import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import {
  classifyReferrer,
  duplicateTitleGroups,
  metadataCompleteness,
  monthlyDepositBuckets,
  buildResearchCsv,
  type CsvSection,
  type DuplicateCandidate,
  type MetadataCompletenessInput,
  type ReferrerClass,
} from '@/server/analytics/visibility';

export const dynamic = 'force-dynamic';

const MAX_ITEMS = 5000;
const MAX_EVENT_ROWS = 5000;

const REFERRER_CLASSES: ReferrerClass[] = ['direct', 'internal', 'search_engine', 'social', 'ai_agent', 'other'];

interface PublishedItemRow {
  id: string;
  title: string | null;
  item_type: string | null;
  authors: unknown;
  abstract: string | null;
  subjects: unknown;
  keywords: unknown;
  faculty_code: string | null;
  department: string | null;
  year: number | null;
  language: string | null;
  doi: string | null;
  file_url: string | null;
  checksum: string | null;
  embargo_until: string | null;
  visibility: string | null;
  status: string | null;
  view_count: number | null;
  download_count: number | null;
  created_at: string;
}

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function internalHostsFromEnv(): string[] {
  const hosts = new Set<string>(['virtuallibrary.esut.edu.ng', 'esut.edu.ng', 'localhost']);
  for (const key of ['APP_BASE_URL', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SITE_URL'] as const) {
    const raw = process.env[key];
    if (!raw) continue;
    try {
      hosts.add(new URL(raw).hostname.toLowerCase());
    } catch {
      // Ignore unparsable env values; the defaults still apply.
    }
  }
  return [...hosts];
}

function isThesisRow(row: PublishedItemRow): boolean {
  const type = `${row.item_type ?? ''}`.toLowerCase();
  return type.includes('thesis') || type.includes('dissertation');
}

function isPublicFullText(row: PublishedItemRow, nowIso: string): boolean {
  if (row.status !== 'published' || row.visibility !== 'global' || !row.file_url) return false;
  if (row.embargo_until && row.embargo_until > nowIso) return false;
  return true;
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const { searchParams } = new URL(request.url);
    const days = parsePositiveInt(searchParams.get('days'), 365, 3650);
    const page = parsePositiveInt(searchParams.get('page'), 1, 100000);
    const pageSize = parsePositiveInt(searchParams.get('page_size'), 50, 200);
    const format = searchParams.get('format') === 'csv' ? 'csv' : 'json';
    const faculty = searchParams.get('faculty');
    const department = searchParams.get('department');

    const supabase = getSupabaseAdminClient();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();
    const botFilter = 'bot_flag.is.null,bot_flag.neq.BOT';

    const itemColumns = 'id, title, item_type, authors, abstract, subjects, keywords, faculty_code, department, year, language, doi, file_url, checksum, embargo_until, visibility, status, view_count, download_count, created_at';

    let publishedQuery = supabase.from('repository_items').select(itemColumns).eq('status', 'published');
    if (faculty) publishedQuery = publishedQuery.eq('faculty_code', faculty);
    if (department) publishedQuery = publishedQuery.eq('department', department);

    let depositQuery = supabase.from('repository_items').select('created_at, status').gte('created_at', since);
    if (faculty) depositQuery = depositQuery.eq('faculty_code', faculty);
    if (department) depositQuery = depositQuery.eq('department', department);

    let approvedQuery = supabase.from('repository_items').select('id', { count: 'exact', head: true }).eq('status', 'approved');
    if (faculty) approvedQuery = approvedQuery.eq('faculty_code', faculty);
    if (department) approvedQuery = approvedQuery.eq('department', department);

    const humanEventCount = (eventType: string) => {
      let q = supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', eventType).gte('created_at', since).or(botFilter);
      if (faculty) q = q.eq('faculty', faculty);
      if (department) q = q.eq('department', department);
      return q;
    };

    const [
      { data: publishedRows, error: publishedError },
      { data: depositRows, error: depositError },
      { count: approvedCount, error: approvedError },
      { count: humanViewCount, error: viewCountError },
      { count: humanDownloadCount, error: downloadCountError },
      { data: referrerRows, error: referrerError },
    ] = await Promise.all([
      publishedQuery.limit(MAX_ITEMS),
      depositQuery.limit(MAX_EVENT_ROWS),
      approvedQuery,
      humanEventCount('repository_item_view'),
      humanEventCount('repository_file_download'),
      supabase.from('analytics_events')
        .select('referrer')
        .in('event_type', ['repository_item_view', 'repository_file_download'])
        .gte('created_at', since)
        .or(botFilter)
        .limit(MAX_EVENT_ROWS),
    ]);

    if (publishedError) throw new Error(publishedError.message);
    if (depositError) throw new Error(depositError.message);
    if (approvedError) throw new Error(approvedError.message);
    if (viewCountError) throw new Error(viewCountError.message);
    if (downloadCountError) throw new Error(downloadCountError.message);
    if (referrerError) throw new Error(referrerError.message);

    const publishedItems: PublishedItemRow[] = (publishedRows ?? []) as unknown as PublishedItemRow[];

    const byFaculty = new Map<string, number>();
    const byDepartment = new Map<string, number>();
    let thesesTotal = 0;
    let publicFullText = 0;
    let filesMissingChecksum = 0;
    let embargoedFiles = 0;
    let counterViews = 0;
    let counterDownloads = 0;
    const completenessResults = publishedItems.map((row) => {
      const input: MetadataCompletenessInput = {
        title: row.title,
        authors: row.authors,
        abstract: row.abstract,
        year: row.year,
        subjects: row.subjects,
        keywords: row.keywords,
        doi: row.doi,
        faculty_code: row.faculty_code,
        department: row.department,
        language: row.language,
        file_url: row.file_url,
      };
      return metadataCompleteness(input);
    });
    const missingFieldCounts: Record<string, number> = {};
    for (const result of completenessResults) {
      for (const field of result.missingFields) {
        missingFieldCounts[field] = (missingFieldCounts[field] ?? 0) + 1;
      }
    }
    const averageCompleteness = completenessResults.length > 0
      ? Math.round(completenessResults.reduce((sum, r) => sum + r.score, 0) / completenessResults.length)
      : 0;

    for (const row of publishedItems) {
      const facultyKey = row.faculty_code?.trim() || 'unassigned';
      const departmentKey = row.department?.trim() || 'unassigned';
      byFaculty.set(facultyKey, (byFaculty.get(facultyKey) ?? 0) + 1);
      byDepartment.set(departmentKey, (byDepartment.get(departmentKey) ?? 0) + 1);
      if (isThesisRow(row)) thesesTotal += 1;
      if (isPublicFullText(row, nowIso)) publicFullText += 1;
      if (row.embargo_until && row.embargo_until > nowIso) embargoedFiles += 1;
      if (row.file_url && !row.checksum) filesMissingChecksum += 1;
      counterViews += row.view_count ?? 0;
      counterDownloads += row.download_count ?? 0;
    }

    const hosts = internalHostsFromEnv();
    const referrerTotals: Record<ReferrerClass, number> = {
      direct: 0, internal: 0, search_engine: 0, social: 0, ai_agent: 0, other: 0,
    };
    for (const row of referrerRows ?? []) {
      const referrer = (row as { referrer?: string | null }).referrer ?? null;
      referrerTotals[classifyReferrer(referrer, hosts)] += 1;
    }

    const duplicateCandidates: DuplicateCandidate[] = publishedItems.map((row) => ({
      id: row.id,
      title: row.title ?? '',
      status: row.status,
    }));
    const allDuplicateGroups = duplicateTitleGroups(duplicateCandidates);
    const duplicateStart = (page - 1) * pageSize;
    const duplicatePage = allDuplicateGroups.slice(duplicateStart, duplicateStart + pageSize);

    const deposits = monthlyDepositBuckets((depositRows ?? []) as Array<{ created_at: string; status?: string | null }>);

    const sitemapEligible = publishedItems.filter((row) => isPublicFullText(row, nowIso) || (row.status === 'published' && row.visibility === 'global' && !row.embargo_until)).length;

    const searchVisibility = {
      internal: {
        published_records: publishedItems.length,
        sitemap_eligible_records: sitemapEligible,
        records_with_doi: publishedItems.filter((row) => !!row.doi).length,
        note: 'Internal visibility metrics only. They do not confirm crawl or indexing by any external search engine.',
      },
      external: {
        google_indexing_confirmed: false,
        google_search_console: 'Verification of indexing must come from independently reviewed Google Search Console evidence.',
      },
    };

    const data = {
      generated_at: nowIso,
      window_days: days,
      publications: {
        published_total: publishedItems.length,
        published_theses: thesesTotal,
        published_other: publishedItems.length - thesesTotal,
        approved_awaiting_publish: approvedCount ?? 0,
        by_faculty: [...byFaculty.entries()].sort((a, b) => b[1] - a[1]).map(([faculty_code, count]) => ({ faculty_code, count })),
        by_department: [...byDepartment.entries()].sort((a, b) => b[1] - a[1]).map(([department, count]) => ({ department, count })),
      },
      deposits_over_time: deposits,
      public_full_text: {
        records: publicFullText,
        embargoed_records: embargoedFiles,
        published_without_file: publishedItems.filter((row) => !row.file_url).length,
        published_file_without_checksum: filesMissingChecksum,
      },
      engagement: {
        human_views: humanViewCount ?? 0,
        human_downloads: humanDownloadCount ?? 0,
        counter_views_total: counterViews,
        counter_downloads_total: counterDownloads,
        referrers: referrerTotals,
        sample_size: {
          events: (referrerRows ?? []).length,
          max_events: MAX_EVENT_ROWS,
          items: publishedItems.length,
          max_items: MAX_ITEMS,
        },
      },
      metadata_quality: {
        records_scored: completenessResults.length,
        average_score: averageCompleteness,
        missing_field_counts: missingFieldCounts,
      },
      duplicates: {
        total_groups: allDuplicateGroups.length,
        page,
        page_size: pageSize,
        groups: duplicatePage,
      },
      search_visibility: searchVisibility,
      filters_applied: {
        days,
        ...(faculty ? { faculty } : {}),
        ...(department ? { department } : {}),
        note: 'Faculty/department filters apply to repository records and their captured events; event rows without captured faculty/department are excluded from filtered event counts.',
      },
    };

    if (format === 'csv') {
      const sections: CsvSection[] = [
        {
          name: 'summary',
          header: ['metric', 'value'],
          rows: [
            ['window_days', days],
            ['published_total', data.publications.published_total],
            ['published_theses', data.publications.published_theses],
            ['published_other', data.publications.published_other],
            ['approved_awaiting_publish', data.publications.approved_awaiting_publish],
            ['public_full_text_records', data.public_full_text.records],
            ['human_views', data.engagement.human_views],
            ['human_downloads', data.engagement.human_downloads],
            ['metadata_average_score', data.metadata_quality.average_score],
            ['duplicate_title_groups', data.duplicates.total_groups],
            ['google_indexing_confirmed', 'false'],
          ],
        },
        {
          name: 'published_by_faculty',
          header: ['faculty_code', 'count'],
          rows: data.publications.by_faculty.map((row) => [row.faculty_code, row.count]),
        },
        {
          name: 'published_by_department',
          header: ['department', 'count'],
          rows: data.publications.by_department.map((row) => [row.department, row.count]),
        },
        {
          name: 'deposits_over_time',
          header: ['month', 'total', 'status_breakdown'],
          rows: data.deposits_over_time.map((row) => [
            row.month,
            row.total,
            Object.entries(row.byStatus).map(([status, count]) => `${status}:${count}`).join('; '),
          ]),
        },
        {
          name: 'referrer_classes',
          header: ['referrer_class', 'events'],
          rows: REFERRER_CLASSES.map((cls) => [cls, referrerTotals[cls]]),
        },
        {
          name: 'duplicate_titles',
          header: ['normalized_title', 'count', 'item_ids'],
          rows: allDuplicateGroups.map((group) => [
            group.normalizedTitle,
            group.count,
            group.items.map((item) => item.id).join('; '),
          ]),
        },
      ];
      return new NextResponse(buildResearchCsv(sections), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="esut-research-visibility-${nowIso.slice(0, 10)}.csv"`,
          'cache-control': 'no-store',
        },
      });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
