import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export type AnalyticsEventType = 'page_view' | 'search' | 'download' | 'view_item' | 'login' | 'register';

export interface AnalyticsEventInput {
  event_type: AnalyticsEventType;
  user_id?: string | null;
  session_id?: string;
  ip_hash?: string;
  user_agent?: string;
  referrer?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}

export async function recordEvent(input: AnalyticsEventInput): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from('analytics_events').insert({
      event_type: input.event_type,
      user_id: input.user_id ?? null,
      session_id: input.session_id ?? null,
      ip_hash: input.ip_hash ?? null,
      user_agent: input.user_agent ?? null,
      referrer: input.referrer ?? null,
      path: input.path ?? null,
      metadata: input.metadata ?? {},
    });
  } catch {
    // analytics failures must never break the app
  }
}

export async function getAnalyticsSummary(days: number) {
  const supabase = getSupabaseAdminClient();
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [pageViews, searches, downloads, logins, registrations, topPaths, dailyCounts] = await Promise.all([
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'page_view').gte('created_at', since),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'search').gte('created_at', since),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'download').gte('created_at', since),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'login').gte('created_at', since),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'register').gte('created_at', since),
    supabase.from('analytics_events').select('path').eq('event_type', 'page_view').gte('created_at', since).limit(500),
    supabase.from('analytics_events').select('created_at').gte('created_at', since).limit(5000),
  ]);

  const pathCounts: Record<string, number> = {};
  for (const row of topPaths.data ?? []) {
    const p = row.path || '/';
    pathCounts[p] = (pathCounts[p] || 0) + 1;
  }
  const topPathsSorted = Object.entries(pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const dailyMap: Record<string, number> = {};
  for (const row of dailyCounts.data ?? []) {
    const d = row.created_at?.substring(0, 10) || '';
    dailyMap[d] = (dailyMap[d] || 0) + 1;
  }
  const daily = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));

  return {
    pageViews: pageViews.count ?? 0,
    searches: searches.count ?? 0,
    downloads: downloads.count ?? 0,
    logins: logins.count ?? 0,
    registrations: registrations.count ?? 0,
    topPaths: topPathsSorted,
    daily,
  };
}
