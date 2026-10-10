import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { aggregateVisits, computeOccupancy, type RawVisitRow } from './occupancy';

export interface PeriodFilter {
  from: string;
  to: string;
  branchId?: string;
  tenantId?: string;
}

export interface BranchUtilization {
  branchId: string;
  branchName: string;
  totalVisits: number;
  uniqueUsers: number;
  avgDurationMinutes: number | null;
  visitorVisits: number;
}

export interface SlaasAnalytics {
  totalVisits: number;
  uniqueUsers: number;
  avgDurationMinutes: number | null;
  medianDurationMinutes: number | null;
  peakOccupancy: number;
  visitorVisits: number;
  byBranch: BranchUtilization[];
  byHour: Array<{ hour: number; count: number }>;
  byWeekday: Array<{ weekday: number; count: number }>;
}

export async function getSlaasAnalytics(filter: PeriodFilter): Promise<SlaasAnalytics> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from('access_visits')
    .select('id, patron_id, visitor_id, duration_minutes, checked_in_at, checked_out_at, status, branch_id, library_branches(name)')
    .gte('checked_in_at', filter.from)
    .lte('checked_in_at', filter.to);
  if (filter.branchId) query = query.eq('branch_id', filter.branchId);
  if (filter.tenantId) query = query.eq('tenant_id', filter.tenantId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Array<RawVisitRow & { branch_id: string; library_branches?: { name: string } | null }>;

  const peak = await computePeakOccupancy(filter);
  const base = aggregateVisits(rows, peak);

  const branchMap = new Map<string, BranchUtilization>();
  const hourMap = new Map<number, number>();
  const weekdayMap = new Map<number, number>();

  for (const row of rows) {
    const branchId = row.branch_id;
    const branchName = row.library_branches?.name ?? 'Unknown';
    if (!branchMap.has(branchId)) {
      branchMap.set(branchId, { branchId, branchName, totalVisits: 0, uniqueUsers: 0, avgDurationMinutes: null, visitorVisits: 0 });
    }
    const b = branchMap.get(branchId)!;
    b.totalVisits += 1;
    if (row.visitor_id) b.visitorVisits += 1;

    const d = new Date(row.checked_in_at);
    const hour = d.getHours();
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
    const wd = d.getDay();
    weekdayMap.set(wd, (weekdayMap.get(wd) ?? 0) + 1);
  }

  const branchUnique = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.patron_id) continue;
    if (!branchUnique.has(row.branch_id)) branchUnique.set(row.branch_id, new Set());
    branchUnique.get(row.branch_id)!.add(row.patron_id);
  }
  for (const [bid, set] of branchUnique) {
    const b = branchMap.get(bid);
    if (b) b.uniqueUsers = set.size;
  }

  const branchDurations = new Map<string, number[]>();
  for (const row of rows) {
    if (row.duration_minutes == null) continue;
    if (!branchDurations.has(row.branch_id)) branchDurations.set(row.branch_id, []);
    branchDurations.get(row.branch_id)!.push(row.duration_minutes);
  }
  for (const [bid, arr] of branchDurations) {
    const b = branchMap.get(bid);
    if (b && arr.length > 0) {
      b.avgDurationMinutes = Math.round((arr.reduce((a, c) => a + c, 0) / arr.length) * 10) / 10;
    }
  }

  return {
    ...base,
    byBranch: Array.from(branchMap.values()),
    byHour: Array.from(hourMap.entries()).map(([hour, count]) => ({ hour, count })).sort((a, b) => a.hour - b.hour),
    byWeekday: Array.from(weekdayMap.entries()).map(([weekday, count]) => ({ weekday, count })).sort((a, b) => a.weekday - b.weekday),
  };
}

async function computePeakOccupancy(filter: PeriodFilter): Promise<number> {
  const supabase = getSupabaseAdminClient();
  let q = supabase
    .from('access_visits')
    .select('checked_in_at, checked_out_at')
    .lte('checked_in_at', filter.to)
    .or(`checked_out_at.is.null,checked_out_at.gte.${filter.from}`)
    .limit(10000);
  if (filter.branchId) q = q.eq('branch_id', filter.branchId);
  if (filter.tenantId) q = q.eq('tenant_id', filter.tenantId);
  const { data, error } = await q;
  if (error) return 0;
  const rows = (data ?? []) as Array<{ checked_in_at: string; checked_out_at: string | null }>;
  const events: Array<{ t: number; delta: number }> = [];
  for (const r of rows) {
    events.push({ t: new Date(r.checked_in_at).getTime(), delta: 1 });
    if (r.checked_out_at) events.push({ t: new Date(r.checked_out_at).getTime(), delta: -1 });
  }
  events.sort((a, b) => a.t - b.t);
  let cur = 0;
  let peak = 0;
  for (const e of events) {
    cur += e.delta;
    if (cur > peak) peak = cur;
  }
  return peak;
}

export function getCurrentBranchOccupancySnapshot(branches: Array<{ id: string; capacity: number; capacity_mode: 'informational' | 'warning' | 'enforced'; warn_threshold_pct: number }>) {
  return branches.map((b) => ({ branchId: b.id, snapshot: computeOccupancy(0, b.capacity, b.capacity_mode, b.warn_threshold_pct, b.id) }));
}
