import { describe, it, expect } from 'vitest';
import {
  syncOfflineBatch,
  resolveOfflineTransaction,
  BatchValidationError,
  canRecoverQueue,
  MAX_BATCH_SIZE,
  PENDING_CLAIM_TTL_MS,
  type OfflineStore,
  type LedgerRow,
  type PatronRow,
  type ItemRow,
  type LoanRow,
  type OfflineBatchInput,
  type OfflineTxInput,
  type SyncContext,
  type AppliedHook,
  type ResolveEvent,
  type WorkstationRow,
} from './offlineSync';
import { rulesFingerprint, OFFLINE_CACHE_MAX_AGE_HOURS } from '@/lib/circulationRules';

// ── Deterministic ids ─────────────────────────────────────────────────────────
let seq = 0;
function uuid(): string {
  seq += 1;
  const hex = seq.toString(16).padStart(8, '0');
  return `${hex}-0000-4000-8000-000000000000`;
}

const NOW = new Date('2026-10-04T12:00:00.000Z');

// ── In-memory OfflineStore fake ──────────────────────────────────────────────
interface FakeHold {
  id: string;
  item_id: string;
  patron_id: string;
  patron_user_id: string | null;
  status: string;
  priority: number;
}

class FakeStore implements OfflineStore {
  ledger = new Map<string, LedgerRow>();
  patrons = new Map<string, PatronRow>();
  items = new Map<string, ItemRow>();
  loans = new Map<string, LoanRow>();
  holds: FakeHold[] = [];
  circulationTxs: Array<Record<string, unknown>> = [];
  fines: Array<Record<string, unknown>> = [];
  notifications: Array<Record<string, unknown>> = [];
  workstations: WorkstationRow[] = [];
  failInsertLoan = false;
  private loanSeq = 0;

  async getLedger(id: string) {
    // Mirror the production store: each read returns a fresh copy, never a
    // live reference that later patches mutate underneath the caller.
    const row = this.ledger.get(id);
    return row ? { ...row } : null;
  }
  async claimLedger(row: LedgerRow) {
    if (this.ledger.has(row.client_txn_id)) return false;
    this.ledger.set(row.client_txn_id, { ...row });
    return true;
  }
  async updateLedger(id: string, patch: Partial<LedgerRow>) {
    const row = this.ledger.get(id);
    if (row) Object.assign(row, patch);
  }
  async upsertWorkstation(ws: WorkstationRow) {
    const i = this.workstations.findIndex((w) => w.device_id === ws.device_id);
    if (i >= 0) this.workstations[i] = ws;
    else this.workstations.push(ws);
  }
  async getPatron(id: string) {
    return this.patrons.get(id) ?? null;
  }
  async getItem(id: string) {
    return this.items.get(id) ?? null;
  }
  async countActiveLoans(patronId: string) {
    return [...this.loans.values()].filter(
      (l) => l.patron_id === patronId && (l.status === 'active' || l.status === 'overdue'),
    ).length;
  }
  async getActiveLoanByItem(itemId: string) {
    return (
      [...this.loans.values()].find(
        (l) => l.catalogue_item_id === itemId && (l.status === 'active' || l.status === 'overdue'),
      ) ?? null
    );
  }
  async getActiveLoanByPatronItem(patronId: string, itemId: string) {
    return (
      [...this.loans.values()].find(
        (l) =>
          l.patron_id === patronId &&
          l.catalogue_item_id === itemId &&
          (l.status === 'active' || l.status === 'overdue'),
      ) ?? null
    );
  }
  async getLoan(id: string) {
    return this.loans.get(id) ?? null;
  }
  async hasForeignPendingHold(itemId: string, patronId: string) {
    return this.holds.some((h) => h.item_id === itemId && h.patron_id !== patronId && h.status === 'pending');
  }
  async insertLoan(row: { patron_id: string; catalogue_item_id: string; checkout_date: string; due_date: string }) {
    if (this.failInsertLoan) throw new Error('insertLoan: simulated store failure');
    this.loanSeq += 1;
    const id = `loan-${this.loanSeq}`;
    this.loans.set(id, { id, return_date: null, renewed_count: 0, status: 'active', ...row });
    return id;
  }
  async setLoanReturned(loanId: string, returnDate: string) {
    const loan = this.loans.get(loanId);
    if (loan) {
      loan.status = 'returned';
      loan.return_date = returnDate;
    }
  }
  async setLoanRenewed(loanId: string, dueDate: string) {
    const loan = this.loans.get(loanId);
    if (loan) {
      loan.due_date = dueDate;
      loan.renewed_count += 1;
    }
  }
  async adjustAvailableCopies(itemId: string, delta: number) {
    const item = this.items.get(itemId);
    if (item) item.available_copies += delta;
  }
  async insertCirculationTx(row: Record<string, unknown>) {
    this.circulationTxs.push(row);
  }
  async getAppliedCirculationByOfflineId(offlineId: string) {
    const row = this.circulationTxs.find((r) => r.offline_id === offlineId);
    return row ? { id: `circ-${String(offlineId).slice(0, 8)}` } : null;
  }
  async insertFine(row: Record<string, unknown>) {
    this.fines.push(row);
  }
  async insertPatronNotification(row: Record<string, unknown>) {
    this.notifications.push(row);
  }
  async promoteNextHold(itemId: string, _itemTitle: string): Promise<AppliedHook['hold_ready'] | null> {
    const next = this.holds
      .filter((h) => h.item_id === itemId && h.status === 'pending')
      .sort((a, b) => a.priority - b.priority)[0];
    if (!next) return null;
    next.status = 'ready_for_collection';
    return { hold_id: next.id, patron_user_id: next.patron_user_id, patron_id: next.patron_id };
  }

  // ── seed helpers
  seedPatron(over: Partial<PatronRow> = {}): PatronRow {
    const row: PatronRow = {
      id: 'patron-1',
      patron_id: 'PL-0001',
      user_id: 'user-1',
      full_name: 'Amaka Obi',
      email: 'amaka@example.com',
      patron_category: 'undergraduate',
      status: 'active',
      membership_expires_at: null,
      ...over,
    };
    this.patrons.set(row.id, row);
    return row;
  }
  seedItem(over: Partial<ItemRow> = {}): ItemRow {
    const row: ItemRow = {
      id: 'item-1',
      title: 'Physics for Engineers',
      available_copies: 2,
      total_copies: 3,
      ...over,
    };
    this.items.set(row.id, row);
    return row;
  }
  seedLoan(over: Partial<LoanRow> = {}): LoanRow {
    const row: LoanRow = {
      id: 'loan-x',
      patron_id: 'patron-1',
      catalogue_item_id: 'item-1',
      checkout_date: '2026-09-20T09:00:00.000Z',
      due_date: '2026-10-18',
      return_date: null,
      renewed_count: 0,
      status: 'active',
      ...over,
    };
    this.loans.set(row.id, row);
    return row;
  }
}

// ── context helper with hook collectors ──────────────────────────────────────
function makeCtx(over: Partial<SyncContext> = {}) {
  const applied: AppliedHook[] = [];
  const resolved: ResolveEvent[] = [];
  const ctx: SyncContext = {
    operatorId: 'op-a',
    roles: ['librarian'],
    now: () => NOW,
    hooks: {
      onApplied: (h) => {
        applied.push(h);
      },
      onResolved: (e) => {
        resolved.push(e);
      },
    },
    ...over,
  };
  return { ctx, applied, resolved };
}

function tx(
  localSeq: number,
  operation: OfflineTxInput['operation'],
  payload: Record<string, unknown>,
  over: Partial<OfflineTxInput> = {},
): OfflineTxInput {
  return {
    client_txn_id: uuid(),
    local_seq: localSeq,
    operation,
    client_timestamp: '2026-10-04T09:00:00.000Z',
    payload,
    ...over,
  };
}

function batch(transactions: OfflineTxInput[], over: Partial<OfflineBatchInput> = {}): OfflineBatchInput {
  return { device_id: 'device-1', branch: 'main', transactions, ...over };
}

// ════════════════════════════════════════════════════════════════════════════
describe('offline sync engine — queued operations apply durably', () => {
  it('applies a queued checkout: creates loan, decrements copies, records tx, fires hook once', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem();
    const { ctx, applied } = makeCtx();
    const t = tx(1, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-1' });

    const summary = await syncOfflineBatch(batch([t]), ctx, store);

    expect(summary.applied).toBe(1);
    expect(summary.conflicts).toBe(0);
    const loan = [...store.loans.values()][0];
    expect(loan).toBeDefined();
    expect(loan.patron_id).toBe('patron-1');
    expect(loan.due_date).toBe('2026-10-18'); // 14 days for undergraduate
    expect(store.items.get('item-1')!.available_copies).toBe(1);
    expect(store.circulationTxs).toHaveLength(1);
    expect(store.circulationTxs[0]).toMatchObject({
      transaction_type: 'checkout',
      patron_id: 'patron-1',
      loan_id: loan.id,
      performed_by: 'op-a',
      offline_id: t.client_txn_id,
    });
    expect(applied).toHaveLength(1);
    expect(applied[0]).toMatchObject({
      operation: 'checkout',
      client_txn_id: t.client_txn_id,
      device_id: 'device-1',
      operator_id: 'op-a',
      due_date: '2026-10-18',
    });
    const row = await store.getLedger(t.client_txn_id);
    expect(row!.status).toBe('APPLIED');
    expect(row!.server_entity_id).toBe(loan.id);
  });

  it('a failed loan insert leaves no side effects; the client retry then applies cleanly', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem({ available_copies: 1 });
    const { ctx, applied } = makeCtx();
    const t = tx(1, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-1' });

    store.failInsertLoan = true;
    const first = await syncOfflineBatch(batch([t]), ctx, store);
    expect(first.results[0]!.status).toBe('RETRYABLE_ERROR');
    expect(store.items.get('item-1')!.available_copies).toBe(1); // no orphan decrement
    expect(store.loans.size).toBe(0);
    expect(store.circulationTxs).toHaveLength(0);
    expect(applied).toHaveLength(0);
    expect((await store.getLedger(t.client_txn_id))!.status).toBe('RETRYABLE_ERROR');

    store.failInsertLoan = false;
    const retry = await syncOfflineBatch(batch([t]), ctx, store);
    expect(retry.results[0]!.status).toBe('APPLIED');
    expect(store.items.get('item-1')!.available_copies).toBe(0);
    expect(store.loans.size).toBe(1);
    expect(store.circulationTxs).toHaveLength(1);
    expect(applied).toHaveLength(1);
    expect((await store.getLedger(t.client_txn_id))!.status).toBe('APPLIED');
  });

  it('recovers a partial checkout (loan + copies committed, circulation row missing)', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem({ available_copies: 0 });
    // Simulate the sequential write order failing at the last step:
    const checkoutIso = new Date('2026-10-04T09:00:00.000Z').toISOString();
    store.seedLoan({ id: 'loan-partial', checkout_date: checkoutIso });
    const { ctx, applied } = makeCtx();
    const t = tx(1, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-1' });

    const summary = await syncOfflineBatch(batch([t]), ctx, store);
    expect(summary.results[0]!.status).toBe('APPLIED');
    expect(summary.results[0]!.server_entity_id).toBe('loan-partial');
    expect(store.loans.size).toBe(1); // no duplicate loan
    expect(store.items.get('item-1')!.available_copies).toBe(0); // not decremented twice
    expect(store.circulationTxs).toHaveLength(1); // missing row completed
    expect(store.circulationTxs[0]).toMatchObject({ offline_id: t.client_txn_id, loan_id: 'loan-partial' });
    expect(applied).toHaveLength(1); // hooks fire exactly once
  });

  it('a prior circulation row short-circuits to ALREADY_APPLIED (lost-response replay)', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem({ available_copies: 0 });
    store.seedLoan({ id: 'loan-done' });
    const priorTxn = '3f1a9c2e-6b4d-4a8f-9c1e-8d7b5a2f4e10';
    store.circulationTxs.push({ offline_id: priorTxn, loan_id: 'loan-done' });
    const { ctx, applied } = makeCtx();
    const t = tx(1, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-1' }, { client_txn_id: priorTxn });

    const summary = await syncOfflineBatch(batch([t]), ctx, store);
    expect(summary.results[0]!.status).toBe('ALREADY_APPLIED');
    expect(store.loans.size).toBe(1);
    expect(store.circulationTxs).toHaveLength(1);
    expect(applied).toHaveLength(0);
  });

  it('applies a queued checkin: returns loan, increments copies, promotes next hold', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem({ available_copies: 1 });
    store.seedLoan({ id: 'loan-1', status: 'active', due_date: '2026-12-01' });
    store.holds.push({
      id: 'hold-9',
      item_id: 'item-1',
      patron_id: 'patron-2',
      patron_user_id: 'user-2',
      status: 'pending',
      priority: 1,
    });
    const { ctx, applied } = makeCtx();
    const t = tx(1, 'checkin', {
      loan_id: 'loan-1',
      patron_id: 'patron-1',
      catalogue_item_id: 'item-1',
    });

    const summary = await syncOfflineBatch(batch([t]), ctx, store);

    expect(summary.applied).toBe(1);
    const loan = store.loans.get('loan-1')!;
    expect(loan.status).toBe('returned');
    expect(loan.return_date).toBe('2026-10-04T09:00:00.000Z');
    expect(store.items.get('item-1')!.available_copies).toBe(2);
    expect(store.fines).toHaveLength(0);
    expect(store.holds[0].status).toBe('ready_for_collection');
    expect(applied[0].hold_ready).toEqual({
      hold_id: 'hold-9',
      patron_user_id: 'user-2',
      patron_id: 'patron-2',
    });
  });

  it('overdue checkin inserts a fine and a patron notification', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem();
    store.seedLoan({ id: 'loan-late', status: 'active', due_date: '2026-09-01' });
    const { ctx } = makeCtx();
    const t = tx(1, 'checkin', {
      loan_id: 'loan-late',
      patron_id: 'patron-1',
      catalogue_item_id: 'item-1',
    });

    const summary = await syncOfflineBatch(batch([t]), ctx, store);

    expect(summary.applied).toBe(1);
    expect(store.fines).toHaveLength(1);
    expect(store.fines[0].amount as number).toBeGreaterThan(0);
    expect(store.fines[0].reference_id).toBe('loan-late');
    expect(store.notifications).toHaveLength(1);
    expect(store.notifications[0]).toMatchObject({ type: 'fine', patron_id: 'patron-1' });
    expect(String(store.circulationTxs[0].notes)).toContain('fine applied');
  });

  it('applies a queued renew: extends due date, increments renewed_count', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem();
    store.seedLoan({ id: 'loan-r', status: 'active', due_date: '2026-11-01', renewed_count: 1 });
    const { ctx, applied } = makeCtx();
    const t = tx(1, 'renew', {
      loan_id: 'loan-r',
      patron_id: 'patron-1',
      catalogue_item_id: 'item-1',
    });

    const summary = await syncOfflineBatch(batch([t]), ctx, store);

    expect(summary.applied).toBe(1);
    const loan = store.loans.get('loan-r')!;
    expect(loan.renewed_count).toBe(2);
    expect(loan.due_date).toBe('2026-10-18'); // from server now, undergraduate 14 days
    expect(store.circulationTxs[0]).toMatchObject({ transaction_type: 'renew', offline_id: t.client_txn_id });
    expect(applied[0]).toMatchObject({ operation: 'renew', due_date: '2026-10-18' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('offline sync engine — idempotency, ordering, partial batches', () => {
  it('duplicate sync of the same client_txn_id is idempotent (ALREADY_APPLIED, hooks once)', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem();
    const { ctx, applied } = makeCtx();
    const t = tx(1, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-1' });

    const first = await syncOfflineBatch(batch([t]), ctx, store);
    const second = await syncOfflineBatch(batch([t]), ctx, store);

    expect(first.applied).toBe(1);
    expect(second.already_applied).toBe(1);
    expect(second.applied).toBe(0);
    expect(store.loans.size).toBe(1);
    expect(store.items.get('item-1')!.available_copies).toBe(1);
    expect(applied).toHaveLength(1); // notices/analytics fire only on first apply
  });

  it('applies transactions in local_seq order even when the batch arrives unordered', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem({ id: 'item-a', available_copies: 1 });
    store.seedItem({ id: 'item-b', available_copies: 1 });
    const { ctx } = makeCtx();
    const t2 = tx(2, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-b' });
    const t1 = tx(1, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-a' });

    const summary = await syncOfflineBatch(batch([t2, t1]), ctx, store);

    expect(summary.applied).toBe(2);
    expect(store.circulationTxs.map((c) => c.catalogue_item_id)).toEqual(['item-a', 'item-b']);
    expect((await store.getLedger(t1.client_txn_id))!.local_seq).toBe(1);
  });

  it('a conflict in one transaction does not block the rest of the batch (partial batch)', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem({ id: 'item-out', available_copies: 1 });
    store.seedItem({ id: 'item-free', available_copies: 1 });
    store.seedLoan({ id: 'loan-other', patron_id: 'someone-else', catalogue_item_id: 'item-out', status: 'active' });
    const { ctx, applied } = makeCtx();
    const conflictTx = tx(1, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-out' });
    const validTx = tx(2, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-free' });

    const summary = await syncOfflineBatch(batch([conflictTx, validTx]), ctx, store);

    expect(summary.conflicts).toBe(1);
    expect(summary.applied).toBe(1);
    expect(summary.results[0].conflict_code).toBe('ITEM_CHECKED_OUT_TO_DIFFERENT_PATRON');
    expect(summary.results[1].status).toBe('APPLIED');
    expect(applied).toHaveLength(1);
    expect(applied[0].catalogue_item_id).toBe('item-free');
    expect(store.loans.size).toBe(2); // pre-existing + newly applied
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('offline sync engine — conflicts and eligibility', () => {
  it('item checked out to a different patron → CONFLICT ITEM_CHECKED_OUT_TO_DIFFERENT_PATRON', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem({ available_copies: 1 });
    store.seedLoan({ patron_id: 'someone-else', status: 'active' });
    const { ctx } = makeCtx();
    const t = tx(1, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-1' });

    const summary = await syncOfflineBatch(batch([t]), ctx, store);

    expect(summary.conflicts).toBe(1);
    expect(summary.results[0].conflict_code).toBe('ITEM_CHECKED_OUT_TO_DIFFERENT_PATRON');
    const row = await store.getLedger(t.client_txn_id);
    expect(row!.status).toBe('CONFLICT');
    expect(store.loans.size).toBe(1); // no new loan
  });

  it('suspended patron → CONFLICT PATRON_BLOCKED', async () => {
    const store = new FakeStore();
    store.seedPatron({ status: 'suspended' });
    store.seedItem();
    const { ctx, applied } = makeCtx();
    const t = tx(1, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-1' });

    const summary = await syncOfflineBatch(batch([t]), ctx, store);

    expect(summary.conflicts).toBe(1);
    expect(summary.results[0].conflict_code).toBe('PATRON_BLOCKED');
    expect(applied).toHaveLength(0);
    expect(store.loans.size).toBe(0);
  });

  it('check-in of an already-returned loan → ALREADY_APPLIED with no duplicate side effects', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem();
    store.seedLoan({ id: 'loan-done', status: 'returned', return_date: '2026-10-01T10:00:00.000Z', due_date: '2026-09-01' });
    const { ctx, applied } = makeCtx();
    const t = tx(1, 'checkin', { loan_id: 'loan-done', patron_id: 'patron-1', catalogue_item_id: 'item-1' });

    const summary = await syncOfflineBatch(batch([t]), ctx, store);

    expect(summary.already_applied).toBe(1);
    expect(summary.applied).toBe(0);
    expect(store.fines).toHaveLength(0); // no fine for a loan already closed
    expect(store.items.get('item-1')!.available_copies).toBe(2); // unchanged
    expect(applied).toHaveLength(0); // no hooks for already-returned
  });

  it('max loans → CONFLICT MAX_LOANS_REACHED; librarian override with note applies', async () => {
    const store = new FakeStore();
    store.seedPatron({ patron_category: 'undergraduate' }); // max 4
    store.seedItem();
    for (let i = 1; i <= 4; i += 1) {
      store.seedLoan({ id: `loan-full-${i}`, catalogue_item_id: `other-item-${i}`, status: 'active', due_date: '2026-12-01' });
    }
    const { ctx, applied, resolved } = makeCtx();
    const t = tx(1, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-1' });

    const conflict = await syncOfflineBatch(batch([t]), ctx, store);
    expect(conflict.conflicts).toBe(1);
    expect(conflict.results[0].conflict_code).toBe('MAX_LOANS_REACHED');
    expect(applied).toHaveLength(0);

    const outcome = await resolveOfflineTransaction(
      { client_txn_id: t.client_txn_id, action: 'override', note: 'Head of department approved extra loan.' },
      ctx,
      store,
    );

    expect(outcome.status).toBe('APPLIED');
    expect(outcome.client_action).toBe('remove');
    expect(store.loans.size).toBe(5);
    expect(applied).toHaveLength(1); // fired only after the override applied
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ action: 'override', actor_id: 'op-a', conflict_code: 'MAX_LOANS_REACHED' });
    const row = await store.getLedger(t.client_txn_id);
    expect(row!.status).toBe('APPLIED');
    expect(row!.resolution).toBe('override');
    expect(row!.resolution_note).toContain('approved');
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('offline sync engine — renewal holds and override rules', () => {
  it('renewal blocked by a foreign pending hold → CONFLICT HOLD_CONFLICT; override with note applies', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem();
    store.seedLoan({ id: 'loan-h', status: 'active', due_date: '2026-11-10' });
    store.holds.push({
      id: 'hold-other',
      item_id: 'item-1',
      patron_id: 'patron-2',
      patron_user_id: null,
      status: 'pending',
      priority: 1,
    });
    const { ctx, applied, resolved } = makeCtx();
    const t = tx(1, 'renew', { loan_id: 'loan-h', patron_id: 'patron-1', catalogue_item_id: 'item-1' });

    const conflict = await syncOfflineBatch(batch([t]), ctx, store);
    expect(conflict.conflicts).toBe(1);
    expect(conflict.results[0].conflict_code).toBe('HOLD_CONFLICT');
    expect(store.loans.get('loan-h')!.renewed_count).toBe(0);
    expect(applied).toHaveLength(0);

    const outcome = await resolveOfflineTransaction(
      { client_txn_id: t.client_txn_id, action: 'override', note: 'Borrower and holder agreed to extend.' },
      ctx,
      store,
    );

    expect(outcome.status).toBe('APPLIED');
    expect(store.loans.get('loan-h')!.renewed_count).toBe(1);
    expect(applied).toHaveLength(1);
    expect(resolved[0].action).toBe('override');
  });

  it('override requires a note and only allow-listed conflict codes', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem();
    store.seedLoan({ id: 'loan-o', status: 'active', due_date: '2026-11-10' });
    store.holds.push({
      id: 'hold-x',
      item_id: 'item-1',
      patron_id: 'patron-2',
      patron_user_id: null,
      status: 'pending',
      priority: 1,
    });
    const { ctx } = makeCtx();
    const holdConflictTx = tx(1, 'renew', { loan_id: 'loan-o', patron_id: 'patron-1', catalogue_item_id: 'item-1' });
    await syncOfflineBatch(batch([holdConflictTx]), ctx, store);

    // 1) note is mandatory
    await expect(
      resolveOfflineTransaction({ client_txn_id: holdConflictTx.client_txn_id, action: 'override', note: '   ' }, ctx, store),
    ).rejects.toThrow(BatchValidationError);

    // 2) LOAN_OVERDUE is not overridable
    const overdueLoan = store.seedLoan({ id: 'loan-od', status: 'active', due_date: '2026-09-20' });
    const overdueTx = tx(2, 'renew', { loan_id: overdueLoan.id, patron_id: 'patron-1', catalogue_item_id: 'item-1' });
    const od = await syncOfflineBatch(batch([overdueTx]), ctx, store);
    expect(od.results[0].conflict_code).toBe('LOAN_OVERDUE');
    await expect(
      resolveOfflineTransaction({ client_txn_id: overdueTx.client_txn_id, action: 'override', note: 'late renewal' }, ctx, store),
    ).rejects.toThrow(/cannot be overridden/i);

    // 3) allow-listed code with a note succeeds
    const ok = await resolveOfflineTransaction(
      { client_txn_id: holdConflictTx.client_txn_id, action: 'override', note: 'agreed extension' },
      ctx,
      store,
    );
    expect(ok.status).toBe('APPLIED');
  });

  it('renewal limit reached → CONFLICT RENEWAL_LIMIT_REACHED (overridable)', async () => {
    const store = new FakeStore();
    store.seedPatron({ patron_category: 'undergraduate' }); // renewals: 2
    store.seedItem();
    store.seedLoan({ id: 'loan-rr', status: 'active', due_date: '2026-11-10', renewed_count: 2 });
    const { ctx } = makeCtx();
    const t = tx(1, 'renew', { loan_id: 'loan-rr', patron_id: 'patron-1', catalogue_item_id: 'item-1' });

    const summary = await syncOfflineBatch(batch([t]), ctx, store);

    expect(summary.conflicts).toBe(1);
    expect(summary.results[0].conflict_code).toBe('RENEWAL_LIMIT_REACHED');
    expect(store.loans.get('loan-rr')!.renewed_count).toBe(2);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('offline sync engine — cache freshness, rules fingerprint, operator safety', () => {
  it('guards stale cache (STALE_CACHE) and changed rules (RULE_CHANGED); fresh cache applies', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem();
    const { ctx } = makeCtx();

    const staleAt = new Date(NOW.getTime() - (OFFLINE_CACHE_MAX_AGE_HOURS + 24) * 3600_000).toISOString();
    const staleTx = tx(1, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-1' }, { cache_fetched_at: staleAt });
    const stale = await syncOfflineBatch(batch([staleTx]), ctx, store);
    expect(stale.results[0].conflict_code).toBe('STALE_CACHE');

    const badRulesTx = tx(
      2,
      'checkout',
      { patron_id: 'patron-1', catalogue_item_id: 'item-1', rules_fingerprint: 'deadbeefdeadbeef' },
      { cache_fetched_at: NOW.toISOString() },
    );
    const badRules = await syncOfflineBatch(batch([badRulesTx]), ctx, store);
    expect(badRules.results[0].conflict_code).toBe('RULE_CHANGED');

    const freshTx = tx(
      3,
      'checkout',
      { patron_id: 'patron-1', catalogue_item_id: 'item-1', rules_fingerprint: rulesFingerprint() },
      { cache_fetched_at: NOW.toISOString() },
    );
    const fresh = await syncOfflineBatch(batch([freshTx]), ctx, store);
    expect(fresh.applied).toBe(1);
    expect(store.loans.size).toBe(1);
  });

  it('different queued_by is rejected without a recovery role; librarian can recover the queue', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem({ id: 'item-a', available_copies: 1 });
    store.seedItem({ id: 'item-b', available_copies: 1 });
    expect(canRecoverQueue(['faculty_librarian'])).toBe(false);
    expect(canRecoverQueue(['librarian'])).toBe(true);

    const { ctx: limitedCtx } = makeCtx({ roles: ['faculty_librarian'] });
    const foreignTx = tx(1, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-a' }, { queued_by: 'op-b' });
    const rejected = await syncOfflineBatch(batch([foreignTx]), limitedCtx, store);
    expect(rejected.rejected).toBe(1);
    expect(rejected.results[0].conflict_code).toBe('OPERATOR_MISMATCH');
    expect(store.loans.size).toBe(0);

    const { ctx: recoveryCtx } = makeCtx({ roles: ['librarian'] });
    const secondTx = tx(2, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-b' }, { queued_by: 'op-b' });
    const recovered = await syncOfflineBatch(batch([secondTx]), recoveryCtx, store);
    expect(recovered.applied).toBe(1);
    expect(store.loans.size).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('offline sync engine — concurrent claim and retry resolution', () => {
  it('fresh PENDING claim → RETRYABLE SYNC_IN_PROGRESS; resolve retry requeues and applies', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem();
    const { ctx, applied } = makeCtx();
    const t = tx(1, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-1' });

    // Simulate another sync request holding a fresh PENDING claim (< TTL).
    await store.claimLedger({
      client_txn_id: t.client_txn_id,
      device_id: 'device-1',
      operator_id: 'other-op',
      queued_by: null,
      branch: '',
      operation: 'checkout',
      local_seq: 1,
      payload: t.payload,
      client_timestamp: null,
      cache_fetched_at: null,
      status: 'PENDING',
      conflict_code: null,
      message: '',
      server_entity_id: null,
      attempts: 1,
      last_error: null,
      resolution: null,
      resolution_note: null,
      resolved_by: null,
      resolved_at: null,
      applied_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(), // now → inside PENDING_CLAIM_TTL_MS
    });

    const busy = await syncOfflineBatch(batch([t]), ctx, store);
    expect(busy.retryable).toBe(1);
    expect(busy.results[0].conflict_code).toBe('SYNC_IN_PROGRESS');
    expect(store.loans.size).toBe(0);
    expect(PENDING_CLAIM_TTL_MS).toBeGreaterThan(0);

    // Librarian resolves with retry → requeues past the claim TTL guard.
    const resolve = await resolveOfflineTransaction({ client_txn_id: t.client_txn_id, action: 'retry', note: '' }, ctx, store);
    expect(resolve.client_action).toBe('retry');

    const retried = await syncOfflineBatch(batch([t]), ctx, store);
    expect(retried.applied).toBe(1);
    expect(store.loans.size).toBe(1);
    expect(applied).toHaveLength(1);
  });

  it('cancel and accept_server resolutions mark the ledger and tell the client what to do', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem();
    const { ctx, resolved } = makeCtx();
    const conflictTx = tx(1, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-1', rules_fingerprint: 'bad' });
    await syncOfflineBatch(batch([conflictTx]), ctx, store);

    const cancelled = await resolveOfflineTransaction(
      { client_txn_id: conflictTx.client_txn_id, action: 'cancel', note: 'queued while offline' },
      ctx,
      store,
    );
    expect(cancelled.client_action).toBe('remove');
    expect(cancelled.resolution).toBe('cancel');

    const acceptTx = tx(2, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-1', rules_fingerprint: 'bad' });
    await syncOfflineBatch(batch([acceptTx]), ctx, store);
    const accepted = await resolveOfflineTransaction(
      { client_txn_id: acceptTx.client_txn_id, action: 'accept_server', note: 'server already had it' },
      ctx,
      store,
    );
    expect(accepted.client_action).toBe('remove');
    expect(resolved.map((r) => r.action)).toEqual(['cancel', 'accept_server']);
  });

  it('resolving an unknown transaction returns found:false', async () => {
    const store = new FakeStore();
    const { ctx } = makeCtx();
    const out = await resolveOfflineTransaction({ client_txn_id: uuid(), action: 'retry' }, ctx, store);
    expect(out.found).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('offline sync engine — workstation, hooks, and batch validation', () => {
  it('workstation last_seq tracks max APPLIED seq; hooks never fire for conflicts', async () => {
    const store = new FakeStore();
    store.seedPatron();
    store.seedItem({ id: 'item-good', available_copies: 1 });
    store.seedItem({ id: 'item-bad', available_copies: 0 });
    const { ctx, applied, resolved } = makeCtx();
    const okTx = tx(1, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-good' });
    const badTx = tx(2, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-bad' });

    const summary = await syncOfflineBatch(batch([okTx, badTx]), ctx, store);

    expect(summary.applied).toBe(1);
    expect(summary.conflicts).toBe(1);
    expect(applied).toHaveLength(1); // analytics/notices only for the applied tx
    expect(applied[0].client_txn_id).toBe(okTx.client_txn_id);
    expect(resolved).toHaveLength(0);
    expect(store.workstations).toHaveLength(1);
    expect(store.workstations[0]).toMatchObject({ device_id: 'device-1', last_seq: 1, registered_by: 'op-a' });
  });

  it('rejects batches that fail validation with BatchValidationError', async () => {
    const store = new FakeStore();
    const { ctx } = makeCtx();

    await expect(syncOfflineBatch(batch([], { device_id: 'device-1' }), ctx, store)).rejects.toThrow(BatchValidationError);
    await expect(syncOfflineBatch(batch([tx(1, 'checkout', {})], { device_id: '  ' }), ctx, store)).rejects.toThrow(BatchValidationError);

    const badUuid = { ...tx(1, 'checkout', {}), client_txn_id: 'not-a-uuid' };
    await expect(syncOfflineBatch(batch([badUuid]), ctx, store)).rejects.toThrow(/uuid/i);

    const tooMany = Array.from({ length: MAX_BATCH_SIZE + 1 }, (_, i) =>
      tx(i, 'checkout', { patron_id: 'patron-1', catalogue_item_id: 'item-1' }),
    );
    await expect(syncOfflineBatch(batch(tooMany), ctx, store)).rejects.toThrow(/maximum of 500/);

    const badOperation = { ...tx(1, 'checkout', {}), operation: 'register' as unknown as OfflineTxInput['operation'] };
    await expect(syncOfflineBatch(batch([badOperation]), ctx, store)).rejects.toThrow(/operation must be/);
  });
});
