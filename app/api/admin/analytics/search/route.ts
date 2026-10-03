import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') ?? '30', 10), 365);

    const supabase = getSupabaseAdminClient();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: events } = await supabase
      .from('analytics_events')
      .select('search_query, result_count, faculty, patron_role, created_at')
      .eq('event_type', 'catalogue_search')
      .gte('created_at', since)
      .limit(10000);

    const queries: Record<string, { count: number; zeroResults: number; clicks: number }> = {};
    for (const row of events ?? []) {
      const q = row.search_query ?? '(empty)';
      if (!queries[q]) queries[q] = { count: 0, zeroResults: 0, clicks: 0 };
      queries[q].count++;
      if (row.result_count === 0) queries[q].zeroResults++;
    }

    const { data: clicks } = await supabase
      .from('analytics_events')
      .select('search_query')
      .eq('event_type', 'catalogue_result_click')
      .gte('created_at', since)
      .limit(10000);

    for (const row of clicks ?? []) {
      const q = row.search_query ?? '(empty)';
      if (!queries[q]) queries[q] = { count: 0, zeroResults: 0, clicks: 0 };
      queries[q].clicks++;
    }

    const topQueries = Object.entries(queries)
      .map(([query, stats]) => ({ query, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const zeroResultQueries = Object.entries(queries)
      .filter(([, stats]) => stats.zeroResults > 0)
      .map(([query, stats]) => ({ query, ...stats }))
      .sort((a, b) => b.zeroResults - a.zeroResults)
      .slice(0, 20);

    const totalSearches = (events ?? []).length;
    const totalClicks = (clicks ?? []).length;
    const ctr = totalSearches > 0 ? Math.round((totalClicks / totalSearches) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalSearches,
        totalClicks,
        clickThroughRate: ctr,
        topQueries,
        zeroResultQueries,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
