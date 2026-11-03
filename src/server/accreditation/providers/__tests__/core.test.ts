import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, useRealFetch } from './helpers';
import { coreProvider } from '../core';
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

const ORIGINAL_KEY = process.env.CORE_API_KEY;

describe('coreProvider', () => {
  afterEach(() => {
    useRealFetch();
    if (ORIGINAL_KEY === undefined) delete process.env.CORE_API_KEY;
    else process.env.CORE_API_KEY = ORIGINAL_KEY;
    vi.restoreAllMocks();
  });

  it('is disabled when CORE_API_KEY is not set', () => {
    delete process.env.CORE_API_KEY;
    expect(coreProvider.enabled()).toBe(false);
  });

  it('is enabled when CORE_API_KEY is set', () => {
    process.env.CORE_API_KEY = 'test-key-not-real';
    expect(coreProvider.enabled()).toBe(true);
  });

  it('returns an error when harvesting without a key', async () => {
    delete process.env.CORE_API_KEY;
    const result = await coreProvider.harvest(buildQuery());
    expect(result.items).toEqual([]);
    expect(result.error).toBe('CORE_API_KEY not configured');
  });

  it('treats fullText="Not available for public API users." as NO full text (honesty)', async () => {
    process.env.CORE_API_KEY = 'test-key-not-real';
    const results = [
      {
        id: 1001,
        title: 'CORE Paper',
        authors: [{ name: 'Jane Doe' }],
        publishedDate: '2024-03-01',
        yearPublished: 2024,
        doi: '10.example/core',
        abstract: 'An abstract.',
        fullText: 'Not available for public API users.',
        links: [{ type: 'display', url: 'https://core.ac.uk/works/1001' }],
      },
      {
        id: 1002,
        title: 'CORE Paper With Download',
        authors: [],
        publishedDate: '2025-01-01',
        yearPublished: 2025,
        downloadUrl: 'https://core.ac.uk/download/pdf/1002.pdf',
        fullText: 'https://core.ac.uk/download/pdf/1002.pdf',
      },
    ];
    mockFetch(async (url, options) => {
      expect(url).toContain('q=pharmacology');
      expect(options?.headers?.Authorization).toBe('Bearer test-key-not-real');
      return {
        status: 200,
        ok: true,
        headers: {},
        body: JSON.stringify({ results, totalHits: 2 }),
      };
    });
    const result = await coreProvider.harvest(buildQuery());
    expect(result.items).toHaveLength(2);

    const noFullText = result.items.find((item) => item.externalId === '1001');
    expect(noFullText?.fullTextUrl).toBeUndefined();
    expect(noFullText?.accessState).toBe('abstract_only');
    expect(noFullText?.openAccess).toBe(false);

    const withDownload = result.items.find((item) => item.externalId === '1002');
    expect(withDownload?.fullTextUrl).toBe('https://core.ac.uk/download/pdf/1002.pdf');
    expect(withDownload?.accessState).toBe('full_text');
    expect(withDownload?.openAccess).toBe(true);
  });

  it('drops out-of-range years client-side (CORE has no reliable server-side year filter)', async () => {
    process.env.CORE_API_KEY = 'test-key-not-real';
    const results = [
      { id: 2001, title: 'In Range', yearPublished: 2024, publishedDate: '2024-01-01' },
      { id: 2002, title: 'Out of Range', yearPublished: 2019, publishedDate: '2019-01-01' },
      { id: 2003, title: 'No Year', publishedDate: null },
    ];
    mockFetch(async () => ({
      status: 200,
      ok: true,
      headers: {},
      body: JSON.stringify({ results, totalHits: 3 }),
    }));
    const result = await coreProvider.harvest(buildQuery({ yearFrom: 2023, yearTo: 2026 }));
    expect(result.items).toHaveLength(1);
    expect(result.items[0].externalId).toBe('2001');
  });

  it('caps offset at MAX_OFFSET (75) for free-tier safety', async () => {
    process.env.CORE_API_KEY = 'test-key-not-real';
    mockFetch(async (url) => {
      expect(url).toContain('offset=75');
      return { status: 200, ok: true, headers: {}, body: JSON.stringify({ results: [] }) };
    });
    await coreProvider.harvest(buildQuery({ cursor: '9999' }));
  });
});