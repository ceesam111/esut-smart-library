import { afterEach, describe, expect, it } from 'vitest';
import { mockFetch, useRealFetch } from './helpers';
import { doajProvider } from '../doaj';
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

describe('doajProvider', () => {
  afterEach(() => {
    useRealFetch();
  });

  it('returns empty items with error on non-200', async () => {
    mockFetch(async () => ({ status: 500, ok: false, headers: {}, body: 'oops' }));
    const result = await doajProvider.harvest(buildQuery());
    expect(result.items).toEqual([]);
    expect(result.error).toBe('http 500');
  });

  it('client-side filters out-of-range years (DOAJ has no server-side year filter)', async () => {
    const results = [
      {
        id: 'in-range',
        bibjson: { title: 'In Range', year: '2024', author: [{ name: 'A' }] },
      },
      {
        id: 'out-of-range',
        bibjson: { title: 'Out of Range', year: '2019', author: [{ name: 'B' }] },
      },
      {
        id: 'no-year',
        bibjson: { title: 'No Year', author: [{ name: 'C' }] },
      },
    ];
    mockFetch(async () => ({
      status: 200,
      ok: true,
      headers: {},
      body: JSON.stringify({ results }),
    }));
    const result = await doajProvider.harvest(buildQuery({ yearFrom: 2023, yearTo: 2026 }));
    expect(result.items).toHaveLength(1);
    expect(result.items[0].externalId).toBe('in-range');
    expect(result.items[0].publicationYear).toBe(2024);
  });

  it('sets full_text only when a PDF content-type link is present', async () => {
    const results = [
      {
        id: 'with-pdf',
        bibjson: {
          title: 'With PDF',
          year: '2024',
          link: [{ url: 'https://example.org/full.pdf', 'content-type': 'application/pdf' }],
        },
      },
      {
        id: 'without-pdf',
        bibjson: {
          title: 'Without PDF',
          year: '2024',
          link: [{ url: 'https://example.org/landing', 'content-type': 'text/html' }],
        },
      },
      {
        id: 'no-links',
        bibjson: { title: 'No Links', year: '2024' },
      },
    ];
    mockFetch(async () => ({
      status: 200,
      ok: true,
      headers: {},
      body: JSON.stringify({ results }),
    }));
    const result = await doajProvider.harvest(buildQuery());
    const withPdf = result.items.find((item) => item.externalId === 'with-pdf');
    const withoutPdf = result.items.find((item) => item.externalId === 'without-pdf');
    const noLinks = result.items.find((item) => item.externalId === 'no-links');

    expect(withPdf?.accessState).toBe('full_text');
    expect(withPdf?.fullTextUrl).toBe('https://example.org/full.pdf');

    expect(withoutPdf?.accessState).toBe('metadata_only');
    expect(withoutPdf?.fullTextUrl).toBeUndefined();

    expect(noLinks?.accessState).toBe('metadata_only');
    expect(noLinks?.fullTextUrl).toBeUndefined();
  });

  it('returns nextCursor when a full page is returned', async () => {
    const results = Array.from({ length: 25 }, (_, i) => ({
      id: `doc-${i}`,
      bibjson: { title: `Paper ${i}`, year: '2024' },
    }));
    mockFetch(async () => ({
      status: 200,
      ok: true,
      headers: {},
      body: JSON.stringify({ results }),
    }));
    const result = await doajProvider.harvest(buildQuery({ cursor: '1' }));
    expect(result.nextCursor).toBe('2');
  });
});