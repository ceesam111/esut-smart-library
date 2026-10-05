import { randomUUID } from 'crypto';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { createSupabaseOfflineStore, withNetRetry } from '@/server/circulation/supabaseOfflineStore';
import { calculateFine, computeDueDate, maxItemsFor, renewalsFor } from '@/lib/circulationRules';

export interface Sip2Patron {
  id: string;
  patron_id: string;
  full_name: string;
  email: string;
  patron_category: string;
  status: string;
  membership_expires_at: string | null;
  user_id: string | null;
}

export interface Sip2Item {
  id: string;
  title: string;
  call_number: string | null;
  isbn: string | null;
  available_copies: number;
  total_copies: number;
  format: string | null;
}

export interface ActiveLoan {
  id: string;
  patron_id: string;
  catalogue_item_id: string;
  checkout_date: string;
  due_date: string;
  return_date: string | null;
  renewed_count: number;
  status: string;
}

export type CheckoutResult =
  | { outcome: 'checked_out'; loanId: string; dueDate: string; renewal: boolean }
  | { outcome: 'already_held'; loanId: string; dueDate: string }
  | { outcome: 'rejected'; code: string; message: string };

export type CheckinResult =
  | { outcome: 'returned'; loanId: string; patronId: string; fineAmount: number | null; itemTitle: string }
  | { outcome: 'no_loan'; message: string }
  | { outcome: 'rejected'; code: string; message: string };

export type RenewResult =
  | { outcome: 'renewed'; loanId: string; dueDate: string }
  | { outcome: 'rejected'; code: string; message: string };

export interface PatronCirculationSummary {
  chargedCount: number;
  overdueCount: number;
  holdCount: number;
  fineItemCount: number;
  fineAmount: number;
  chargedTitles: string[];
  overdueTitles: string[];
  holdTitles: string[];
}

const LOAN_COLUMNS = 'id, patron_id, catalogue_item_id, checkout_date, due_date, return_date, renewed_count, status';
const ACTIVE_STATUSES = ['active', 'overdue'] as const;

let offlineStore: ReturnType<typeof createSupabaseOfflineStore> | null = null;
function holdsStore(): ReturnType<typeof createSupabaseOfflineStore> {
  if (!offlineStore) offlineStore = createSupabaseOfflineStore();
  return offlineStore;
}

export async function resolvePatronBarcode(barcode: string): Promise<Sip2Patron | null> {
  const code = barcode.trim();
  if (!code) return null;
  return withNetRetry(async () => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('patrons')
      .select('id, patron_id, full_name, email, patron_category, status, membership_expires_at, user_id')
      .eq('patron_id', code)
      .maybeSingle();
    if (error) throw new Error(`resolvePatronBarcode: ${error.message}`);
    return (data as Sip2Patron | null) ?? null;
  });
}

export async function resolveItemBarcode(barcode: string): Promise<{ item: Sip2Item; scannedBarcode: string } | null> {
  const code = barcode.trim();
  if (!code) return null;
  return withNetRetry(async () => {
    const supabase = getSupabaseAdminClient();
    const { data: copy, error: copyErr } = await supabase
      .from('catalogue_copies')
      .select('item_id')
      .eq('barcode', code)
      .maybeSingle();
    if (copyErr) throw new Error(`resolveItemBarcode(copy): ${copyErr.message}`);
    const itemId = copy?.item_id ?? null;
    if (itemId) {
      const { data: item, error } = await supabase
        .from('catalogue_items')
        .select('id, title, call_number, isbn, available_copies, total_copies, format')
        .eq('id', itemId)
        .maybeSingle();
      if (error) throw new Error(`resolveItemBarcode(item): ${error.message}`);
      if (item) return { item: item as Sip2Item, scannedBarcode: code };
    }
    const { data: byIsbn, error: isbnErr } = await supabase
      .from('catalogue_items')
      .select('id, title, call_number, isbn, available_copies, total_copies, format')
      .eq('isbn', code)
      .maybeSingle();
    if (isbnErr) throw new Error(`resolveItemBarcode(isbn): ${isbnErr.message}`);
    if (byIsbn) return { item: byIsbn as Sip2Item, scannedBarcode: code };
    return null;
  });
}

async function activeLoanFor(patronId: string, itemId: string): Promise<ActiveLoan | null> {
  return withNetRetry(async () => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('loans')
      .select(LOAN_COLUMNS)
      .eq('patron_id', patronId)
      .eq('catalogue_item_id', itemId)
      .in('status', [...ACTIVE_STATUSES])
      .order('checkout_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`activeLoanFor: ${error.message}`);
    return (data as ActiveLoan | null) ?? null;
  });
}

async function activeLoanOnItem(itemId: string): Promise<ActiveLoan | null> {
  return withNetRetry(async () => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('loans')
      .select(LOAN_COLUMNS)
      .eq('catalogue_item_id', itemId)
      .in('status', [...ACTIVE_STATUSES])
      .order('checkout_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`activeLoanOnItem: ${error.message}`);
    return (data as ActiveLoan | null) ?? null;
  });
}

async function countActiveLoans(patronId: string): Promise<number> {
  return withNetRetry(async () => {
    const supabase = getSupabaseAdminClient();
    const { count, error } = await supabase
      .from('loans')
      .select('id', { count: 'exact', head: true })
      .eq('patron_id', patronId)
      .in('status', [...ACTIVE_STATUSES]);
    if (error) throw new Error(`countActiveLoans: ${error.message}`);
    return count ?? 0;
  });
}

/**
 * Optimistic guarded availability claim (single UPDATE with WHERE available_copies = expected).
 * Returns 'claimed', 'unavailable' (counter hit zero) or 'raced' (value moved, retry).
 */
async function claimAvailability(itemId: string): Promise<'claimed' | 'unavailable' | 'raced'> {
  const supabase = getSupabaseAdminClient();
  const { data: current, error: readErr } = await supabase
    .from('catalogue_items')
    .select('available_copies')
    .eq('id', itemId)
    .maybeSingle();
  if (readErr) throw new Error(`claimAvailability(read): ${readErr.message}`);
  const available = current?.available_copies ?? 0;
  if (available <= 0) return 'unavailable';
  const { data: updated, error: updErr } = await supabase
    .from('catalogue_items')
    .update({ available_copies: available - 1, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('available_copies', available)
    .select('id');
  if (updErr) throw new Error(`claimAvailability(update): ${updErr.message}`);
  if (updated && updated.length > 0) return 'claimed';
  return 'raced';
}

async function releaseAvailability(itemId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data: current, error: readErr } = await supabase
    .from('catalogue_items')
    .select('available_copies')
    .eq('id', itemId)
    .maybeSingle();
  if (readErr || !current) return;
  await supabase
    .from('catalogue_items')
    .update({ available_copies: current.available_copies + 1, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('available_copies', current.available_copies);
}

async function restoreAvailability(itemId: string): Promise<void> {
  await withNetRetry(() => releaseAvailability(itemId));
}

function patronBlocked(patron: Sip2Patron, now: Date): { code: string; message: string } | null {
  if (patron.status === 'suspended') return { code: 'PATRON_BLOCKED', message: 'Patron account is suspended.' };
  if (patron.status === 'expired') return { code: 'PATRON_EXPIRED', message: 'Patron account has expired.' };
  if (patron.membership_expires_at && Date.parse(patron.membership_expires_at) < now.getTime()) {
    return { code: 'PATRON_EXPIRED', message: 'Patron membership has expired.' };
  }
  return null;
}

function isUniqueViolation(error: { code?: string | null; message?: string | null } | null): boolean {
  return !!error && (error.code === '23505' || String(error.message ?? '').includes('duplicate key'));
}

export async function checkoutSip2(params: {
  patronBarcode: string;
  itemBarcode: string;
}): Promise<CheckoutResult> {
  const now = new Date();
  const patron = await resolvePatronBarcode(params.patronBarcode);
  if (!patron) return { outcome: 'rejected', code: 'PATRON_NOT_FOUND', message: 'Patron barcode not found.' };
  const blocked = patronBlocked(patron, now);
  if (blocked) return { outcome: 'rejected', code: blocked.code, message: blocked.message };

  const resolved = await resolveItemBarcode(params.itemBarcode);
  if (!resolved) return { outcome: 'rejected', code: 'ITEM_NOT_FOUND', message: 'Item barcode not found.' };
  const item = resolved.item;

  const [existing, onItem, activeCount] = await Promise.all([
    activeLoanFor(patron.id, item.id),
    activeLoanOnItem(item.id),
    countActiveLoans(patron.id),
  ]);
  if (existing) return { outcome: 'already_held', loanId: existing.id, dueDate: existing.due_date };
  if (onItem) {
    return { outcome: 'rejected', code: 'ITEM_UNAVAILABLE', message: 'Item is already checked out to another patron.' };
  }
  if (item.available_copies <= 0) {
    return { outcome: 'rejected', code: 'ITEM_UNAVAILABLE', message: 'No copies available for checkout.' };
  }
  const maxItems = maxItemsFor(patron.patron_category);
  if (activeCount >= maxItems) {
    return {
      outcome: 'rejected',
      code: 'MAX_LOANS',
      message: `Patron already has ${activeCount} active loan(s). Maximum for ${patron.patron_category} is ${maxItems}.`,
    };
  }

  let claim: 'claimed' | 'unavailable' | 'raced' = 'raced';
  for (let attempt = 0; attempt < 4 && claim === 'raced'; attempt++) {
    claim = await withNetRetry(() => claimAvailability(item.id));
  }
  if (claim === 'unavailable') {
    return { outcome: 'rejected', code: 'ITEM_UNAVAILABLE', message: 'No copies available for checkout.' };
  }
  if (claim === 'raced') {
    return { outcome: 'rejected', code: 'CONFLICT', message: 'Item availability changed concurrently — retry.' };
  }

  const checkoutISO = now.toISOString();
  const dueDate = computeDueDate(now, patron.patron_category);

  let loanId: string | null = null;
  const supabase = getSupabaseAdminClient();
  try {
    const { data, error } = await withNetRetry(async () =>
      supabase
        .from('loans')
        .insert({
          patron_id: patron.id,
          catalogue_item_id: item.id,
          checkout_date: checkoutISO,
          due_date: dueDate,
          status: 'active',
        })
        .select('id')
        .single(),
    );
    if (error) throw error;
    loanId = data?.id as string;
  } catch (err) {
    await restoreAvailability(item.id);
    if (isUniqueViolation(err as { code?: string | null })) {
      const concurrent = await activeLoanFor(patron.id, item.id);
      if (concurrent) return { outcome: 'already_held', loanId: concurrent.id, dueDate: concurrent.due_date };
      return { outcome: 'rejected', code: 'CONFLICT', message: 'Concurrent checkout detected — retry.' };
    }
    const message = err instanceof Error ? err.message : 'Checkout failed.';
    return { outcome: 'rejected', code: 'ERROR', message };
  }

  try {
    await withNetRetry(async () => {
      const { error } = await supabase.from('circulation_transactions').insert({
        transaction_type: 'checkout',
        patron_id: patron.id,
        catalogue_item_id: item.id,
        copy_barcode: params.itemBarcode,
        loan_id: loanId,
        performed_by: null,
        offline_id: `sip2:${randomUUID()}`,
        synced_at: now.toISOString(),
        notes: 'SIP2 checkout',
      });
      if (error && error.code !== '23505') throw new Error(`circulation_transactions: ${error.message}`);
    });
  } catch {
    // Loan committed; audit row failure must not fail the checkout.
  }

  return { outcome: 'checked_out', loanId, dueDate, renewal: false };
}

export async function checkinSip2(params: {
  itemBarcode: string;
  patronBarcode?: string | null;
}): Promise<CheckinResult> {
  const now = new Date();
  const resolved = await resolveItemBarcode(params.itemBarcode);
  if (!resolved) return { outcome: 'rejected', code: 'ITEM_NOT_FOUND', message: 'Item barcode not found.' };
  const item = resolved.item;

  const loan = await activeLoanOnItem(item.id);
  if (!loan) {
    return { outcome: 'no_loan', message: 'No active loan for this item — already returned or never checked out.' };
  }
  if (params.patronBarcode) {
    const patron = await resolvePatronBarcode(params.patronBarcode);
    if (patron && patron.id !== loan.patron_id) {
      return { outcome: 'rejected', code: 'WRONG_PATRON', message: 'Item is checked out to a different patron.' };
    }
  }

  const supabase = getSupabaseAdminClient();
  const returnedAt = now.toISOString();
  let winner: boolean;
  try {
    const { data, error } = await withNetRetry(async () =>
      supabase
        .from('loans')
        .update({ return_date: returnedAt, status: 'returned', updated_at: returnedAt })
        .eq('id', loan.id)
        .is('return_date', null)
        .select('id'),
    );
    if (error) throw error;
    winner = !!data && data.length > 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Check-in failed.';
    return { outcome: 'rejected', code: 'ERROR', message };
  }

  if (!winner) {
    return { outcome: 'no_loan', message: 'Loan already returned — duplicate check-in ignored.' };
  }

  await withNetRetry(() => releaseAvailability(item.id));

  const fine = calculateFine(loan.due_date, now);
  let fineAmount: number | null = null;
  if (fine.amount > 0) {
    fineAmount = fine.amount;
    const fineInsert = {
      patron_id: loan.patron_id,
      amount: fine.amount,
      reason: `Overdue fine — ${item.title}`,
      reference_type: 'loan',
      reference_id: loan.id,
      status: 'unpaid',
    };
    const noticeInsert = {
      patron_id: loan.patron_id,
      title: 'Overdue Fine',
      message: `An overdue fine of ₦${fine.amount.toLocaleString()} was applied for "${item.title}".`,
      type: 'fine',
    };
    await Promise.all([
      withNetRetry(async () => {
        const { error } = await supabase.from('fines').insert(fineInsert);
        if (error && error.code !== '23505') throw new Error(`fines: ${error.message}`);
      }),
      withNetRetry(async () => {
        const { error } = await supabase.from('notifications').insert(noticeInsert);
        if (error && error.code !== '23505') throw new Error(`notifications: ${error.message}`);
      }),
    ]);
  }

  try {
    await withNetRetry(async () => {
      const { error } = await supabase.from('circulation_transactions').insert({
        transaction_type: 'checkin',
        patron_id: loan.patron_id,
        catalogue_item_id: item.id,
        copy_barcode: params.itemBarcode,
        loan_id: loan.id,
        performed_by: null,
        offline_id: `sip2:${randomUUID()}`,
        synced_at: now.toISOString(),
        notes: fineAmount ? `SIP2 check-in — fine applied: ₦${fineAmount}` : 'SIP2 check-in',
      });
      if (error && error.code !== '23505') throw new Error(`circulation_transactions: ${error.message}`);
    });
  } catch {
    // Audit row must not fail a committed check-in.
  }

  try {
    await holdsStore().promoteNextHold(item.id, item.title);
  } catch {
    // Hold promotion failure must not fail check-in; staff can promote manually.
  }

  return { outcome: 'returned', loanId: loan.id, patronId: loan.patron_id, fineAmount, itemTitle: item.title };
}

export async function renewSip2(params: {
  patronBarcode: string;
  itemBarcode: string;
}): Promise<RenewResult> {
  const now = new Date();
  const patron = await resolvePatronBarcode(params.patronBarcode);
  if (!patron) return { outcome: 'rejected', code: 'PATRON_NOT_FOUND', message: 'Patron barcode not found.' };
  const blocked = patronBlocked(patron, now);
  if (blocked) return { outcome: 'rejected', code: blocked.code, message: blocked.message };

  const resolved = await resolveItemBarcode(params.itemBarcode);
  if (!resolved) return { outcome: 'rejected', code: 'ITEM_NOT_FOUND', message: 'Item barcode not found.' };
  const item = resolved.item;

  const loan = await activeLoanFor(patron.id, item.id);
  if (!loan) {
    return { outcome: 'rejected', code: 'LOAN_NOT_FOUND', message: 'No active loan for this patron and item.' };
  }
  if (Date.parse(loan.due_date) < now.getTime()) {
    return { outcome: 'rejected', code: 'LOAN_OVERDUE', message: 'Loan is overdue and cannot be renewed.' };
  }
  const maxRenewals = renewalsFor(patron.patron_category);
  if ((loan.renewed_count ?? 0) >= maxRenewals) {
    return {
      outcome: 'rejected',
      code: 'RENEWAL_LIMIT',
      message: `Renewal limit of ${maxRenewals} already reached for ${patron.patron_category}.`,
    };
  }
  const supabase = getSupabaseAdminClient();
  const foreignHold = await withNetRetry(async () => {
    const { count, error } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('catalogue_item_id', item.id)
      .neq('patron_id', patron.id)
      .in('status', ['pending', 'ready_for_collection']);
    if (error) throw new Error(`foreignHold: ${error.message}`);
    return (count ?? 0) > 0;
  });
  if (foreignHold) {
    return {
      outcome: 'rejected',
      code: 'HOLD_CONFLICT',
      message: 'Another patron has a pending hold on this item — renewal blocked.',
    };
  }

  const newDueDate = computeDueDate(now, patron.patron_category);
  const expectedCount = loan.renewed_count ?? 0;
  let updated: boolean;
  try {
    const { data, error } = await withNetRetry(async () =>
      supabase
        .from('loans')
        .update({
          due_date: newDueDate,
          renewed_count: expectedCount + 1,
          updated_at: now.toISOString(),
        })
        .eq('id', loan.id)
        .eq('renewed_count', expectedCount)
        .is('return_date', null)
        .select('id'),
    );
    if (error) throw error;
    updated = !!data && data.length > 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Renew failed.';
    return { outcome: 'rejected', code: 'ERROR', message };
  }
  if (!updated) {
    return { outcome: 'rejected', code: 'CONFLICT', message: 'Loan changed concurrently — retry.' };
  }

  try {
    await withNetRetry(async () => {
      const { error } = await supabase.from('circulation_transactions').insert({
        transaction_type: 'renew',
        patron_id: patron.id,
        catalogue_item_id: item.id,
        copy_barcode: params.itemBarcode,
        loan_id: loan.id,
        performed_by: null,
        offline_id: `sip2:${randomUUID()}`,
        synced_at: now.toISOString(),
        notes: 'SIP2 renewal',
      });
      if (error && error.code !== '23505') throw new Error(`circulation_transactions: ${error.message}`);
    });
  } catch {
    // Audit row must not fail a committed renewal.
  }

  return { outcome: 'renewed', loanId: loan.id, dueDate: newDueDate };
}

export async function patronCirculationSummary(patronId: string): Promise<PatronCirculationSummary> {
  const supabase = getSupabaseAdminClient();
  const now = new Date();
  const [loans, reservations, fines] = await Promise.all([
    withNetRetry(async () => {
      const { data, error } = await supabase
        .from('loans')
        .select('due_date, status, catalogue_items(title)')
        .eq('patron_id', patronId)
        .in('status', [...ACTIVE_STATUSES]);
      if (error) throw new Error(`summary(loans): ${error.message}`);
      return (data ?? []) as Array<{
        due_date: string;
        status: string;
        catalogue_items: { title: string } | { title: string }[] | null;
      }>;
    }),
    withNetRetry(async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('status, catalogue_items(title)')
        .eq('patron_id', patronId)
        .in('status', ['pending', 'ready_for_collection']);
      if (error) throw new Error(`summary(reservations): ${error.message}`);
      return (data ?? []) as Array<{ status: string; catalogue_items: { title: string } | { title: string }[] | null }>;
    }),
    withNetRetry(async () => {
      const { data, error } = await supabase
        .from('fines')
        .select('amount, status, reason')
        .eq('patron_id', patronId)
        .eq('status', 'unpaid');
      if (error) throw new Error(`summary(fines): ${error.message}`);
      return (data ?? []) as Array<{ amount: number; status: string; reason: string }>;
    }),
  ]);

  const titleOf = (row: { catalogue_items: { title: string } | { title: string }[] | null }): string => {
    const rel = Array.isArray(row.catalogue_items) ? row.catalogue_items[0] : row.catalogue_items;
    return rel?.title ?? 'Library item';
  };

  const isOverdue = (loan: { due_date: string; status: string }) =>
    loan.status === 'overdue' || Date.parse(loan.due_date) < now.getTime();

  const chargedTitles = loans.map(titleOf);
  const overdueTitles = loans.filter(isOverdue).map(titleOf);
  const holdTitles = reservations.map(titleOf);

  return {
    chargedCount: loans.length,
    overdueCount: overdueTitles.length,
    holdCount: reservations.length,
    fineItemCount: fines.length,
    fineAmount: fines.reduce((sum, fine) => sum + Number(fine.amount || 0), 0),
    chargedTitles,
    overdueTitles,
    holdTitles,
  };
}

/** 14-char NISO patron-status flag field (positions: 0 charge denied, 1 renewal denied, 5 too many charged, 6 too many overdue, 10 excessive fines). */
export function patronStatusFlags(params: {
  blocked: boolean;
  renewalDenied: boolean;
  atLoanLimit: boolean;
  hasOverdue: boolean;
  excessiveFines: boolean;
}): string {
  const flags = Array.from({ length: 14 }, () => ' ');
  if (params.blocked) flags[0] = 'Y';
  if (params.renewalDenied) flags[1] = 'Y';
  if (params.atLoanLimit) flags[5] = 'Y';
  if (params.hasOverdue) flags[6] = 'Y';
  if (params.excessiveFines) flags[10] = 'Y';
  return flags.join('');
}
