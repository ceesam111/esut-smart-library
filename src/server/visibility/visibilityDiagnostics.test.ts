import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeVisibilityDiagnostics, SITEMAP_URL_LIMIT } from './visibilityDiagnostics';

type Row = Record<string, unknown>;

type Op =
  | { type: 'eq'; col: string; val: unknown }
  | { type: 'neq'; col: string; val: unknown }
  | { type: 'gt'; col: string; val: unknown }
  | { type: 'or'; expr: string };

function matchOr(row: Row, expr: string): boolean {
  return expr.split(',').some((part) => {
    const [col, op, ...rest] = part.split('.');
    const value = rest.join('.');
    const cell = row[col];
    if (op === 'is' && value === 'null') return cell === null || cell === undefined;
    if (op === 'lte') return cell !== null && cell !== undefined && String(cell) <= value;
    if (op === 'gte') return cell !== null && cell !== undefined && String(cell) >= value;
    return false;
  });
}

function makeClient(tableRows: Record<string, Row[]>): SupabaseClient {
  const builder = (table: string) => {
    const rows = tableRows[table] ?? [];
    const ops: Op[] = [];

    const filtered = () =>
      rows.filter((row) =>
        ops.every((op) => {
          if (op.type === 'eq') return row[op.col] === op.val;
          if (op.type === 'neq') return row[op.col] !== op.val;
          if (op.type === 'gt') return String(row[op.col] ?? '') > String(op.val);
          return matchOr(row, op.expr);
        }),
      );

    const chain = {
      select(_columns: string, _options?: { count?: string; head?: boolean }) {
        return chain;
      },
      eq(col: string, val: unknown) { ops.push({ type: 'eq', col, val }); return chain; },
      neq(col: string, val: unknown) { ops.push({ type: 'neq', col, val }); return chain; },
      gt(col: string, val: unknown) { ops.push({ type: 'gt', col, val }); return chain; },
      or(expr: string) { ops.push({ type: 'or', expr }); return chain; },
      limit(value: number) {
        return Promise.resolve({ data: filtered().slice(0, value), count: filtered().length, error: null });
      },
      then(onFulfilled: (value: unknown) => unknown) {
        return Promise.resolve({ data: filtered(), count: filtered().length, error: null }).then(onFulfilled);
      },
    };
    return chain;
  };

  return { from: builder } as unknown as SupabaseClient;
}

const repositoryRows: Row[] = [
  {
    id: 'r1', status: 'published', visibility: 'global', embargo_until: null,
    title: 'Solar Energy Storage', abstract: 'A study.', keywords: ['solar'], year: 2025,
    authors: ['Okoro, J.'], doi: '10.1234/esut.1', license: 'CC BY', language: 'English',
    handle: 'esutir/2025/1', file_url: 'https://cdn.example/r1.pdf',
  },
  {
    id: 'r2', status: 'published', visibility: 'global', embargo_until: null,
    title: 'solar  energy storage', abstract: null, keywords: [], year: null,
    authors: [], doi: null, license: null, language: 'English',
    handle: null, file_url: null,
  },
  {
    id: 'r3', status: 'published', visibility: 'global', embargo_until: '2099-01-01T00:00:00.000Z',
    title: 'Embargoed Work', abstract: 'x', keywords: ['e'], year: 2026,
    authors: ['A'], doi: null, license: null, language: 'English', handle: 'esutir/2026/3', file_url: 'https://cdn.example/r3.pdf',
  },
  {
    id: 'r4', status: 'published', visibility: 'faculty', embargo_until: null,
    title: 'Faculty Only Work', abstract: 'x', keywords: ['f'], year: 2026,
    authors: ['B'], doi: null, license: null, language: 'English', handle: 'esutir/2026/4', file_url: 'https://cdn.example/r4.pdf',
  },
  {
    id: 'r5', status: 'draft', visibility: 'global', embargo_until: null,
    title: 'Unpublished Draft', abstract: null, keywords: [], year: null, authors: [],
    doi: null, license: null, language: null, handle: null, file_url: null,
  },
  {
    id: 'r6', status: 'published', visibility: 'global', embargo_until: null,
    title: 'Wind Power', abstract: 'y', keywords: ['wind'], year: 2024,
    authors: ['C'], doi: null, license: null, language: 'English', handle: 'esutir/2024/6', file_url: 'https://cdn.example/r6.pdf',
  },
  {
    id: 'r7', status: 'published', visibility: 'global', embargo_until: null,
    title: 'WIND   POWER', abstract: 'y', keywords: ['wind'], year: 2024,
    authors: ['D'], doi: null, license: null, language: 'English', handle: 'esutir/2024/7', file_url: 'https://cdn.example/r7.pdf',
  },
];

const client = makeClient({
  repository_items: repositoryRows,
  theses: [
    { id: 't1', status: 'published' },
    { id: 't2', status: 'approved' },
  ],
});

describe('computeVisibilityDiagnostics', () => {
  it('separates published, indexable, embargoed and non-public records', async () => {
    const diagnostics = await computeVisibilityDiagnostics(client);
    expect(diagnostics.repository.published_items).toBe(6);
    expect(diagnostics.repository.public_indexable_items).toBe(4);
    expect(diagnostics.repository.embargoed_items).toBe(1);
    expect(diagnostics.repository.non_public_published_items).toBe(1);
    expect(diagnostics.repository.published_theses).toBe(1);
  });

  it('reports full sitemap coverage for indexable records within capacity', async () => {
    const diagnostics = await computeVisibilityDiagnostics(client);
    expect(diagnostics.repository.sitemap_urls).toBe(4);
    expect(diagnostics.repository.sitemap_capacity).toBe(SITEMAP_URL_LIMIT);
    expect(diagnostics.repository.sitemap_coverage_pct).toBe(100);
  });

  it('counts missing metadata across indexable records only', async () => {
    const diagnostics = await computeVisibilityDiagnostics(client);
    expect(diagnostics.metadata_gaps.missing_abstract).toBe(1);
    expect(diagnostics.metadata_gaps.missing_keywords).toBe(1);
    expect(diagnostics.metadata_gaps.missing_year).toBe(1);
    expect(diagnostics.metadata_gaps.missing_authors).toBe(1);
    expect(diagnostics.metadata_gaps.missing_handle).toBe(1);
    expect(diagnostics.metadata_gaps.missing_file).toBe(1);
    expect(diagnostics.metadata_gaps.missing_language).toBe(0);
    expect(diagnostics.metadata_gaps.missing_doi).toBe(3);
  });

  it('groups duplicate titles case- and whitespace-insensitively', async () => {
    const diagnostics = await computeVisibilityDiagnostics(client);
    expect(diagnostics.duplicate_titles).toHaveLength(2);
    const titles = diagnostics.duplicate_titles.map((entry) => entry.title);
    expect(titles).toContain('Solar Energy Storage');
    expect(titles).toContain('Wind Power');
    for (const entry of diagnostics.duplicate_titles) expect(entry.count).toBe(2);
  });

  it('keeps deep checks explicitly unavailable until requested', async () => {
    const diagnostics = await computeVisibilityDiagnostics(client);
    expect(diagnostics.crawlability.robots_txt.status).toBe('unavailable');
    expect(diagnostics.crawlability.sitemap_index.status).toBe('unavailable');
    expect(diagnostics.broken_links.status).toBe('unavailable');
    expect(diagnostics.search_console.status).toBe('not_configured');
    expect(diagnostics.search_console.configured).toBe(false);
  });
});
