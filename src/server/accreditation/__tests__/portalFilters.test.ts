import { describe, expect, it } from 'vitest';
import type { PortalResourceItem } from '@/lib/accreditationApi';
import { applyPortalFilters } from '../portalFilters';

const makeItem = (overrides: Partial<PortalResourceItem>): PortalResourceItem => ({
  key: 'key-1',
  recordSource: 'external',
  sourceProvider: 'openalex',
  sourceLabel: 'OpenAlex',
  resourceType: 'research_article',
  title: 'Placeholder title',
  creators: [],
  year: 2024,
  publisher: null,
  doi: null,
  abstract: null,
  subjects: [],
  landingUrl: 'https://example.org/record',
  fullTextUrl: null,
  accessState: 'metadata_only',
  openAccess: true,
  verification: null,
  availability: null,
  relevanceScore: null,
  matchedTerms: [],
  ...overrides,
});

const baseItems = [
  makeItem({ key: 'a1', title: 'Dengue fever in West Africa', sourceProvider: 'openalex' }),
  makeItem({
    key: 'a2',
    title: 'Arbovirus surveillance',
    creators: ['Dengue, A.'],
    sourceProvider: 'crossref',
  }),
  makeItem({
    key: 'a3',
    title: 'Vector control review',
    abstract: 'Background: dengue fever remains endemic.',
    sourceProvider: 'europe-pmc',
  }),
  makeItem({
    key: 'a4',
    title: 'Mosquito biology',
    subjects: ['Dengue Fever'],
    resourceType: 'ebook',
    sourceProvider: 'openalex',
  }),
  makeItem({
    key: 'a5',
    title: 'Unrelated ecology paper',
    sourceProvider: 'openalex',
  }),
];

describe('applyPortalFilters', () => {
  it('reports matchedTotal across every type when no type filter is active', () => {
    const outcome = applyPortalFilters({
      base: baseItems,
      needle: 'dengue',
      types: [],
      source: null,
      localTypes: ['print_holding'],
    });
    expect(outcome.results).toHaveLength(4);
    expect(outcome.matchedTotal).toBe(4);
    expect(outcome.typeCounts).toEqual(
      expect.arrayContaining([
        { type: 'research_article', count: 3 },
        { type: 'ebook', count: 1 },
      ]),
    );
  });

  it('keeps matchedTotal and type facets global while a type filter narrows results', () => {
    const outcome = applyPortalFilters({
      base: baseItems,
      needle: 'dengue',
      types: ['ebook'],
      source: null,
      localTypes: ['print_holding'],
    });
    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0].key).toBe('a4');
    expect(outcome.matchedTotal).toBe(4);
    expect(outcome.typeCounts).toHaveLength(2);
  });

  it('matches the needle case-insensitively across title, creators, abstract and subjects', () => {
    const outcome = applyPortalFilters({
      base: baseItems,
      needle: 'DENGUE',
      types: [],
      source: null,
      localTypes: ['print_holding'],
    });
    expect(outcome.matchedTotal).toBe(4);
    expect(outcome.results.map((item) => item.key).sort()).toEqual(['a1', 'a2', 'a3', 'a4']);
  });

  it('narrows matchedTotal and type facets when a source filter is active', () => {
    const outcome = applyPortalFilters({
      base: baseItems,
      needle: null,
      types: [],
      source: 'openalex',
      localTypes: ['print_holding'],
    });
    expect(outcome.matchedTotal).toBe(3);
    expect(outcome.results.map((item) => item.key).sort()).toEqual(['a1', 'a4', 'a5']);
    expect(outcome.typeCounts).toEqual(
      expect.arrayContaining([
        { type: 'research_article', count: 2 },
        { type: 'ebook', count: 1 },
      ]),
    );
    expect(outcome.typeCounts).toHaveLength(2);
  });

  it('keeps provider facets complete while a source filter is active', () => {
    const outcome = applyPortalFilters({
      base: baseItems,
      needle: null,
      types: [],
      source: 'openalex',
      localTypes: ['print_holding'],
    });
    const providers = outcome.providerCounts.map((entry) => entry.provider).sort();
    expect(providers).toEqual(['crossref', 'europe-pmc', 'openalex']);
  });

  it('applies the local pseudo-source against recordSource', () => {
    const localItems = [
      makeItem({ key: 'l1', recordSource: 'catalogue', sourceProvider: null, sourceLabel: 'Catalogue' }),
      makeItem({ key: 'l2', recordSource: 'external', sourceProvider: 'openalex' }),
    ];
    const outcome = applyPortalFilters({
      base: localItems,
      needle: null,
      types: [],
      source: 'catalogue',
      localTypes: ['catalogue'],
    });
    expect(outcome.matchedTotal).toBe(1);
    expect(outcome.results[0].key).toBe('l1');
    expect(outcome.providerCounts.map((entry) => entry.provider)).toEqual([
      'catalogue',
      'openalex',
    ]);
  });

  it('produces the same results regardless of type and source filter order', () => {
    const items = [
      makeItem({ key: 'x1', resourceType: 'ebook', sourceProvider: 'openalex' }),
      makeItem({ key: 'x2', resourceType: 'ebook', sourceProvider: 'crossref' }),
      makeItem({ key: 'x3', resourceType: 'research_article', sourceProvider: 'openalex' }),
    ];
    const outcome = applyPortalFilters({
      base: items,
      needle: null,
      types: ['ebook'],
      source: 'openalex',
      localTypes: ['print_holding'],
    });
    expect(outcome.results.map((item) => item.key)).toEqual(['x1']);
    expect(outcome.matchedTotal).toBe(2);
    expect(
      outcome.providerCounts
        .map((entry) => `${entry.provider}:${entry.count}`)
        .sort(),
    ).toEqual(['crossref:1', 'openalex:1']);
  });
});
