import { afterEach, describe, expect, it } from 'vitest';
import { mockFetch, useRealFetch } from './helpers';
import { crossrefProvider } from '../crossref';
import type { HarvestQuery } from '../../types';

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

describe('crossrefProvider', () => {
  afterEach(() => {
    useRealFetch();
  });

  it('returns empty items with error on non-200', async () => {
    mockFetch(async () => ({ status: 503, ok: false, headers: {}, body: 'Service Unavailable' }));
    const result = await crossrefProvider.harvest(buildQuery());
    expect(result.items).toEqual([]);
    expect(result.error).toBe('http 503');
  });

  it('returns rate limited shape on 429', async () => {
    mockFetch(async () => ({
      status: 429,
      ok: false,
      headers: { 'retry-after': '120' },
      body: 'Too Many Requests',
    }));
    const result = await crossrefProvider.harvest(buildQuery());
    expect(result.items).toEqual([]);
    expect(result.error).toBe('rate limited');
    expect(result.rateLimitedUntil).toBeTruthy();
  });

  it('parses works with DOI landing as landing page and metadata_only access', async () => {
    const works = [
      {
        DOI: '10.1000/test',
        title: ['A Crossref Paper'],
        author: [{ given: 'John', family: 'Doe' }],
        'container-title': ['Journal of Testing'],
        issued: { 'date-parts': [[2024, 5, 1]] },
        URL: 'https://doi.org/10.1000/test',
        publisher: 'Example Publisher',
        type: 'journal-article',
        ISSN: ['1234-5678'],
      },
    ];
    mockFetch(async () => ({
      status: 200,
      ok: true,
      headers: {},
      body: JSON.stringify({ message: { items: works, 'total-results': 1 } }),
    }));
    const result = await crossrefProvider.harvest(buildQuery());
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.accessState).toBe('metadata_only');
    expect(item.fullTextUrl).toBeUndefined();
    expect(item.landingPageUrl).toBe('https://doi.org/10.1000/test');
    expect(item.doi).toBe('10.1000/test');
    expect(item.publicationYear).toBe(2024);
    expect(item.creators).toEqual(['John Doe']);
    expect(item.publisher).toBe('Example Publisher');
  });

  it('uses next-cursor from response for pagination', async () => {
    mockFetch(async (url) => {
      expect(url).toContain('cursor=');
      return {
        status: 200,
        ok: true,
        headers: {},
        body: JSON.stringify({ message: { items: [], 'next-cursor': 'abc123' } }),
      };
    });
    const result = await crossrefProvider.harvest(buildQuery({ cursor: 'abc123|0' }));
    expect(result.nextCursor).toBe('abc123|0');
  });

  it('drops works without a DOI and without URL', async () => {
    const works = [
      {
        title: ['No DOI Paper'],
        author: [],
        issued: { 'date-parts': [[2024]] },
      },
    ];
    mockFetch(async () => ({
      status: 200,
      ok: true,
      headers: {},
      body: JSON.stringify({ message: { items: works } }),
    }));
    const result = await crossrefProvider.harvest(buildQuery());
    expect(result.items).toHaveLength(0);
  });
});