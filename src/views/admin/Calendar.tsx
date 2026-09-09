import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';

interface AcademicCalendar {
  semester_1_start: string;
  semester_1_end: string;
  exam_1_start: string;
  exam_1_end: string;
  semester_2_start: string;
  semester_2_end: string;
  exam_2_start: string;
  exam_2_end: string;
  long_vacation_start: string;
  long_vacation_end: string;
}

interface PublicHoliday {
  id: string;
  name: string;
  date: string;
}

export default function Calendar() {
  const [calendar, setCalendar] = useState<AcademicCalendar>({
    semester_1_start: '2024-09-01',
    semester_1_end: '2024-12-15',
    exam_1_start: '2024-12-16',
    exam_1_end: '2024-12-31',
    semester_2_start: '2025-01-15',
    semester_2_end: '2025-05-15',
    exam_2_start: '2025-05-16',
    exam_2_end: '2025-06-15',
    long_vacation_start: '2025-06-16',
    long_vacation_end: '2025-08-31',
  });

  const [holidays, setHolidays] = useState<PublicHoliday[]>([
    { id: '1', name: 'New Year', date: '2025-01-01' },
    { id: '2', name: 'Independence Day', date: '2025-10-01' },
  ]);

  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [automationStatus, setAutomationStatus] = useState('active');

  useEffect(() => {
    setLoading(false);
  }, []);

  const handleCalendarChange = (field: keyof AcademicCalendar, value: string) => {
    setCalendar((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addHoliday = () => {
    if (!newHolidayName.trim() || !newHolidayDate) return;

    const newHoliday: PublicHoliday = {
      id: Math.random().toString(),
      name: newHolidayName,
      date: newHolidayDate,
    };

    setHolidays((prev) => [...prev, newHoliday].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    setNewHolidayName('');
    setNewHolidayDate('');
  };

  const removeHoliday = (id: string) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  };

  const saveCalendar = async () => {
    try {
      console.log('Saving calendar configuration:', calendar);
      alert('Calendar configuration saved successfully');
    } catch (error) {
      console.error('Error saving calendar:', error);
    }
  };

  if (loading) {
    return <div className="p-8">Loading calendar...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Academic Calendar</h1>
        <p className="text-gray-600 mt-2">Configure academic sessions and automated schedules</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Automation Status</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded">
              <span className="font-medium">Automated Notifications</span>
              <span className="badge badge-success">{automationStatus === 'active' ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded">
              <span className="font-medium">Deadline Alerts</span>
              <span className="badge badge-success">Enabled</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded">
              <span className="font-medium">Date-based Workflows</span>
              <span className="badge badge-success">Active</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Current Session Info</h2>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-gray-600">Institution</p>
              <p className="font-semibold">{institutionConfig.name}</p>
            </div>
            <div>
              <p className="text-gray-600">Total Enrolment</p>
              <p className="font-semibold">{institutionConfig.totalEnrolment || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-600">Academic Year</p>
              <p className="font-semibold">2024/2025</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-6">Academic Calendar Configuration</h2>

        <div className="space-y-8">
          <div className="border-l-4 border-primary-700 pl-6">
            <h3 className="text-lg font-semibold mb-4">Semester 1</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input w-full"
                  value={calendar.semester_1_start}
                  onChange={(e) => handleCalendarChange('semester_1_start', e.target.value)}
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input w-full"
                  value={calendar.semester_1_end}
                  onChange={(e) => handleCalendarChange('semester_1_end', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="border-l-4 border-red-600 pl-6">
            <h3 className="text-lg font-semibold mb-4">Exam Period 1</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input w-full"
                  value={calendar.exam_1_start}
                  onChange={(e) => handleCalendarChange('exam_1_start', e.target.value)}
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input w-full"
                  value={calendar.exam_1_end}
                  onChange={(e) => handleCalendarChange('exam_1_end', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="border-l-4 border-primary-700 pl-6">
            <h3 className="text-lg font-semibold mb-4">Semester 2</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input w-full"
                  value={calendar.semester_2_start}
                  onChange={(e) => handleCalendarChange('semester_2_start', e.target.value)}
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input w-full"
                  value={calendar.semester_2_end}
                  onChange={(e) => handleCalendarChange('semester_2_end', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="border-l-4 border-red-600 pl-6">
            <h3 className="text-lg font-semibold mb-4">Exam Period 2</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input w-full"
                  value={calendar.exam_2_start}
                  onChange={(e) => handleCalendarChange('exam_2_start', e.target.value)}
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input w-full"
                  value={calendar.exam_2_end}
                  onChange={(e) => handleCalendarChange('exam_2_end', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="border-l-4 border-green-600 pl-6">
            <h3 className="text-lg font-semibold mb-4">Long Vacation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input w-full"
                  value={calendar.long_vacation_start}
                  onChange={(e) => handleCalendarChange('long_vacation_start', e.target.value)}
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input w-full"
                  value={calendar.long_vacation_end}
                  onChange={(e) => handleCalendarChange('long_vacation_end', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t">
          <button onClick={saveCalendar} className="btn-primary">
            Save Calendar Configuration
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-6">Public Holidays</h2>

        <div className="mb-6 p-4 bg-gray-50 rounded space-y-3">
          <div>
            <label className="label">Holiday Name</label>
            <input
              type="text"
              className="input w-full"
              value={newHolidayName}
              onChange={(e) => setNewHolidayName(e.target.value)}
              placeholder="e.g., Independence Day"
            />
          </div>
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input w-full"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
            />
          </div>
          <button
            onClick={addHoliday}
            disabled={!newHolidayName.trim() || !newHolidayDate}
            className="btn-outline w-full disabled:opacity-50"
          >
            Add Holiday
          </button>
        </div>

        <div className="space-y-2">
          {holidays.length > 0 ? (
            holidays.map((holiday) => (
              <div
                key={holiday.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100"
              >
                <div>
                  <p className="font-medium">{holiday.name}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(holiday.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => removeHoliday(holiday.id)}
                  className="btn-outline text-red-600 text-sm py-1 px-2"
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-6">No public holidays configured</p>
          )}
        </div>
      </div>
    </div>
  );
}
