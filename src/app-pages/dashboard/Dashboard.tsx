import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';
import StudyBreakButton from '@/components/StudyBreakButton';

interface PatronData {
  id: string;
  full_name: string;
  patron_id: string;
  patron_category: string;
  status: string;
  library_number: string | null;
  profile_photo_url: string | null;
}

interface DashboardStats {
  active_loans: number;
  due_soon: number;
  ill_tickets: number;
  fines: number;
}

interface CalendarRecord {
  session: string;
  semester_one_start: string | null;
  semester_one_end: string | null;
  exam_one_start: string | null;
  exam_one_end: string | null;
  semester_two_start: string | null;
  semester_two_end: string | null;
  exam_two_start: string | null;
  exam_two_end: string | null;
  vacation_start: string | null;
  vacation_end: string | null;
}

function getCalendarPeriod(cal: CalendarRecord): { label: string; color: string; icon: string } {
  const today = new Date().toISOString().slice(0, 10);
  const between = (s: string | null, e: string | null) => !!(s && e && today >= s && today <= e);

  if (between(cal.exam_one_start, cal.exam_one_end)) return { label: 'Exam Period 1', color: 'text-red-700 bg-red-50 border-red-200', icon: '📝' };
  if (between(cal.exam_two_start, cal.exam_two_end)) return { label: 'Exam Period 2', color: 'text-red-700 bg-red-50 border-red-200', icon: '📝' };
  if (between(cal.semester_one_start, cal.semester_one_end)) return { label: 'Semester 1', color: 'text-primary-700 bg-primary-50 border-primary-200', icon: '📚' };
  if (between(cal.semester_two_start, cal.semester_two_end)) return { label: 'Semester 2', color: 'text-primary-700 bg-primary-50 border-primary-200', icon: '📚' };
  if (between(cal.vacation_start, cal.vacation_end)) return { label: 'Long Vacation', color: 'text-green-700 bg-green-50 border-green-200', icon: '🌴' };
  return { label: 'Between Periods', color: 'text-neutral-600 bg-neutral-50 border-neutral-200', icon: '📅' };
}

function getNextKeyDate(cal: CalendarRecord): { label: string; days: number } | null {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const candidates = [
    { label: 'Semester 1 Starts', date: cal.semester_one_start },
    { label: 'Semester 1 Ends', date: cal.semester_one_end },
    { label: 'Exam Period 1', date: cal.exam_one_start },
    { label: 'Exam Period 1 Ends', date: cal.exam_one_end },
    { label: 'Semester 2 Starts', date: cal.semester_two_start },
    { label: 'Semester 2 Ends', date: cal.semester_two_end },
    { label: 'Exam Period 2', date: cal.exam_two_start },
    { label: 'Exam Period 2 Ends', date: cal.exam_two_end },
    { label: 'Long Vacation', date: cal.vacation_start },
    { label: 'Vacation Ends', date: cal.vacation_end },
  ].filter(c => c.date && c.date > todayStr);

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.date!.localeCompare(b.date!));
  const next = candidates[0];
  const days = Math.ceil((new Date(next.date!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return { label: next.label, days };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [patron, setPatron] = useState<PatronData | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    active_loans: 0,
    due_soon: 0,
    ill_tickets: 0,
    fines: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentLoans, setRecentLoans] = useState<any[]>([]);
  const [calendar, setCalendar] = useState<CalendarRecord | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          navigate('/login');
          return;
        }

        const { data: patronData, error: patronError } = await supabase
          .from('patrons')
          .select('id, full_name, patron_id, patron_category, status, library_number, profile_photo_url')
          .eq('user_id', userData.user.id)
          .single();

        if (patronError) throw patronError;
        setPatron(patronData);

        const { data: loansData } = await supabase
          .from('loans')
          .select('*')
          .eq('patron_id', patronData.id)
          .eq('status', 'active')
          .order('due_date', { ascending: true });

        const now = new Date();
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + 7);

        const dueSoon = loansData?.filter((loan) => {
          const due = new Date(loan.due_date);
          return due <= dueDate;
        }).length || 0;

        const { data: illData } = await supabase
          .from('ill_requests')
          .select('id')
          .eq('patron_id', patronData.id)
          .neq('status', 'returned');

        const { data: fineData } = await supabase
          .from('fines')
          .select('amount')
          .eq('patron_id', patronData.id)
          .eq('status', 'unpaid');

        const unpaidFineTotal = (fineData ?? []).reduce((sum, fine) => sum + Number(fine.amount ?? 0), 0);

        setStats({
          active_loans: loansData?.length || 0,
          due_soon: dueSoon,
          ill_tickets: illData?.length || 0,
          fines: unpaidFineTotal,
        });

        setRecentLoans(loansData?.slice(0, 5) || []);

        // Fetch academic calendar
        const { data: calData } = await supabase
          .from('academic_calendar')
          .select('session, semester_one_start, semester_one_end, exam_one_start, exam_one_end, semester_two_start, semester_two_end, exam_two_start, exam_two_end, vacation_start, vacation_end')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (calData) setCalendar(calData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {patron?.status === 'pending' && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            Your account is <strong>pending approval</strong>. A librarian will review your registration and
            issue your Library Number. Some features stay limited until then.
          </div>
        )}
        <div className="card mb-8 bg-gradient-to-r from-primary-700 to-primary-800 text-white">
          <div className="p-8 flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/25 overflow-hidden flex items-center justify-center text-3xl shrink-0">
                {patron?.profile_photo_url ? <img src={patron.profile_photo_url} alt="" className="w-full h-full object-cover" /> : '👤'}
              </div>
              <div>
              <h1 className="text-4xl font-bold mb-2">Welcome, {patron?.full_name}!</h1>
              <p className="text-primary-100 text-lg">
                {patron?.library_number ? 'Library Number' : 'Patron ID'}:{' '}
                <span className="font-mono font-semibold">{patron?.library_number ?? patron?.patron_id}</span>
              </p>
              </div>
            </div>
            <StudyBreakButton className="!bg-white/10 !border-white/40 !text-white hover:!bg-white/20" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="stat-card bg-white rounded-lg shadow">
            <div className="p-6">
              <div className="text-gray-600 text-sm font-medium mb-2">Active Loans</div>
              <div className="text-4xl font-bold text-primary-700 mb-2">{stats.active_loans}</div>
              <Link to="/dashboard/loans" className="text-primary-700 text-sm hover:underline">
                View loans →
              </Link>
            </div>
          </div>

          <div className="stat-card bg-white rounded-lg shadow">
            <div className="p-6">
              <div className="text-gray-600 text-sm font-medium mb-2">Due Soon</div>
              <div className="text-4xl font-bold text-orange-600 mb-2">{stats.due_soon}</div>
              <Link to="/dashboard/loans" className="text-orange-600 text-sm hover:underline">
                View due dates →
              </Link>
            </div>
          </div>

          <div className="stat-card bg-white rounded-lg shadow">
            <div className="p-6">
              <div className="text-gray-600 text-sm font-medium mb-2">ILL Tickets</div>
              <div className="text-4xl font-bold text-green-600 mb-2">{stats.ill_tickets}</div>
              <Link to="/dashboard/ill" className="text-green-600 text-sm hover:underline">
                View requests →
              </Link>
            </div>
          </div>

          <div className="stat-card bg-white rounded-lg shadow">
            <div className="p-6">
              <div className="text-gray-600 text-sm font-medium mb-2">Outstanding Fines</div>
              <div className="text-4xl font-bold text-red-600 mb-2">{stats.fines}</div>
              <Link to="/dashboard/loans" className="text-red-600 text-sm hover:underline">
                View loans →
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="card bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Recent Loans</h2>
              </div>
              <div className="p-6">
                {recentLoans.length > 0 ? (
                  <div className="space-y-4">
                    {recentLoans.map((loan) => (
                      <div key={loan.id} className="flex justify-between items-start p-4 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{loan.item_title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{loan.item_authors}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            Due: {new Date(loan.due_date).toLocaleDateString()}
                          </p>
                        </div>
                        <button className="btn-outline px-4 py-2 rounded ml-4">Renew</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-center py-8">No active loans</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Academic Calendar Widget */}
            {calendar && (() => {
              const period = getCalendarPeriod(calendar);
              const next = getNextKeyDate(calendar);
              return (
                <div className={`card rounded-lg shadow p-5 border ${period.color}`}>
                  <h3 className="text-xs font-bold uppercase tracking-wide opacity-60 mb-3">Academic Calendar</h3>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{period.icon}</span>
                    <span className="font-bold text-base">{period.label}</span>
                  </div>
                  {calendar.session && (
                    <p className="text-xs opacity-70 mb-3">{calendar.session}</p>
                  )}
                  {next && (
                    <div className="flex items-center justify-between pt-3 border-t border-current border-opacity-20">
                      <div>
                        <p className="text-xs opacity-60">Next: {next.label}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-xl">{next.days}</span>
                        <span className="text-xs opacity-60 ml-1">days</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="card bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Access</h3>
              <div className="space-y-3">
                <Link to="/dashboard/library-card" className="btn-primary w-full px-4 py-2 rounded block text-center">
                  Library Card
                </Link>
                <Link to="/library-manual" className="btn-outline w-full px-4 py-2 rounded block text-center">
                  Library Manual
                </Link>
                <Link to="/dashboard/reading-lists" className="btn-outline w-full px-4 py-2 rounded block text-center">
                  Reading Lists
                </Link>
                <Link to="/ai-librarian" className="btn-ghost w-full px-4 py-2 rounded block text-center">
                  Ask AI Reference Librarian
                </Link>
              </div>
            </div>

            <div className="card bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {institutionConfig.libraryName}
              </h3>
              <p className="text-sm text-gray-600">
                Need help? Ask {institutionConfig.librarianName} or contact our library staff.
              </p>
              <Link to="/contact" className="btn-outline w-full px-4 py-2 rounded mt-4 block text-center">
                Contact Library
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
