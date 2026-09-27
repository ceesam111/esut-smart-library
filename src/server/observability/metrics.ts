import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface PlatformMetrics {
  timestamp: string;
  uptime: number;
  database: {
    connected: boolean;
    tableCount: number;
  };
  storage: {
    buckets: number;
  };
  email: {
    provider: string;
    status: string;
  };
  analytics: {
    totalEvents: number;
    eventsLast24h: number;
  };
  repository: {
    totalItems: number;
    publishedItems: number;
  };
  catalogue: {
    totalItems: number;
  };
  circulation: {
    activeLoans: number;
    overdueLoans: number;
  };
}

export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  const supabase = getSupabaseAdminClient();
  const now = Date.now();
  const dayAgo = new Date(now - 86400000).toISOString();

  const [tableCount, buckets, totalEvents, eventsLast24h, totalItems, publishedItems, totalCatalogue, activeLoans, overdueLoans] = await Promise.all([
    supabase.from('information_schema.tables').select('*', { count: 'exact', head: true }).eq('table_schema', 'public'),
    supabase.from('storage.buckets').select('*', { count: 'exact', head: true }),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).gte('created_at', dayAgo),
    supabase.from('repository_items').select('*', { count: 'exact', head: true }),
    supabase.from('repository_items').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('catalogue_items').select('*', { count: 'exact', head: true }),
    supabase.from('loans').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('loans').select('*', { count: 'exact', head: true }).eq('status', 'overdue'),
  ]);

  return {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      connected: true,
      tableCount: tableCount.count ?? 0,
    },
    storage: {
      buckets: buckets.count ?? 0,
    },
    email: {
      provider: process.env.RESEND_API_KEY ? 'resend' : 'gmail',
      status: 'configured',
    },
    analytics: {
      totalEvents: totalEvents.count ?? 0,
      eventsLast24h: eventsLast24h.count ?? 0,
    },
    repository: {
      totalItems: totalItems.count ?? 0,
      publishedItems: publishedItems.count ?? 0,
    },
    catalogue: {
      totalItems: totalCatalogue.count ?? 0,
    },
    circulation: {
      activeLoans: activeLoans.count ?? 0,
      overdueLoans: overdueLoans.count ?? 0,
    },
  };
}
