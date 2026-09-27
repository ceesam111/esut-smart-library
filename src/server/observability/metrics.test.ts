import { describe, it, expect } from 'vitest';

describe('metrics', () => {
  it('metrics structure is correct', () => {
    const metrics = {
      timestamp: '2026-01-01T00:00:00Z',
      uptime: 100,
      database: { connected: true, tableCount: 121 },
      storage: { buckets: 3 },
      email: { provider: 'gmail', status: 'configured' },
      analytics: { totalEvents: 0, eventsLast24h: 0 },
      repository: { totalItems: 0, publishedItems: 0 },
      catalogue: { totalItems: 0 },
      circulation: { activeLoans: 0, overdueLoans: 0 },
    };
    expect(metrics.database.connected).toBe(true);
    expect(metrics.database.tableCount).toBe(121);
  });
});
