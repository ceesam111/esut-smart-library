import { afterEach, describe, expect, it } from 'vitest';
import { mockFetch, useRealFetch } from './helpers';
import { europePmcProvider } from '../europePmc';
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

describe('europePmcProvider', () => {
  afterEach(() => {
    useRealFetch();
  });

  it('degrades gracefully on 403 Cloudflare challenge (never throws, returns error shape)', async () => {
    mockFetch(async () => ({
      status: 403,
      ok: false,
      headers: {},
      body: '<html><title>Just a moment...</title></html>',
    }));
    const result = await europePmcProvider.harvest(buildQuery());
    expect(result.items).toEqual([]);
    expect(result.error).toBe('http 403');
  });

  it('returns rate limited shape on 429', async () => {
    mockFetch(async () => ({
      status: 429,
      ok: false,
      headers: {},
      body: 'Too Many Requests',
    }));
    const result = await europePmcProvider.harvest(buildQuery());
    expect(result.error).toBe('rate limited');
    expect(result.rateLimitedUntil).toBeTruthy();
  });

  it('parses core results with year filter enforcement', async () => {
    const payload = {
      resultList: {
        result: [
          {
            id: '123456',
            source: 'MED',
            pmid: '123456',
            title: 'In Range EPMC Paper',
            authorString: 'Smith, J.; Doe, A.',
            pubYear: '2024',
            journalTitle: 'Journal of Pharma',
            journalIssn: '1234-5678',
            doi: '10.example/epmc',
            abstractText: 'An EPMC abstract.',
            isOpenAccess: 'Y',
            firstPublicationDate: '2024-04-01',
          },
          {
            id: '999999',
            source: 'MED',
            title: 'Out of Range EPMC Paper',
            authorString: 'Old, B.',
            pubYear: '2018',
          },
        ],
      },
      nextCursorMark: '*',
      hitCount: 2,
    };
    mockFetch(async (url) => {
      const decoded = decodeURIComponent(url).replace(/\+/g, ' ');
      expect(decoded).toContain('PUB_YEAR:[2023 TO 2026]');
      expect(decoded).toContain('resultType=core');
      return { status: 200, ok: true, headers: {}, body: JSON.stringify(payload) };
    });
    const result = await europePmcProvider.harvest(buildQuery());
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.title).toBe('In Range EPMC Paper');
    expect(item.publicationYear).toBe(2024);
    expect(item.doi).toBe('10.example/epmc');
    expect(item.landingPageUrl).toBe('https://europepmc.org/article/MED/123456');
    expect(item.accessState).toBe('abstract_only');
    expect(result.nextCursor).toBe('*');
  });

  it('never synthesises fullTextUrl from a DOI (no fullTextUrlList = no full text)', async () => {
    const payload = {
      resultList: {
        result: [
          {
            id: '555',
            source: 'MED',
            title: 'No Full Text List Paper',
            pubYear: '2024',
            doi: '10.example/nolink',
            isOpenAccess: 'N',
          },
        ],
      },
    };
    mockFetch(async () => ({ status: 200, ok: true, headers: {}, body: JSON.stringify(payload) }));
    const result = await europePmcProvider.harvest(buildQuery());
    expect(result.items[0].fullTextUrl).toBeUndefined();
    expect(result.items[0].accessState).toBe('metadata_only');
  });
});