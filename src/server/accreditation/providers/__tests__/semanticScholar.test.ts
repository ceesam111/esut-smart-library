import { afterEach, describe, expect, it } from 'vitest';
import { mockFetch, useRealFetch } from './helpers';
import { semanticScholarProvider } from '../semanticScholar';
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

describe('semanticScholarProvider', () => {
  afterEach(() => {
    useRealFetch();
  });

  it('returns rate limited shape on 429 (keyless shared pool)', async () => {
    mockFetch(async () => ({
      status: 429,
      ok: false,
      headers: { 'retry-after': '60' },
      body: JSON.stringify({
        message: 'Too Many Requests. Please wait and try again or apply for a key for higher rate limits.',
        code: '429',
      }),
    }));
    const result = await semanticScholarProvider.harvest(buildQuery());
    expect(result.items).toEqual([]);
    expect(result.error).toBe('rate limited');
    expect(result.rateLimitedUntil).toBeTruthy();
  });

  it('declares a courtesy delay for the shared pool', () => {
    expect(semanticScholarProvider.courtesyDelayMs).toBeGreaterThan(0);
  });

  it('parses papers with openAccessPdf as full text', async () => {
    const payload = {
      data: [
        {
          paperId: 'abc123',
          title: 'S2 Paper In Range',
          authors: [{ name: 'Jane Doe' }],
          year: 2024,
          externalIds: { DOI: '10.example/s2' },
          openAccessPdf: { url: 'https://pdf.example.org/s2.pdf' },
          isOpenAccess: true,
          journal: { name: 'S2 Journal' },
          abstract: 'S2 abstract.',
        },
        {
          paperId: 'def456',
          title: 'S2 Paper Out of Range',
          authors: [],
          year: 2018,
        },
        {
          paperId: 'ghi789',
          title: 'S2 Paper No PDF',
          authors: [{ name: 'No PDF Author' }],
          year: 2025,
          isOpenAccess: false,
          abstract: 'Abstract without PDF.',
        },
      ],
      total: 3,
    };
    mockFetch(async (url) => {
      expect(url).toContain('fields=');
      expect(url).toContain('openAccessPdf');
      return { status: 200, ok: true, headers: {}, body: JSON.stringify(payload) };
    });
    const result = await semanticScholarProvider.harvest(buildQuery());
    expect(result.items).toHaveLength(2);

    const withPdf = result.items.find((item) => item.externalId === 'abc123');
    expect(withPdf?.fullTextUrl).toBe('https://pdf.example.org/s2.pdf');
    expect(withPdf?.accessState).toBe('full_text');
    expect(withPdf?.doi).toBe('10.example/s2');
    expect(withPdf?.landingPageUrl).toBe('https://doi.org/10.example/s2');
    expect(withPdf?.publicationYear).toBe(2024);

    const noPdf = result.items.find((item) => item.externalId === 'ghi789');
    expect(noPdf?.fullTextUrl).toBeUndefined();
    expect(noPdf?.accessState).toBe('abstract_only');
  });

  it('drops papers with no year (undefined) under the active filter', async () => {
    const payload = {
      data: [
        { paperId: 'noyear1', title: 'No Year Paper', authors: [], abstract: 'x' },
      ],
      total: 1,
    };
    mockFetch(async () => ({ status: 200, ok: true, headers: {}, body: JSON.stringify(payload) }));
    const result = await semanticScholarProvider.harvest(buildQuery());
    expect(result.items).toHaveLength(0);
  });
});