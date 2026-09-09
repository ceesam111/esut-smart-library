import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface CalendarRecord {
  id?: string;
  session: string;
  semester_one_start: string;
  semester_one_end: string;
  exam_one_start: string;
  exam_one_end: string;
  semester_two_start: string;
  semester_two_end: string;
  exam_two_start: string;
  exam_two_end: string;
  vacation_start: string;
  vacation_end: string;
  public_holidays: PublicHoliday[];
}

interface PublicHoliday {
  id: string;
  name: string;
  date: string;
}

const EMPTY_CALENDAR: CalendarRecord = {
  session: '',
  semester_one_start: '',
  semester_one_end: '',
  exam_one_start: '',
  exam_one_end: '',
  semester_two_start: '',
  semester_two_end: '',
  exam_two_start: '',
  exam_two_end: '',
  vacation_start: '',
  vacation_end: '',
  public_holidays: [],
};

type Period = 'semester_1' | 'exams_1' | 'semester_2' | 'exams_2' | 'vacation' | 'between';

function detectPeriod(cal: CalendarRecord): { label: string; color: string } {
  const today = new Date().toISOString().slice(0, 10);
  const between = (s: string, e: string) => s && e && today >= s && today <= e;

  if (between(cal.semester_one_start, cal.semester_one_end)) return { label: 'Semester 1 in Progress', color: 'bg-primary-50 text-primary-800 border-primary-200' };
  if (between(cal.exam_one_start, cal.exam_one_end)) return { label: 'Exam Period 1', color: 'bg-red-50 text-red-800 border-red-200' };
  if (between(cal.semester_two_start, cal.semester_two_end)) return { label: 'Semester 2 in Progress', color: 'bg-primary-50 text-primary-800 border-primary-200' };
  if (between(cal.exam_two_start, cal.exam_two_end)) return { label: 'Exam Period 2', color: 'bg-red-50 text-red-800 border-red-200' };
  if (between(cal.vacation_start, cal.vacation_end)) return { label: 'Long Vacation', color: 'bg-green-50 text-green-800 border-green-200' };
  return { label: 'Between Periods', color: 'bg-neutral-50 text-neutral-600 border-neutral-200' };
}

function nextKeyDate(cal: CalendarRecord): { label: string; days: number } | null {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const dates: { label: string; date: string }[] = [
    { label: 'Semester 1 Start', date: cal.semester_one_start },
    { label: 'Semester 1 End', date: cal.semester_one_end },
    { label: 'Exam Period 1 Start', date: cal.exam_one_start },
    { label: 'Exam Period 1 End', date: cal.exam_one_end },
    { label: 'Semester 2 Start', date: cal.semester_two_start },
    { label: 'Semester 2 End', date: cal.semester_two_end },
    { label: 'Exam Period 2 Start', date: cal.exam_two_start },
    { label: 'Exam Period 2 End', date: cal.exam_two_end },
    { label: 'Long Vacation Start', date: cal.vacation_start },
    { label: 'Long Vacation End', date: cal.vacation_end },
  ].filter(d => d.date && d.date > todayStr);

  if (!dates.length) return null;
  dates.sort((a, b) => a.date.localeCompare(b.date));
  const next = dates[0];
  const diff = Math.ceil((new Date(next.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return { label: next.label, days: diff };
}

function DateSection({ title, color, startField, endField, values, onChange }: {
  title: string;
  color: string;
  startField: keyof CalendarRecord;
  endField: keyof CalendarRecord;
  values: CalendarRecord;
  onChange: (field: keyof CalendarRecord, val: string) => void;
}) {
  return (
    <div className={`border-l-4 pl-6 ${color}`}>
      <h3 className="text-base font-semibold text-neutral-800 mb-3">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Start Date</label>
          <input type="date" className="input w-full"
            value={values[startField] as string}
            onChange={e => onChange(startField, e.target.value)} />
        </div>
        <div>
          <label className="label">End Date</label>
          <input type="date" className="input w-full"
            value={values[endField] as string}
            onChange={e => onChange(endField, e.target.value)} />
        </div>
      </div>
    </div>
  );
}

export default function Calendar() {
  const [calendar, setCalendar] = useState<CalendarRecord>(EMPTY_CALENDAR);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('academic_calendar')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setCalendarId(data.id);
        setCalendar({
          session: data.session ?? '',
          semester_one_start: data.semester_one_start ?? '',
          semester_one_end: data.semester_one_end ?? '',
          exam_one_start: data.exam_one_start ?? '',
          exam_one_end: data.exam_one_end ?? '',
          semester_two_start: data.semester_two_start ?? '',
          semester_two_end: data.semester_two_end ?? '',
          exam_two_start: data.exam_two_start ?? '',
          exam_two_end: data.exam_two_end ?? '',
          vacation_start: data.vacation_start ?? '',
          vacation_end: data.vacation_end ?? '',
          public_holidays: Array.isArray(data.public_holidays) ? data.public_holidays : [],
        });
      }
      setLoading(false);
    })();
  }, []);

  const handleChange = (field: keyof CalendarRecord, value: string) => {
    setCalendar(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const addHoliday = () => {
    if (!newHolidayName.trim() || !newHolidayDate) return;
    const holiday: PublicHoliday = { id: crypto.randomUUID(), name: newHolidayName.trim(), date: newHolidayDate };
    setCalendar(prev => ({
      ...prev,
      public_holidays: [...prev.public_holidays, holiday].sort((a, b) => a.date.localeCompare(b.date)),
    }));
    setNewHolidayName('');
    setNewHolidayDate('');
    setSaved(false);
  };

  const removeHoliday = (id: string) => {
    setCalendar(prev => ({ ...prev, public_holidays: prev.public_holidays.filter(h => h.id !== id) }));
    setSaved(false);
  };

  const saveCalendar = async () => {
    if (!calendar.session.trim()) { setSaveError('Academic session name is required.'); return; }
    setSaving(true);
    setSaveError('');

    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      session: calendar.session,
      semester_one_start: calendar.semester_one_start || null,
      semester_one_end: calendar.semester_one_end || null,
      exam_one_start: calendar.exam_one_start || null,
      exam_one_end: calendar.exam_one_end || null,
      semester_two_start: calendar.semester_two_start || null,
      semester_two_end: calendar.semester_two_end || null,
      exam_two_start: calendar.exam_two_start || null,
      exam_two_end: calendar.exam_two_end || null,
      vacation_start: calendar.vacation_start || null,
      vacation_end: calendar.vacation_end || null,
      public_holidays: calendar.public_holidays,
      updated_at: new Date().toISOString(),
    };

    let error: any = null;

    if (calendarId) {
      ({ error } = await supabase.from('academic_calendar').update(payload).eq('id', calendarId));
    } else {
      const { data, error: insertErr } = await supabase
        .from('academic_calendar')
        .insert({ ...payload, created_by: user?.id ?? null })
        .select('id')
        .single();
      error = insertErr;
      if (data) setCalendarId(data.id);
    }

    setSaving(false);
    if (error) { setSaveError(error.message); }
    else { setSaved(true); }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const period = detectPeriod(calendar);
  const next = nextKeyDate(calendar);

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Academic Calendar</h1>
        <p className="text-neutral-500 mt-1">Configure session dates and automated schedule rules</p>
      </div>

      {/* Current period status */}
      {calendarId && (
        <div className={`flex items-center justify-between rounded-xl border p-4 ${period.color}`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-0.5">Current Period</p>
            <p className="font-bold text-lg">{period.label}</p>
            {calendar.session && <p className="text-sm opacity-70 mt-0.5">{calendar.session}</p>}
          </div>
          {next && (
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-0.5">Next Key Date</p>
              <p className="font-bold text-2xl">{next.days}d</p>
              <p className="text-xs opacity-70">{next.label}</p>
            </div>
          )}
        </div>
      )}

      {saveError && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{saveError}</div>
      )}

      {/* Session Name */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Academic Session</h2>
        <div>
          <label className="label">Current Academic Session *</label>
          <input
            type="text"
            className="input w-full max-w-xs"
            placeholder="e.g. 2024/2025"
            value={calendar.session}
            onChange={e => handleChange('session', e.target.value)}
          />
          <p className="text-xs text-neutral-400 mt-1">This value drives all automated calendar rules.</p>
        </div>
      </div>

      {/* Date Configuration */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-6">Session Dates</h2>
        <div className="space-y-8">
          <DateSection title="Semester 1" color="border-primary-600"
            startField="semester_one_start" endField="semester_one_end"
            values={calendar} onChange={handleChange} />
          <DateSection title="Exam Period 1" color="border-red-500"
            startField="exam_one_start" endField="exam_one_end"
            values={calendar} onChange={handleChange} />
          <DateSection title="Semester 2" color="border-primary-600"
            startField="semester_two_start" endField="semester_two_end"
            values={calendar} onChange={handleChange} />
          <DateSection title="Exam Period 2" color="border-red-500"
            startField="exam_two_start" endField="exam_two_end"
            values={calendar} onChange={handleChange} />
          <DateSection title="Long Vacation" color="border-green-500"
            startField="vacation_start" endField="vacation_end"
            values={calendar} onChange={handleChange} />
        </div>
      </div>

      {/* Public Holidays */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">Public Holidays</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 p-4 bg-neutral-50 rounded-xl border">
          <div className="md:col-span-2">
            <label className="label">Holiday Name</label>
            <input type="text" className="input w-full" placeholder="e.g. Independence Day"
              value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addHoliday()} />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input w-full"
              value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <button onClick={addHoliday}
              disabled={!newHolidayName.trim() || !newHolidayDate}
              className="btn-outline w-full disabled:opacity-50">
              + Add Holiday
            </button>
          </div>
        </div>

        {calendar.public_holidays.length === 0 ? (
          <p className="text-neutral-400 text-sm text-center py-6">No public holidays configured</p>
        ) : (
          <div className="space-y-2">
            {calendar.public_holidays.map(h => (
              <div key={h.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border">
                <div>
                  <p className="font-medium text-neutral-800">{h.name}</p>
                  <p className="text-sm text-neutral-500">
                    {new Date(h.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <button onClick={() => removeHoliday(h.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 hover:bg-red-50 rounded transition-colors">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Automated Rules Info */}
      <div className="card p-6 bg-primary-50 border-primary-100">
        <h2 className="text-base font-semibold text-primary-900 mb-3">Automated Calendar Rules</h2>
        <div className="space-y-2 text-sm text-primary-800">
          {[
            'Exam period starts — fine calculation suspended, loans due during exams extended to 3 days after exams end',
            '14 days before semester end — bulk email sent to patrons with outstanding loans',
            'Exam period ends — normal fine calculation resumes',
            'Session end — reading lists archived, counters reset, "See You Next Session" email sent',
            'New semester start — "Welcome Back" email sent to all active patrons',
          ].map((rule, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-primary-500 font-bold shrink-0">{i + 1}.</span>
              <span>{rule}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-primary-600 mt-3">Rules run daily via the calendar-rules edge function. Save your session dates above to activate them.</p>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button onClick={saveCalendar} disabled={saving} className="btn-primary px-8">
          {saving ? 'Saving…' : 'Save Session Calendar'}
        </button>
        {saved && <span className="text-sm text-green-700 font-medium">Saved successfully</span>}
      </div>
    </div>
  );
}
