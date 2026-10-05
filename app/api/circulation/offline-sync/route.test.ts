import { describe, it, expect } from 'vitest';
import {
  syncOfflineBatch,
  BatchValidationError,
  MAX_BATCH_SIZE,
  type SyncContext,
} from '@/server/circulation/offlineSync';

/**
 * Contract tests for POST /api/circulation/offline-sync.
 *
 * The route authenticates the caller and delegates to syncOfflineBatch,
 * converting BatchValidationError into a 400 response. These tests pin the
 * request-shape rules the route therefore enforces, using a store stub that
 * must never be touched when validation fails.
 */
const neverStore = {
  async getLedger() {
    throw new Error('store must not be touched for invalid batches');
  },
} as never;

const ctx: SyncContext = { operatorId: 'op-test', roles: ['librarian'] };

function validTx(over: Record<string, unknown> = {}) {
  return {
    client_txn_id: '4a7f2f1e-0000-4000-8000-000000000001',
    local_seq: 1,
    operation: 'checkout',
    payload: { patron_id: 'p1', catalogue_item_id: 'i1' },
    ...over,
  };
}

function post(body: Record<string, unknown>) {
  return syncOfflineBatch(body as never, ctx, neverStore);
}

describe('POST /api/circulation/offline-sync request contract', () => {
  it('rejects a batch without a device_id', async () => {
    await expect(post({ device_id: '', transactions: [validTx()] })).rejects.toThrow(BatchValidationError);
    await expect(post({ transactions: [validTx()] })).rejects.toThrow(/device_id required/);
  });

  it('rejects a batch with no transactions or more than the server maximum', async () => {
    await expect(post({ device_id: 'dev-1', transactions: [] })).rejects.toThrow(/transactions array required/);
    await expect(
      post({
        device_id: 'dev-1',
        transactions: Array.from({ length: MAX_BATCH_SIZE + 1 }, (_, i) => validTx({ local_seq: i })),
      }),
    ).rejects.toThrow(/maximum of 500/);
  });

  it('rejects transactions with malformed identity or operation fields', async () => {
    await expect(post({ device_id: 'dev-1', transactions: [validTx({ client_txn_id: 'tx-1' })] })).rejects.toThrow(/uuid/i);
    await expect(post({ device_id: 'dev-1', transactions: [validTx({ local_seq: -1 })] })).rejects.toThrow(/local_seq/);
    await expect(post({ device_id: 'dev-1', transactions: [validTx({ operation: 'return' })] })).rejects.toThrow(/operation must be/);
    await expect(post({ device_id: 'dev-1', transactions: [validTx({ payload: null })] })).rejects.toThrow(/payload object required/);
  });
});
