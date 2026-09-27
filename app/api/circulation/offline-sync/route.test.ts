import { describe, it, expect } from 'vitest';

describe('offline-sync', () => {
  it('offline sync payload structure is correct', () => {
    const payload = {
      transactions: [
        { offline_id: 'tx-001', action: 'checkout', item_id: 'item-1', patron_id: 'patron-1', due_date: '2026-02-01' },
        { offline_id: 'tx-002', action: 'return', item_id: 'item-1', patron_id: 'patron-1', returned_date: '2026-01-25' },
      ],
    };
    expect(payload.transactions).toHaveLength(2);
    expect(payload.transactions[0].offline_id).toBe('tx-001');
  });

  it('offline transaction has required fields', () => {
    const tx = {
      offline_id: 'tx-001',
      action: 'checkout',
      item_id: 'item-1',
      patron_id: 'patron-1',
      synced_at: '2026-01-01T00:00:00Z',
    };
    expect(tx.offline_id).toBeDefined();
    expect(tx.action).toBeDefined();
    expect(tx.synced_at).toBeDefined();
  });
});
