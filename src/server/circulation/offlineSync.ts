import {
  computeDueDate,
  calculateFine,
  maxItemsFor,
  renewalsFor,
  rulesFingerprint,
  OFFLINE_CACHE_MAX_AGE_HOURS,
} from '@/lib/circulationRules';

export type OfflineOperation = 'checkout' | 'checkin' | 'renew';

export type OfflineTxStatus =
  | 'PENDING'
  | 'APPLIED'
  | 'ALREADY_APPLIED'
  | 'CONFLICT'
  | 'REJECTED'
  | 'RETRYABLE_ERROR';

export type ConflictCode =
  | 'ITEM_ALREADY_CHECKED_OUT'
  | 'ITEM_CHECKED_OUT_TO_DIFFERENT_PATRON'
  | 'ITEM_ALREADY_RETURNED'
  | 'ITEM_NOT_FOUND'
  | 'PATRON_NOT_FOUND'
  | 'PATRON_BLOCKED'
  | 'PATRON_EXPIRED'
  | 'MAX_LOANS_REACHED'
  | 'LOAN_NOT_FOUND'
  | 'LOAN_OVERDUE'
  | 'RENEWAL_LIMIT_REACHED'
  | 'HOLD_CONFLICT'
  | 'RULE_CHANGED'
  | 'STALE_CACHE'
  | 'OPERATOR_MISMATCH'
  | 'REQUIRES_ONLINE'
  | 'INVALID_PAYLOAD'
  | 'SYNC_IN_PROGRESS'
  | 'UNKNOWN_ERROR';

export type ResolutionAction = 'retry' | 'accept_server' | 'cancel' | 'override';

/** Business-rule conflicts a librarian may override with a mandatory note. */
export const OVERRIDE_ALLOWED_CODES: ConflictCode[] = [
  'MAX_LOANS_REACHED',
  'RENEWAL_LIMIT_REACHED',
  'STALE_CACHE',
  'HOLD_CONFLICT',
];

export const MAX_BATCH_SIZE = 500;
export const PENDING_CLAIM_TTL_MS = 60_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface OfflineTxInput {
  client_txn_id: string;
  local_seq: number;
  operation: OfflineOperation;
  client_timestamp?: string | null;
  cache_fetched_at?: string | null;
  queued_by?: string | null;
  payload: Record<string, unknown>;
}

export interface OfflineBatchInput {
  device_id: string;
  label?: string;
  branch?: string;
  transactions: OfflineTxInput[];
}

export interface LedgerRow {
  client_txn_id: string;
  device_id: string;
  operator_id: string;
  queued_by: string | null;
  branch: string;
  operation: OfflineOperation;
  local_seq: number;
  payload: Record<string, unknown>;
  client_timestamp: string | null;
  cache_fetched_at: string | null;
  status: OfflineTxStatus;
  conflict_code: string | null;
  message: string;
  server_entity_id: string | null;
  attempts: number;
  last_error: string | null;
  resolution: ResolutionAction | null;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatronRow {
  id: string;
  patron_id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  patron_category: string;
  status: string;
  membership_expires_at: string | null;
}

export interface ItemRow {
  id: string;
  title: string;
  available_copies: number;
  total_copies: number;
}

export interface LoanRow {
  id: string;
  patron_id: string;
  catalogue_item_id: string;
  checkout_date: string;
  due_date: string;
  return_date: string | null;
  renewed_count: number;
  status: string;
}

export interface AppliedHook {
  client_txn_id: string;
  operation: OfflineOperation;
  device_id: string;
  local_seq: number;
  branch: string;
  operator_id: string;
  patron_id: string;
  patron_user_id: string | null;
  patron_name: string;
  catalogue_item_id: string;
  item_title: string;
  loan_id: string;
  due_date?: string;
  fine_amount?: number;
  hold_ready?: { hold_id: string; patron_user_id: string | null; patron_id: string };
}

export interface ResolveEvent {
  client_txn_id: string;
  action: ResolutionAction;
  note: string;
  actor_id: string;
  conflict_code: string | null;
}

export interface SyncHooks {
  onApplied?(hook: AppliedHook): Promise<void> | void;
  onResolved?(event: ResolveEvent): Promise<void> | void;
}

export interface SyncContext {
  operatorId: string;
  roles: string[];
  now?: () => Date;
  hooks?: SyncHooks;
}

export interface TxResult {
  client_txn_id: string;
  local_seq: number;
  status: OfflineTxStatus;
  conflict_code?: ConflictCode | null;
  message: string;
  server_entity_id?: string | null;
  resolution?: ResolutionAction | null;
}

export interface SyncSummary {
  results: TxResult[];
  applied: number;
  already_applied: number;
  conflicts: number;
  rejected: number;
  retryable: number;
}

export interface WorkstationRow {
  device_id: string;
  label: string;
  branch: string;
  registered_by: string | null;
  last_sync_at: string;
  last_seen_at: string;
  last_seq: number;
}

export interface OfflineStore {
  getLedger(clientTxnId: string): Promise<LedgerRow | null>;
  claimLedger(row: LedgerRow): Promise<boolean>;
  updateLedger(clientTxnId: string, patch: Partial<LedgerRow>): Promise<void>;
  upsertWorkstation(ws: WorkstationRow): Promise<void>;

  getPatron(id: string): Promise<PatronRow | null>;
  getItem(id: string): Promise<ItemRow | null>;
  countActiveLoans(patronId: string): Promise<number>;
  getActiveLoanByItem(itemId: string): Promise<LoanRow | null>;
  getActiveLoanByPatronItem(patronId: string, itemId: string): Promise<LoanRow | null>;
  getLoan(loanId: string): Promise<LoanRow | null>;
  hasForeignPendingHold(itemId: string, patronId: string): Promise<boolean>;

  insertLoan(row: {
    patron_id: string;
    catalogue_item_id: string;
    checkout_date: string;
    due_date: string;
  }): Promise<string>;
  setLoanReturned(loanId: string, returnDate: string): Promise<void>;
  setLoanRenewed(loanId: string, dueDate: string): Promise<void>;
  adjustAvailableCopies(itemId: string, delta: number): Promise<void>;
  insertCirculationTx(row: {
    transaction_type: OfflineOperation;
    patron_id: string;
    catalogue_item_id: string;
    loan_id: string;
    performed_by: string;
    offline_id: string;
    synced_at: string;
    notes: string;
  }): Promise<void>;
  insertFine(row: {
    patron_id: string;
    amount: number;
    reason: string;
    reference_id: string;
  }): Promise<void>;
  insertPatronNotification(row: {
    patron_id: string;
    title: string;
    message: string;
    type: string;
  }): Promise<void>;
  getAppliedCirculationByOfflineId(offlineId: string): Promise<{ id: string } | null>;
  promoteNextHold(itemId: string, itemTitle: string): Promise<AppliedHook['hold_ready'] | null>;
}

type ApplyOutcome =
  | {
      kind: 'applied';
      serverEntityId: string;
      hook: Omit<AppliedHook, 'client_txn_id' | 'device_id' | 'local_seq' | 'branch' | 'operator_id'>;
    }
  | { kind: 'already'; message: string }
  | { kind: 'conflict'; code: ConflictCode; message: string }
  | { kind: 'rejected'; code: ConflictCode; message: string };

class ConflictResult extends Error {
  constructor(public code: ConflictCode, message: string) {
    super(message);
    this.name = 'ConflictResult';
  }
}

class RejectResult extends Error {
  constructor(public code: ConflictCode, message: string) {
    super(message);
    this.name = 'RejectResult';
  }
}

export class BatchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BatchValidationError';
  }
}

function nowIso(ctx: SyncContext): string {
  return (ctx.now ? ctx.now() : new Date()).toISOString();
}

function validateBatch(input: OfflineBatchInput): string | null {
  if (!input.device_id || typeof input.device_id !== 'string' || !input.device_id.trim()) {
    return 'device_id required';
  }
  if (!Array.isArray(input.transactions) || input.transactions.length === 0) {
    return 'transactions array required';
  }
  if (input.transactions.length > MAX_BATCH_SIZE) {
    return `Batch exceeds maximum of ${MAX_BATCH_SIZE}`;
  }
  for (const tx of input.transactions) {
    if (!tx.client_txn_id || !UUID_RE.test(tx.client_txn_id)) return 'client_txn_id must be a uuid';
    if (typeof tx.local_seq !== 'number' || !Number.isInteger(tx.local_seq) || tx.local_seq < 0) {
      return 'local_seq must be a non-negative integer';
    }
    if (!['checkout', 'checkin', 'renew'].includes(tx.operation)) {
      return 'operation must be checkout, checkin or renew';
    }
    if (!tx.payload || typeof tx.payload !== 'object') return 'payload object required';
  }
  return null;
}

function str(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function cacheIsStale(cacheFetchedAt: string | null | undefined, now: Date): boolean {
  if (!cacheFetchedAt) return false;
  const fetched = Date.parse(cacheFetchedAt);
  if (Number.isNaN(fetched)) return false;
  return now.getTime() - fetched > OFFLINE_CACHE_MAX_AGE_HOURS * 3600_000;
}

function clientDateOrNow(ts: string | null | undefined, now: Date): Date {
  if (!ts) return now;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? now : new Date(parsed);
}

async function applyCheckout(
  store: OfflineStore,
  tx: OfflineTxInput,
  ctx: SyncContext,
  force: boolean,
): Promise<ApplyOutcome> {
  const now = ctx.now ? ctx.now() : new Date();
  const payload = tx.payload;
  const patronId = str(payload, 'patron_id');
  const itemId = str(payload, 'catalogue_item_id');
  if (!patronId || !itemId) {
    return { kind: 'rejected', code: 'INVALID_PAYLOAD', message: 'patron_id and catalogue_item_id required' };
  }

  // Fast idempotency path: this client_txn_id already produced a circulation
  // row (a previous attempt applied fully, or a lost-response insert
  // committed). Beats every business-rule conflict — the state is truth.
  const priorCirc = await store.getAppliedCirculationByOfflineId(tx.client_txn_id);
  if (priorCirc) {
    return { kind: 'already', message: 'Transaction already applied — duplicate sync ignored.' };
  }

  const clientFp = str(payload, 'rules_fingerprint');
  if (clientFp && clientFp !== rulesFingerprint()) {
    throw new ConflictResult('RULE_CHANGED', 'Circulation rules changed since the offline cache was built. Refresh and retry.');
  }
  if (cacheIsStale(tx.cache_fetched_at, now)) {
    throw new ConflictResult('STALE_CACHE', `Offline cache older than ${OFFLINE_CACHE_MAX_AGE_HOURS}h. Refresh before checkout.`);
  }

  // Independent reads — parallelized (Supabase REST round-trips dominate latency).
  const [patron, item, activeOnItem, activeCount] = await Promise.all([
    store.getPatron(patronId),
    store.getItem(itemId),
    store.getActiveLoanByItem(itemId),
    store.countActiveLoans(patronId),
  ]);
  if (!patron) throw new RejectResult('PATRON_NOT_FOUND', 'Patron no longer exists.');
  if (patron.status === 'suspended') throw new ConflictResult('PATRON_BLOCKED', 'Patron account is suspended.');
  if (patron.status === 'expired') throw new ConflictResult('PATRON_EXPIRED', 'Patron account has expired.');
  if (patron.membership_expires_at && Date.parse(patron.membership_expires_at) < now.getTime()) {
    throw new ConflictResult('PATRON_EXPIRED', 'Patron membership has expired.');
  }

  if (!item) throw new RejectResult('ITEM_NOT_FOUND', 'Catalogue item no longer exists.');

  const checkoutAt = clientDateOrNow(tx.client_timestamp, now);
  const checkoutISO = checkoutAt.toISOString();
  const dueDate = computeDueDate(checkoutAt, patron.patron_category);

  // Partial-apply recovery: writes are sequential (loan → availability →
  // circulation row), so if an active loan for this patron/item matches THIS
  // transaction's checkout timestamp, the loan and availability already
  // committed and only the circulation row is missing. Complete it instead of
  // reporting a bogus ITEM_ALREADY_CHECKED_OUT conflict.
  if (activeOnItem && activeOnItem.patron_id === patronId && activeOnItem.checkout_date === checkoutISO) {
    await store.insertCirculationTx({
      transaction_type: 'checkout',
      patron_id: patronId,
      catalogue_item_id: itemId,
      loan_id: activeOnItem.id,
      performed_by: ctx.operatorId,
      offline_id: tx.client_txn_id,
      synced_at: now.toISOString(),
      notes: 'Offline sync checkout',
    });
    return {
      kind: 'applied',
      serverEntityId: activeOnItem.id,
      hook: {
        operation: 'checkout',
        patron_id: patronId,
        patron_user_id: patron.user_id,
        patron_name: patron.full_name,
        catalogue_item_id: itemId,
        item_title: item.title,
        loan_id: activeOnItem.id,
        due_date: dueDate,
      },
    };
  }

  if (activeOnItem && activeOnItem.patron_id !== patronId) {
    throw new ConflictResult('ITEM_CHECKED_OUT_TO_DIFFERENT_PATRON', 'Item is already checked out to a different patron.');
  }
  if (activeOnItem && activeOnItem.patron_id === patronId) {
    throw new ConflictResult('ITEM_ALREADY_CHECKED_OUT', 'This item is already checked out to this patron.');
  }
  if (item.available_copies <= 0) {
    throw new ConflictResult('ITEM_ALREADY_CHECKED_OUT', 'No copies available for checkout.');
  }

  const maxItems = maxItemsFor(patron.patron_category);
  if (activeCount >= maxItems && !force) {
    throw new ConflictResult(
      'MAX_LOANS_REACHED',
      `Patron already has ${activeCount} active loan(s). Maximum for ${patron.patron_category} is ${maxItems}.`,
    );
  }

  // Writes are sequential on purpose: Supabase REST has no multi-table
  // transactions, so a parallel failure could commit one write and not the
  // other (e.g. availability decremented with no loan). Loan-first ordering
  // makes a transient failure leave no side effects → clean client retry.
  const loanId = await store.insertLoan({
    patron_id: patronId,
    catalogue_item_id: itemId,
    checkout_date: checkoutAt.toISOString(),
    due_date: dueDate,
  });
  await store.adjustAvailableCopies(itemId, -1);
  await store.insertCirculationTx({
    transaction_type: 'checkout',
    patron_id: patronId,
    catalogue_item_id: itemId,
    loan_id: loanId,
    performed_by: ctx.operatorId,
    offline_id: tx.client_txn_id,
    synced_at: now.toISOString(),
    notes: 'Offline sync checkout',
  });

  return {
    kind: 'applied',
    serverEntityId: loanId,
    hook: {
      operation: 'checkout',
      patron_id: patronId,
      patron_user_id: patron.user_id,
      patron_name: patron.full_name,
      catalogue_item_id: itemId,
      item_title: item.title,
      loan_id: loanId,
      due_date: dueDate,
    },
  };
}

async function applyCheckin(store: OfflineStore, tx: OfflineTxInput, ctx: SyncContext): Promise<ApplyOutcome> {
  const now = ctx.now ? ctx.now() : new Date();
  const payload = tx.payload;
  const loanId = str(payload, 'loan_id');
  const patronId = str(payload, 'patron_id');
  const itemId = str(payload, 'catalogue_item_id');

  const priorCircCheckin = await store.getAppliedCirculationByOfflineId(tx.client_txn_id);
  if (priorCircCheckin) {
    return { kind: 'already', message: 'Transaction already applied — duplicate sync ignored.' };
  }

  let loan: LoanRow | null = null;
  if (loanId) loan = await store.getLoan(loanId);
  else if (patronId && itemId) loan = await store.getActiveLoanByPatronItem(patronId, itemId);
  if (!loan) {
    return { kind: 'conflict', code: 'LOAN_NOT_FOUND', message: 'No active loan found for this check-in.' };
  }
  if (loan.status === 'returned') {
    return { kind: 'already', message: 'Item already returned — no duplicate action taken.' };
  }

  const returnedAt = clientDateOrNow(tx.client_timestamp, now);
  const [patron, item] = await Promise.all([store.getPatron(loan.patron_id), store.getItem(loan.catalogue_item_id)]);

  // Sequential (see applyCheckout): loan state first, then availability.
  await store.setLoanReturned(loan.id, returnedAt.toISOString());
  await store.adjustAvailableCopies(loan.catalogue_item_id, 1);

  const fine = calculateFine(loan.due_date, returnedAt);
  let fineAmount: number | undefined;
  if (fine.amount > 0) {
    fineAmount = fine.amount;
    await Promise.all([
      store.insertFine({
        patron_id: loan.patron_id,
        amount: fine.amount,
        reason: `Overdue fine — ${item?.title ?? 'Library item'}`,
        reference_id: loan.id,
      }),
      store.insertPatronNotification({
        patron_id: loan.patron_id,
        title: 'Overdue Fine',
        message: `An overdue fine of ₦${fine.amount.toLocaleString()} was applied for "${item?.title ?? 'Library item'}".`,
        type: 'fine',
      }),
    ]);
  }

  await store.insertCirculationTx({
    transaction_type: 'checkin',
    patron_id: loan.patron_id,
    catalogue_item_id: loan.catalogue_item_id,
    loan_id: loan.id,
    performed_by: ctx.operatorId,
    offline_id: tx.client_txn_id,
    synced_at: now.toISOString(),
    notes: fineAmount ? `Offline sync check-in — fine applied: ₦${fineAmount}` : 'Offline sync check-in',
  });

  const hold = await store.promoteNextHold(loan.catalogue_item_id, item?.title ?? 'Library item');

  return {
    kind: 'applied',
    serverEntityId: loan.id,
    hook: {
      operation: 'checkin',
      patron_id: loan.patron_id,
      patron_user_id: patron?.user_id ?? null,
      patron_name: patron?.full_name ?? 'Patron',
      catalogue_item_id: loan.catalogue_item_id,
      item_title: item?.title ?? 'Library item',
      loan_id: loan.id,
      fine_amount: fineAmount,
      hold_ready: hold ?? undefined,
    },
  };
}

async function applyRenew(
  store: OfflineStore,
  tx: OfflineTxInput,
  ctx: SyncContext,
  force: boolean,
): Promise<ApplyOutcome> {
  const now = ctx.now ? ctx.now() : new Date();
  const loanId = str(tx.payload, 'loan_id');
  if (!loanId) {
    return { kind: 'rejected', code: 'INVALID_PAYLOAD', message: 'loan_id required' };
  }

  const priorCircRenew = await store.getAppliedCirculationByOfflineId(tx.client_txn_id);
  if (priorCircRenew) {
    return { kind: 'already', message: 'Transaction already applied — duplicate sync ignored.' };
  }

  const loan = await store.getLoan(loanId);
  if (!loan || loan.status === 'returned' || loan.status === 'lost') {
    throw new ConflictResult('LOAN_NOT_FOUND', 'Loan not found or already returned.');
  }
  const patron = await store.getPatron(loan.patron_id);
  if (!patron) throw new RejectResult('PATRON_NOT_FOUND', 'Patron no longer exists.');
  if (patron.status === 'suspended') throw new ConflictResult('PATRON_BLOCKED', 'Patron account is suspended.');
  if (patron.status === 'expired') throw new ConflictResult('PATRON_EXPIRED', 'Patron account has expired.');

  if (Date.parse(loan.due_date) < now.getTime() && !force) {
    throw new ConflictResult('LOAN_OVERDUE', 'Loan is overdue and cannot be renewed.');
  }

  const maxRenewals = renewalsFor(patron.patron_category);
  if ((loan.renewed_count ?? 0) >= maxRenewals && !force) {
    throw new ConflictResult(
      'RENEWAL_LIMIT_REACHED',
      `Renewal limit of ${maxRenewals} already reached for ${patron.patron_category}.`,
    );
  }

  const [item, holdConflict] = await Promise.all([
    store.getItem(loan.catalogue_item_id),
    force ? Promise.resolve(false) : store.hasForeignPendingHold(loan.catalogue_item_id, loan.patron_id),
  ]);
  if (holdConflict) {
    throw new ConflictResult('HOLD_CONFLICT', 'Another patron has a pending hold on this item — renewal blocked.');
  }

  const newDueDate = computeDueDate(now, patron.patron_category);
  // Sequential (see applyCheckout): renew the loan first, then record it.
  await store.setLoanRenewed(loan.id, newDueDate);
  await store.insertCirculationTx({
    transaction_type: 'renew',
    patron_id: loan.patron_id,
    catalogue_item_id: loan.catalogue_item_id,
    loan_id: loan.id,
    performed_by: ctx.operatorId,
    offline_id: tx.client_txn_id,
    synced_at: now.toISOString(),
    notes: 'Offline sync renewal',
  });

  return {
    kind: 'applied',
    serverEntityId: loan.id,
    hook: {
      operation: 'renew',
      patron_id: loan.patron_id,
      patron_user_id: patron.user_id,
      patron_name: patron.full_name,
      catalogue_item_id: loan.catalogue_item_id,
      item_title: item?.title ?? 'Library item',
      loan_id: loan.id,
      due_date: newDueDate,
    },
  };
}

function runApply(
  store: OfflineStore,
  tx: OfflineTxInput,
  ctx: SyncContext,
  meta: { force: boolean },
): Promise<ApplyOutcome> {
  if (tx.operation === 'checkout') return applyCheckout(store, tx, ctx, meta.force);
  if (tx.operation === 'checkin') return applyCheckin(store, tx, ctx);
  return applyRenew(store, tx, ctx, meta.force);
}

async function fireApplied(ctx: SyncContext, hook: AppliedHook): Promise<void> {
  if (!ctx.hooks?.onApplied) return;
  try {
    await ctx.hooks.onApplied(hook);
  } catch (err) {
    console.warn('offline sync onApplied hook failed:', err instanceof Error ? err.message : err);
  }
}

async function fireResolved(ctx: SyncContext, event: ResolveEvent): Promise<void> {
  if (!ctx.hooks?.onResolved) return;
  try {
    await ctx.hooks.onResolved(event);
  } catch (err) {
    console.warn('offline sync onResolved hook failed:', err instanceof Error ? err.message : err);
  }
}

function emptyLedger(tx: OfflineTxInput, batch: OfflineBatchInput, ctx: SyncContext): LedgerRow {
  const iso = nowIso(ctx);
  return {
    client_txn_id: tx.client_txn_id,
    device_id: batch.device_id,
    operator_id: ctx.operatorId,
    queued_by: tx.queued_by ?? null,
    branch: batch.branch ?? '',
    operation: tx.operation,
    local_seq: tx.local_seq,
    payload: tx.payload ?? {},
    client_timestamp: tx.client_timestamp ?? null,
    cache_fetched_at: tx.cache_fetched_at ?? null,
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
    created_at: iso,
    updated_at: iso,
  };
}

async function processOne(
  tx: OfflineTxInput,
  batch: OfflineBatchInput,
  ctx: SyncContext,
  store: OfflineStore,
): Promise<TxResult> {
  const base = { client_txn_id: tx.client_txn_id, local_seq: tx.local_seq };

  const existing = await store.getLedger(tx.client_txn_id);
  if (existing) {
    if (existing.status === 'APPLIED' || existing.status === 'ALREADY_APPLIED') {
      return {
        ...base,
        status: 'ALREADY_APPLIED',
        message: 'Transaction already applied — duplicate sync ignored.',
        server_entity_id: existing.server_entity_id,
      };
    }
    if (existing.status === 'CONFLICT' && existing.resolution !== 'retry') {
      return {
        ...base,
        status: 'CONFLICT',
        conflict_code: (existing.conflict_code as ConflictCode) ?? 'UNKNOWN_ERROR',
        message: existing.message || 'Conflict recorded — awaiting resolution.',
        resolution: existing.resolution,
      };
    }
    if (existing.status === 'REJECTED' && existing.resolution !== 'retry') {
      return {
        ...base,
        status: 'REJECTED',
        conflict_code: (existing.conflict_code as ConflictCode) ?? 'INVALID_PAYLOAD',
        message: existing.message || 'Transaction rejected.',
        resolution: existing.resolution,
      };
    }
    const updatedMs = Date.parse(existing.updated_at || existing.created_at || '');
    const age = Number.isNaN(updatedMs) ? Number.POSITIVE_INFINITY : Date.now() - updatedMs;
    if (existing.status === 'PENDING' && existing.resolution !== 'retry' && age < PENDING_CLAIM_TTL_MS) {
      return {
        ...base,
        status: 'RETRYABLE_ERROR',
        conflict_code: 'SYNC_IN_PROGRESS',
        message: 'Another sync request is processing this transaction.',
      };
    }
    await store.updateLedger(tx.client_txn_id, {
      status: 'PENDING',
      attempts: (existing.attempts ?? 1) + 1,
      updated_at: nowIso(ctx),
    });
  } else {
    const claimed = await store.claimLedger(emptyLedger(tx, batch, ctx));
    if (!claimed) {
      const row = await store.getLedger(tx.client_txn_id);
      if (row && (row.status === 'APPLIED' || row.status === 'ALREADY_APPLIED')) {
        return {
          ...base,
          status: 'ALREADY_APPLIED',
          message: 'Transaction already applied — duplicate sync ignored.',
          server_entity_id: row.server_entity_id,
        };
      }
      return {
        ...base,
        status: 'RETRYABLE_ERROR',
        conflict_code: 'SYNC_IN_PROGRESS',
        message: 'Another sync request is processing this transaction.',
      };
    }
  }

  // Operator ownership: queue entries belong to the operator who created them.
  // Authorized recovery (GLOBAL_ADMIN_ROLES) may replay another operator's work.
  if (tx.queued_by && tx.queued_by !== ctx.operatorId && !canRecoverQueue(ctx.roles)) {
    const message = 'Queued transaction belongs to a different operator.';
    await store.updateLedger(tx.client_txn_id, {
      status: 'REJECTED',
      conflict_code: 'OPERATOR_MISMATCH',
      message,
      updated_at: nowIso(ctx),
    });
    return { ...base, status: 'REJECTED', conflict_code: 'OPERATOR_MISMATCH', message };
  }

  let outcome: ApplyOutcome;
  try {
    outcome = await runApply(store, tx, ctx, { force: false });
  } catch (err) {
    if (err instanceof ConflictResult || err instanceof RejectResult) {
      const status: OfflineTxStatus = err instanceof ConflictResult ? 'CONFLICT' : 'REJECTED';
      await store.updateLedger(tx.client_txn_id, {
        status,
        conflict_code: err.code,
        message: err.message,
        updated_at: nowIso(ctx),
      });
      return { ...base, status, conflict_code: err.code, message: err.message };
    }
    throw err;
  }

  if (outcome.kind === 'applied') {
    await store.updateLedger(tx.client_txn_id, {
      status: 'APPLIED',
      server_entity_id: outcome.serverEntityId,
      applied_at: nowIso(ctx),
      conflict_code: null,
      message: 'Applied',
      updated_at: nowIso(ctx),
    });
    await fireApplied(ctx, {
      ...outcome.hook,
      client_txn_id: tx.client_txn_id,
      device_id: batch.device_id,
      local_seq: tx.local_seq,
      branch: batch.branch ?? '',
      operator_id: ctx.operatorId,
    });
    return { ...base, status: 'APPLIED', message: 'Applied', server_entity_id: outcome.serverEntityId };
  }
  if (outcome.kind === 'already') {
    await store.updateLedger(tx.client_txn_id, {
      status: 'ALREADY_APPLIED',
      message: outcome.message,
      updated_at: nowIso(ctx),
    });
    return { ...base, status: 'ALREADY_APPLIED', message: outcome.message };
  }
  const status: OfflineTxStatus = outcome.kind === 'conflict' ? 'CONFLICT' : 'REJECTED';
  await store.updateLedger(tx.client_txn_id, {
    status,
    conflict_code: outcome.code,
    message: outcome.message,
    updated_at: nowIso(ctx),
  });
  return { ...base, status, conflict_code: outcome.code, message: outcome.message };
}

export async function syncOfflineBatch(
  input: OfflineBatchInput,
  ctx: SyncContext,
  store: OfflineStore,
): Promise<SyncSummary> {
  const validationError = validateBatch(input);
  if (validationError) throw new BatchValidationError(validationError);

  const ordered = [...input.transactions].sort((a, b) => a.local_seq - b.local_seq);

  const results: TxResult[] = [];
  const byId = new Map<string, TxResult>();
  let maxSeq = 0;

  for (const tx of ordered) {
    const seen = byId.get(tx.client_txn_id);
    if (seen) {
      results.push({
        ...seen,
        status: seen.status === 'APPLIED' ? 'ALREADY_APPLIED' : seen.status,
        message: seen.status === 'APPLIED' ? 'Duplicate transaction in batch — already applied.' : seen.message,
      });
      continue;
    }

    let result: TxResult;
    try {
      result = await processOne(tx, input, ctx, store);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await store
        .updateLedger(tx.client_txn_id, {
          status: 'RETRYABLE_ERROR',
          last_error: message,
          updated_at: nowIso(ctx),
        })
        .catch(() => undefined);
      result = {
        client_txn_id: tx.client_txn_id,
        local_seq: tx.local_seq,
        status: 'RETRYABLE_ERROR',
        conflict_code: 'UNKNOWN_ERROR',
        message: 'Temporary server error — transaction will be retried.',
      };
    }

    byId.set(tx.client_txn_id, result);
    results.push(result);
    if (tx.local_seq > maxSeq && (result.status === 'APPLIED' || result.status === 'ALREADY_APPLIED')) {
      maxSeq = tx.local_seq;
    }
  }

  await store
    .upsertWorkstation({
      device_id: input.device_id,
      label: input.label ?? '',
      branch: input.branch ?? '',
      registered_by: ctx.operatorId,
      last_sync_at: nowIso(ctx),
      last_seen_at: nowIso(ctx),
      last_seq: maxSeq,
    })
    .catch((err) => console.warn('offline workstation upsert failed:', err instanceof Error ? err.message : err));

  return {
    results,
    applied: results.filter((r) => r.status === 'APPLIED').length,
    already_applied: results.filter((r) => r.status === 'ALREADY_APPLIED').length,
    conflicts: results.filter((r) => r.status === 'CONFLICT').length,
    rejected: results.filter((r) => r.status === 'REJECTED').length,
    retryable: results.filter((r) => r.status === 'RETRYABLE_ERROR').length,
  };
}

export function canRecoverQueue(roles: string[]): boolean {
  return roles.some((r) => r === 'super_admin' || r === 'librarian' || r === 'admin');
}

export interface ResolveInput {
  client_txn_id: string;
  action: ResolutionAction;
  note?: string;
}

export interface ResolveOutcome {
  found: boolean;
  status?: OfflineTxStatus;
  conflict_code?: string | null;
  message?: string;
  resolution?: ResolutionAction | null;
  client_action?: 'retry' | 'remove' | 'keep';
}

export async function resolveOfflineTransaction(
  input: ResolveInput,
  ctx: SyncContext,
  store: OfflineStore,
): Promise<ResolveOutcome> {
  const row = await store.getLedger(input.client_txn_id);
  if (!row) return { found: false };

  const now = nowIso(ctx);
  const note = (input.note ?? '').trim();

  if (input.action === 'retry') {
    if (row.status === 'APPLIED' || row.status === 'ALREADY_APPLIED') {
      return {
        found: true, status: row.status, conflict_code: row.conflict_code,
        message: row.message, resolution: row.resolution, client_action: 'remove',
      };
    }
    await store.updateLedger(row.client_txn_id, {
      status: 'PENDING',
      resolution: 'retry',
      resolution_note: note,
      resolved_by: ctx.operatorId,
      resolved_at: now,
      updated_at: now,
    });
    await fireResolved(ctx, {
      client_txn_id: row.client_txn_id, action: 'retry', note,
      actor_id: ctx.operatorId, conflict_code: row.conflict_code,
    });
    return {
      found: true, status: 'PENDING', conflict_code: row.conflict_code,
      message: 'Queued for retry.', resolution: 'retry', client_action: 'retry',
    };
  }

  if (input.action === 'cancel' || input.action === 'accept_server') {
    await store.updateLedger(row.client_txn_id, {
      resolution: input.action,
      resolution_note: note,
      resolved_by: ctx.operatorId,
      resolved_at: now,
      updated_at: now,
    });
    await fireResolved(ctx, {
      client_txn_id: row.client_txn_id, action: input.action, note,
      actor_id: ctx.operatorId, conflict_code: row.conflict_code,
    });
    return {
      found: true, status: row.status, conflict_code: row.conflict_code,
      message: input.action === 'cancel' ? 'Transaction cancelled by librarian.' : 'Server state accepted.',
      resolution: input.action, client_action: 'remove',
    };
  }

  // override
  if (!note) throw new BatchValidationError('Override requires a note.');
  if (row.status === 'APPLIED' || row.status === 'ALREADY_APPLIED') {
    return {
      found: true, status: row.status, conflict_code: row.conflict_code,
      message: row.message, resolution: row.resolution, client_action: 'remove',
    };
  }
  if (!row.conflict_code || !OVERRIDE_ALLOWED_CODES.includes(row.conflict_code as ConflictCode)) {
    throw new BatchValidationError(`Conflict ${row.conflict_code ?? 'unknown'} cannot be overridden.`);
  }

  const tx: OfflineTxInput = {
    client_txn_id: row.client_txn_id,
    local_seq: row.local_seq,
    operation: row.operation,
    client_timestamp: row.client_timestamp,
    cache_fetched_at: row.cache_fetched_at,
    queued_by: row.queued_by,
    payload: row.payload,
  };

  let outcome: ApplyOutcome;
  try {
    outcome = await runApply(store, tx, ctx, { force: true });
  } catch (err) {
    if (err instanceof ConflictResult || err instanceof RejectResult) {
      await store.updateLedger(row.client_txn_id, {
        conflict_code: err.code,
        message: err.message,
        updated_at: now,
      });
      return {
        found: true,
        status: err instanceof ConflictResult ? 'CONFLICT' : 'REJECTED',
        conflict_code: err.code,
        message: err.message,
        resolution: 'override',
        client_action: 'keep',
      };
    }
    throw err;
  }

  if (outcome.kind === 'applied') {
    await store.updateLedger(row.client_txn_id, {
      status: 'APPLIED',
      server_entity_id: outcome.serverEntityId,
      conflict_code: null,
      message: `Applied (overridden: ${note})`,
      resolution: 'override',
      resolution_note: note,
      resolved_by: ctx.operatorId,
      resolved_at: now,
      applied_at: now,
      updated_at: now,
    });
    await fireApplied(ctx, {
      ...outcome.hook,
      client_txn_id: tx.client_txn_id,
      device_id: row.device_id,
      local_seq: row.local_seq,
      branch: row.branch,
      operator_id: ctx.operatorId,
    });
    await fireResolved(ctx, {
      client_txn_id: row.client_txn_id, action: 'override', note,
      actor_id: ctx.operatorId, conflict_code: row.conflict_code,
    });
    return {
      found: true, status: 'APPLIED', conflict_code: null,
      message: `Applied after override: ${note}`, resolution: 'override', client_action: 'remove',
    };
  }
  if (outcome.kind === 'already') {
    await store.updateLedger(row.client_txn_id, {
      status: 'ALREADY_APPLIED', message: outcome.message, updated_at: now,
    });
    return {
      found: true, status: 'ALREADY_APPLIED', conflict_code: null,
      message: outcome.message, resolution: 'override', client_action: 'remove',
    };
  }
  const status: OfflineTxStatus = outcome.kind === 'conflict' ? 'CONFLICT' : 'REJECTED';
  await store.updateLedger(row.client_txn_id, {
    status, conflict_code: outcome.code, message: outcome.message, updated_at: now,
  });
  return {
    found: true, status, conflict_code: outcome.code,
    message: outcome.message, resolution: 'override', client_action: 'keep',
  };
}
