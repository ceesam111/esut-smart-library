export type OfflineOperation = 'checkout' | 'checkin' | 'renew';

export type QueuedState = 'pending' | 'conflict' | 'rejected';

export interface CheckoutPayload {
  patron_id: string;
  catalogue_item_id: string;
  patron_name: string;
  item_title: string;
  rules_fingerprint: string;
}

export interface CheckinPayload {
  loan_id?: string;
  patron_id: string;
  catalogue_item_id: string;
  patron_name: string;
  item_title: string;
}

export interface RenewPayload {
  loan_id: string;
  patron_id: string;
  catalogue_item_id: string;
  patron_name: string;
  item_title: string;
}

export type OfflinePayload = CheckoutPayload | CheckinPayload | RenewPayload;

export interface QueuedTx {
  client_txn_id: string;
  local_seq: number;
  operation: OfflineOperation;
  client_timestamp: string;
  queued_by: string;
  state: QueuedState;
  conflict_code?: string | null;
  message?: string;
  resolution?: 'retry' | 'override' | null;
  attempts: number;
  payload: OfflinePayload;
}

/**
 * Bounded offline staff session grant. Deliberately contains NO tokens or
 * credentials — only identity/role facts needed to author queued work. Sync
 * always authenticates with a live online Supabase session.
 */
export interface OfflineSession {
  operator_id: string;
  email: string;
  roles: string[];
  granted_at: string;
  expires_at: string;
}

export interface CachePatron {
  id: string;
  patron_id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  patron_category: string;
  faculty_name: string | null;
  status: string;
  membership_expires_at: string | null;
}

export interface CacheItem {
  id: string;
  title: string;
  authors: unknown;
  call_number: string | null;
  format: string;
  available_copies: number;
  total_copies: number;
}

export interface CacheCopy {
  item_id: string;
  barcode: string | null;
  status: string;
}

export interface CacheLoan {
  id: string;
  patron_id: string;
  catalogue_item_id: string;
  checkout_date: string;
  due_date: string;
  renewed_count: number | null;
  status: string;
}

export interface CacheHold {
  id: string;
  patron_id: string;
  catalogue_item_id: string;
  status: string;
  priority: number | null;
}

export interface CacheRules {
  loanRules: Record<string, { maxItems: number; durationDays: number; renewals: number }>;
  fineRatePerDay: number;
  examOneDates: { start: string; end: string };
  examTwoDates: { start: string; end: string };
  libraryName: string;
}

export interface OfflineCache {
  fetched_at: string;
  max_age_hours: number;
  rules: CacheRules;
  rules_fingerprint: string;
  patrons: CachePatron[];
  items: CacheItem[];
  copies: CacheCopy[];
  loans: CacheLoan[];
  holds: CacheHold[];
  truncated: Record<string, boolean>;
}

export interface SyncResultRow {
  client_txn_id: string;
  local_seq: number;
  status: 'APPLIED' | 'ALREADY_APPLIED' | 'CONFLICT' | 'REJECTED' | 'RETRYABLE_ERROR';
  conflict_code?: string | null;
  message: string;
  server_entity_id?: string | null;
}

export interface SyncSummary {
  results: SyncResultRow[];
  applied: number;
  already_applied: number;
  conflicts: number;
  rejected: number;
  retryable: number;
}

export type ConnectivityState = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'DEGRADED' | 'SYNC_ERROR';
