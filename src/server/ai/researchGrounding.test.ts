import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GROUNDING_QUERY_MAX,
  GROUNDING_TOP_K,
  buildGroundingBlock,
  formatSourcesFooter,
  normalizeAuthors,
  parseCitedRecords,
  retrieveGroundingRecords,
  sanitizeGroundingQuery,
  toGroundedRecords,
  type GroundedRecord,
} from './researchGrounding';
import { searchRepository } from '@/server/search/repositorySearch';

vi.mock('@/server/search/repositorySearch', () => ({
  searchRepository: vi.fn(),
}));

const searchMock = vi.mocked(searchRepository);

afterEach(() => {
  searchMock.mockReset();
});

function record(id: string, title: string): GroundedRecord {
  return { id, title, authors: ['A. Author'], year: 2024, doi: null, url: `/repository/${id}` };
}

describe('sanitizeGroundingQuery', () => {
  it('strips control characters without needing literal control bytes', () => {
    const raw = `hello${String.fromCharCode(0)}${String.fromCharCode(7)} world`;
    expect(sanitizeGroundingQuery(raw)).toBe('hello world');
  });

  it('collapses whitespace and trims the query', () => {
    expect(sanitizeGroundingQuery('  solar   energy  ')).toBe('solar energy');
  });

  it('caps the query at the configured maximum length', () => {
    expect(sanitizeGroundingQuery('a'.repeat(500))).toHaveLength(GROUNDING_QUERY_MAX);
  });

  it('keeps ordinary academic queries intact, including hyphenated years', () => {
    expect(sanitizeGroundingQuery('erosion control 2020-2024 study')).toBe('erosion control 2020-2024 study');
  });
});

describe('normalizeAuthors', () => {
  it('splits string authors on semicolons while preserving "Last, F." forms', () => {
    expect(normalizeAuthors('Okafor, C.; Ade, N')).toEqual(['Okafor, C.', 'Ade, N']);
  });

  it('maps object authors by name', () => {
    expect(normalizeAuthors([{ name: 'Okafor, C.' }, { name: 42 }, { other: true }])).toEqual(['Okafor, C.']);
  });

  it('passes through plain string arrays', () => {
    expect(normalizeAuthors(['A. Author', 'B. Writer'])).toEqual(['A. Author', 'B. Writer']);
  });

  it('returns an empty list for missing or invalid values', () => {
    expect(normalizeAuthors(null)).toEqual([]);
    expect(normalizeAuthors(undefined)).toEqual([]);
    expect(normalizeAuthors(7)).toEqual([]);
  });

  it('caps the author list', () => {
    const many = Array.from({ length: 30 }, (_, index) => `Author ${index}`);
    expect(normalizeAuthors(many)).toHaveLength(12);
  });
});

describe('toGroundedRecords', () => {
  it('maps search items to records with canonical repository URLs', () => {
    const records = toGroundedRecords([
      { id: '11111111-1111-1111-1111-111111111111', title: 'Solar drying of cassava', authors: ['E. Ok'], year: 2023, doi: '10.1000/xyz' },
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].url).toBe('/repository/11111111-1111-1111-1111-111111111111');
    expect(records[0].doi).toBe('10.1000/xyz');
    expect(records[0].year).toBe(2023);
  });

  it('deduplicates repeated ids', () => {
    const row = { id: 'dup-id', title: 'Duplicate', authors: [], year: 2020 };
    const records = toGroundedRecords([row, row, { ...row }]);
    expect(records).toHaveLength(1);
  });

  it('caps the result set at the grounding limit', () => {
    const items = Array.from({ length: 20 }, (_, index) => ({ id: `id-${index}`, title: `Title ${index}`, authors: [], year: 2021 }));
    expect(toGroundedRecords(items)).toHaveLength(GROUNDING_TOP_K);
  });

  it('skips rows without an id and falls back to a placeholder title', () => {
    const records = toGroundedRecords([{ title: 'No id' }, { id: 'ok', title: '   ' }, null, 'string-row']);
    expect(records).toHaveLength(1);
    expect(records[0].title).toBe('Untitled record');
  });
});

describe('buildGroundingBlock', () => {
  it('tells the model no records were retrieved instead of allowing invention', () => {
    const block = buildGroundingBlock([]);
    expect(block).toContain('none retrieved');
    expect(block).toContain('Do not invent ESUT repository records');
  });

  it('renders numbered records with URLs and the never-invent rule', () => {
    const block = buildGroundingBlock([record('id-1', 'Thesis one')]);
    expect(block).toContain('[1] Thesis one');
    expect(block).toContain('URL:/repository/id-1');
    expect(block).toContain('Never invent additional ESUT records');
  });

  it('renders all retrieved records with stable numbering', () => {
    const block = buildGroundingBlock([record('id-1', 'First'), record('id-2', 'Second')]);
    expect(block).toContain('[1] First');
    expect(block).toContain('[2] Second');
  });
});

describe('parseCitedRecords', () => {
  const records = [record('id-1', 'First'), record('id-2', 'Second'), record('id-3', 'Third')];

  it('maps [n] markers to the correct records', () => {
    const cited = parseCitedRecords('Several studies agree [1] and extend it [3].', records);
    expect(cited.map((entry) => entry.id)).toEqual(['id-1', 'id-3']);
  });

  it('ignores out-of-range markers instead of guessing', () => {
    const cited = parseCitedRecords('See [9] for details.', records);
    expect(cited).toEqual([]);
  });

  it('deduplicates repeated citations', () => {
    const cited = parseCitedRecords('[1] again [1] and [1].', records);
    expect(cited.map((entry) => entry.id)).toEqual(['id-1']);
  });

  it('detects direct URL citations', () => {
    const cited = parseCitedRecords('See /repository/id-2 for the data.', records);
    expect(cited.map((entry) => entry.id)).toEqual(['id-2']);
  });

  it('returns nothing for answers that cite no repository records', () => {
    expect(parseCitedRecords('A general answer with no markers.', records)).toEqual([]);
  });
});

describe('formatSourcesFooter', () => {
  it('returns an empty string when nothing was cited', () => {
    expect(formatSourcesFooter([])).toBe('');
  });

  it('lists cited records with titles and links', () => {
    const footer = formatSourcesFooter([record('id-1', 'Grounded title')]);
    expect(footer).toContain('ESUT repository sources used:');
    expect(footer).toContain('1. Grounded title - /repository/id-1');
  });
});

describe('retrieveGroundingRecords', () => {
  it('runs the internal repository search and maps results', async () => {
    searchMock.mockResolvedValue({
      items: [{ id: 'id-9', title: 'Retrieved title', authors: ['A. Author'], year: 2022, doi: null }],
      total: 1,
      page: 1,
      pageSize: GROUNDING_TOP_K,
      totalPages: 1,
      facets: { resourceType: [], year: [], faculty: [], department: [], author: [], subject: [], accessLevel: [] },
      query: 'retrieved title',
      sort: 'relevance',
    } as unknown as Awaited<ReturnType<typeof searchRepository>>);

    const result = await retrieveGroundingRecords('retrieved title');
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(result.degraded).toBe(false);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].id).toBe('id-9');
    expect(result.total).toBe(1);
  });

  it('degrades gracefully when retrieval fails', async () => {
    searchMock.mockRejectedValue(new Error('database unavailable'));
    const result = await retrieveGroundingRecords('some thesis question');
    expect(result.degraded).toBe(true);
    expect(result.records).toEqual([]);
    expect(result.error).toBe('database unavailable');
  });

  it('does not search for trivially short queries', async () => {
    const result = await retrieveGroundingRecords('  a ');
    expect(searchMock).not.toHaveBeenCalled();
    expect(result.records).toEqual([]);
    expect(result.degraded).toBe(false);
  });

  it('sanitizes the query before it reaches the search layer', async () => {
    searchMock.mockResolvedValue({ items: [], total: 0 } as unknown as Awaited<ReturnType<typeof searchRepository>>);
    await retrieveGroundingRecords(`solar${String.fromCharCode(0)} dryer`);
    expect(searchMock).toHaveBeenCalledWith(expect.objectContaining({ query: 'solar dryer' }));
  });
});
