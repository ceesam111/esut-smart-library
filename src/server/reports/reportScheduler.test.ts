import { describe, it, expect } from 'vitest';
import {
  normalizeSchedule,
  computeNextRunAt,
  computePeriodKey,
} from './reportScheduler';

describe('schedule normalization', () => {
  it('accepts a valid daily schedule', () => {
    const schedule = normalizeSchedule({
      schedule_frequency: 'daily',
      schedule_time: '08:30',
      schedule_day: null,
      schedule_delivery: 'email',
    });
    expect(schedule).toEqual({ frequency: 'daily', time: '08:30', day: null, delivery: 'email' });
  });

  it('accepts a valid weekly schedule with weekday', () => {
    const schedule = normalizeSchedule({
      schedule_frequency: 'weekly',
      schedule_time: '06:00',
      schedule_day: 5,
      schedule_delivery: 'in_app',
    });
    expect(schedule.frequency).toBe('weekly');
    expect(schedule.day).toBe(5);
  });

  it('accepts a valid monthly schedule with month day', () => {
    const schedule = normalizeSchedule({
      schedule_frequency: 'monthly',
      schedule_time: '23:05',
      schedule_day: 31,
      schedule_delivery: 'in_app',
    });
    expect(schedule.frequency).toBe('monthly');
    expect(schedule.day).toBe(31);
  });

  it('rejects unknown frequency', () => {
    expect(() => normalizeSchedule({ schedule_frequency: 'hourly', schedule_time: '08:00' })).toThrow(/frequency/i);
  });

  it('rejects malformed time', () => {
    expect(() => normalizeSchedule({ schedule_frequency: 'daily', schedule_time: '25:99' })).toThrow(/time/i);
    expect(() => normalizeSchedule({ schedule_frequency: 'daily', schedule_time: '8am' })).toThrow(/time/i);
  });

  it('rejects weekly schedule without valid day', () => {
    expect(() => normalizeSchedule({ schedule_frequency: 'weekly', schedule_time: '08:00', schedule_day: 9 })).toThrow(/day/i);
    expect(() => normalizeSchedule({ schedule_frequency: 'weekly', schedule_time: '08:00', schedule_day: null })).toThrow(/day/i);
  });

  it('rejects monthly schedule outside 1-31', () => {
    expect(() => normalizeSchedule({ schedule_frequency: 'monthly', schedule_time: '08:00', schedule_day: 32 })).toThrow(/day/i);
    expect(() => normalizeSchedule({ schedule_frequency: 'monthly', schedule_time: '08:00', schedule_day: 0 })).toThrow(/day/i);
  });

  it('rejects invalid delivery channel', () => {
    expect(() => normalizeSchedule({ schedule_frequency: 'daily', schedule_time: '08:00', schedule_delivery: 'sms' })).toThrow(/delivery/i);
  });
});

describe('computeNextRunAt', () => {
  it('schedules daily runs later today when time has not passed', () => {
    const from = new Date(Date.UTC(2026, 9, 4, 6, 0)); // 2026-10-04 06:00 UTC
    const next = computeNextRunAt({ frequency: 'daily', time: '08:00', day: null, delivery: 'in_app' }, from);
    expect(next.toISOString()).toBe('2026-10-04T08:00:00.000Z');
  });

  it('rolls daily runs to tomorrow when time already passed', () => {
    const from = new Date(Date.UTC(2026, 9, 4, 9, 30));
    const next = computeNextRunAt({ frequency: 'daily', time: '08:00', day: null, delivery: 'in_app' }, from);
    expect(next.toISOString()).toBe('2026-10-05T08:00:00.000Z');
  });

  it('finds the next weekly occurrence after the current time', () => {
    const from = new Date(Date.UTC(2026, 9, 4, 10, 0)); // Sunday 2026-10-04
    const next = computeNextRunAt({ frequency: 'weekly', time: '07:00', day: 0, delivery: 'in_app' }, from);
    expect(next.getUTCDay()).toBe(0);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
    expect(next.toISOString()).toBe('2026-10-11T07:00:00.000Z');
  });

  it('clamps monthly day to the length of the month', () => {
    const from = new Date(Date.UTC(2026, 1, 10, 0, 0)); // 2026-02-10
    const next = computeNextRunAt({ frequency: 'monthly', time: '08:00', day: 31, delivery: 'in_app' }, from);
    expect(next.toISOString()).toBe('2026-02-28T08:00:00.000Z');
  });
});

describe('computePeriodKey', () => {
  it('builds daily keys', () => {
    const at = new Date(Date.UTC(2026, 9, 4, 15, 0));
    expect(computePeriodKey({ frequency: 'daily', time: '08:00', day: null, delivery: 'in_app' }, at)).toBe('d:2026-10-04');
  });

  it('builds monthly keys', () => {
    const at = new Date(Date.UTC(2026, 9, 4, 15, 0));
    expect(computePeriodKey({ frequency: 'monthly', time: '08:00', day: 1, delivery: 'in_app' }, at)).toBe('m:2026-10');
  });

  it('builds ISO week keys stable across the week', () => {
    const monday = new Date(Date.UTC(2026, 9, 5, 1, 0));
    const friday = new Date(Date.UTC(2026, 9, 9, 23, 0));
    const schedule = { frequency: 'weekly' as const, time: '08:00', day: 1, delivery: 'in_app' as const };
    const a = computePeriodKey(schedule, monday);
    const b = computePeriodKey(schedule, friday);
    expect(a).toBe(b);
    expect(a).toMatch(/^w:\d{4}-W\d{2}$/);
  });

  it('produces different keys for different periods', () => {
    const schedule = { frequency: 'daily' as const, time: '08:00', day: null, delivery: 'in_app' as const };
    const day1 = computePeriodKey(schedule, new Date(Date.UTC(2026, 9, 4)));
    const day2 = computePeriodKey(schedule, new Date(Date.UTC(2026, 9, 5)));
    expect(day1).not.toBe(day2);
  });
});
