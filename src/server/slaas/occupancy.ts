export interface OccupancySnapshot {
  branchId: string;
  currentlyInside: number;
  capacity: number;
  availableSpaces: number;
  occupancyPct: number;
  capacityMode: 'informational' | 'warning' | 'enforced';
  warnThresholdPct: number;
}

export interface VisitAggregate {
  totalVisits: number;
  uniqueUsers: number;
  avgDurationMinutes: number | null;
  medianDurationMinutes: number | null;
  peakOccupancy: number;
  visitorVisits: number;
}

export function computeOccupancy(
  currentlyInside: number,
  capacity: number,
  capacityMode: 'informational' | 'warning' | 'enforced',
  warnThresholdPct: number,
  branchId: string,
): OccupancySnapshot {
  const safeInside = Math.max(0, currentlyInside);
  const safeCapacity = Math.max(0, capacity);
  const occupancyPct = safeCapacity === 0 ? 0 : Math.round((safeInside / safeCapacity) * 1000) / 10;
  const availableSpaces = Math.max(0, safeCapacity - safeInside);
  return {
    branchId,
    currentlyInside: safeInside,
    capacity: safeCapacity,
    availableSpaces,
    occupancyPct,
    capacityMode,
    warnThresholdPct,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
  }
  return sorted[mid];
}

export interface RawVisitRow {
  patron_id: string | null;
  visitor_id: string | null;
  duration_minutes: number | null;
  checked_in_at: string;
  checked_out_at: string | null;
}

export function aggregateVisits(rows: RawVisitRow[], peakOccupancy: number): VisitAggregate {
  const users = new Set<string>();
  const durations: number[] = [];
  let visitorVisits = 0;
  for (const row of rows) {
    if (row.visitor_id) visitorVisits += 1;
    if (row.patron_id) users.add(row.patron_id);
    if (row.duration_minutes !== null) durations.push(row.duration_minutes);
  }
  const total = rows.length;
  const avg = durations.length === 0 ? null : Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10;
  return {
    totalVisits: total,
    uniqueUsers: users.size,
    avgDurationMinutes: avg,
    medianDurationMinutes: median(durations),
    peakOccupancy,
    visitorVisits,
  };
}
