import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface Loan {
  id: string;
  item_id: string;
  item_title: string;
  item_authors: string;
  due_date: string;
  issued_date: string;
  status: string;
  renewals_used: number;
  renewals_max: number;
  patron_id: string;
}

export default function Loans() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [patronId, setPatronId] = useState<string | null>(null);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPatronAndLoans = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          navigate('/login');
          return;
        }

        const { data: patronData, error: patronError } = await supabase
          .from('patrons')
          .select('id')
          .eq('user_id', userData.user.id)
          .single();

        if (patronError) throw patronError;
        setPatronId(patronData.id);

        const { data: loansData, error: loansError } = await supabase
          .from('loans')
          .select('*')
          .eq('patron_id', patronData.id)
          .order('due_date', { ascending: true });

        if (loansError) throw loansError;
        setLoans(loansData || []);
      } catch (error) {
        console.error('Error fetching loans:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPatronAndLoans();
  }, [navigate]);

  const handleRenew = async (loanId: string) => {
    setRenewingId(loanId);
    try {
      const { error } = await supabase
        .from('loans')
        .update({
          renewals_used: (
            loans.find((l) => l.id === loanId)?.renewals_used || 0
          ) + 1,
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
        })
        .eq('id', loanId);

      if (error) throw error;

      setLoans(
        loans.map((loan) =>
          loan.id === loanId
            ? {
                ...loan,
                renewals_used: loan.renewals_used + 1,
                due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split('T')[0],
              }
            : loan
        )
      );
    } catch (error) {
      console.error('Error renewing loan:', error);
    } finally {
      setRenewingId(null);
    }
  };

  const activeLoans = loans.filter((loan) => loan.status === 'active');
  const historyLoans = loans.filter((loan) => loan.status === 'returned');

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diff = due.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const displayLoans = activeTab === 'active' ? activeLoans : historyLoans;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading loans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">My Loans</h1>
          <p className="text-gray-600 mt-2">Manage your borrowed items</p>
        </div>

        <div className="card bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('active')}
                className={`px-6 py-4 font-semibold border-b-2 transition-colors ${
                  activeTab === 'active'
                    ? 'text-primary-700 border-primary-700'
                    : 'text-gray-600 border-transparent hover:text-gray-900'
                }`}
              >
                Active Loans ({activeLoans.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-6 py-4 font-semibold border-b-2 transition-colors ${
                  activeTab === 'history'
                    ? 'text-primary-700 border-primary-700'
                    : 'text-gray-600 border-transparent hover:text-gray-900'
                }`}
              >
                History ({historyLoans.length})
              </button>
            </div>
          </div>

          <div className="p-6">
            {displayLoans.length > 0 ? (
              <div className="space-y-4">
                {displayLoans.map((loan) => {
                  const overdue = activeTab === 'active' && isOverdue(loan.due_date);
                  const daysUntilDue = getDaysUntilDue(loan.due_date);
                  const canRenew =
                    activeTab === 'active' &&
                    loan.renewals_used < loan.renewals_max &&
                    !overdue;

                  return (
                    <div
                      key={loan.id}
                      className={`p-4 rounded-lg border-2 transition-colors ${
                        overdue
                          ? 'bg-red-50 border-red-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {loan.item_title}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            by {loan.item_authors}
                          </p>
                        </div>
                        {overdue && (
                          <span className="badge badge-error px-3 py-1 rounded-full text-xs font-semibold">
                            Overdue
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 py-3 border-t border-gray-200">
                        <div>
                          <div className="text-xs text-gray-600 font-medium">
                            Issued
                          </div>
                          <div className="text-sm font-semibold text-gray-900 mt-1">
                            {new Date(loan.issued_date).toLocaleDateString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 font-medium">
                            Due Date
                          </div>
                          <div
                            className={`text-sm font-semibold mt-1 ${
                              overdue
                                ? 'text-red-600'
                                : daysUntilDue <= 7
                                  ? 'text-orange-600'
                                  : 'text-gray-900'
                            }`}
                          >
                            {new Date(loan.due_date).toLocaleDateString()}
                          </div>
                          {activeTab === 'active' && (
                            <div className="text-xs text-gray-500 mt-1">
                              {overdue
                                ? `${Math.abs(daysUntilDue)} days overdue`
                                : `${daysUntilDue} days left`}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 font-medium">
                            Renewals
                          </div>
                          <div className="text-sm font-semibold text-gray-900 mt-1">
                            {loan.renewals_used}/{loan.renewals_max}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 font-medium">
                            Status
                          </div>
                          <div className="mt-1">
                            <span
                              className={`badge px-2 py-1 rounded text-xs font-semibold ${
                                loan.status === 'active'
                                  ? 'badge-primary'
                                  : 'badge-secondary'
                              }`}
                            >
                              {loan.status === 'active'
                                ? 'Active'
                                : 'Returned'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {activeTab === 'active' && (
                        <div className="flex gap-3 pt-3 border-t border-gray-200">
                          {canRenew && (
                            <button
                              onClick={() => handleRenew(loan.id)}
                              disabled={renewingId === loan.id}
                              className="btn-primary px-4 py-2 rounded font-semibold disabled:opacity-50"
                            >
                              {renewingId === loan.id ? 'Renewing...' : 'Renew'}
                            </button>
                          )}
                          {!canRenew && activeTab === 'active' && (
                            <div className="text-sm text-gray-600">
                              {loan.renewals_used >= loan.renewals_max
                                ? 'No renewals remaining'
                                : overdue
                                  ? 'Cannot renew overdue items'
                                  : ''}
                            </div>
                          )}
                          <button className="btn-outline px-4 py-2 rounded font-semibold">
                            Item Details
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg mb-4">
                  {activeTab === 'active'
                    ? 'No active loans'
                    : 'No loan history'}
                </p>
                {activeTab === 'active' && (
                  <a
                    href="/catalogue"
                    className="btn-primary inline-block px-6 py-2 rounded font-semibold"
                  >
                    Search Catalogue
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <a href="/dashboard" className="btn-ghost px-4 py-2 rounded font-semibold">
          ← Back to Dashboard
        </a>
      </div>
    </div>
  );
}
