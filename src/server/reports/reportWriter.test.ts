import { describe, it, expect } from 'vitest';
import { reportToCsv } from '@/server/reports/reportWriter';

describe('reportWriter', () => {
  it('converts data to CSV with headers', () => {
    const data = [{ id: '1', name: 'Test' }];
    const csv = reportToCsv(data);
    expect(csv).toContain('id,name');
    expect(csv).toContain('1,Test');
  });

  it('handles empty data', () => {
    const csv = reportToCsv([]);
    expect(csv).toBe('');
  });

  it('escapes commas in values', () => {
    const data = [{ name: 'Doe, John' }];
    const csv = reportToCsv(data);
    expect(csv).toContain('"Doe, John"');
  });

  it('handles null values', () => {
    const data = [{ id: '1', name: null }];
    const csv = reportToCsv(data);
    expect(csv).toContain('1,');
  });
});
