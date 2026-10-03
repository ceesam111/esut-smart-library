import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

const ITEMS = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Malaria Vaccine Development',
    authors: ['Dr. A. Smith'],
    isbn: '9783161484100',
    issn: null,
    publisher: 'Test Press',
    year: 2024,
    format: 'Book',
    abstract: 'A book about malaria vaccines.',
    subjects: ['Malaria', 'Vaccines'],
    call_number: 'RA644.M3',
    language: 'English',
    doi: null,
    place_of_publication: null,
    physical_description: null,
    series: null,
    edition: null,
    status: 'available',
    visibility: 'global',
    created_at: '2024-01-02T00:00:00Z',
    authors_text: 'Dr. A. Smith',
    subjects_text: 'Malaria; Vaccines',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    title: 'Private Catalogue Entry',
    authors: ['Dr. B. Hidden'],
    isbn: null,
    issn: null,
    publisher: null,
    year: 2023,
    format: null,
    abstract: null,
    subjects: null,
    call_number: null,
    language: null,
    doi: null,
    place_of_publication: null,
    physical_description: null,
    series: null,
    edition: null,
    status: 'available',
    visibility: 'private',
    created_at: '2023-01-01T00:00:00Z',
    authors_text: 'Dr. B. Hidden',
    subjects_text: null,
  },
];

let captured: { orFilters: string[]; textSearches: string[]; ranges: Array<[number, number]> } = { orFilters: [], textSearches: [], ranges: [] };

function createBuilder() {
  const state = { items: ITEMS };
  let eqVisibility: string | undefined;

  function builder(): Record<string, unknown> {
    const b: Record<string, unknown> = {};
    const self = () => b;
    b.select = () => self();
    b.eq = (col: string, val: string) => { if (col === 'visibility') eqVisibility = val; return self(); };
    b.or = (f: string) => { captured.orFilters.push(f); return self(); };
    b.textSearch = (col: string, val: string) => { captured.textSearches.push(`${col}:${val}`); return self(); };
    b.order = () => self();
    b.range = (from: number, to: number) => { captured.ranges.push([from, to]); return self(); };
    b.then = (onFulfilled: (v: unknown) => unknown) => {
      let items = state.items;
      if (eqVisibility) items = items.filter((e) => e.visibility === eqVisibility);
      return Promise.resolve({ data: items, error: null, count: items.length }).then(onFulfilled);
    };
    return b;
  }
  return { from: () => builder() };
}

vi.mock('@/server/supabase/adminClient', () => ({
  getSupabaseAdminClient: () => createBuilder(),
}));

beforeEach(() => {
  captured = { orFilters: [], textSearches: [], ranges: [] };
});

function get(params: Record<string, string>): Promise<Response> {
  const url = new URL('http://localhost/api/sru');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return GET(new Request(url.toString()));
}

describe('SRU route', () => {
  it('explain returns SRU 1.2 with advertised indexes and schemas', async () => {
    const res = await get({ operation: 'explain' });
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('<explainResponse');
    expect(xml).toContain('<version>1.2</version>');
    expect(xml).toContain('cql.serverChoice');
    expect(xml).toContain('dc.title');
    expect(xml).toContain('bath.isbn');
    expect(xml).toContain('info:srw/schema/1/marcxml');
    expect(xml).toContain('info:srw/schema/1/dc');
  });

  it('searchRetrieve returns records with pagination', async () => {
    const res = await get({ operation: 'searchRetrieve', version: '1.2', query: 'dc.title = "malaria"', maximumRecords: '1' });
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('<numberOfRecords>1</numberOfRecords>');
    expect(xml).toContain('Malaria Vaccine Development');
    expect(xml).toContain('<recordPosition>1</recordPosition>');
    expect(captured.orFilters[0]).toContain('title.ilike.%malaria%');
  });

  it('searchRetrieve returns MARCXML when requested', async () => {
    const res = await get({ operation: 'searchRetrieve', version: '1.2', query: 'dc.title = "malaria"', recordSchema: 'info:srw/schema/1/marcxml' });
    const xml = await res.text();
    expect(xml).toContain('<recordSchema>info:srw/schema/1/marcxml</recordSchema>');
    expect(xml).toContain('<leader>');
    expect(xml).toContain('<controlfield tag="001">11111111-1111-1111-1111-111111111111</controlfield>');
    expect(xml).toContain('<datafield tag="245"');
  });

  it('never exposes private catalogue entries', async () => {
    const res = await get({ operation: 'searchRetrieve', version: '1.2', query: 'cql.serverChoice = "private"' });
    const xml = await res.text();
    expect(xml).not.toContain('Private Catalogue Entry');
    expect(xml).not.toContain('22222222-2222-2222-2222-222222222222');
  });

  it('rejects missing query with diagnostic 7', async () => {
    const res = await get({ operation: 'searchRetrieve', version: '1.2' });
    expect(res.status).toBe(400);
    const xml = await res.text();
    expect(xml).toContain('info:srw/diagnostic/1/7');
  });

  it('rejects malformed CQL with diagnostic 10', async () => {
    const res = await get({ operation: 'searchRetrieve', version: '1.2', query: 'dc.title = ' });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('info:srw/diagnostic/1/10');
  });

  it('rejects unsupported index with diagnostic 11', async () => {
    const res = await get({ operation: 'searchRetrieve', version: '1.2', query: 'dc.language = "English"' });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('info:srw/diagnostic/1/11');
  });

  it('rejects unsupported schema with diagnostic 13', async () => {
    const res = await get({ operation: 'searchRetrieve', version: '1.2', query: 'cql.serverChoice = "x"', recordSchema: 'bogus' });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('info:srw/diagnostic/1/13');
  });

  it('rejects invalid startRecord with diagnostic 14', async () => {
    const res = await get({ operation: 'searchRetrieve', version: '1.2', query: 'cql.serverChoice = "x"', startRecord: '0' });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('info:srw/diagnostic/1/14');
  });

  it('rejects invalid maximumRecords with diagnostic 15', async () => {
    const res = await get({ operation: 'searchRetrieve', version: '1.2', query: 'cql.serverChoice = "x"', maximumRecords: 'abc' });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('info:srw/diagnostic/1/15');
  });

  it('rejects unknown operation with diagnostic 1', async () => {
    const res = await get({ operation: 'scan' });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('info:srw/diagnostic/1/1');
  });

  it('applies startRecord and maximumRecords as a range', async () => {
    await get({ operation: 'searchRetrieve', version: '1.2', query: 'cql.serverChoice = "x"', startRecord: '3', maximumRecords: '2' });
    expect(captured.ranges).toContainEqual([2, 3]);
  });

  it('routes cql.serverChoice to textSearch', async () => {
    await get({ operation: 'searchRetrieve', version: '1.2', query: 'cql.serverChoice = "malaria"' });
    expect(captured.textSearches).toContainEqual('search_vector:malaria');
    expect(captured.orFilters).toHaveLength(0);
  });
});
