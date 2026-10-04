import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });

class ChainRecorder {
  table = '';
  calls: string[] = [];
  eq(_col: string, _val: string) { this.calls.push(`eq:${_col}=${_val}`); return this; }
  gte(_col: string, _val: string) { this.calls.push(`gte:${_col}`); return this; }
  lt(_col: string, _val: string) { this.calls.push(`lt:${_col}`); return this; }
  is(_col: string, _val: unknown) { this.calls.push(`is:${_col}`); return this; }
  select(_cols: string) { this.calls.push('select'); return this; }
  limit(_n: number) { this.calls.push('limit'); return this; }
  insert(row: unknown) { mockInsert(row); return Promise.resolve({ data: null, error: null }); }
  then(resolve: (v: unknown) => void) { resolve({ count: 10, data: [] }); }
}

const recorders: ChainRecorder[] = [];
const mockFrom = vi.fn((table: string) => {
  const recorder = new ChainRecorder();
  recorder.table = table;
  recorders.push(recorder);
  return recorder;
});

vi.mock('@/server/supabase/adminClient', () => ({
  getSupabaseAdminClient: () => ({ from: mockFrom }),
}));

vi.mock('@/server/auth/requireRole', () => ({
  requireRole: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from './route';

describe('admin analytics route filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recorders.length = 0;
  });

  it('applies faculty, patron_role, and department filters to event queries', async () => {
    const request = new Request('http://localhost/api/admin/analytics?days=30&faculty=Science&patron_role=student&department=Physics') as never;
    const response = await GET(request);
    expect(response.status).toBe(200);

    const eventRecorders = recorders.filter((r) => r.table === 'analytics_events');
    expect(eventRecorders.length).toBeGreaterThan(0);
    for (const recorder of eventRecorders) {
      expect(recorder.calls).toContain('eq:faculty=Science');
      expect(recorder.calls).toContain('eq:patron_role=student');
      expect(recorder.calls).toContain('eq:department=Physics');
    }
  });

  it('omits filter predicates when no filters are provided', async () => {
    const request = new Request('http://localhost/api/admin/analytics?days=7') as never;
    const response = await GET(request);
    expect(response.status).toBe(200);

    const eventRecorders = recorders.filter((r) => r.table === 'analytics_events');
    expect(eventRecorders.length).toBeGreaterThan(0);
    for (const recorder of eventRecorders) {
      expect(recorder.calls.some((c) => c.startsWith('eq:faculty'))).toBe(false);
      expect(recorder.calls.some((c) => c.startsWith('eq:patron_role'))).toBe(false);
      expect(recorder.calls.some((c) => c.startsWith('eq:department'))).toBe(false);
    }
  });

  it('reports applied filters in the response payload', async () => {
    const request = new Request('http://localhost/api/admin/analytics?days=7&faculty=Science') as never;
    const response = await GET(request);
    const body = await response.json();
    expect(body.data.filters_applied.faculty).toBe('Science');
    expect(body.data.filters_applied.days).toBe(7);
  });
});
