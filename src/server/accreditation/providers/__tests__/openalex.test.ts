import { afterEach, describe, expect, it } from 'vitest';
import { mockFetch, useRealFetch } from './helpers';
import { openalexProvider } from '../openalex';
import type { HarvestQuery, ProviderHarvestResult } from '../../types';

function buildQuery(overrides: Partial<HarvestQuery> = {}): HarvestQuery {
  return {
    programmeSlug: 'pharmacy',
    searchTerms: ['pharmacology'],
    yearFrom: 2023,
    yearTo: 2026,
    limit: 25,
    cursor: null,
    ...overrides,
  };
}

async function callProvider(query: HarvestQuery): Promise<ProviderHarvestResult> {
  return openalexProvider.harvest(query);
}

describe('openalexProvider', () => {
  afterEach(() => {
    useRealFetch();
  });

  it('returns empty items with error when fetch fails', async () => {
    mockFetch(async () => ({ status: 500, ok: false, headers: {}, body: 'Internal Server Error' }));
    const result = await callProvider(buildQuery());
    expect(result.items).toEqual([]);
    expect(result.error).toBe('http 500');
    expect(result.rateLimitedUntil).toBeNull();
  });

  it('returns empty items with rateLimitedUntil when 429', async () => {
    mockFetch(async () => ({
      status: 429,
      ok: false,
      headers: { 'retry-after': '300' },
      body: 'Too Many Requests',
    }));
    const result = await callProvider(buildQuery());
    expect(result.items).toEqual([]);
    expect(result.error).toBe('rate limited');
    expect(result.rateLimitedUntil).toBeTruthy();
  });

  it('returns empty items on invalid JSON', async () => {
    mockFetch(async () => ({ status: 200, ok: true, headers: {}, body: 'not-valid-json' }));
    const result = await callProvider(buildQuery());
    expect(result.items).toEqual([]);
    expect(result.error).toBe('invalid json');
  });

  it('parses works and returns items with full access state when full text present', async () => {
    const works = [
      {
        id: 'https://openalex.org/W1',
        display_name: 'A Study of Pharmacology',
        type: 'journal-article',
        publication_date: '2024-05-10',
        authorships: [{ author: { display_name: 'Alice Smith' } }],
        primary_location: {
          landing_page_url: 'https://journal.example.org/article/123',
          source: { display_name: 'Journal of Pharma' },
        },
        best_oa_location: {
          pdf_url: 'https://cdn.example.org/fulltext.pdf',
          is_oa: true,
          version: 'published_version',
        },
        open_access: { is_oa: true, oa_url: 'https://open.example.org/fulltext.pdf' },
        doi: 'https://doi.org/10.example/abc',
      },
    ];
    mockFetch(async () => ({ status: 200, ok: true, headers: {}, body: JSON.stringify({ results: works }) }));
    const result = await callProvider(buildQuery());
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.accessState).toBe('full_text');
    expect(item.fullTextUrl).toBe('https://cdn.example.org/fulltext.pdf');
    expect(item.openAccess).toBe(true);
    expect(item.resourceType).toBe('research_article');
    expect(item.publicationYear).toBe(2024);
    expect(item.doi).toBe('10.example/abc');
    expect(item.creators).toEqual(['Alice Smith']);
    expect(item.publisher).toBe('Journal of Pharma');
  });

  it('returns abstract_only when no full text but abstract present', async () => {
    const works = [
      {
        id: 'https://openalex.org/W2',
        display_name: 'Abstract Only Paper',
        type: 'article',
        publication_date: '2025-01-01',
        authorships: [{ author: { display_name: 'Bob Jones' } }],
        primary_location: { landing_page_url: 'https://journal.example.org/article/456' },
        open_access: { is_oa: false },
        abstract_inverted_index: { hello: [0], world: [1] },
      },
    ];
    mockFetch(async () => ({ status: 200, ok: true, headers: {}, body: JSON.stringify({ results: works }) }));
    const result = await callProvider(buildQuery());
    expect(result.items).toHaveLength(1);
    expect(result.items[0].accessState).toBe('abstract_only');
    expect(result.items[0].fullTextUrl).toBeUndefined();
    expect(result.items[0].abstractText).toBe('hello world');
  });

  it('returns metadata_only when neither full text nor abstract are present', async () => {
    const works = [
      {
        id: 'https://openalex.org/W3',
        display_name: 'No Abstract Paper',
        type: 'article',
        publication_date: '2024-06-15',
        authorships: [],
        primary_location: { landing_page_url: 'https://journal.example.org/article/789' },
        open_access: { is_oa: false },
      },
    ];
    mockFetch(async () => ({ status: 200, ok: true, headers: {}, body: JSON.stringify({ results: works }) }));
    const result = await callProvider(buildQuery());
    expect(result.items).toHaveLength(1);
    expect(result.items[0].accessState).toBe('metadata_only');
  });

  it('drops records outside the year range via client-side enforcement', async () => {
    const works = [
      {
        id: 'https://openalex.org/W4',
        display_name: 'Out of Range Paper',
        type: 'article',
        publication_date: '2020-01-01',
        authorships: [],
        primary_location: { landing_page_url: 'https://journal.example.org/article/old' },
        open_access: { is_oa: false },
      },
    ];
    mockFetch(async () => ({ status: 200, ok: true, headers: {}, body: JSON.stringify({ results: works }) }));
    const result = await callProvider(buildQuery({ yearFrom: 2023, yearTo: 2026 }));
    expect(result.items).toHaveLength(0);
  });

  it('returns null nextCursor when fewer than a full page is returned', async () => {
    const works = [
      {
        id: 'https://openalex.org/W5',
        display_name: 'One Item',
        type: 'article',
        publication_date: '2024-01-01',
        authorships: [],
        primary_location: { landing_page_url: 'https://journal.example.org/article/1' },
        open_access: { is_oa: false },
      },
    ];
    mockFetch(async () => ({ status: 200, ok: true, headers: {}, body: JSON.stringify({ results: works }) }));
    const result = await callProvider(buildQuery());
    expect(result.nextCursor).toBeNull();
  });

  it('returns nextCursor when a full page is returned', async () => {
    const works = Array.from({ length: 25 }, (_, i) => ({
      id: `https://openalex.org/W${i + 100}`,
      display_name: `Item ${i + 100}`,
      type: 'article',
      publication_date: '2024-01-01',
      authorships: [],
      primary_location: { landing_page_url: `https://journal.example.org/article/${i + 100}` },
      open_access: { is_oa: false },
    }));
    mockFetch(async () => ({ status: 200, ok: true, headers: {}, body: JSON.stringify({ results: works }) }));
    const result = await callProvider(buildQuery());
    expect(result.nextCursor).toBe('2');
  });

  it('uses the stored cursor for the next page', async () => {
    mockFetch(async (url) => {
      expect(url).toContain('page=2');
      return { status: 200, ok: true, headers: {}, body: JSON.stringify({ results: [] }) };
    });
    await callProvider(buildQuery({ cursor: '2' }));
  });
});