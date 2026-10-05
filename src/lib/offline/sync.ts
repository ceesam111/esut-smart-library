import { OfflineStore, offlineStore as defaultStore } from './store';
import type { OfflineCache, SyncSummary, SyncResultRow } from './types';

export interface SyncDeps {
  store: OfflineStore;
  getAccessToken: () => Promise<string | null>;
  fetchFn: typeof fetch;
}

const CHUNK_SIZE = 100;

let inFlight: Promise<SyncSummary | null> | null = null;

export function isSyncInFlight(): boolean {
  return inFlight !== null;
}

async function postChunk(
  deps: SyncDeps,
  body: Record<string, unknown>,
): Promise<SyncSummary> {
  const token = await deps.getAccessToken();
  if (!token) throw new Error('Authentication required to sync.');
  const res = await deps.fetchFn('/api/circulation/offline-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as (SyncSummary & { success?: boolean; error?: string }) | null;
  if (!res.ok || !json?.results) {
    throw new Error(json?.error ?? `Sync failed with status ${res.status}`);
  }
  return json;
}

export async function refreshOfflineCache(deps: SyncDeps): Promise<OfflineCache | null> {
  const token = await deps.getAccessToken();
  if (!token) return null;
  const res = await deps.fetchFn('/api/circulation/offline-cache', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as { success?: boolean; cache?: OfflineCache } | null;
  if (!json?.cache) return null;
  await deps.store.saveCache(json.cache);
  return json.cache;
}

async function applyResults(deps: SyncDeps, results: SyncResultRow[]): Promise<void> {
  for (const row of results) {
    if (row.status === 'APPLIED' || row.status === 'ALREADY_APPLIED') {
      await deps.store.removeTx(row.client_txn_id);
    } else if (row.status === 'CONFLICT') {
      await deps.store.setTxState(row.client_txn_id, 'conflict', {
        conflict_code: row.conflict_code ?? null,
        message: row.message,
        resolution: null,
        bumpAttempts: true,
      });
    } else if (row.status === 'REJECTED') {
      await deps.store.setTxState(row.client_txn_id, 'rejected', {
        conflict_code: row.conflict_code ?? null,
        message: row.message,
        bumpAttempts: true,
      });
    } else {
      await deps.store.setTxState(row.client_txn_id, 'pending', {
        conflict_code: row.conflict_code ?? null,
        message: row.message,
        bumpAttempts: true,
      });
    }
  }
}

/**
 * Sync the durable queue. Concurrency-safe: a module-level mutex means a
 * second call joins the in-flight sync instead of double-submitting (server
 * also guards with per-transaction PENDING claims). Transactions are sent in
 * local_seq order, chunked (100 per request, max 500 per request server-side).
 * After apply, the circulation cache is refreshed so the desk immediately
 * reflects server-authoritative state.
 */
export function syncNow(deps: Partial<SyncDeps> = {}): Promise<SyncSummary | null> {
  if (inFlight) return inFlight;
  inFlight = runSync({
    store: deps.store ?? defaultStore,
    getAccessToken: deps.getAccessToken ?? defaultGetAccessToken,
    fetchFn: deps.fetchFn ?? fetch,
  }).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function defaultGetAccessToken(): Promise<string | null> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function runSync(deps: SyncDeps): Promise<SyncSummary | null> {
  const queue = await deps.store.listQueue();
  const pending = queue.filter((tx) => tx.state === 'pending');
  if (pending.length === 0) return null;

  const deviceId = await deps.store.getDeviceId();
  const cache = await deps.store.loadCache();
  const cacheFetchedAt = cache?.fetched_at ?? null;
  const totals: SyncSummary = {
    results: [],
    applied: 0,
    already_applied: 0,
    conflicts: 0,
    rejected: 0,
    retryable: 0,
  };

  for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
    const chunk = pending.slice(i, i + CHUNK_SIZE);
    const summary = await postChunk(deps, {
      device_id: deviceId,
      label: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : 'circulation-desk',
      branch: '',
      transactions: chunk.map((tx) => ({
        client_txn_id: tx.client_txn_id,
        local_seq: tx.local_seq,
        operation: tx.operation,
        client_timestamp: tx.client_timestamp,
        cache_fetched_at: cacheFetchedAt,
        queued_by: tx.queued_by,
        payload: tx.payload,
      })),
    });
    await applyResults(deps, summary.results);
    totals.results.push(...summary.results);
    totals.applied += summary.applied;
    totals.already_applied += summary.already_applied;
    totals.conflicts += summary.conflicts;
    totals.rejected += summary.rejected;
    totals.retryable += summary.retryable;
  }

  await deps.store.setLastSync(new Date().toISOString());
  await refreshOfflineCache(deps).catch(() => null);
  return totals;
}

export interface ResolveResponse {
  found: boolean;
  status?: string;
  conflict_code?: string | null;
  message?: string;
  resolution?: string | null;
  client_action?: 'retry' | 'remove' | 'keep';
  error?: string;
}

export async function resolveConflict(
  clientTxnId: string,
  action: 'retry' | 'accept_server' | 'cancel' | 'override',
  note: string,
  deps: Partial<SyncDeps> = {},
): Promise<ResolveResponse> {
  const store = deps.store ?? defaultStore;
  const getAccessToken = deps.getAccessToken ?? defaultGetAccessToken;
  const fetchFn = deps.fetchFn ?? fetch;
  const token = await getAccessToken();
  if (!token) throw new Error('Authentication required.');
  const res = await fetchFn('/api/circulation/offline-resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ client_txn_id: clientTxnId, action, note }),
  });
  const json = (await res.json().catch(() => null)) as ResolveResponse | null;
  if (!res.ok || !json) throw new Error(json?.error ?? `Resolve failed with status ${res.status}`);

  if (json.client_action === 'remove') {
    await store.removeTx(clientTxnId);
  } else if (json.client_action === 'retry') {
    await store.setTxState(clientTxnId, 'pending', { conflict_code: null, message: 'Queued for retry.', resolution: 'retry' });
  } else if (json.status === 'CONFLICT' || json.status === 'REJECTED') {
    await store.setTxState(clientTxnId, json.status === 'CONFLICT' ? 'conflict' : 'rejected', {
      conflict_code: json.conflict_code ?? null,
      message: json.message,
      resolution: 'override',
    });
  }
  return json;
}

export const _testUtils = { CHUNK_SIZE, runSync, applyResults, isSyncInFlight: () => inFlight !== null };
