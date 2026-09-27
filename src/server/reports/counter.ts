import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface CounterReport {
  report: string;
  version: string;
  created: string;
  rows: Array<Record<string, string>>;
}

export async function generateCounterR5(startDate: string, endDate: string): Promise<CounterReport> {
  const supabase = getSupabaseAdminClient();

  const [pageViews, searches, downloads] = await Promise.all([
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'page_view').gte('created_at', startDate).lte('created_at', endDate),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'search').gte('created_at', startDate).lte('created_at', endDate),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'download').gte('created_at', startDate).lte('created_at', endDate),
  ]);

  const rows = [
    {
      Database: 'ESUT Library Catalogue',
      Publisher: 'ESUT',
      Platform: 'ESUT Smart Library',
      Reporting_Period: `${startDate} to ${endDate}`,
      Total_Item_Investigations: String(pageViews.count ?? 0),
      Total_Item_Requests: String(downloads.count ?? 0),
      Unique_Item_Investigations: String(pageViews.count ?? 0),
      Unique_Item_Requests: String(downloads.count ?? 0),
      Limit_Exceeded: '0',
      No_License: '0',
    },
  ];

  return {
    report: 'TR',
    version: '5.0',
    created: new Date().toISOString(),
    rows,
  };
}

export function counterToCsv(report: CounterReport): string {
  if (report.rows.length === 0) return '';
  const headers = Object.keys(report.rows[0]);
  const rows = report.rows.map((row) =>
    headers.map((h) => {
      const val = row[h] || '';
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}
