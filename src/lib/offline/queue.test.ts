import { describe, it, expect, beforeEach } from 'vitest';
import { OfflineStore, createMemoryBackend, resetMemoryBackend } from './store';
import type { CheckoutPayload, OfflineSession, OfflineCache } from './types';

const BACKEND = 'queue-tests';

function checkoutPayload(over: Partial<CheckoutPayload> = {}): CheckoutPayload {
  return {
    patron_id: 'patron-1',
    catalogue_item_id: 'item-1',
    patron_name: 'Amaka Obi',
    item_title: 'Physics for Engineers',
    rules_fingerprint: 'fingerprint-1',
    ...over,
  };
}

function makeSession(over: Partial<OfflineSession> = {}): OfflineSession {
  return {
    operator_id: 'op-a',
    email: 'librarian@example.com',
    roles: ['librarian'],
    granted_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 12 * 3600_000).toISOString(),
    ...over,
  };
}

function makeCache(over: Partial<OfflineCache> = {}): OfflineCache {
  return {
    fetched_at: new Date().toISOString(),
    max_age_hours: 48,
    rules: { loanRules: {}, fineRatePerDay: 50, examOneDates: { start: '2026-05-15', end: '2026-05-30' }, examTwoDates: { start: '2025-12-01', end: '2025-12-20' }, libraryName: 'ESUT' },
    rules_fingerprint: 'fingerprint-1',
    patrons: [],
    items: [],
    copies: [],
    loans: [],
    holds: [],
    truncated: {},
    ...over,
  };
}

describe('offline queue store (durable, IndexedDB-backed in the browser)', () => {
  beforeEach(() => {
    resetMemoryBackend(BACKEND);
  });

  it('enqueue assigns monotonic local_seq and survives a store reload (same durable backend)', async () => {
    const store1 = new OfflineStore(createMemoryBackend(BACKEND));
    const a = await store1.enqueue('checkout', checkoutPayload(), 'op-a');
    const b = await store1.enqueue('checkin', { loan_id: 'loan-1', patron_id: 'p', catalogue_item_id: 'i', patron_name: 'n', item_title: 't' }, 'op-a');
    expect(a.local_seq).toBe(1);
    expect(b.local_seq).toBe(2);

    // "Reload": a brand-new store instance over the same named backend sees both.
    const store2 = new OfflineStore(createMemoryBackend(BACKEND));
    const queue = await store2.listQueue();
    expect(queue.map((t) => t.local_seq)).toEqual([1, 2]);
    expect(queue[0].client_txn_id).toBe(a.client_txn_id);
    expect(queue[0].queued_by).toBe('op-a');
    expect(queue[0].state).toBe('pending');
  });

  it('logout clears the session grant but preserves the queued work', async () => {
    const store = new OfflineStore(createMemoryBackend(BACKEND));
    await store.saveSession(makeSession());
    await store.enqueue('checkout', checkoutPayload(), 'op-a');

    await store.clearSession();

    expect(await store.loadSession()).toBeNull();
    const queue = await store.listQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].state).toBe('pending');
  });

  it('an expired session grant is treated as missing without touching the queue', async () => {
    const store = new OfflineStore(createMemoryBackend(BACKEND));
    await store.saveSession(makeSession({ expires_at: new Date(Date.now() - 1000).toISOString() }));
    await store.enqueue('checkout', checkoutPayload(), 'op-a');

    expect(await store.loadSession()).toBeNull();
    expect(await store.listQueue()).toHaveLength(1);
  });

  it('a different operator on the same workstation keeps original queued_by attribution', async () => {
    const store = new OfflineStore(createMemoryBackend(BACKEND));
    await store.enqueue('checkout', checkoutPayload(), 'operator-one');

    // Second staff member signs in on the same machine; queue is unchanged and
    // still attributed to the operator who performed the work.
    const queue = await store.listQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].queued_by).toBe('operator-one');

    const deviceIdBefore = await store.getDeviceId();
    const store2 = new OfflineStore(createMemoryBackend(BACKEND));
    expect(await store2.getDeviceId()).toBe(deviceIdBefore);

    // New work by the second operator is attributed separately.
    const next = await store2.enqueue('checkin', { patron_id: 'p', catalogue_item_id: 'i', patron_name: 'n', item_title: 't' }, 'operator-two');
    expect(next.queued_by).toBe('operator-two');
    expect(await store2.listQueue()).toHaveLength(2);
  });

  it('tracks conflict state, resolution and removal (post-apply cleanup)', async () => {
    const store = new OfflineStore(createMemoryBackend(BACKEND));
    const tx = await store.enqueue('checkout', checkoutPayload(), 'op-a');

    await store.setTxState(tx.client_txn_id, 'conflict', {
      conflict_code: 'MAX_LOANS_REACHED',
      message: 'Patron already has 4 active loans.',
      bumpAttempts: true,
    });
    let stored = await store.getTx(tx.client_txn_id);
    expect(stored!.state).toBe('conflict');
    expect(stored!.conflict_code).toBe('MAX_LOANS_REACHED');
    expect(stored!.attempts).toBe(1);

    await store.setTxState(tx.client_txn_id, 'pending', { conflict_code: null, message: 'Queued for retry.', resolution: 'retry' });
    stored = await store.getTx(tx.client_txn_id);
    expect(stored!.state).toBe('pending');
    expect(stored!.resolution).toBe('retry');

    await store.removeTx(tx.client_txn_id);
    expect(await store.getTx(tx.client_txn_id)).toBeNull();
    expect(await store.listQueue()).toHaveLength(0);
  });

  it('cache and lastSync persist across reloads', async () => {
    const store1 = new OfflineStore(createMemoryBackend(BACKEND));
    const cache = makeCache({ patrons: [] });
    await store1.saveCache(cache);
    await store1.setLastSync('2026-10-04T12:00:00.000Z');

    const store2 = new OfflineStore(createMemoryBackend(BACKEND));
    const loaded = await store2.loadCache();
    expect(loaded?.rules_fingerprint).toBe('fingerprint-1');
    expect(await store2.getLastSync()).toBe('2026-10-04T12:00:00.000Z');
  });
});
