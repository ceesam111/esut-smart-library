import { afterEach, describe, expect, it } from 'vitest';
import { mockFetch, useRealFetch } from './helpers';
import { internetArchiveProvider } from '../internetArchive';
import { openLibraryProvider } from '../openLibrary';
import { zenodoProvider } from '../zenodo';
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

describe('internetArchiveProvider', () => {
  afterEach(() => {
    useRealFetch();
  });

  it('returns empty items with error on non-200', async () => {
    mockFetch(async () => ({ status: 500, ok: false, headers: {}, body: 'oops' }));
    const result = await internetArchiveProvider.harvest(buildQuery());
    expect(result.items).toEqual([]);
    expect(result.error).toBe('http 500');
  });

  it('parses docs with year range enforcement and honest access labelling', async () => {
    const payload = {
      response: {
        docs: [
          {
            identifier: 'inrange-1',
            title: 'In Range Book',
            creator: 'Author One',
            year: '2024',
            subject: ['pharmacology', 'medicine'],
          },
          {
            identifier: 'outrange-1',
            title: 'Old Book',
            creator: 'Author Two',
            year: '2015',
          },
          {
            identifier: 'noyear-1',
            title: 'No Year Book',
            creator: 'Author Three',
          },
        ],
        numFound: 3,
      },
    };
    mockFetch(async (url) => {
      const decoded = decodeURIComponent(url).replace(/\+/g, ' ');
      expect(decoded).toContain('year:[2023 TO 2026]');
      return { status: 200, ok: true, headers: {}, body: JSON.stringify(payload) };
    });
    const result = await internetArchiveProvider.harvest(buildQuery());
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.externalId).toBe('inrange-1');
    expect(item.resourceType).toBe('ebook');
    expect(item.publicationYear).toBe(2024);
    expect(item.landingPageUrl).toBe('https://archive.org/details/inrange-1');
    expect(item.subjectHeadings).toEqual(['pharmacology', 'medicine']);
  });

  it('uses the landing page as fullTextUrl for archive.org items (readable online)', async () => {
    const payload = {
      response: {
        docs: [{ identifier: 'readable-1', title: 'Readable Book', year: '2024' }],
        numFound: 1,
      },
    };
    mockFetch(async () => ({ status: 200, ok: true, headers: {}, body: JSON.stringify(payload) }));
    const result = await internetArchiveProvider.harvest(buildQuery());
    expect(result.items[0].fullTextUrl).toBe('https://archive.org/details/readable-1');
    expect(result.items[0].accessState).toBe('full_text');
  });

  it('never synthesises a DOI field', async () => {
    const payload = {
      response: {
        docs: [{ identifier: 'noddoi-1', title: 'No DOI Book', year: '2024' }],
        numFound: 1,
      },
    };
    mockFetch(async () => ({ status: 200, ok: true, headers: {}, body: JSON.stringify(payload) }));
    const result = await internetArchiveProvider.harvest(buildQuery());
    expect(result.items[0].doi).toBeUndefined();
  });
});

describe('openLibraryProvider', () => {
  afterEach(() => {
    useRealFetch();
  });

  it('client-side filters year (Open Library has no server-side year range)', async () => {
    const payload = {
      docs: [
        { key: '/works/OL1W', title: 'In Range', first_publish_year: 2024 },
        { key: '/works/OL2W', title: 'Out of Range', first_publish_year: 2018 },
        { key: '/works/OL3W', title: 'No Year' },
      ],
    };
    mockFetch(async () => ({ status: 200, ok: true, headers: {}, body: JSON.stringify(payload) }));
    const result = await openLibraryProvider.harvest(buildQuery());
    expect(result.items).toHaveLength(1);
    expect(result.items[0].externalId).toBe('/works/OL1W');
    expect(result.items[0].publicationYear).toBe(2024);
    expect(result.items[0].resourceType).toBe('ebook');
  });

  it('uses the work landing page as fullTextUrl (read at Open Library)', async () => {
    const payload = {
      docs: [{ key: '/works/OL4W', title: 'Borrowable', first_publish_year: 2025 }],
    };
    mockFetch(async () => ({ status: 200, ok: true, headers: {}, body: JSON.stringify(payload) }));
    const result = await openLibraryProvider.harvest(buildQuery());
    expect(result.items[0].landingPageUrl).toBe('https://openlibrary.org/works/OL4W');
    expect(result.items[0].fullTextUrl).toBe('https://openlibrary.org/works/OL4W');
    expect(result.items[0].accessState).toBe('full_text');
  });

  it('honours offset cursor', async () => {
    mockFetch(async (url) => {
      expect(url).toContain('offset=25');
      return { status: 200, ok: true, headers: {}, body: JSON.stringify({ docs: [] }) };
    });
    await openLibraryProvider.harvest(buildQuery({ cursor: '25' }));
  });

  it('returns empty items on error', async () => {
    mockFetch(async () => ({ status: 503, ok: false, headers: {}, body: 'bad gateway' }));
    const result = await openLibraryProvider.harvest(buildQuery());
    expect(result.items).toEqual([]);
    expect(result.error).toBe('http 503');
  });
});

describe('zenodoProvider', () => {
  afterEach(() => {
    useRealFetch();
  });

  it('parses hits with metadata/doi/files and year enforcement', async () => {
    const payload = {
      hits: {
        hits: [
          {
            id: '1001',
            doi: '10.5281/zenodo.1001',
            metadata: {
              title: 'In Range Dataset',
              publication_date: '2024-09-01',
              creators: [{ name: 'Data Creator' }],
              description: 'A dataset description.',
              resource_type: { type: 'dataset' },
            },
            files: [{ key: 'data.csv', links: { self: 'https://zenodo.org/api/files/abc/data.csv', preview: 'https://zenodo.org/records/1001/files/data.csv' } }],
          },
          {
            id: '1002',
            metadata: {
              title: 'Out of Range',
              publication_date: '2019-01-01',
            },
          },
          {
            id: '1003',
            metadata: {
              title: 'No Date',
            },
          },
        ],
      },
    };
    mockFetch(async (url, options) => {
      expect(url).toContain('q=pharmacology');
      expect(options?.headers?.Authorization).toBeUndefined();
      return { status: 200, ok: true, headers: {}, body: JSON.stringify(payload) };
    });
    const result = await zenodoProvider.harvest(buildQuery());
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.externalId).toBe('1001');
    expect(item.doi).toBe('10.5281/zenodo.1001');
    expect(item.publicationYear).toBe(2024);
    expect(item.resourceType).toBe('dataset');
    expect(item.fullTextUrl).toBe('https://zenodo.org/records/1001/files/data.csv');
    expect(item.accessState).toBe('full_text');
    expect(item.abstractText).toBe('A dataset description.');
    expect(item.creators).toEqual(['Data Creator']);
  });

  it('returns empty items with error on non-200', async () => {
    mockFetch(async () => ({ status: 500, ok: false, headers: {}, body: 'oops' }));
    const result = await zenodoProvider.harvest(buildQuery());
    expect(result.items).toEqual([]);
    expect(result.error).toBe('http 500');
  });

  it('uses DOI landing page when present, records landing honestly', async () => {
    const payload = {
      hits: {
        hits: [
          {
            id: '2001',
            doi: '10.5281/zenodo.2001',
            metadata: { title: 'DOI Landing Paper', publication_date: '2025-02-02' },
          },
        ],
      },
    };
    mockFetch(async () => ({ status: 200, ok: true, headers: {}, body: JSON.stringify(payload) }));
    const result = await zenodoProvider.harvest(buildQuery());
    expect(result.items[0].landingPageUrl).toBe('https://doi.org/10.5281/zenodo.2001');
    expect(result.items[0].fullTextUrl).toBeUndefined();
    expect(result.items[0].accessState).toBe('metadata_only');
  });
});