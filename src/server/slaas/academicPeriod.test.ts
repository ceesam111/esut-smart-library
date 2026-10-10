import { describe, expect, it } from 'vitest';
import { resolvePeriodFromRow } from './academicPeriod';

const row = {
  session: '2025/2026',
  semester_one_start: '2025-09-15',
  semester_one_end: '2026-01-30',
  exam_one_start: '2026-02-02',
  exam_one_end: '2026-02-20',
  semester_two_start: '2026-03-02',
  semester_two_end: '2026-06-26',
  exam_two_start: '2026-06-29',
  exam_two_end: '2026-07-17',
};

describe('resolvePeriodFromRow', () => {
  it('returns semester 1 during first semester', () => {
    expect(resolvePeriodFromRow(row, new Date('2025-10-01T12:00:00Z'))).toEqual({ session: '2025/2026', semester: '1' });
  });

  it('returns semester 1 during first exams', () => {
    expect(resolvePeriodFromRow(row, new Date('2026-02-10T12:00:00Z'))).toEqual({ session: '2025/2026', semester: '1' });
  });

  it('returns semester 2 during second semester', () => {
    expect(resolvePeriodFromRow(row, new Date('2026-05-05T12:00:00Z'))).toEqual({ session: '2025/2026', semester: '2' });
  });

  it('keeps session but null semester during vacation', () => {
    expect(resolvePeriodFromRow(row, new Date('2026-02-25T12:00:00Z'))).toEqual({ session: '2025/2026', semester: null });
  });

  it('returns nulls without a calendar row', () => {
    expect(resolvePeriodFromRow(null, new Date())).toEqual({ session: null, semester: null });
    expect(resolvePeriodFromRow({ ...row, session: null }, new Date('2025-10-01T12:00:00Z'))).toEqual({ session: null, semester: null });
  });

  it('ignores ranges with missing boundaries', () => {
    expect(resolvePeriodFromRow({ ...row, semester_one_start: null }, new Date('2025-10-01T12:00:00Z'))).toEqual({ session: '2025/2026', semester: null });
  });
});
