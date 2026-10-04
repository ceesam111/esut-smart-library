import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

type Filters = { faculty?: string; patronRole?: string; department?: string };

interface EventQuery {
  select: (cols: string, opts?: { count?: 'exact'; head?: boolean }) => EventQuery;
  eq: (col: string, val: string | number) => EventQuery;
  gte: (col: string, val: string) => EventQuery;
  lt: (col: string, val: string) => EventQuery;
  is: (col: string, val: unknown) => EventQuery;
  limit: (n: number) => EventQuery;
  then: (onfulfilled: (value: { count: number | null; data: Record<string, unknown>[] | null }) => void) => void;
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') ?? '30', 10), 365);
    const filters: Filters = {};
    const faculty = searchParams.get('faculty');
    const patronRole = searchParams.get('patron_role');
    const department = searchParams.get('department');
    if (faculty) filters.faculty = faculty;
    if (patronRole) filters.patronRole = patronRole;
    if (department) filters.department = department;

    const supabase = getSupabaseAdminClient();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const eventCount = (eventType: string, extra?: (q: EventQuery) => EventQuery) => {
      let q: EventQuery = supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', eventType).gte('created_at', since) as unknown as EventQuery;
      if (filters.faculty) q = q.eq('faculty', filters.faculty);
      if (filters.patronRole) q = q.eq('patron_role', filters.patronRole);
      if (filters.department) q = q.eq('department', filters.department);
      if (extra) q = extra(q);
      return q as unknown as PromiseLike<{ count: number | null }>;
    };

    const eventRows = (eventType: string, columns: string, limit: number) => {
      let q: EventQuery = supabase.from('analytics_events').select(columns).eq('event_type', eventType).gte('created_at', since).limit(limit) as unknown as EventQuery;
      if (filters.faculty) q = q.eq('faculty', filters.faculty);
      if (filters.patronRole) q = q.eq('patron_role', filters.patronRole);
      if (filters.department) q = q.eq('department', filters.department);
      return q as unknown as PromiseLike<{ data: Record<string, unknown>[] | null }>;
    };

    const [checkouts, borrowerRows, currentLoans, overdueLoans, catalogueSearches, zeroResultSearches, repositoryViews, repositoryDownloads, topTitles, topRepositoryItems, dailyActivity] = await Promise.all([
      eventCount('checkout'),
      eventRows('checkout', 'user_id', 5000),
      supabase.from('loans').select('id', { count: 'exact', head: true }).is('returned_at', null),
      supabase.from('loans').select('id', { count: 'exact', head: true }).is('returned_at', null).lt('due_date', new Date().toISOString()),
      eventCount('catalogue_search'),
      eventCount('catalogue_search', (q: EventQuery) => q.eq('result_count', 0)),
      eventCount('repository_item_view'),
      eventCount('repository_file_download'),
      eventRows('checkout', 'entity_id, metadata', 1000),
      eventRows('repository_file_download', 'entity_id', 1000),
      (async () => {
        let q: EventQuery = supabase.from('analytics_events').select('event_type, created_at').gte('created_at', since).limit(10000) as unknown as EventQuery;
        if (filters.faculty) q = q.eq('faculty', filters.faculty);
        if (filters.patronRole) q = q.eq('patron_role', filters.patronRole);
        if (filters.department) q = q.eq('department', filters.department);
        return q as unknown as PromiseLike<{ data: Record<string, unknown>[] | null }>;
      })(),
    ]);

    const uniqueBorrowers = new Set((borrowerRows.data ?? []).map(r => r.user_id).filter(Boolean));

    const titleCounts: Record<string, number> = {};
    for (const row of topTitles.data ?? []) {
      const title = (row.metadata as { title?: string } | undefined)?.title ?? 'Unknown';
      titleCounts[title] = (titleCounts[title] ?? 0) + 1;
    }
    const topTitlesList = Object.entries(titleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([title, count]) => ({ title, count }));

    const repoCounts: Record<string, number> = {};
    for (const row of topRepositoryItems.data ?? []) {
      const id = String(row.entity_id);
      repoCounts[id] = (repoCounts[id] ?? 0) + 1;
    }
    const topRepoList = Object.entries(repoCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ id, count }));

    const dailyCounts: Record<string, Record<string, number>> = {};
    for (const row of dailyActivity.data ?? []) {
      const day = String(row.created_at ?? '').slice(0, 10) || 'unknown';
      const eventType = String(row.event_type);
      if (!dailyCounts[day]) dailyCounts[day] = {};
      dailyCounts[day][eventType] = (dailyCounts[day][eventType] ?? 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        checkouts: checkouts.count ?? 0,
        activeBorrowers: uniqueBorrowers.size,
        currentLoans: currentLoans.count ?? 0,
        overdueLoans: overdueLoans.count ?? 0,
        catalogueSearches: catalogueSearches.count ?? 0,
        zeroResultSearches: zeroResultSearches.count ?? 0,
        repositoryViews: repositoryViews.count ?? 0,
        repositoryDownloads: repositoryDownloads.count ?? 0,
        topTitles: topTitlesList,
        topRepositoryItems: topRepoList,
        daily: dailyCounts,
        filters_applied: {
          days,
          ...(filters.faculty ? { faculty: filters.faculty } : {}),
          ...(filters.patronRole ? { patron_role: filters.patronRole } : {}),
          ...(filters.department ? { department: filters.department } : {}),
          note: 'currentLoans/overdueLoans come from the loans table and are not segmented by faculty/role.',
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
