import { afterEach, describe, expect, it } from 'vitest';
import { mockFetch, useRealFetch } from './helpers';
import { arxivProvider } from '../arxiv';
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

const SAMPLE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <entry>
    <id>http://arxiv.org/abs/2401.00001v1</id>
    <title>A Pharmacology Preprint</title>
    <summary>This is the abstract of a pharmacology preprint.</summary>
    <published>2024-01-15T10:00:00Z</published>
    <updated>2024-01-16T10:00:00Z</updated>
    <author><name>Alice Author</name></author>
    <author><name>Bob Writer</name></author>
    <category term="q-bio.PH" scheme="http://arxiv.org/schemas/atom"/>
    <category term="q-bio" scheme="http://arxiv.org/schemas/atom"/>
    <link href="http://arxiv.org/abs/2401.00001v1" rel="alternate" type="text/html"/>
    <link href="http://arxiv.org/pdf/2401.00001v1" rel="related" type="application/pdf"/>
    <arxiv:primary_category term="q-bio.PH"/>
    <arxiv:doi>10.1103/physrev.2401</arxiv:doi>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/1901.00002v1</id>
    <title>Out of Range Preprint</title>
    <summary>An old preprint.</summary>
    <published>2019-06-01T00:00:00Z</published>
    <author><name>Carol</name></author>
    <link href="http://arxiv.org/abs/1901.00002v1" rel="alternate" type="text/html"/>
    <link href="http://arxiv.org/pdf/1901.00002v1" rel="related" type="application/pdf"/>
  </entry>
</feed>`;

describe('arxivProvider', () => {
  afterEach(() => {
    useRealFetch();
  });

  it('returns empty items with error on non-200', async () => {
    mockFetch(async () => ({ status: 503, ok: false, headers: {}, body: 'Bad Gateway' }));
    const result = await arxivProvider.harvest(buildQuery());
    expect(result.items).toEqual([]);
    expect(result.error).toBe('http 503');
  });

  it('returns rate limited shape on 429', async () => {
    mockFetch(async () => ({
      status: 429,
      ok: false,
      headers: { 'retry-after': '3' },
      body: 'Rate exceeded',
    }));
    const result = await arxivProvider.harvest(buildQuery());
    expect(result.error).toBe('rate limited');
    expect(result.rateLimitedUntil).toBeTruthy();
  });

  it('parses Atom entries with authors, categories, DOI, and PDF full text', async () => {
    mockFetch(async (url, options) => {
      expect(url).toContain('search_query=');
      expect(options?.headers?.Accept).toBe('application/atom+xml');
      return { status: 200, ok: true, headers: {}, body: SAMPLE_FEED };
    });
    const result = await arxivProvider.harvest(buildQuery({ yearFrom: 2023, yearTo: 2026 }));
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.title).toBe('A Pharmacology Preprint');
    expect(item.externalId).toBe('2401.00001v1');
    expect(item.creators).toEqual(['Alice Author', 'Bob Writer']);
    expect(item.publicationYear).toBe(2024);
    expect(item.doi).toBe('10.1103/physrev.2401');
    expect(item.subjectHeadings).toEqual(['q-bio.PH', 'q-bio']);
    expect(item.abstractText).toBe('This is the abstract of a pharmacology preprint.');
    expect(item.fullTextUrl).toBe('http://arxiv.org/pdf/2401.00001v1');
    expect(item.accessState).toBe('full_text');
    expect(item.landingPageUrl).toBe('https://arxiv.org/abs/2401.00001v1');
    expect(item.resourceType).toBe('research_article');
  });

  it('drops preprints outside the year range via client-side enforcement', async () => {
    mockFetch(async () => ({ status: 200, ok: true, headers: {}, body: SAMPLE_FEED }));
    const result = await arxivProvider.harvest(buildQuery({ yearFrom: 2023, yearTo: 2026 }));
    const ids = result.items.map((item) => item.externalId);
    expect(ids).not.toContain('1901.00002v1');
  });

  it('sends submittedDate year-range filter in search query', async () => {
    mockFetch(async (url) => {
      const decoded = decodeURIComponent(url).replace(/\+/g, ' ');
      expect(decoded).toContain('submittedDate:[202301010000 TO 202612312359]');
      return { status: 200, ok: true, headers: {}, body: SAMPLE_FEED };
    });
    await arxivProvider.harvest(buildQuery({ yearFrom: 2023, yearTo: 2026 }));
  });

  it('returns null nextCursor for a partial feed (no more results)', async () => {
    mockFetch(async () => ({ status: 200, ok: true, headers: {}, body: SAMPLE_FEED }));
    const result = await arxivProvider.harvest(buildQuery());
    expect(result.nextCursor).toBeNull();
  });
});