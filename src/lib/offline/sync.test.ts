import { describe, it, expect, beforeEach, vi } from 'vitest';
import { syncNow, refreshOfflineCache, resolveConflict, isSyncInFlight, _testUtils } from './sync';
import { OfflineStore, createMemoryBackend, resetMemoryBackend } from './store';
import type { CheckoutPayload, OfflineCache, SyncSummary } from './types';

const BACKEND = 'sync-tests';

function checkoutPayload(over: Partial<CheckoutPayload> = {}): CheckoutPayload {
  return {
    patron_id: 'patron-1',
    catalogue_item_id: 'item-1',
    patron_name: 'Amaka Obi',
    item_title: 'Physics for Engineers',
    rules_fingerprint: 'fp',
    ...over,
  };
}

function makeCache(): OfflineCache {
  return {
    fetched_at: new Date().toISOString(),
    max_age_hours: 48,
    rules: { loanRules: {}, fineRatePerDay: 50, examOneDates: { start: '2026-05-15', end: '2026-05-30' }, examTwoDates: { start: '2025-12-01', end: '2025-12-20' }, libraryName: 'ESUT' },
    rules_fingerprint: 'fp-current',
    patrons: [],
    items: [],
    copies: [],
    loans: [],
    holds: [],
    truncated: {},
  };
}

interface SyncPostBody {
  device_id?: string;
  label?: string;
  branch?: string;
  transactions?: Array<{ client_txn_id: string; local_seq: number }>;
}

interface RecordedCall {
  url: string;
  body: SyncPostBody | null;
}

function makeFetch(opts: { delayMs?: number; handler?: (url: string, body: SyncPostBody | null) => unknown } = {}) {
  const calls: RecordedCall[] = [];
  const fetchFn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    const body = init?.body ? (JSON.parse(String(init.body)) as SyncPostBody) : null;
    calls.push({ url: u, body });
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    if (opts.handler) {
      const payload = opts.handler(u, body);
      return { ok: true, status: 200, json: async () => payload } as unknown as Response;
    }
    if (u.includes('/offline-cache')) {
      return { ok: true, status: 200, json: async () => ({ success: true, cache: makeCache() }) } as unknown as Response;
    }
    const results = ((body?.transactions ?? []) as Array<{ client_txn_id: string; local_seq: number }>).map((t) => ({
      client_txn_id: t.client_txn_id,
      local_seq: t.local_seq,
      status: 'APPLIED' as const,
      message: 'Applied',
    }));
    const summary: SyncSummary = {
      results,
      applied: results.length,
      already_applied: 0,
      conflicts: 0,
      rejected: 0,
      retryable: 0,
    };
    return { ok: true, status: 200, json: async () => summary } as unknown as Response;
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, calls, mock: fetchFn };
}

function depsFor(store: OfflineStore, fetchFn: typeof fetch, token: string | null = 'token-1') {
  return { store, fetchFn, getAccessToken: async () => token };
}

const syncCalls = (calls: RecordedCall[]) => calls.filter((c) => c.url.includes('/circulation/offline-sync'));

describe('client offline sync (reconnect, chunking, conflict handling)', () => {
  beforeEach(() => {
    resetMemoryBackend(BACKEND);
  });

  it('reconnect sync posts queued txs in local_seq order, clears applied rows, refreshes cache', async () => {
    const store = new OfflineStore(createMemoryBackend(BACKEND));
    await store.enqueue('checkout', checkoutPayload(), 'op-a');
    await store.enqueue('checkin', { patron_id: 'p', catalogue_item_id: 'i', patron_name: 'n', item_title: 't' }, 'op-a');
    await store.saveCache({ fetched_at: '2026-10-03T00:00:00.000Z' } as OfflineCache);

    const { fetchFn, calls } = makeFetch();
    const summary = await syncNow(depsFor(store, fetchFn));

    expect(summary).not.toBeNull();
    expect(summary!.applied).toBe(2);
    expect(await store.listQueue()).toHaveLength(0); // applied rows removed
    expect(await store.getLastSync()).not.toBeNull();

    const posted = syncCalls(calls);
    expect(posted).toHaveLength(1);
    const first = posted[0]!;
    expect(first.body!.transactions!.map((t) => t.local_seq)).toEqual([1, 2]);
    expect(first.body!.device_id).toBe(await store.getDeviceId());

    // Post-sync cache refresh so the desk reflects server truth.
    expect(calls.some((c) => c.url.includes('/circulation/offline-cache'))).toBe(true);
    const cache = await store.loadCache();
    expect(cache?.rules_fingerprint).toBe('fp-current');
  });

  it('concurrent sync calls join one in-flight run (no double submit)', async () => {
    const store = new OfflineStore(createMemoryBackend(BACKEND));
    await store.enqueue('checkout', checkoutPayload(), 'op-a');
    const { fetchFn, calls } = makeFetch({ delayMs: 40 });

    const p1 = syncNow(depsFor(store, fetchFn));
    expect(isSyncInFlight()).toBe(true);
    const p2 = syncNow(depsFor(store, fetchFn));
    expect(p2).toBe(p1); // second caller joins the same run

    const [s1, s2] = await Promise.all([p1, p2]);
    expect(s1).toEqual(s2);
    expect(isSyncInFlight()).toBe(false);
    expect(syncCalls(calls)).toHaveLength(1); // exactly one POST despite two calls
    expect(await store.listQueue()).toHaveLength(0);
  });

  it('conflict results are kept in the queue with their conflict code (not removed)', async () => {
    const store = new OfflineStore(createMemoryBackend(BACKEND));
    const tx = await store.enqueue('checkout', checkoutPayload(), 'op-a');

    const { fetchFn } = makeFetch({
      handler: () => ({
        results: [
          {
            client_txn_id: tx.client_txn_id,
            local_seq: 1,
            status: 'CONFLICT',
            conflict_code: 'ITEM_ALREADY_CHECKED_OUT',
            message: 'Item already checked out to this patron.',
          },
        ],
        applied: 0,
        already_applied: 0,
        conflicts: 1,
        rejected: 0,
        retryable: 0,
      }),
    });

    const summary = await syncNow(depsFor(store, fetchFn));
    expect(summary!.conflicts).toBe(1);

    const queued = await store.getTx(tx.client_txn_id);
    expect(queued).not.toBeNull();
    expect(queued!.state).toBe('conflict');
    expect(queued!.conflict_code).toBe('ITEM_ALREADY_CHECKED_OUT');
    expect(queued!.attempts).toBe(1);
  });

  it('rejected and retryable results keep the row with distinct states', async () => {
    const store = new OfflineStore(createMemoryBackend(BACKEND));
    const rejectedTx = await store.enqueue('checkout', checkoutPayload(), 'op-a');
    const retryTx = await store.enqueue('checkout', checkoutPayload({ catalogue_item_id: 'item-2' }), 'op-a');

    const { fetchFn } = makeFetch({
      handler: () => ({
        results: [
          { client_txn_id: rejectedTx.client_txn_id, local_seq: 1, status: 'REJECTED', conflict_code: 'PATRON_NOT_FOUND', message: 'Patron no longer exists.' },
          { client_txn_id: retryTx.client_txn_id, local_seq: 2, status: 'RETRYABLE_ERROR', conflict_code: 'SYNC_IN_PROGRESS', message: 'Another sync is processing.' },
        ],
        applied: 0,
        already_applied: 0,
        conflicts: 0,
        rejected: 1,
        retryable: 1,
      }),
    });

    await syncNow(depsFor(store, fetchFn));
    expect((await store.getTx(rejectedTx.client_txn_id))!.state).toBe('rejected');
    const retried = await store.getTx(retryTx.client_txn_id);
    expect(retried!.state).toBe('pending');
    expect(retried!.conflict_code).toBe('SYNC_IN_PROGRESS');
  });

  it('large queues are chunked into requests of at most 100 transactions', async () => {
    const store = new OfflineStore(createMemoryBackend(BACKEND));
    for (let i = 0; i < 105; i += 1) {
      await store.enqueue('checkout', checkoutPayload(), 'op-a');
    }

    const { fetchFn, calls } = makeFetch();
    const summary = await syncNow(depsFor(store, fetchFn));

    const posted = syncCalls(calls);
    expect(posted).toHaveLength(2);
    expect(posted[0].body!.transactions).toHaveLength(100);
    expect(posted[1].body!.transactions).toHaveLength(5);
    expect(summary!.applied).toBe(105);
    expect(await store.listQueue()).toHaveLength(0);
    expect(_testUtils.CHUNK_SIZE).toBe(100);
  });

  it('sync without a session token fails without touching the queue', async () => {
    const store = new OfflineStore(createMemoryBackend(BACKEND));
    const tx = await store.enqueue('checkout', checkoutPayload(), 'op-a');
    const { fetchFn, calls } = makeFetch();

    await expect(syncNow(depsFor(store, fetchFn, null))).rejects.toThrow(/authentication required/i);
    expect(syncCalls(calls)).toHaveLength(0);
    expect(await store.getTx(tx.client_txn_id)).not.toBeNull();
  });

  it('refreshOfflineCache stores the fetched cache and returns null without a token', async () => {
    const store = new OfflineStore(createMemoryBackend(BACKEND));
    const { fetchFn } = makeFetch();

    const cache = await refreshOfflineCache(depsFor(store, fetchFn));
    expect(cache).not.toBeNull();
    expect((await store.loadCache())?.rules_fingerprint).toBe('fp-current');

    const empty = await refreshOfflineCache(depsFor(store, fetchFn, null));
    expect(empty).toBeNull();
  });

  it('resolveConflict applies the server decision locally (remove / retry)', async () => {
    const store = new OfflineStore(createMemoryBackend(BACKEND));
    const tx = await store.enqueue('checkout', checkoutPayload(), 'op-a');
    await store.setTxState(tx.client_txn_id, 'conflict', { conflict_code: 'HOLD_CONFLICT', message: 'hold' });

    // cancel / accept_server → server says remove
    const { fetchFn } = makeFetch({
      handler: () => ({ found: true, status: 'CONFLICT', conflict_code: 'HOLD_CONFLICT', resolution: 'cancel', client_action: 'remove' }),
    });
    const out = await resolveConflict(tx.client_txn_id, 'cancel', 'queued offline', depsFor(store, fetchFn));
    expect(out.found).toBe(true);
    expect(await store.getTx(tx.client_txn_id)).toBeNull();

    // retry → back to pending with resolution recorded
    const tx2 = await store.enqueue('checkout', checkoutPayload(), 'op-a');
    await store.setTxState(tx2.client_txn_id, 'conflict', { conflict_code: 'HOLD_CONFLICT', message: 'hold' });
    const retryFetch = makeFetch({
      handler: () => ({ found: true, status: 'PENDING', resolution: 'retry', client_action: 'retry' }),
    });
    await resolveConflict(tx2.client_txn_id, 'retry', '', depsFor(store, retryFetch.fetchFn));
    const requeued = await store.getTx(tx2.client_txn_id);
    expect(requeued!.state).toBe('pending');
    expect(requeued!.resolution).toBe('retry');
  });
});
