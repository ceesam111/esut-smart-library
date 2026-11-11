import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchLocalResources } from './localSearch';

interface QueryRecord {
  table: string;
  eqFilters: Array<[string, string]>;
  orFilter: string | null;
  textSearch: { column: string; query: string; type: string | null } | null;
  limit: number | null;
}

interface TableError {
  code?: string;
  message: string;
}

interface MockSupabase {
  from: (table: string) => Record<string, unknown>;
}

const TENANT = 'tenant-esut';
const QUERY = 'digital libraries';

const CATALOGUE_ROW = {
  id: 'cat-1',
  title: 'Library science',
  authors: ['Smith, J.'],
  isbn: '9780000000001',
  doi: null,
  publisher: 'Test Press',
  year: 2020,
  subjects: null,
  source_url: null,
  cover_image: null,
};

const REPOSITORY_ROW = {
  id: 'repo-1',
  title: 'Digital Libraries',
  authors: ['Adaeze, N.'],
  doi: null,
  year: 2024,
  item_type: 'article',
  keywords: ['digital libraries'],
  language: 'English',
};

const RECORDS: QueryRecord[] = [];
let TABLE_DATA: Record<string, Array<Record<string, unknown>>> = {};
let TABLE_ERRORS: Record<string, TableError> = {};

vi.mock('@/server/supabase/adminClient', () => ({
  getSupabaseAdminClient: () => createMockClient(),
}));

function createMockClient(): MockSupabase {
  return {
    from: (table: string) => {
      const record: QueryRecord = { table, eqFilters: [], orFilter: null, textSearch: null, limit: null };
      RECORDS.push(record);
      const chain: Record<string, unknown> = {
        then: (onFulfilled: (value: unknown) => unknown) => {
          const error = TABLE_ERRORS[table];
          const payload = error ? { data: null, error } : { data: TABLE_DATA[table] ?? [], error: null };
          return Promise.resolve(payload).then(onFulfilled);
        },
      };
      for (const op of ['select', 'eq', 'or', 'textSearch', 'limit']) {
        chain[op] = (...args: unknown[]) => {
          if (op === 'eq') record.eqFilters.push([String(args[0]), String(args[1])]);
          if (op === 'or') record.orFilter = String(args[0]);
          if (op === 'textSearch') {
            const options = args[2] as { type?: string } | undefined;
            record.textSearch = { column: String(args[0]), query: String(args[1]), type: options?.type ?? null };
          }
          if (op === 'limit') record.limit = Number(args[0]);
          return chain;
        };
      }
      return chain;
    },
  };
}

describe('searchLocalResources', () => {
  beforeEach(() => {
    RECORDS.length = 0;
    TABLE_DATA = {};
    TABLE_ERRORS = {};
  });

  it('merges repository hits into local results and tags them by origin', async () => {
    TABLE_DATA = { catalogue_items: [CATALOGUE_ROW], repository_items: [REPOSITORY_ROW] };
    const out = await searchLocalResources({ tenantId: TENANT, query: QUERY });
    expect(out.schemaAvailable).toBe(true);
    expect(out.results.map((row: { id: string; result_type: string }) => [row.id, row.result_type])).toEqual([
      ['repo-1', 'repository'],
      ['cat-1', 'catalogue'],
    ]);
    expect(out.results[0].score).toBeGreaterThan(out.results[1].score);
    expect(out.quality).toBe('good');
  });

  it('gates the repository query to published, public, non-embargoed items', async () => {
    await searchLocalResources({ tenantId: TENANT, query: 'q' });
    const repository = RECORDS.find((record) => record.table === 'repository_items');
    expect(repository?.eqFilters).toEqual(
      expect.arrayContaining([
        ['status', 'published'],
        ['visibility', 'global'],
      ]),
    );
    expect(repository?.orFilter).toMatch(/^embargo_until\.is\.null,embargo_until\.lte\.\d{4}-\d{2}-\d{2}T/);
    expect(repository?.textSearch).toEqual({ column: 'search_vector', query: 'q', type: 'websearch' });
    expect(repository?.limit).toBe(25);
  });

  it('keeps the catalogue query tenant-scoped and applies the limit to both sources', async () => {
    await searchLocalResources({ tenantId: TENANT, query: 'q', limit: 5 });
    const catalogue = RECORDS.find((record) => record.table === 'catalogue_items');
    expect(catalogue?.eqFilters).toContainEqual(['tenant_id', TENANT]);
    expect(catalogue?.textSearch).toEqual({ column: 'search_vector', query: 'q', type: 'websearch' });
    expect(catalogue?.limit).toBe(5);
    const repository = RECORDS.find((record) => record.table === 'repository_items');
    expect(repository?.limit).toBe(5);
  });

  it('falls back to catalogue-only results when the repository search schema is missing', async () => {
    TABLE_DATA = { catalogue_items: [CATALOGUE_ROW], repository_items: [] };
    TABLE_ERRORS = { repository_items: { code: '42703', message: 'column repository_items.search_vector does not exist' } };
    const out = await searchLocalResources({ tenantId: TENANT, query: QUERY });
    expect(out.schemaAvailable).toBe(true);
    expect(out.results).toHaveLength(1);
    expect(out.results[0].result_type).toBe('catalogue');
  });

  it('reports the schema unavailable when the catalogue search schema is missing', async () => {
    TABLE_ERRORS = { catalogue_items: { code: '42P01', message: 'relation "public.catalogue_items" does not exist' } };
    const out = await searchLocalResources({ tenantId: TENANT, query: 'q' });
    expect(out.schemaAvailable).toBe(false);
    expect(out.results).toHaveLength(0);
    expect(out.quality).toBe('none');
  });

  it('rejects when the repository query fails for a non-schema reason', async () => {
    TABLE_ERRORS = { repository_items: { message: 'connection refused' } };
    await expect(searchLocalResources({ tenantId: TENANT, query: 'q' })).rejects.toThrow('connection refused');
  });
});
