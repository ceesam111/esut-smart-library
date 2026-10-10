import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface AcademicPeriod {
  session: string | null;
  semester: '1' | '2' | null;
}

interface CalendarRow {
  session: string | null;
  semester_one_start: string | null;
  semester_one_end: string | null;
  exam_one_start: string | null;
  exam_one_end: string | null;
  semester_two_start: string | null;
  semester_two_end: string | null;
  exam_two_start: string | null;
  exam_two_end: string | null;
}

function inRange(day: string, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  return day >= start && day <= end;
}

export function resolvePeriodFromRow(row: CalendarRow | null, now: Date): AcademicPeriod {
  if (!row || !row.session) return { session: null, semester: null };
  const day = now.toISOString().slice(0, 10);

  const oneEnd = row.exam_one_end ?? row.semester_one_end;
  if (inRange(day, row.semester_one_start, oneEnd)) return { session: row.session, semester: '1' };

  const twoEnd = row.exam_two_end ?? row.semester_two_end;
  if (inRange(day, row.semester_two_start, twoEnd)) return { session: row.session, semester: '2' };

  return { session: row.session, semester: null };
}

export async function getCurrentAcademicPeriod(now: Date = new Date()): Promise<AcademicPeriod> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('academic_calendar')
    .select('session, semester_one_start, semester_one_end, exam_one_start, exam_one_end, semester_two_start, semester_two_end, exam_two_start, exam_two_end')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return resolvePeriodFromRow((data as CalendarRow | null) ?? null, now);
}
