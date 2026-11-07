import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { PortalResourceItem } from '@/lib/accreditationApi';
import type { ScholarlyResourceRow } from '@/server/accreditation/types';

vi.mock('@/server/supabase/pagedQuery', () => ({ fetchAllPaged: vi.fn() }));
vi.mock('@/server/supabase/adminClient', () => ({ getSupabaseAdminClient: vi.fn() }));
vi.mock('@/server/accreditation/localRecords', () => ({ loadLocalRecords: vi.fn() }));
vi.mock('@/server/accreditation/liveOaSearch', () => ({ searchLiveOpenAccess: vi.fn() }));
vi.mock('@/server/logging/logger', () => ({
  childLogger: vi.fn(() => ({
    http: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { GET } from './route';
import { fetchAllPaged } from '@/server/supabase/pagedQuery';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { loadLocalRecords } from '@/server/accreditation/localRecords';
import { searchLiveOpenAccess } from '@/server/accreditation/liveOaSearch';

interface ResourcesPayload {
  success: boolean;
  data: {
    total: number;
    matchedTotal: number;
    externalTotal: number;
    liveTotal: number;
    effectiveYearFrom: number;
    effectiveYearTo: number;
    expanded: boolean;
    items: PortalResourceItem[];
    typeFacets: Array<{ type: string; count: number }>;
    providerFacets: Array<{ provider: string; label: string; count: number }>;
  };
}

interface YearWindow {
  gte: number;
  lte: number;
}

const windows: YearWindow[] = [];
let rowQueue: ScholarlyResourceRow[][] = [];
let liveQueue: PortalResourceItem[][] = [];
let pendingGte: number | null = null;
let pendingLte: number | null = null;

const createRecordingClient = () => {
  const makeBuilder = () => {
    const bag: Record<string, unknown> = {};
    const self = () => bag;
    bag.select = self;
    bag.eq = self;
    bag.order = self;
    bag.range = self;
    bag.contains = self;
    bag.not = self;
    bag.gte = (column: string, value: number) => {
      if (column === 'publication_year') pendingGte = value;
      return bag;
    };
    bag.lte = (column: string, value: number) => {
      if (column === 'publication_year') pendingLte = value;
      return bag;
    };
    return bag;
  };
  return { from: () => makeBuilder() };
};

const dbRow = (overrides: Partial<ScholarlyResourceRow>): ScholarlyResourceRow => ({
  id: 'row-1',
  source_provider: 'openalex',
  external_id: 'ext-1',
  resource_type: 'ebook',
  title: 'Dengue in schools',
  creators: ['A. Obi'],
  publisher: 'Test Press',
  publication_date: '2024-05-01',
  publication_year: 2024,
  doi: '10.1000/dengue1',
  isbn: null,
  issn: null,
  language: 'en',
  subject_headings: ['Dengue'],
  abstract_text: 'A study of dengue in schools.',
  landing_page_url: 'https://example.com/1',
  full_text_url: 'https://example.com/1.pdf',
  access_state: 'full_text',
  open_access: true,
  verification_status: 'verified',
  verification_http_status: 200,
  verification_checked_at: '2026-01-01T00:00:00Z',
  programmes: ['all'],
  matched_terms: ['dengue'],
  relevance_score: 0.9,
  first_indexed_at: '2026-01-01T00:00:00Z',
  last_synced_at: '2026-01-01T00:00:00Z',
  is_active: true,
  ...overrides,
});

const liveItem = (overrides: Partial<PortalResourceItem>): PortalResourceItem => ({
  key: 'live:openalex:x',
  recordSource: 'external',
  sourceProvider: 'openalex',
  sourceLabel: 'OpenAlex (live)',
  resourceType: 'research_article',
  title: 'Dengue fever',
  creators: ['A. Obi'],
  year: 2024,
  publisher: null,
  doi: null,
  abstract: null,
  subjects: ['Virology'],
  landingUrl: 'https://example.com/x',
  fullTextUrl: 'https://example.com/x.pdf',
  accessState: 'full_text',
  openAccess: true,
  verification: null,
  availability: null,
  relevanceScore: null,
  matchedTerms: [],
  ...overrides,
});

const get = (params: Record<string, string>): Promise<Response> => {
  const url = new URL('http://localhost/api/accreditation/resources');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return GET(new NextRequest(url));
};

const anchorYear = (): number => Math.max(2026, new Date().getFullYear());

describe('accreditation resources route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    windows.length = 0;
    rowQueue = [];
    liveQueue = [];
    pendingGte = null;
    pendingLte = null;
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      createRecordingClient() as unknown as ReturnType<typeof getSupabaseAdminClient>,
    );
    vi.mocked(loadLocalRecords).mockResolvedValue(
      { items: [] } as unknown as Awaited<ReturnType<typeof loadLocalRecords>>,
    );
    vi.mocked(searchLiveOpenAccess).mockImplementation(async () => liveQueue.shift() ?? []);
    vi.mocked(fetchAllPaged).mockImplementation(
      async (fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) => {
        pendingGte = null;
        pendingLte = null;
        void fetchPage(0, 999);
        if (pendingGte !== null && pendingLte !== null) {
          windows.push({ gte: pendingGte, lte: pendingLte });
        }
        const rows = rowQueue.shift() ?? [];
        return { rows, error: null };
      },
    );
  });

  it('defaults to the latest five-year window', async () => {
    rowQueue = [[]];
    liveQueue = [[liveItem({ key: 'live:openalex:w1', title: 'Dengue fever', year: 2024 })]];
    const response = await get({ q: 'dengue' });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as ResourcesPayload;
    const anchor = anchorYear();
    expect(windows).toEqual([{ gte: anchor - 4, lte: anchor }]);
    expect(payload.data.effectiveYearFrom).toBe(anchor - 4);
    expect(payload.data.effectiveYearTo).toBe(anchor);
    expect(payload.data.expanded).toBe(false);
    expect(payload.data.liveTotal).toBe(1);
    expect(payload.data.matchedTotal).toBe(1);
    expect(vi.mocked(searchLiveOpenAccess)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(searchLiveOpenAccess)).toHaveBeenCalledWith({
      needle: 'dengue',
      yearFrom: anchor - 4,
      yearTo: anchor,
    });
    expect(vi.mocked(fetchAllPaged)).toHaveBeenCalledTimes(1);
  });

  it('extends five years back when nothing matches and auto-extend is on', async () => {
    rowQueue = [[]];
    liveQueue = [
      [],
      [liveItem({ key: 'live:doaj:old', title: 'Dengue outbreak 2019', year: 2019 })],
    ];
    const response = await get({ q: 'dengue', auto_extend: 'true' });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as ResourcesPayload;
    const anchor = anchorYear();
    const from = anchor - 4;
    expect(windows).toEqual([
      { gte: from, lte: anchor },
      { gte: 1900, lte: from - 1 },
    ]);
    expect(payload.data.expanded).toBe(true);
    expect(payload.data.effectiveYearFrom).toBe(from - 5);
    expect(payload.data.effectiveYearTo).toBe(anchor);
    expect(payload.data.matchedTotal).toBe(1);
    expect(payload.data.liveTotal).toBe(1);
    expect(payload.data.items.map((item) => item.key)).toEqual(['live:doaj:old']);
    expect(vi.mocked(searchLiveOpenAccess)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetchAllPaged)).toHaveBeenCalledTimes(2);
  });

  it('respects custom years and never auto-extends them', async () => {
    rowQueue = [[]];
    liveQueue = [[liveItem({ key: 'live:openalex:c1', title: 'Dengue in 2012', year: 2012 })]];
    const response = await get({ q: 'dengue', year_from: '2010', year_to: '2015' });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as ResourcesPayload;
    expect(windows).toEqual([{ gte: 2010, lte: 2015 }]);
    expect(payload.data.effectiveYearFrom).toBe(2010);
    expect(payload.data.effectiveYearTo).toBe(2015);
    expect(payload.data.expanded).toBe(false);
    expect(payload.data.matchedTotal).toBe(1);
    expect(vi.mocked(fetchAllPaged)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(searchLiveOpenAccess)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(searchLiveOpenAccess)).toHaveBeenCalledWith({
      needle: 'dengue',
      yearFrom: 2010,
      yearTo: 2015,
    });
  });

  it('ignores auto-extend when there is no search term', async () => {
    rowQueue = [[]];
    const response = await get({ auto_extend: 'true' });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as ResourcesPayload;
    const anchor = anchorYear();
    expect(windows).toEqual([{ gte: anchor - 4, lte: anchor }]);
    expect(payload.data.effectiveYearFrom).toBe(anchor - 4);
    expect(payload.data.expanded).toBe(false);
    expect(payload.data.liveTotal).toBe(0);
    expect(vi.mocked(fetchAllPaged)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(searchLiveOpenAccess)).not.toHaveBeenCalled();
  });

  it('merges live open-access results with database rows and facets', async () => {
    rowQueue = [[dbRow({ id: 'row-1', title: 'Dengue in schools' })]];
    liveQueue = [
      [
        liveItem({
          key: 'live:openalex:e1',
          title: 'Dengue transmission patterns',
          year: 2024,
          resourceType: 'ejournal',
        }),
        liveItem({
          key: 'live:doaj:a1',
          title: 'Dengue diagnosis update',
          year: 2023,
          resourceType: 'research_article',
          sourceProvider: 'doaj',
          sourceLabel: 'DOAJ (live)',
        }),
      ],
    ];
    const response = await get({ q: 'dengue' });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as ResourcesPayload;
    expect(payload.data.total).toBe(3);
    expect(payload.data.matchedTotal).toBe(3);
    expect(payload.data.externalTotal).toBe(3);
    expect(payload.data.liveTotal).toBe(2);
    const types = Object.fromEntries(payload.data.typeFacets.map((facet) => [facet.type, facet.count]));
    expect(types.ebook).toBe(1);
    expect(types.ejournal).toBe(1);
    expect(types.research_article).toBe(1);
    expect(payload.data.providerFacets.some((facet) => facet.provider === 'openalex')).toBe(true);
    expect(payload.data.providerFacets.some((facet) => facet.provider === 'doaj')).toBe(true);
  });

  it('clamps custom years to the 1900 floor', async () => {
    rowQueue = [[]];
    liveQueue = [[]];
    const response = await get({ q: 'dengue', year_from: '1500', year_to: '2015' });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as ResourcesPayload;
    expect(windows).toEqual([{ gte: 1900, lte: 2015 }]);
    expect(payload.data.effectiveYearFrom).toBe(1900);
    expect(payload.data.effectiveYearTo).toBe(2015);
    expect(payload.data.expanded).toBe(false);
  });
});
