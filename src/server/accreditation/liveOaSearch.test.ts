import { describe, it, expect } from 'vitest';
import { searchLiveOpenAccess } from './liveOaSearch';
import { resolveHarvestedItem } from './providers/mapping';
import type { AccreditationProvider, HarvestQuery, ProviderHarvestResult } from './types';

const ok = (items: ProviderHarvestResult['items']): ProviderHarvestResult => ({
  items,
  nextCursor: null,
});

const makeProvider = (
  id: string,
  harvest: AccreditationProvider['harvest'],
  enabled = true,
): AccreditationProvider => ({
  id,
  displayName: id.toUpperCase(),
  homepageUrl: 'https://example.com',
  docsUrl: 'https://example.com/docs',
  enabled: () => enabled,
  supportsServerYearFilter: false,
  harvest,
});

const sample = (overrides: {
  externalId: string;
  title: string;
  publicationYear?: number;
  doi?: string;
  openAccess?: boolean;
  fullTextUrl?: string;
  resourceType?: 'ebook' | 'ejournal' | 'research_article';
}) =>
  resolveHarvestedItem({
    externalId: overrides.externalId,
    resourceType: overrides.resourceType ?? 'research_article',
    title: overrides.title,
    creators: ['A. Obi'],
    landingPageUrl: `https://example.com/${overrides.externalId}`,
    publicationYear: overrides.publicationYear ?? 2024,
    doi: overrides.doi,
    fullTextUrl: overrides.fullTextUrl ?? `https://example.com/${overrides.externalId}.pdf`,
    openAccess: overrides.openAccess ?? true,
    subjectHeadings: ['Virology'],
    abstractText: 'About dengue.',
  });

describe('searchLiveOpenAccess', () => {
  it('maps open-access hits into portal items with live provenance', async () => {
    const openalex = makeProvider('openalex', async () =>
      ok([sample({ externalId: 'w1', title: 'Dengue fever', doi: '10.1000/xyz1' })]),
    );
    const results = await searchLiveOpenAccess({
      needle: 'dengue',
      yearFrom: 2022,
      yearTo: 2026,
      providers: [openalex],
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      key: 'live:openalex:w1',
      recordSource: 'external',
      sourceProvider: 'openalex',
      sourceLabel: 'OPENALEX (live)',
      resourceType: 'research_article',
      title: 'Dengue fever',
      year: 2024,
      openAccess: true,
      accessState: 'full_text',
      verification: null,
    });
  });

  it('drops non-open-access records and records outside the year window', async () => {
    const doaj = makeProvider('doaj', async () =>
      ok([
        sample({ externalId: 'paid', title: 'Paywalled dengue', openAccess: false, fullTextUrl: undefined }),
        sample({ externalId: 'old', title: 'Old dengue', publicationYear: 2015 }),
        sample({ externalId: 'fresh', title: 'Fresh dengue', publicationYear: 2023 }),
      ]),
    );
    const results = await searchLiveOpenAccess({
      needle: 'dengue',
      yearFrom: 2022,
      yearTo: 2026,
      providers: [doaj],
    });
    expect(results.map((entry) => entry.key)).toEqual(['live:doaj:fresh']);
  });

  it('keeps a single record when two providers return the same DOI', async () => {
    const first = makeProvider('openalex', async () =>
      ok([sample({ externalId: 'w1', title: 'Dengue fever', doi: '10.1000/same' })]),
    );
    const second = makeProvider('doaj', async () =>
      ok([sample({ externalId: 'a1', title: 'Dengue fever report', doi: '10.1000/same' })]),
    );
    const results = await searchLiveOpenAccess({
      needle: 'dengue',
      yearFrom: 2022,
      yearTo: 2026,
      providers: [first, second],
    });
    expect(results).toHaveLength(1);
    expect(results[0].key).toBe('live:openalex:w1');
  });

  it('ignores disabled providers and providers outside the live set', async () => {
    let calls = 0;
    const disabled = makeProvider(
      'openalex',
      async () => {
        calls += 1;
        return ok([]);
      },
      false,
    );
    const unlisted = makeProvider('core', async () => {
      calls += 1;
      return ok([]);
    });
    const results = await searchLiveOpenAccess({
      needle: 'dengue',
      yearFrom: 2022,
      yearTo: 2026,
      providers: [disabled, unlisted],
    });
    expect(calls).toBe(0);
    expect(results).toEqual([]);
  });

  it('still returns results when one provider fails', async () => {
    const broken = makeProvider('europe-pmc', async () => {
      throw new Error('network down');
    });
    const working = makeProvider('open-library', async (query: HarvestQuery) => {
      expect(query.searchTerms).toEqual(['dengue']);
      expect(query.yearFrom).toBe(2020);
      expect(query.yearTo).toBe(2026);
      return ok([
        resolveHarvestedItem({
          externalId: '/works/OL1',
          resourceType: 'ebook',
          title: 'Understanding dengue',
          creators: ['B. Eze'],
          landingPageUrl: 'https://openlibrary.org/works/OL1',
          publicationYear: 2020,
          openAccess: true,
        }),
      ]);
    });
    const results = await searchLiveOpenAccess({
      needle: 'dengue',
      yearFrom: 2020,
      yearTo: 2026,
      providers: [broken, working],
    });
    expect(results).toHaveLength(1);
    expect(results[0].key).toBe('live:open-library:/works/OL1');
    expect(results[0].resourceType).toBe('ebook');
  });
});
