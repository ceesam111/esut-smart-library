import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLimit = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/server/supabase/adminClient', () => ({
  getSupabaseAdminClient: () => ({
    from: mockFrom,
  }),
}));

import { generateReport, reportToCsv } from '@/server/reports/reportWriter';

describe('reportWriter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ limit: mockLimit });
  });

  describe('serials report', () => {
    it('queries serials_subscriptions with correct columns', async () => {
      const mockData = [
        { id: '1', title: 'Journal A', issn: '1234-5678', publisher: 'Pub A', status: 'active', start_date: '2025-01-01', renewal_date: '2026-01-01' },
      ];
      mockLimit.mockResolvedValue({ data: mockData, error: null });

      const result = await generateReport({ type: 'serials', startDate: '2025-01-01', endDate: '2025-12-31', format: 'json' });
      expect(result.type).toBe('serials');
      expect(result.rowCount).toBe(1);
      expect(result.data[0].title).toBe('Journal A');
    });

    it('does not reference nonexistent end_date column', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await generateReport({ type: 'serials', startDate: '2025-01-01', endDate: '2025-12-31', format: 'json' });
      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining('renewal_date')
      );
      const selectArg = mockSelect.mock.calls[0][0];
      expect(selectArg).not.toContain('end_date');
    });
  });

  describe('reportToCsv', () => {
    it('returns empty string for empty data', () => {
      expect(reportToCsv([])).toBe('');
    });

    it('generates valid CSV for populated data', () => {
      const data = [{ name: 'Test', value: 42 }];
      const csv = reportToCsv(data);
      expect(csv).toContain('name,value');
      expect(csv).toContain('Test,42');
    });
  });
});
