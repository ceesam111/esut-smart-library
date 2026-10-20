import type { SupabaseClient } from '@supabase/supabase-js';
import { appBaseUrl } from '@/server/seo/scholarlyMetadata';

export const SITEMAP_URL_LIMIT = 50000;
const DEEP_DOI_CAP = 25;
const CHECK_TIMEOUT_MS = 5000;

export interface MetadataGaps {
  missing_abstract: number;
  missing_keywords: number;
  missing_year: number;
  missing_authors: number;
  missing_doi: number;
  missing_license: number;
  missing_language: number;
  missing_handle: number;
  missing_file: number;
}

export interface CrawlCheck {
  status: 'ok' | 'error' | 'unavailable';
  code?: number;
  detail?: string;
}

export interface BrokenLinkReport {
  status: 'ok' | 'unavailable' | 'skipped';
  checked: number;
  broken: Array<{ id: string; doi: string; code?: number }>;
  unverifiable: number;
  detail?: string;
}

export interface VisibilityDiagnostics {
  generated_at: string;
  repository: {
    published_items: number;
    public_indexable_items: number;
    embargoed_items: number;
    non_public_published_items: number;
    sitemap_urls: number;
    sitemap_capacity: number;
    sitemap_coverage_pct: number;
    published_theses: number;
  };
  metadata_gaps: MetadataGaps;
  duplicate_titles: Array<{ title: string; count: number }>;
  crawlability: {
    base_url: string;
    robots_txt: CrawlCheck;
    sitemap_index: CrawlCheck;
  };
  broken_links: BrokenLinkReport;
  search_console: { configured: boolean; status: 'not_configured'; note: string };
}

interface IndexableRow {
  id: string;
  handle: string | null;
  title: string | null;
  abstract: string | null;
  keywords: unknown;
  year: number | null;
  authors: unknown;
  doi: string | null;
  license: string | null;
  language: string | null;
  file_url: string | null;
}

function hasText(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function resolveCount(builder: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
  const { count, error } = await builder;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function fetchCheck(url: string, expect: (body: string) => boolean): Promise<CrawlCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    const body = (await response.text()).slice(0, 4000);
    if (!response.ok) return { status: 'error', code: response.status, detail: `Expected 2xx, received ${response.status}.` };
    if (!expect(body)) return { status: 'error', code: response.status, detail: 'Response body failed structural validation.' };
    return { status: 'ok', code: response.status };
  } catch (error) {
    return { status: 'error', detail: error instanceof Error ? error.message : 'Request failed.' };
  } finally {
    clearTimeout(timer);
  }
}

async function checkDoiLinks(rows: Array<{ id: string; doi: string | null }>): Promise<BrokenLinkReport> {
  const candidates = rows.filter((row) => hasText(row.doi)).slice(0, DEEP_DOI_CAP);
  if (candidates.length === 0) {
    return { status: 'skipped', checked: 0, broken: [], unverifiable: 0, detail: 'No DOI links to verify.' };
  }

  const broken: BrokenLinkReport['broken'] = [];
  let unverifiable = 0;
  let checked = 0;

  for (const row of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    checked += 1;
    try {
      const response = await fetch(`https://doi.org/${encodeURIComponent(row.doi as string)}`, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
      });
      if (response.status >= 400 && response.status !== 403 && response.status !== 405) {
        broken.push({ id: row.id, doi: row.doi as string, code: response.status });
      } else if (response.status === 403 || response.status === 405) {
        unverifiable += 1;
      }
    } catch {
      unverifiable += 1;
    } finally {
      clearTimeout(timer);
    }
  }

  return { status: 'ok', checked, broken, unverifiable };
}

export interface DiagnosticsOptions {
  deep?: boolean;
}

export async function computeVisibilityDiagnostics(
  db: SupabaseClient,
  options: DiagnosticsOptions = {},
): Promise<VisibilityDiagnostics> {
  const nowIso = new Date().toISOString();
  const embargoGate = `embargo_until.is.null,embargo_until.lte.${nowIso}`;
  const repositoryCount = () => db.from('repository_items').select('id', { count: 'exact', head: true });

  const [publishedItems, publicIndexable, embargoed, nonPublicPublished, publishedTheses] = await Promise.all([
    resolveCount(repositoryCount().eq('status', 'published')),
    resolveCount(repositoryCount().eq('status', 'published').eq('visibility', 'global').or(embargoGate)),
    resolveCount(repositoryCount().eq('status', 'published').eq('visibility', 'global').gt('embargo_until', nowIso)),
    resolveCount(repositoryCount().eq('status', 'published').neq('visibility', 'global')),
    resolveCount(db.from('theses').select('id', { count: 'exact', head: true }).eq('status', 'published')),
  ]);

  const { data: indexableRows, error: rowsError } = await db
    .from('repository_items')
    .select('id,handle,title,abstract,keywords,year,authors,doi,license,language,file_url')
    .eq('status', 'published')
    .eq('visibility', 'global')
    .or(embargoGate)
    .limit(SITEMAP_URL_LIMIT);
  if (rowsError) throw new Error(rowsError.message);
  const rows = (indexableRows ?? []) as unknown as IndexableRow[];

  const metadataGaps: MetadataGaps = {
    missing_abstract: 0,
    missing_keywords: 0,
    missing_year: 0,
    missing_authors: 0,
    missing_doi: 0,
    missing_license: 0,
    missing_language: 0,
    missing_handle: 0,
    missing_file: 0,
  };
  const titleCounts = new Map<string, { title: string; count: number }>();

  for (const row of rows) {
    if (!hasText(row.abstract)) metadataGaps.missing_abstract += 1;
    if (!hasText(row.keywords)) metadataGaps.missing_keywords += 1;
    if (!row.year) metadataGaps.missing_year += 1;
    if (!hasText(row.authors)) metadataGaps.missing_authors += 1;
    if (!hasText(row.doi)) metadataGaps.missing_doi += 1;
    if (!hasText(row.license)) metadataGaps.missing_license += 1;
    if (!hasText(row.language)) metadataGaps.missing_language += 1;
    if (!hasText(row.handle)) metadataGaps.missing_handle += 1;
    if (!hasText(row.file_url)) metadataGaps.missing_file += 1;
    if (hasText(row.title)) {
      const key = normalizeTitle(row.title as string);
      const entry = titleCounts.get(key);
      if (entry) entry.count += 1;
      else titleCounts.set(key, { title: (row.title as string).trim(), count: 1 });
    }
  }

  const duplicateTitles = [...titleCounts.values()]
    .filter((entry) => entry.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const sitemapUrls = rows.length;
  const coverage = publicIndexable > 0 ? Math.min(100, Math.round((sitemapUrls / publicIndexable) * 100)) : 100;

  const deep = options.deep === true;
  const base = appBaseUrl();
  const [robotsTxt, sitemapIndex, brokenLinks] = deep
    ? await Promise.all([
        fetchCheck(`${base}/robots.txt`, (body) => body.includes('User-agent')),
        fetchCheck(`${base}/sitemap.xml`, (body) => body.includes('<sitemap') || body.includes('<urlset')),
        checkDoiLinks(rows),
      ])
    : [
        { status: 'unavailable' as const, detail: 'Deep check not requested.' },
        { status: 'unavailable' as const, detail: 'Deep check not requested.' },
        { status: 'unavailable' as const, checked: 0, broken: [], unverifiable: 0, detail: 'Deep check not requested.' } satisfies BrokenLinkReport,
      ];

  return {
    generated_at: new Date().toISOString(),
    repository: {
      published_items: publishedItems,
      public_indexable_items: publicIndexable,
      embargoed_items: embargoed,
      non_public_published_items: nonPublicPublished,
      sitemap_urls: sitemapUrls,
      sitemap_capacity: SITEMAP_URL_LIMIT,
      sitemap_coverage_pct: coverage,
      published_theses: publishedTheses,
    },
    metadata_gaps: metadataGaps,
    duplicate_titles: duplicateTitles,
    crawlability: { base_url: base, robots_txt: robotsTxt, sitemap_index: sitemapIndex },
    broken_links: brokenLinks,
    search_console: {
      configured: false,
      status: 'not_configured',
      note: 'Google Search Console credentials are not configured, so crawl-error import is unavailable.',
    },
  };
}
