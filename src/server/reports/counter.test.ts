import { describe, it, expect } from 'vitest';
import { counterToCsv } from '@/server/reports/counter';

describe('counter', () => {
  it('converts COUNTER report to CSV', () => {
    const report = {
      report: 'TR',
      version: '5.0',
      created: '2026-01-01T00:00:00Z',
      rows: [{ Database: 'Test', Publisher: 'ESUT', Total_Item_Investigations: '100' }],
    };
    const csv = counterToCsv(report);
    expect(csv).toContain('Database,Publisher,Total_Item_Investigations');
    expect(csv).toContain('Test,ESUT,100');
  });

  it('handles empty report', () => {
    const report = { report: 'TR', version: '5.0', created: '', rows: [] };
    const csv = counterToCsv(report);
    expect(csv).toBe('');
  });
});
