import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') ?? '30', 10), 365);
    const _faculty = searchParams.get('faculty');
    const _patronRole = searchParams.get('patron_role');

    const supabase = getSupabaseAdminClient();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [checkouts, activeBorrowers, currentLoans, overdueLoans, catalogueSearches, zeroResultSearches, repositoryViews, repositoryDownloads, topTitles, topRepositoryItems, dailyActivity] = await Promise.all([
      supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'checkout').gte('created_at', since),
      supabase.from('analytics_events').select('user_id').eq('event_type', 'checkout').gte('created_at', since),
      supabase.from('loans').select('id', { count: 'exact', head: true }).is('returned_at', null),
      supabase.from('loans').select('id', { count: 'exact', head: true }).is('returned_at', null).lt('due_date', new Date().toISOString()),
      supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'catalogue_search').gte('created_at', since),
      supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'catalogue_search').gte('created_at', since).eq('result_count', 0),
      supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'repository_item_view').gte('created_at', since),
      supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'repository_file_download').gte('created_at', since),
      supabase.from('analytics_events').select('entity_id, metadata').eq('event_type', 'checkout').gte('created_at', since).limit(1000),
      supabase.from('analytics_events').select('entity_id').eq('event_type', 'repository_file_download').gte('created_at', since).limit(1000),
      supabase.from('analytics_events').select('event_type, created_at').gte('created_at', since).limit(10000),
    ]);

    const uniqueBorrowers = new Set((activeBorrowers.data ?? []).map(r => r.user_id).filter(Boolean));

    const titleCounts: Record<string, number> = {};
    for (const row of topTitles.data ?? []) {
      const title = row.metadata?.title ?? 'Unknown';
      titleCounts[title] = (titleCounts[title] ?? 0) + 1;
    }
    const topTitlesList = Object.entries(titleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([title, count]) => ({ title, count }));

    const repoCounts: Record<string, number> = {};
    for (const row of topRepositoryItems.data ?? []) {
      repoCounts[row.entity_id] = (repoCounts[row.entity_id] ?? 0) + 1;
    }
    const topRepoList = Object.entries(repoCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ id, count }));

    const dailyCounts: Record<string, Record<string, number>> = {};
    for (const row of dailyActivity.data ?? []) {
      const day = row.created_at?.slice(0, 10) ?? 'unknown';
      if (!dailyCounts[day]) dailyCounts[day] = {};
      dailyCounts[day][row.event_type] = (dailyCounts[day][row.event_type] ?? 0) + 1;
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
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
