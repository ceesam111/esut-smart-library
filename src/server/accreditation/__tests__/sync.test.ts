import { describe, expect, it } from 'vitest';
import {
  buildDedupeKey,
  prepareRecord,
  runAccreditationSync,
  type ExistingResource,
  type ResourceInsertValues,
  type SyncRepository,
} from '../sync';
import type { AccreditationProvider, HarvestQuery, HarvestedItem, ProviderHarvestResult, SyncStateRow } from '../types';

interface MemoryRow extends ResourceInsertValues {
  id: string;
}

const createMemoryRepo = () => {
  const rows = new Map<string, MemoryRow>();
  const checkpoints = new Map<string, SyncStateRow>();
  let nextId = 1;

  const toExisting = (row: MemoryRow): ExistingResource => ({
    id: row.id,
    source_provider: row.source_provider,
    external_id: row.external_id,
    programmes: row.programmes,
    matched_terms: row.matched_terms,
    relevance_score: row.relevance_score,
    publisher: row.publisher,
    doi: row.doi,
    isbn: row.isbn,
    issn: row.issn,
    language: row.language,
    subject_headings: row.subject_headings,
    creators: row.creators,
    abstract_text: row.abstract_text,
    full_text_url: row.full_text_url,
    access_state: row.access_state,
    open_access: row.open_access,
    is_active: row.is_active,
  });

  const repo: SyncRepository = {
    async loadCheckpoint(provider, programmeSlug) {
      return checkpoints.get(`${provider}::${programmeSlug}`) ?? null;
    },
    async saveCheckpoint(state) {
      checkpoints.set(`${state.provider}::${state.programme_slug}`, {
        ...state,
        updated_at: state.last_run_at,
      });
    },
    async findExisting(provider, externalId) {
      const row = rows.get(`${provider}::${externalId}`);
      return row ? toExisting(row) : null;
    },
    async findByDedupeKey(dedupeKey) {
      for (const row of rows.values()) {
        if (row.dedupe_key === dedupeKey) return toExisting(row);
      }
      return null;
    },
    async insertRecord(values) {
      rows.set(`${values.source_provider}::${values.external_id}`, {
        ...values,
        id: `row-${nextId++}`,
      });
    },
    async updateRecord(id, patch) {
      for (const [key, row] of rows) {
        if (row.id !== id) continue;
        for (const field of Object.keys(patch)) {
          expect(field.startsWith('verification')).toBe(false);
        }
        rows.set(key, { ...row, ...(patch as Partial<MemoryRow>) });
        return;
      }
    },
  };

  return { repo, rows, checkpoints };
};

interface FakeProviderSpec {
  id: string;
  pages: ProviderHarvestResult[];
  courtesyDelayMs?: number;
}

const createFakeProvider = (spec: FakeProviderSpec) => {
  const queue = [...spec.pages];
  const queries: HarvestQuery[] = [];
  const provider: AccreditationProvider = {
    id: spec.id,
    displayName: spec.id,
    homepageUrl: 'https://example.org',
    docsUrl: 'https://example.org/docs',
    enabled: () => true,
    supportsServerYearFilter: true,
    courtesyDelayMs: spec.courtesyDelayMs,
    harvest: async (query) => {
      queries.push(query);
      return queue.shift() ?? { items: [], nextCursor: null };
    },
  };
  return { provider, queries };
};

const harvestedItem = (overrides: Partial<HarvestedItem> = {}): HarvestedItem => ({
  externalId: 'ext-1',
  resourceType: 'research_article',
  title: 'Pharmacology of paracetamol',
  creators: ['Chinedu Okafor'],
  subjectHeadings: ['pharmacology'],
  publicationYear: 2024,
  landingPageUrl: 'https://example.org/record/1',
  accessState: 'metadata_only',
  openAccess: false,
  ...overrides,
});

const fixedNow = (iso: string) => () => new Date(iso);

describe('buildDedupeKey', () => {
  it('prefers a normalised DOI identity', () => {
    expect(
      buildDedupeKey({
        doi: 'https://doi.org/10.1234/ABC',
        title: 'Anything',
        publicationYear: 2024,
        creators: ['Chinedu Okafor'],
      }),
    ).toBe('doi:10.1234/abc');
  });

  it('falls back to normalised title, year and first-author surname', () => {
    expect(
      buildDedupeKey({
        title: 'Pharmacology of Paracetamol!',
        publicationYear: 2024,
        creators: ['Chinedu Okafor'],
      }),
    ).toBe('title:pharmacology of paracetamol|2024|okafor');
  });

  it('produces the same key for equivalent titles with different punctuation', () => {
    const a = buildDedupeKey({ title: 'Drug metabolism: a review', publicationYear: 2023, creators: ['A B'] });
    const b = buildDedupeKey({ title: 'Drug metabolism - a review', publicationYear: 2023, creators: ['A B'] });
    expect(a).toBe(b);
  });
});

describe('prepareRecord', () => {
  const ctx = { providerId: 'openalex', programmeSlug: 'pharmacy', yearFrom: 2023, yearTo: 2026 };

  it('drops records outside the configured year window', () => {
    expect(prepareRecord(harvestedItem({ publicationYear: 2022 }), ctx)).toBeNull();
    expect(prepareRecord(harvestedItem({ publicationYear: 2027 }), ctx)).toBeNull();
  });

  it('drops records with no publication year even when the server filter is absent', () => {
    expect(prepareRecord(harvestedItem({ publicationYear: undefined }), ctx)).toBeNull();
  });

  it('keeps records at both boundaries of the year window', () => {
    expect(prepareRecord(harvestedItem({ publicationYear: 2023 }), ctx)?.publication_year).toBe(2023);
    expect(prepareRecord(harvestedItem({ publicationYear: 2026 }), ctx)?.publication_year).toBe(2026);
  });

  it('drops records without a usable landing page', () => {
    expect(prepareRecord(harvestedItem({ landingPageUrl: 'not-a-url' }), ctx)).toBeNull();
    expect(prepareRecord(harvestedItem({ landingPageUrl: 'javascript:alert(1)' }), ctx)).toBeNull();
  });

  it('drops empty titles and empty external ids', () => {
    expect(prepareRecord(harvestedItem({ title: '   ' }), ctx)).toBeNull();
    expect(prepareRecord(harvestedItem({ externalId: ' ' }), ctx)).toBeNull();
  });

  it('discards non-http full text URLs and downgrades the access state honestly', () => {
    const prepared = prepareRecord(
      harvestedItem({ fullTextUrl: 'javascript:alert(1)', abstractText: 'An abstract.' }),
      ctx,
    );
    expect(prepared?.full_text_url).toBeNull();
    expect(prepared?.access_state).toBe('abstract_only');
    expect(prepared?.open_access).toBe(false);
  });

  it('trusts a real direct full text URL and marks open access', () => {
    const prepared = prepareRecord(
      harvestedItem({ fullTextUrl: 'https://example.org/full.pdf', accessState: 'metadata_only' }),
      ctx,
    );
    expect(prepared?.full_text_url).toBe('https://example.org/full.pdf');
    expect(prepared?.access_state).toBe('full_text');
    expect(prepared?.open_access).toBe(true);
  });

  it('reports metadata_only when there is neither full text nor abstract', () => {
    expect(prepareRecord(harvestedItem({}), ctx)?.access_state).toBe('metadata_only');
  });

  it('always includes the harvest target programme and adds cross-matches', () => {
    const prepared = prepareRecord(
      harvestedItem({ title: 'Pharmacy practice and pharmacology', subjectHeadings: ['computer science'] }),
      ctx,
    );
    expect(prepared?.programmes).toContain('pharmacy');
    expect(prepared?.programmes.length).toBeGreaterThan(1);
    expect(prepared?.matched_terms.length).toBeGreaterThan(0);
  });

  it('forces the target programme in even with no lexical match at all', () => {
    const prepared = prepareRecord(
      harvestedItem({ title: 'Zzz unrelated', subjectHeadings: [] }),
      ctx,
    );
    expect(prepared?.programmes).toEqual(['pharmacy']);
    expect(prepared?.relevance_score).toBe(0);
  });
});

describe('runAccreditationSync', () => {
  it('inserts harvested records and checkpoints after every page', async () => {
    const { repo, rows, checkpoints } = createMemoryRepo();
    const fake = createFakeProvider({
      id: 'openalex',
      pages: [
        { items: [harvestedItem({ externalId: 'a', title: 'Pharmacology of paracetamol' })], nextCursor: 'c2' },
        { items: [harvestedItem({ externalId: 'b', title: 'Aspirin and platelet aggregation' })], nextCursor: null },
      ],
    });

    const outcome = await runAccreditationSync(
      { programmeSlugs: ['pharmacy'], maxPages: 4 },
      { repo, providers: [fake.provider], now: fixedNow('2026-11-01T10:00:00Z'), sleep: async () => undefined },
    );

    expect(outcome.summaries).toHaveLength(1);
    expect(outcome.summaries[0]).toMatchObject({ provider: 'openalex', programmeSlug: 'pharmacy', fetched: 2, upserted: 2, status: 'ok' });
    expect(outcome.requestsMade).toBe(2);
    expect(rows.size).toBe(2);
    expect(fake.queries[0]?.cursor).toBeNull();
    expect(fake.queries[1]?.cursor).toBe('c2');
    expect(fake.queries[0]?.searchTerms.length).toBeGreaterThan(0);
    expect(checkpoints.get('openalex::pharmacy')).toMatchObject({ cursor: null, last_status: 'ok', records_fetched: 2, records_upserted: 2 });
  });

  it('resumes from the stored cursor and restarts from page one when resume is disabled', async () => {
    const { repo, checkpoints } = createMemoryRepo();
    checkpoints.set('openalex::pharmacy', {
      provider: 'openalex',
      programme_slug: 'pharmacy',
      cursor: 'c7',
      last_run_at: '2026-10-31T10:00:00Z',
      last_status: 'ok',
      records_fetched: 25,
      records_upserted: 20,
      last_error: null,
      updated_at: '2026-10-31T10:00:00Z',
    });

    const resumed = createFakeProvider({ id: 'openalex', pages: [{ items: [], nextCursor: null }] });
    await runAccreditationSync(
      { programmeSlugs: ['pharmacy'], maxPages: 1 },
      { repo, providers: [resumed.provider], now: fixedNow('2026-11-01T10:00:00Z'), sleep: async () => undefined },
    );
    expect(resumed.queries[0]?.cursor).toBe('c7');

    const restarted = createFakeProvider({ id: 'openalex', pages: [{ items: [], nextCursor: null }] });
    await runAccreditationSync(
      { programmeSlugs: ['pharmacy'], maxPages: 1, resume: false },
      { repo, providers: [restarted.provider], now: fixedNow('2026-11-01T11:00:00Z'), sleep: async () => undefined },
    );
    expect(restarted.queries[0]?.cursor).toBeNull();
  });

  it('refreshes an existing record without touching first_indexed_at and reactivates it', async () => {
    const { repo, rows } = createMemoryRepo();
    const first = createFakeProvider({
      id: 'openalex',
      pages: [{ items: [harvestedItem({ externalId: 'a', title: 'First title' })], nextCursor: null }],
    });
    await runAccreditationSync(
      { programmeSlugs: ['pharmacy'] },
      { repo, providers: [first.provider], now: fixedNow('2026-11-01T10:00:00Z'), sleep: async () => undefined },
    );

    const stored = rows.get('openalex::a');
    expect(stored?.first_indexed_at).toBe('2026-11-01T10:00:00.000Z');
    rows.set('openalex::a', { ...stored!, is_active: false, relevance_score: 5 });

    const second = createFakeProvider({
      id: 'openalex',
      pages: [{ items: [harvestedItem({ externalId: 'a', title: 'Second title' })], nextCursor: null }],
    });
    await runAccreditationSync(
      { programmeSlugs: ['pharmacy'] },
      { repo, providers: [second.provider], now: fixedNow('2026-11-02T10:00:00Z'), sleep: async () => undefined },
    );

    const refreshed = rows.get('openalex::a');
    expect(rows.size).toBe(1);
    expect(refreshed?.title).toBe('Second title');
    expect(refreshed?.first_indexed_at).toBe('2026-11-01T10:00:00.000Z');
    expect(refreshed?.last_synced_at).toBe('2026-11-02T10:00:00.000Z');
    expect(refreshed?.is_active).toBe(true);
    expect(refreshed?.relevance_score).toBeGreaterThanOrEqual(5);
    expect(refreshed?.verification_status).toBe('unverified');
  });

  it('merges the same work from a different provider without changing its identity', async () => {
    const { repo, rows } = createMemoryRepo();
    const first = createFakeProvider({
      id: 'openalex',
      pages: [
        {
          items: [
            harvestedItem({
              externalId: 'oa-1',
              doi: '10.1234/merge',
              title: 'Merged work',
              subjectHeadings: [],
            }),
          ],
          nextCursor: null,
        },
      ],
    });
    await runAccreditationSync(
      { programmeSlugs: ['pharmacy'] },
      { repo, providers: [first.provider], now: fixedNow('2026-11-01T10:00:00Z'), sleep: async () => undefined },
    );

    const second = createFakeProvider({
      id: 'crossref',
      pages: [
        {
          items: [
            harvestedItem({
              externalId: 'cr-9',
              doi: 'https://doi.org/10.1234/MERGE',
              title: 'Merged work',
              abstractText: 'An abstract from crossref.',
              subjectHeadings: ['medicine'],
            }),
          ],
          nextCursor: null,
        },
      ],
    });
    await runAccreditationSync(
      { programmeSlugs: ['accounting'] },
      { repo, providers: [second.provider], now: fixedNow('2026-11-01T11:00:00Z'), sleep: async () => undefined },
    );

    expect(rows.size).toBe(1);
    const merged = rows.get('openalex::oa-1');
    expect(merged).toBeDefined();
    expect(rows.has('crossref::cr-9')).toBe(false);
    expect(merged?.source_provider).toBe('openalex');
    expect(merged?.external_id).toBe('oa-1');
    expect(merged?.abstract_text).toBe('An abstract from crossref.');
    expect(merged?.subject_headings).toEqual(['medicine']);
    expect(merged?.programmes).toEqual(expect.arrayContaining(['pharmacy', 'accounting']));
    expect(merged?.last_synced_at).toBe('2026-11-01T11:00:00.000Z');
  });

  it('never overwrites non-null metadata during a cross-provider merge', async () => {
    const { repo, rows } = createMemoryRepo();
    const first = createFakeProvider({
      id: 'openalex',
      pages: [
        {
          items: [
            harvestedItem({
              externalId: 'oa-1',
              doi: '10.1234/keep',
              title: 'Keep work',
              publisher: 'Original Publisher',
              abstractText: 'Original abstract',
            }),
          ],
          nextCursor: null,
        },
      ],
    });
    await runAccreditationSync(
      { programmeSlugs: ['pharmacy'] },
      { repo, providers: [first.provider], now: fixedNow('2026-11-01T10:00:00Z'), sleep: async () => undefined },
    );

    const second = createFakeProvider({
      id: 'crossref',
      pages: [
        {
          items: [
            harvestedItem({
              externalId: 'cr-1',
              doi: '10.1234/keep',
              title: 'Keep work',
              publisher: 'Other Publisher',
              abstractText: 'Other abstract',
            }),
          ],
          nextCursor: null,
        },
      ],
    });
    await runAccreditationSync(
      { programmeSlugs: ['pharmacy'] },
      { repo, providers: [second.provider], now: fixedNow('2026-11-01T11:00:00Z'), sleep: async () => undefined },
    );

    const merged = rows.get('openalex::oa-1');
    expect(rows.size).toBe(1);
    expect(merged?.publisher).toBe('Original Publisher');
    expect(merged?.abstract_text).toBe('Original abstract');
  });

  it('applies the year window again at write time even when a provider ignores it', async () => {
    const { repo, rows } = createMemoryRepo();
    const fake = createFakeProvider({
      id: 'doaj',
      pages: [
        {
          items: [
            harvestedItem({ externalId: 'old', publicationYear: 2021 }),
            harvestedItem({ externalId: 'fresh', publicationYear: 2025 }),
          ],
          nextCursor: null,
        },
      ],
    });

    const outcome = await runAccreditationSync(
      { programmeSlugs: ['pharmacy'] },
      { repo, providers: [fake.provider], now: fixedNow('2026-11-01T10:00:00Z'), sleep: async () => undefined },
    );

    expect(outcome.summaries[0]?.fetched).toBe(2);
    expect(outcome.summaries[0]?.upserted).toBe(1);
    expect(rows.size).toBe(1);
    expect(rows.has('doaj::fresh')).toBe(true);
  });

  it('stops a rate-limited provider, skips its remaining combos and keeps other providers running', async () => {
    const { repo, checkpoints } = createMemoryRepo();
    const limited = createFakeProvider({
      id: 'arxiv',
      pages: [{ items: [], rateLimitedUntil: '2026-11-01T12:00:00Z', error: 'rate limited' }],
    });
    const healthy = createFakeProvider({
      id: 'openalex',
      pages: [{ items: [harvestedItem({ externalId: 'h1' })], nextCursor: null }],
    });

    const outcome = await runAccreditationSync(
      { programmeSlugs: ['pharmacy', 'accounting'] },
      { repo, providers: [limited.provider, healthy.provider], now: fixedNow('2026-11-01T10:00:00Z'), sleep: async () => undefined },
    );

    const arxivSummaries = outcome.summaries.filter((summary) => summary.provider === 'arxiv');
    expect(arxivSummaries).toHaveLength(2);
    expect(arxivSummaries[0]).toMatchObject({ programmeSlug: 'pharmacy', status: 'rate_limited', error: 'rate limited until 2026-11-01T12:00:00Z' });
    expect(arxivSummaries[1]).toMatchObject({ programmeSlug: 'accounting', status: 'rate_limited', error: 'skipped: provider rate limited earlier in this run' });
    expect(limited.queries).toHaveLength(1);
    expect(checkpoints.get('arxiv::pharmacy')).toMatchObject({ last_status: 'rate_limited' });
    expect(outcome.summaries.some((summary) => summary.provider === 'openalex' && summary.status === 'ok')).toBe(true);
  });

  it('never makes more provider requests than the per-run budget allows', async () => {
    const { repo } = createMemoryRepo();
    const fake = createFakeProvider({
      id: 'openalex',
      pages: [
        { items: [harvestedItem({ externalId: 'p1' })], nextCursor: 'c2' },
        { items: [harvestedItem({ externalId: 'p2' })], nextCursor: 'c3' },
        { items: [harvestedItem({ externalId: 'p3' })], nextCursor: null },
      ],
    });

    const outcome = await runAccreditationSync(
      { programmeSlugs: ['pharmacy'], maxRequests: 2 },
      { repo, providers: [fake.provider], now: fixedNow('2026-11-01T10:00:00Z'), sleep: async () => undefined },
    );

    expect(outcome.requestsMade).toBe(2);
    expect(fake.queries).toHaveLength(2);
  });

  it('observes the provider courtesy delay between pages', async () => {
    const { repo } = createMemoryRepo();
    const sleeps: number[] = [];
    const fake = createFakeProvider({
      id: 'arxiv',
      courtesyDelayMs: 250,
      pages: [
        { items: [harvestedItem({ externalId: 'p1' })], nextCursor: 'c2' },
        { items: [], nextCursor: null },
      ],
    });

    await runAccreditationSync(
      { programmeSlugs: ['pharmacy'] },
      {
        repo,
        providers: [fake.provider],
        now: fixedNow('2026-11-01T10:00:00Z'),
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
    );

    expect(sleeps).toEqual([250]);
  });

  it('records a provider failure as an error summary without stopping the run', async () => {
    const { repo, checkpoints } = createMemoryRepo();
    const failing: AccreditationProvider = {
      id: 'core',
      displayName: 'core',
      homepageUrl: 'https://example.org',
      docsUrl: 'https://example.org/docs',
      enabled: () => true,
      supportsServerYearFilter: false,
      harvest: async () => ({ items: [], error: 'http 500' }),
    };
    const healthy = createFakeProvider({
      id: 'openalex',
      pages: [{ items: [harvestedItem({ externalId: 'h1' })], nextCursor: null }],
    });

    const outcome = await runAccreditationSync(
      { programmeSlugs: ['pharmacy'] },
      { repo, providers: [failing, healthy.provider], now: fixedNow('2026-11-01T10:00:00Z'), sleep: async () => undefined },
    );

    expect(outcome.summaries[0]).toMatchObject({ provider: 'core', status: 'error', error: 'http 500' });
    expect(checkpoints.get('core::pharmacy')).toMatchObject({ last_status: 'error', last_error: 'http 500' });
    expect(outcome.summaries[1]).toMatchObject({ provider: 'openalex', status: 'ok' });
  });

  it('converts an unexpected provider throw into an error summary', async () => {
    const { repo } = createMemoryRepo();
    const throwing: AccreditationProvider = {
      id: 'core',
      displayName: 'core',
      homepageUrl: 'https://example.org',
      docsUrl: 'https://example.org/docs',
      enabled: () => true,
      supportsServerYearFilter: false,
      harvest: async () => {
        throw new Error('socket hang up');
      },
    };

    const outcome = await runAccreditationSync(
      { programmeSlugs: ['pharmacy'] },
      { repo, providers: [throwing], now: fixedNow('2026-11-01T10:00:00Z'), sleep: async () => undefined },
    );

    expect(outcome.summaries[0]).toMatchObject({ status: 'error', error: 'socket hang up' });
  });

  it('rejects unknown provider ids and programme slugs', async () => {
    const { repo } = createMemoryRepo();
    await expect(
      runAccreditationSync({ providerIds: ['nope'], programmeSlugs: ['pharmacy'] }, { repo }),
    ).rejects.toThrow('Unknown provider id: nope');
    await expect(
      runAccreditationSync({ programmeSlugs: ['nope'] }, { repo }),
    ).rejects.toThrow('Unknown programme slug: nope');
  });

  it('caps each page at the documented page size', async () => {
    const { repo } = createMemoryRepo();
    const fake = createFakeProvider({ id: 'openalex', pages: [{ items: [], nextCursor: null }] });

    await runAccreditationSync(
      { programmeSlugs: ['pharmacy'], maxPerProgrammePerProvider: 200 },
      { repo, providers: [fake.provider], now: fixedNow('2026-11-01T10:00:00Z'), sleep: async () => undefined },
    );

    expect(fake.queries[0]?.limit).toBe(25);
  });

  it('stops paging a combo once the per-programme cap is reached', async () => {
    const { repo } = createMemoryRepo();
    const fake = createFakeProvider({
      id: 'openalex',
      pages: [
        { items: [harvestedItem({ externalId: 'a' }), harvestedItem({ externalId: 'b' })], nextCursor: 'c2' },
        { items: [harvestedItem({ externalId: 'c' })], nextCursor: 'c3' },
      ],
    });

    const outcome = await runAccreditationSync(
      { programmeSlugs: ['pharmacy'], maxPerProgrammePerProvider: 2, maxPages: 4 },
      { repo, providers: [fake.provider], now: fixedNow('2026-11-01T10:00:00Z'), sleep: async () => undefined },
    );

    expect(outcome.summaries[0]).toMatchObject({ fetched: 2, upserted: 2 });
    expect(fake.queries).toHaveLength(1);
  });
});
