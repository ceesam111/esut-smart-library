import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';

interface PatronData {
  id: string;
  full_name: string;
  patron_id: string;
  category: string;
}

interface DashboardStats {
  active_loans: number;
  due_soon: number;
  ill_tickets: number;
  fines: number;
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
          .select('id, full_name, patron_id, category')
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
          .from('ill_tickets')
          .select('*')
          .eq('patron_id', patronData.id)
          .neq('status', 'returned');

        setStats({
          active_loans: loansData?.length || 0,
          due_soon: dueSoon,
          ill_tickets: illData?.length || 0,
          fines: 0,
        });

        setRecentLoans(loansData?.slice(0, 5) || []);
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
        <div className="card mb-8 bg-gradient-to-r from-primary-700 to-primary-800 text-white">
          <div className="p-8">
            <h1 className="text-4xl font-bold mb-2">Welcome, {patron?.full_name}!</h1>
            <p className="text-primary-100 text-lg">
              Patron ID: <span className="font-mono font-semibold">{patron?.patron_id}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="stat-card bg-white rounded-lg shadow">
            <div className="p-6">
              <div className="text-gray-600 text-sm font-medium mb-2">Active Loans</div>
              <div className="text-4xl font-bold text-primary-700 mb-2">{stats.active_loans}</div>
              <a href="/dashboard/loans" className="text-primary-700 text-sm hover:underline">
                View loans →
              </a>
            </div>
          </div>

          <div className="stat-card bg-white rounded-lg shadow">
            <div className="p-6">
              <div className="text-gray-600 text-sm font-medium mb-2">Due Soon</div>
              <div className="text-4xl font-bold text-orange-600 mb-2">{stats.due_soon}</div>
              <a href="/dashboard/loans" className="text-orange-600 text-sm hover:underline">
                View due dates →
              </a>
            </div>
          </div>

          <div className="stat-card bg-white rounded-lg shadow">
            <div className="p-6">
              <div className="text-gray-600 text-sm font-medium mb-2">ILL Tickets</div>
              <div className="text-4xl font-bold text-green-600 mb-2">{stats.ill_tickets}</div>
              <a href="/dashboard/ill-history" className="text-green-600 text-sm hover:underline">
                View requests →
              </a>
            </div>
          </div>

          <div className="stat-card bg-white rounded-lg shadow">
            <div className="p-6">
              <div className="text-gray-600 text-sm font-medium mb-2">Outstanding Fines</div>
              <div className="text-4xl font-bold text-red-600 mb-2">{stats.fines}</div>
              <a href="/dashboard/fines" className="text-red-600 text-sm hover:underline">
                View fines →
              </a>
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
            <div className="card bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Access</h3>
              <div className="space-y-3">
                <a href="/dashboard/library-card" className="btn-primary w-full px-4 py-2 rounded block text-center">
                  Library Card
                </a>
                <a href="/dashboard/reading-lists" className="btn-outline w-full px-4 py-2 rounded block text-center">
                  Reading Lists
                </a>
                <a href="/catalogue" className="btn-ghost w-full px-4 py-2 rounded block text-center">
                  AI Librarian
                </a>
              </div>
            </div>

            <div className="card bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {institutionConfig.name}
              </h3>
              <p className="text-sm text-gray-600">
                Need help? Contact our librarian {institutionConfig.librarianName} for assistance.
              </p>
              <button className="btn-outline w-full px-4 py-2 rounded mt-4">
                Contact Library
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
