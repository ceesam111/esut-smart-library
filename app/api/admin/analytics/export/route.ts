import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { buildCsv } from '@/server/analytics/csv';

interface EventQuery {
  select: (cols: string, opts?: { count?: 'exact'; head?: boolean }) => EventQuery;
  eq: (col: string, val: string | number) => EventQuery;
  gte: (col: string, val: string) => EventQuery;
  limit: (n: number) => EventQuery;
  then: (onfulfilled: (value: { count: number | null; data: Record<string, unknown>[] | null }) => void) => void;
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const { searchParams } = new URL(request.url);
    const report = searchParams.get('report') ?? 'summary';
    const days = Math.min(parseInt(searchParams.get('days') ?? '30', 10), 365);
    const faculty = searchParams.get('faculty');
    const patronRole = searchParams.get('patron_role');

    const supabase = getSupabaseAdminClient();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let rows: Record<string, unknown>[] = [];

    if (report === 'summary') {
      let q: EventQuery = supabase
        .from('analytics_events')
        .select('event_type, faculty, patron_role, created_at')
        .gte('created_at', since)
        .limit(50000) as unknown as EventQuery;
      if (faculty) q = q.eq('faculty', faculty);
      if (patronRole) q = q.eq('patron_role', patronRole);
      const { data } = await q;

      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const key = String(row.event_type);
        counts[key] = (counts[key] ?? 0) + 1;
      }
      rows = Object.entries(counts).map(([event_type, count]) => ({ event_type, count }));
    } else if (report === 'top_titles') {
      const { data } = await supabase
        .from('analytics_events')
        .select('entity_id, metadata')
        .eq('event_type', 'checkout')
        .gte('created_at', since)
        .limit(10000);

      const titleCounts: Record<string, number> = {};
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const title = (row.metadata as { title?: string } | undefined)?.title ?? 'Unknown';
        titleCounts[title] = (titleCounts[title] ?? 0) + 1;
      }
      rows = Object.entries(titleCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(([title, count]) => ({ title, count }));
    } else if (report === 'zero_results') {
      let q: EventQuery = supabase
        .from('analytics_events')
        .select('search_query, faculty, patron_role, created_at')
        .eq('event_type', 'catalogue_search')
        .eq('result_count', 0)
        .gte('created_at', since)
        .limit(10000) as unknown as EventQuery;
      if (faculty) q = q.eq('faculty', faculty);
      if (patronRole) q = q.eq('patron_role', patronRole);
      const { data } = await q;

      const queryCounts: Record<string, number> = {};
      for (const row of data ?? []) {
        const queryText = String(row.search_query ?? '(empty)');
        queryCounts[queryText] = (queryCounts[queryText] ?? 0) + 1;
      }
      rows = Object.entries(queryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(([query, count]) => ({ query, count }));
    } else {
      return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
    }

    const csv = buildCsv(rows);

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="analytics_${report}_${days}d.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
