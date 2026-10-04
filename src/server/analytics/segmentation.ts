export const SMALL_GROUP_THRESHOLD = 5;

export interface SegmentEvent {
  faculty?: string | null;
  department?: string | null;
  patron_role?: string | null;
  event_type: string;
  entity_id?: string | null;
}

export interface SegmentSummary {
  segment: string;
  total: number | 'SUPPRESSED';
  counts: Record<string, number>;
}

export function buildSegments(
  events: SegmentEvent[],
  groupBy: 'faculty' | 'department' | 'patron_role',
  threshold: number = SMALL_GROUP_THRESHOLD,
): SegmentSummary[] {
  const segments: Record<string, Record<string, number>> = {};

  for (const event of events) {
    const key = groupBy === 'faculty' ? event.faculty ?? 'Unknown'
      : groupBy === 'department' ? event.department ?? 'Unknown'
      : event.patron_role ?? 'Unknown';

    if (!segments[key]) segments[key] = {};
    segments[key][event.event_type] = (segments[key][event.event_type] ?? 0) + 1;
  }

  return Object.entries(segments)
    .map(([segment, counts]) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      if (total < threshold) {
        return { segment, total: 'SUPPRESSED' as const, counts: {} };
      }
      return { segment, total, counts };
    })
    .sort((a, b) => (typeof b.total === 'number' ? b.total : -1) - (typeof a.total === 'number' ? a.total : -1));
}
