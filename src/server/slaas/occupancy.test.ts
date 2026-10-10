import { describe, expect, it } from 'vitest';
import { aggregateVisits, computeOccupancy, type RawVisitRow } from './occupancy';

describe('computeOccupancy', () => {
  it('computes occupancy percentage and available spaces', () => {
    const snap = computeOccupancy(80, 100, 'informational', 80, 'b1');
    expect(snap.currentlyInside).toBe(80);
    expect(snap.availableSpaces).toBe(20);
    expect(snap.occupancyPct).toBe(80);
  });

  it('never returns negative occupancy or spaces', () => {
    const snap = computeOccupancy(-5, 100, 'warning', 80, 'b1');
    expect(snap.currentlyInside).toBe(0);
    const snap2 = computeOccupancy(150, 100, 'warning', 80, 'b1');
    expect(snap2.availableSpaces).toBe(0);
  });

  it('handles zero capacity without divide-by-zero', () => {
    const snap = computeOccupancy(10, 0, 'informational', 80, 'b1');
    expect(snap.occupancyPct).toBe(0);
    expect(snap.availableSpaces).toBe(0);
  });
});

describe('aggregateVisits', () => {
  const rows: RawVisitRow[] = [
    { patron_id: 'p1', visitor_id: null, duration_minutes: 30, checked_in_at: '2026-01-01T08:00:00Z', checked_out_at: '2026-01-01T08:30:00Z' },
    { patron_id: 'p2', visitor_id: null, duration_minutes: 60, checked_in_at: '2026-01-01T09:00:00Z', checked_out_at: '2026-01-01T10:00:00Z' },
    { patron_id: 'p1', visitor_id: null, duration_minutes: 45, checked_in_at: '2026-01-02T08:00:00Z', checked_out_at: '2026-01-02T08:45:00Z' },
    { patron_id: null, visitor_id: 'v1', duration_minutes: 20, checked_in_at: '2026-01-02T11:00:00Z', checked_out_at: '2026-01-02T11:20:00Z' },
  ];

  it('computes total visits, unique users, avg and median duration', () => {
    const agg = aggregateVisits(rows, 3);
    expect(agg.totalVisits).toBe(4);
    expect(agg.uniqueUsers).toBe(2);
    expect(agg.avgDurationMinutes).toBe(38.8);
    expect(agg.medianDurationMinutes).toBe(37.5);
    expect(agg.peakOccupancy).toBe(3);
    expect(agg.visitorVisits).toBe(1);
  });

  it('returns null durations when no visit has a duration', () => {
    const agg = aggregateVisits([{ patron_id: 'p1', visitor_id: null, duration_minutes: null, checked_in_at: 'x', checked_out_at: null }], 1);
    expect(agg.avgDurationMinutes).toBeNull();
    expect(agg.medianDurationMinutes).toBeNull();
  });
});
