import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import type {
  ItemRow,
  LedgerRow,
  LoanRow,
  OfflineOperation,
  OfflineStore,
  PatronRow,
  WorkstationRow,
} from './offlineSync';

type SupabaseClient = ReturnType<typeof getSupabaseAdminClient>;

function fail(scope: string, message: string): never {
  throw new Error(`${scope}: ${message}`);
}

/**
 * postgrest-js does NOT rethrow fetch failures â€” it converts them into a
 * returned `{ error }` whose message is `TypeError: fetch failed\n\nCaused by:
 * ...` and whose `code` is "". A plain `fail()` on those bypasses every retry,
 * which is exactly how one lost response used to stall a whole sync. Any
 * error object that looks network-shaped is re-raised as a real TypeError so
 * withNetRetry/insertResilient/claimLedger see it and retry.
 */
function isNetworkMessage(message: string): boolean {
  if (message.includes('fetch failed')) return true;
  return [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EPIPE',
    'EAI_AGAIN',
    'ENOTFOUND',
    'UND_ERR_SOCKET',
    'UND_ERR_HEADERS_TIMEOUT',
    'UND_ERR_BODY_TIMEOUT',
    'FETCH_ERROR',
  ].some((code) => message.includes(code));
}

function expectOk(scope: string, error: { message: string; code?: string } | null | undefined): void {
  if (!error) return;
  if (isNetworkMessage(error.message)) throw new TypeError('fetch failed');
  fail(scope, error.message);
}

// â”€â”€ network-error resilience â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Supabase REST occasionally fails at the socket level (`TypeError: fetch
// failed` â€” reset/TLS/timeout). supabase-js throws instead of returning an
// error object, which used to surface as a RETRYABLE sync result or, worse,
// as a half-applied checkout. Every store call therefore absorbs transient
// network errors: reads and absolute writes retry directly; read-modify-write
// and insert calls verify committed state before/instead of blind re-running
// so a lost response can never double-apply an effect.
// Budget ≈7.5s of backoff + request time — long enough to ride out the
// multi-second network blips observed during sustained batch sync (perf
// runs saw 2/500 txns exhaust a 1.45s budget); beyond that the client's
// resend loop is the backstop.
const RETRY_DELAYS_MS = [150, 400, 900, 2000, 4000];

export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'TypeError' && err.message.includes('fetch failed')) return true;
  const cause = (err as Error & { cause?: unknown }).cause;
  if (cause && typeof cause === 'object' && 'code' in cause) {
    const code = String((cause as { code?: unknown }).code ?? '');
    return [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'EPIPE',
      'EAI_AGAIN',
      'ENOTFOUND',
      'UND_ERR_SOCKET',
      'UND_ERR_HEADERS_TIMEOUT',
      'UND_ERR_BODY_TIMEOUT',
    ].includes(code);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry a pure read or an absolute (idempotent) write on network errors. */
export async function withNetRetry<T>(op: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await op();
    } catch (err) {
      if (!isNetworkError(err) || attempt >= RETRY_DELAYS_MS.length) throw err;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

/**
 * Insert with lost-response recovery: on a network error, wait, then ask the
 * database whether the row is already there (`verify`). If not, run the insert
 * once more and verify again. Never blind-retries without verifying, so a
 * committed-but-unacknowledged insert cannot duplicate.
 */
async function insertResilient(
  doInsert: () => Promise<void>,
  verify: () => Promise<boolean>,
): Promise<void> {
  try {
    await doInsert();
    return;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    await sleep(300);
    if (await withNetRetry(verify)) return;
    try {
      await doInsert();
    } catch (err2) {
      if (!isNetworkError(err2)) throw err2;
      await sleep(300);
      if (await withNetRetry(verify)) return;
      throw err2;
    }
  }
}

export function createSupabaseOfflineStore(): OfflineStore {
  const supabase: SupabaseClient = getSupabaseAdminClient();

  async function readActiveLoanByPatronItem(patronId: string, itemId: string): Promise<LoanRow | null> {
    const { data, error } = await supabase
      .from('loans')
      .select('id, patron_id, catalogue_item_id, checkout_date, due_date, return_date, renewed_count, status')
      .eq('patron_id', patronId)
      .eq('catalogue_item_id', itemId)
      .in('status', ['active', 'overdue'])
      .order('checkout_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    expectOk('getActiveLoanByPatronItem', error);
    return (data as LoanRow | null) ?? null;
  }

  async function readItemCopies(itemId: string): Promise<number> {
    const { data, error } = await supabase
      .from('catalogue_items')
      .select('available_copies')
      .eq('id', itemId)
      .single();
    expectOk('adjustAvailableCopies', error);
    if (!data) fail('adjustAvailableCopies', 'item not found');
    return (data as { available_copies: number }).available_copies ?? 0;
  }

  async function updateItemCopies(itemId: string, value: number): Promise<void> {
    const { error } = await supabase.from('catalogue_items').update({ available_copies: value }).eq('id', itemId);
    expectOk('adjustAvailableCopies', error);
  }

  async function fineExists(row: { reference_id: string; amount: number }): Promise<boolean> {
    const { data, error } = await supabase
      .from('fines')
      .select('id')
      .eq('reference_id', row.reference_id)
      .eq('amount', row.amount)
      .limit(1)
      .maybeSingle();
    expectOk('insertFine', error);
    return !!data;
  }

  async function notificationExists(row: { patron_id: string; title: string; message: string }): Promise<boolean> {
    const { data, error } = await supabase
      .from('notifications')
      .select('id')
      .eq('patron_id', row.patron_id)
      .eq('title', row.title)
      .eq('message', row.message)
      .limit(1)
      .maybeSingle();
    expectOk('insertPatronNotification', error);
    return !!data;
  }

  return {
    async getLedger(clientTxnId: string): Promise<LedgerRow | null> {
      return withNetRetry(async () => {
        const { data, error } = await supabase
          .from('offline_transactions')
          .select('*')
          .eq('client_txn_id', clientTxnId)
          .maybeSingle();
        expectOk('getLedger', error);
        return (data as LedgerRow | null) ?? null;
      });
    },

    async claimLedger(row: LedgerRow): Promise<boolean> {
      let networkFailures = 0;
      for (;;) {
        try {
          const { error } = await supabase.from('offline_transactions').insert(row);
          if (!error) return true;
          if (error.code === '23505') {
            // First attempt: a concurrent sender owns the claim (designed race).
            // After our own network failure: the "duplicate" may be our lost
            // commit — client_txn_id is unique, so any row is this transaction.
            if (networkFailures === 0) return false;
            const existing = await this.getLedger(row.client_txn_id);
            return existing !== null;
          }
          expectOk('claimLedger', error);
        } catch (err) {
          if (!isNetworkError(err)) throw err;
          networkFailures++;
          if (networkFailures > RETRY_DELAYS_MS.length) throw err;
          await sleep(RETRY_DELAYS_MS[networkFailures - 1]);
        }
      }
    },

    async updateLedger(clientTxnId: string, patch: Partial<LedgerRow>): Promise<void> {
      // Absolute values computed once by the caller â€” safe to replay.
      await withNetRetry(async () => {
        const { error } = await supabase.from('offline_transactions').update(patch).eq('client_txn_id', clientTxnId);
        expectOk('updateLedger', error);
      });
    },

    async upsertWorkstation(ws: WorkstationRow): Promise<void> {
      // Absolute snapshot with onConflict â€” safe to replay.
      await withNetRetry(async () => {
        const { error } = await supabase.from('offline_workstations').upsert(
          {
            device_id: ws.device_id,
            label: ws.label,
            branch: ws.branch,
            registered_by: ws.registered_by,
            last_sync_at: ws.last_sync_at,
            last_seen_at: ws.last_seen_at,
            last_seq: ws.last_seq,
          },
          { onConflict: 'device_id' },
        );
        expectOk('upsertWorkstation', error);
      });
    },

    async getPatron(id: string): Promise<PatronRow | null> {
      return withNetRetry(async () => {
        const { data, error } = await supabase
          .from('patrons')
          .select('id, patron_id, user_id, full_name, email, patron_category, status, membership_expires_at')
          .eq('id', id)
          .maybeSingle();
        expectOk('getPatron', error);
        return (data as PatronRow | null) ?? null;
      });
    },

    async getItem(id: string): Promise<ItemRow | null> {
      return withNetRetry(async () => {
        const { data, error } = await supabase
          .from('catalogue_items')
          .select('id, title, available_copies, total_copies')
          .eq('id', id)
          .maybeSingle();
        expectOk('getItem', error);
        return (data as ItemRow | null) ?? null;
      });
    },

    async countActiveLoans(patronId: string): Promise<number> {
      return withNetRetry(async () => {
        const { count, error } = await supabase
          .from('loans')
          .select('id', { count: 'exact', head: true })
          .eq('patron_id', patronId)
          .in('status', ['active', 'overdue']);
        expectOk('countActiveLoans', error);
        return count ?? 0;
      });
    },

    async getActiveLoanByItem(itemId: string): Promise<LoanRow | null> {
      return withNetRetry(async () => {
        const { data, error } = await supabase
          .from('loans')
          .select('id, patron_id, catalogue_item_id, checkout_date, due_date, return_date, renewed_count, status')
          .eq('catalogue_item_id', itemId)
          .in('status', ['active', 'overdue'])
          .order('checkout_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        expectOk('getActiveLoanByItem', error);
        return (data as LoanRow | null) ?? null;
      });
    },

    async getActiveLoanByPatronItem(patronId: string, itemId: string): Promise<LoanRow | null> {
      return withNetRetry(() => readActiveLoanByPatronItem(patronId, itemId));
    },

    async getLoan(loanId: string): Promise<LoanRow | null> {
      return withNetRetry(async () => {
        const { data, error } = await supabase
          .from('loans')
          .select('id, patron_id, catalogue_item_id, checkout_date, due_date, return_date, renewed_count, status')
          .eq('id', loanId)
          .maybeSingle();
        expectOk('getLoan', error);
        return (data as LoanRow | null) ?? null;
      });
    },

    async hasForeignPendingHold(itemId: string, patronId: string): Promise<boolean> {
      return withNetRetry(async () => {
        const { count, error } = await supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('catalogue_item_id', itemId)
          .neq('patron_id', patronId)
          .in('status', ['pending', 'ready_for_collection']);
        expectOk('hasForeignPendingHold', error);
        return (count ?? 0) > 0;
      });
    },

    async insertLoan(row: {
      patron_id: string;
      catalogue_item_id: string;
      checkout_date: string;
      due_date: string;
    }): Promise<string> {
      const doInsert = async () => {
        const { data, error } = await supabase
          .from('loans')
          .insert({ ...row, status: 'active' })
          .select('id')
          .single();
        expectOk('insertLoan', error);
        if (!data) fail('insertLoan', 'no id returned');
        return (data as { id: string }).id;
      };
      try {
        return await doInsert();
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        // Lost response: if the loan actually committed, its checkout_date
        // matches this transaction's timestamp â€” return that id instead of
        // inserting again. If nothing committed, rethrow so the client sees a
        // clean RETRYABLE with no side effects.
        await sleep(300);
        const existing = await withNetRetry(() => readActiveLoanByPatronItem(row.patron_id, row.catalogue_item_id));
        if (existing && existing.checkout_date === row.checkout_date) return existing.id;
        throw err;
      }
    },

    async setLoanReturned(loanId: string, returnDate: string): Promise<void> {
      // Absolute values â€” safe to replay.
      await withNetRetry(async () => {
        const { error } = await supabase
          .from('loans')
          .update({ return_date: returnDate, status: 'returned', updated_at: new Date().toISOString() })
          .eq('id', loanId);
        expectOk('setLoanReturned', error);
      });
    },

    async setLoanRenewed(loanId: string, dueDate: string): Promise<void> {
      const renewOnce = async () => {
        const { data: loan, error: readErr } = await supabase
          .from('loans')
          .select('renewed_count')
          .eq('id', loanId)
          .single();
        if (readErr || !loan) {
          expectOk('setLoanRenewed', readErr);
          if (!loan) fail('setLoanRenewed', 'loan not found');
        }
        const current = (loan as { renewed_count: number | null }).renewed_count ?? 0;
        const { error } = await supabase
          .from('loans')
          .update({
            due_date: dueDate,
            renewed_count: current + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', loanId);
        expectOk('setLoanRenewed', error);
      };
      try {
        await renewOnce();
        return;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        // due_date is the marker of a committed renewal.
        await sleep(300);
        const check = await withNetRetry(async () => {
          const { data } = await supabase.from('loans').select('due_date').eq('id', loanId).maybeSingle();
          return (data as { due_date: string | null } | null)?.due_date ?? null;
        });
        if (check === dueDate) return;
        try {
          await renewOnce();
        } catch (err2) {
          if (!isNetworkError(err2)) throw err2;
          await sleep(300);
          const check2 = await withNetRetry(async () => {
            const { data } = await supabase.from('loans').select('due_date').eq('id', loanId).maybeSingle();
            return (data as { due_date: string | null } | null)?.due_date ?? null;
          });
          if (check2 === dueDate) return;
          throw err2;
        }
      }
    },

    async adjustAvailableCopies(itemId: string, delta: number): Promise<void> {
      const prev = await withNetRetry(() => readItemCopies(itemId));
      const next = Math.max(0, prev + delta);
      try {
        await updateItemCopies(itemId, next);
        return;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        await sleep(300);
        const nowValue = await withNetRetry(() => readItemCopies(itemId));
        if (nowValue === next) return; // committed, response was lost
        if (nowValue !== prev) {
          fail('adjustAvailableCopies', 'available_copies changed concurrently during retry');
        }
        // Previous update truly did not commit â€” safe to run it once more
        // from the freshly read value.
        const retryNext = Math.max(0, nowValue + delta);
        try {
          await updateItemCopies(itemId, retryNext);
        } catch (err2) {
          if (!isNetworkError(err2)) throw err2;
          await sleep(300);
          const finalValue = await withNetRetry(() => readItemCopies(itemId));
          if (finalValue === retryNext) return;
          throw err2;
        }
      }
    },

    async insertCirculationTx(row: {
      transaction_type: OfflineOperation;
      patron_id: string;
      catalogue_item_id: string;
      loan_id: string;
      performed_by: string;
      offline_id: string;
      synced_at: string;
      notes: string;
    }): Promise<void> {
      // offline_id is unique (uq_circulation_transactions_offline_id): a blind
      // retry after a lost response converges on the existing row via 23505.
      await withNetRetry(async () => {
        const { error } = await supabase.from('circulation_transactions').insert({
          transaction_type: row.transaction_type === 'renew' ? 'renew' : row.transaction_type,
          patron_id: row.patron_id,
          catalogue_item_id: row.catalogue_item_id,
          loan_id: row.loan_id,
          performed_by: row.performed_by,
          offline_id: row.offline_id,
          synced_at: row.synced_at,
          notes: row.notes,
        });
        if (error && error.code === '23505') return; // unique offline_id — committed
        expectOk('insertCirculationTx', error);
      });
    },

    async insertFine(row: {
      patron_id: string;
      amount: number;
      reason: string;
      reference_id: string;
    }): Promise<void> {
      const doInsert = async () => {
        const { error } = await supabase.from('fines').insert({
          patron_id: row.patron_id,
          amount: row.amount,
          reason: row.reason,
          reference_type: 'loan',
          reference_id: row.reference_id,
          status: 'unpaid',
        });
        expectOk('insertFine', error);
      };
      await insertResilient(doInsert, () => fineExists(row));
    },

    async insertPatronNotification(row: {
      patron_id: string;
      title: string;
      message: string;
      type: string;
    }): Promise<void> {
      const doInsert = async () => {
        const { error } = await supabase.from('notifications').insert({
          patron_id: row.patron_id,
          title: row.title,
          message: row.message,
          type: row.type,
        });
        expectOk('insertPatronNotification', error);
      };
      await insertResilient(doInsert, () => notificationExists(row));
    },

    async getAppliedCirculationByOfflineId(offlineId: string): Promise<{ id: string } | null> {
      return withNetRetry(async () => {
        const { data, error } = await supabase
          .from('circulation_transactions')
          .select('id')
          .eq('offline_id', offlineId)
          .maybeSingle();
        expectOk('getAppliedCirculationByOfflineId', error);
        return (data as { id: string } | null) ?? null;
      });
    },

    async promoteNextHold(
      itemId: string,
      itemTitle: string,
    ): Promise<{ hold_id: string; patron_user_id: string | null; patron_id: string } | null> {
      const nextHold = await withNetRetry(async () => {
        const { data, error } = await supabase
          .from('reservations')
          .select('id, patron_id, patrons(user_id)')
          .eq('catalogue_item_id', itemId)
          .eq('status', 'pending')
          .order('priority', { ascending: true })
          .limit(1)
          .maybeSingle();
        expectOk('promoteNextHold', error);
        return data;
      });
      if (!nextHold) return null;

      const hold = nextHold as {
        id: string;
        patron_id: string;
        patrons: { user_id: string | null } | { user_id: string | null }[] | null;
      };
      // Absolute status transition guarded by eq(id) â€” safe to replay.
      await withNetRetry(async () => {
        const { error: updateErr } = await supabase
          .from('reservations')
          .update({ status: 'ready_for_collection', notify_sent: true, updated_at: new Date().toISOString() })
          .eq('id', hold.id);
        expectOk('promoteNextHold', updateErr);
      });

      const holdNotice = {
        patron_id: hold.patron_id,
        title: 'Hold Available',
        message: `"${itemTitle}" is now available for collection. Please collect within 3 days.`,
        type: 'hold',
      };
      await insertResilient(
        async () => {
          const { error } = await supabase.from('notifications').insert(holdNotice);
          expectOk('promoteNextHold', error);
        },
        () => notificationExists(holdNotice),
      );

      const patronsRow = Array.isArray(hold.patrons) ? hold.patrons[0] : hold.patrons;
      return { hold_id: hold.id, patron_user_id: patronsRow?.user_id ?? null, patron_id: hold.patron_id };
    },
  };
}
