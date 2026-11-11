import { describe, it, expect, vi, beforeEach } from 'vitest';

const publishedFixture = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Power Systems: Stability',
    item_type: 'thesis',
    authors: [{ name: 'A. Okonkwo' }],
    abstract: 'A study.',
    subjects: ['Engineering'],
    keywords: ['grid'],
    faculty_code: 'ENG',
    department: 'Electrical',
    year: 2024,
    language: 'English',
    doi: '10.1234/abcd',
    file_url: 'b2://bucket/a.pdf',
    checksum: 'abc123',
    embargo_until: null,
    visibility: 'global',
    status: 'published',
    view_count: 10,
    download_count: 2,
    created_at: '2026-08-14T10:00:00Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Water Quality Survey',
    item_type: 'journal',
    authors: [{ name: 'B. Eze' }],
    abstract: null,
    subjects: null,
    keywords: null,
    faculty_code: 'SCI',
    department: 'Chemistry',
    year: 2023,
    language: 'English',
    doi: null,
    file_url: null,
    checksum: null,
    embargo_until: null,
    visibility: 'global',
    status: 'published',
    view_count: 5,
    download_count: 0,
    created_at: '2026-08-20T10:00:00Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    title: 'Embargoed Study',
    item_type: 'journal',
    authors: [{ name: 'C. Obi' }],
    abstract: 'Secret for now.',
    subjects: ['Medicine'],
    keywords: null,
    faculty_code: 'SCI',
    department: 'Pharmacology',
    year: 2025,
    language: 'English',
    doi: null,
    file_url: 'b2://bucket/c.pdf',
    checksum: null,
    embargo_until: '2099-01-01T00:00:00Z',
    visibility: 'global',
    status: 'published',
    view_count: 1,
    download_count: 0,
    created_at: '2026-09-01T10:00:00Z',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    title: 'power systems stability',
    item_type: 'journal',
    authors: [{ name: 'A. Okonkwo' }],
    abstract: 'Journal version.',
    subjects: ['Engineering'],
    keywords: ['grid'],
    faculty_code: 'ENG',
    department: 'Electrical',
    year: 2025,
    language: 'English',
    doi: null,
    file_url: 'b2://bucket/d.pdf',
    checksum: 'def456',
    embargo_until: null,
    visibility: 'global',
    status: 'published',
    view_count: 3,
    download_count: 1,
    created_at: '2026-09-05T10:00:00Z',
  },
];

const depositFixture = [
  { created_at: '2026-08-14T10:00:00Z', status: 'published' },
  { created_at: '2026-08-20T10:00:00Z', status: 'published' },
  { created_at: '2026-09-01T10:00:00Z', status: 'submitted' },
];

const referrerFixture = [
  { referrer: 'https://www.google.com/search?q=esut' },
  { referrer: null },
  { referrer: 'https://chatgpt.com/c/abc' },
  { referrer: 'https://virtuallibrary.esut.edu.ng/repository' },
];

class ChainRecorder {
  table = '';
  calls: string[] = [];
  selectCols = '';
  head = false;
  eq(_col: string, _val: string) { this.calls.push(`eq:${_col}=${_val}`); return this; }
  gte(_col: string, _val: string) { this.calls.push(`gte:${_col}`); return this; }
  lt(_col: string, _val: string) { this.calls.push(`lt:${_col}`); return this; }
  is(_col: string, _val: unknown) { this.calls.push(`is:${_col}`); return this; }
  or(_expr: string) { this.calls.push(`or:${_expr}`); return this; }
  in(_col: string, _vals: string[]) { this.calls.push(`in:${_col}=${_vals.join('|')}`); return this; }
  select(cols: string, opts?: { count?: 'exact'; head?: boolean }) { this.selectCols = cols; this.head = opts?.head === true; this.calls.push('select'); return this; }
  limit(_n: number) { this.calls.push('limit'); return this; }
  then(resolve: (v: unknown) => void) {
    if (this.table === 'repository_items' && this.selectCols.startsWith('id, title')) {
      resolve({ data: publishedFixture, error: null, count: null });
    } else if (this.table === 'repository_items' && this.selectCols === 'created_at, status') {
      resolve({ data: depositFixture, error: null, count: null });
    } else if (this.table === 'repository_items' && this.head) {
      resolve({ data: null, error: null, count: 3 });
    } else if (this.table === 'analytics_events' && this.head) {
      resolve({ data: null, error: null, count: 42 });
    } else {
      resolve({ data: referrerFixture, error: null, count: null });
    }
  }
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

const mockRequireRole = vi.fn();
vi.mock('@/server/auth/requireRole', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

import { GET } from './route';

function makeRequest(query = '') {
  return new Request(`http://localhost/api/admin/analytics/research${query}`) as never;
}

describe('admin research visibility route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recorders.length = 0;
    mockRequireRole.mockResolvedValue(undefined);
  });

  it('rejects non-admin callers with 403', async () => {
    mockRequireRole.mockRejectedValue(new Error('Forbidden.'));
    const response = await GET(makeRequest());
    expect(response.status).toBe(403);
  });

  it('reports publication, thesis, and approved counts', async () => {
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.publications.published_total).toBe(4);
    expect(body.data.publications.published_theses).toBe(1);
    expect(body.data.publications.published_other).toBe(3);
    expect(body.data.publications.approved_awaiting_publish).toBe(3);
  });

  it('breaks publications down by faculty and department', async () => {
    const response = await GET(makeRequest());
    const body = await response.json();
    expect(body.data.publications.by_faculty).toContainEqual({ faculty_code: 'ENG', count: 2 });
    expect(body.data.publications.by_faculty).toContainEqual({ faculty_code: 'SCI', count: 2 });
    expect(body.data.publications.by_department).toContainEqual({ department: 'Electrical', count: 2 });
  });

  it('computes public full-text, embargo, and file integrity counts', async () => {
    const response = await GET(makeRequest());
    const body = await response.json();
    expect(body.data.public_full_text.records).toBe(2);
    expect(body.data.public_full_text.embargoed_records).toBe(1);
    expect(body.data.public_full_text.published_without_file).toBe(1);
    expect(body.data.public_full_text.published_file_without_checksum).toBe(1);
  });

  it('separates human event counts from counter totals and classifies referrers', async () => {
    const response = await GET(makeRequest());
    const body = await response.json();
    expect(body.data.engagement.human_views).toBe(42);
    expect(body.data.engagement.human_downloads).toBe(42);
    expect(body.data.engagement.counter_views_total).toBe(19);
    expect(body.data.engagement.referrers).toEqual({
      direct: 1, internal: 1, search_engine: 1, social: 0, ai_agent: 1, other: 0,
    });
  });

  it('applies the bot filter to every analytics_events query', async () => {
    await GET(makeRequest());
    const eventRecorders = recorders.filter((r) => r.table === 'analytics_events');
    expect(eventRecorders.length).toBeGreaterThan(0);
    for (const recorder of eventRecorders) {
      expect(recorder.calls).toContain('or:bot_flag.is.null,bot_flag.neq.BOT');
    }
  });

  it('buckets deposits over time by month', async () => {
    const response = await GET(makeRequest());
    const body = await response.json();
    expect(body.data.deposits_over_time).toEqual([
      { month: '2026-08', total: 2, byStatus: { published: 2 } },
      { month: '2026-09', total: 1, byStatus: { submitted: 1 } },
    ]);
  });

  it('detects duplicate titles across published records', async () => {
    const response = await GET(makeRequest());
    const body = await response.json();
    expect(body.data.duplicates.total_groups).toBe(1);
    expect(body.data.duplicates.groups[0].count).toBe(2);
    expect(body.data.duplicates.groups[0].items.map((i: { id: string }) => i.id).sort()).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444444',
    ]);
  });

  it('keeps external Google indexing explicitly unconfirmed', async () => {
    const response = await GET(makeRequest());
    const body = await response.json();
    expect(body.data.search_visibility.external.google_indexing_confirmed).toBe(false);
    expect(body.data.search_visibility.internal.note).toContain('do not confirm');
  });

  it('contains no patron or researcher personal identifiers', async () => {
    const response = await GET(makeRequest());
    const text = JSON.stringify(await response.json());
    expect(text).not.toContain('user_id');
    expect(text).not.toContain('patron');
    expect(text).not.toContain('ip_hash');
    expect(text).not.toContain('submitter');
  });

  it('echoes applied faculty and department filters', async () => {
    const response = await GET(makeRequest('?faculty=ENG&department=Electrical&days=30'));
    const body = await response.json();
    expect(body.data.filters_applied.faculty).toBe('ENG');
    expect(body.data.filters_applied.department).toBe('Electrical');
    expect(body.data.filters_applied.days).toBe(30);
    const itemRecorders = recorders.filter((r) => r.table === 'repository_items');
    for (const recorder of itemRecorders) {
      expect(recorder.calls).toContain('eq:faculty_code=ENG');
      expect(recorder.calls).toContain('eq:department=Electrical');
    }
  });

  it('paginates duplicate groups', async () => {
    const response = await GET(makeRequest('?page=2&page_size=1'));
    const body = await response.json();
    expect(body.data.duplicates.page).toBe(2);
    expect(body.data.duplicates.page_size).toBe(1);
    expect(body.data.duplicates.groups).toEqual([]);
  });

  it('exports CSV with an explicit unconfirmed indexing marker', async () => {
    const response = await GET(makeRequest('?format=csv'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    const text = await response.text();
    expect(text).toContain('# summary');
    expect(text).toContain('google_indexing_confirmed,false');
    expect(text).toContain('# duplicate_titles');
    expect(text).toContain('power systems stability');
  });
});
