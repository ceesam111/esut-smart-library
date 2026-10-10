import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';
import BackButton from '@/components/BackButton';
import { useI18n } from '@/lib/i18n';

interface Loan {
  id: string;
  catalogue_item_id: string;
  catalogue_items?: { title?: string | null; authors?: string[] | string | null } | { title?: string | null; authors?: string[] | string | null }[] | null;
  due_date: string;
  checkout_date: string;
  return_date?: string | null;
  status: string;
  renewed_count?: number | null;
  patron_id: string;
  fines?: { id: string; amount: number; status: string; reason: string }[];
}

const DEFAULT_FINE_RATE = 50;

function relatedOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default function Loans() {
  const navigate = useNavigate();
  const { t, formatDate, formatCurrency } = useI18n();
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setPatronId] = useState<string | null>(null);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [fineRate, setFineRate] = useState(DEFAULT_FINE_RATE);
  const [patronCategory, setPatronCategory] = useState<string>('undergraduate');

  useEffect(() => {
    const fetchPatronAndLoans = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          void navigate('/login');
          return;
        }

        const { data: patronData, error: patronError } = await supabase
          .from('patrons')
          .select('id, patron_category')
          .eq('user_id', userData.user.id)
          .single();

        if (patronError) throw patronError;
        setPatronId(patronData.id);
        setPatronCategory(patronData.patron_category || 'undergraduate');

        const [loansResult, rulesResult, finesResult] = await Promise.all([
          supabase
          .from('loans')
          .select('*, catalogue_items(title, authors)')
          .eq('patron_id', patronData.id)
          .order('due_date', { ascending: true }),
          supabase.rpc('get_circulation_rules'),
          supabase.from('fines').select('id, amount, status, reason, reference_id').eq('patron_id', patronData.id),
        ]);

        if (loansResult.error) throw loansResult.error;
        const rules = rulesResult.data as { fine_rate_per_day?: number } | null;
        setFineRate(Number(rules?.fine_rate_per_day) || DEFAULT_FINE_RATE);
        const fines = finesResult.data ?? [];
        setLoans(((loansResult.data || []) as unknown as Loan[]).map((loan) => ({
          ...loan,
          fines: fines.filter((fine: { reference_id: string }) => fine.reference_id === loan.id),
        })));
      } catch (error) {
        console.error('Error fetching loans:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchPatronAndLoans();
  }, [navigate]);

  const loanRule = institutionConfig.loanRules[patronCategory as keyof typeof institutionConfig.loanRules] ?? institutionConfig.loanRules.undergraduate;
  const maxRenewals = loanRule.renewals;
  const renewalDays = loanRule.durationDays;

  const handleRenew = async (loanId: string) => {
    setRenewingId(loanId);
    try {
      const newDueDate = new Date();
      newDueDate.setDate(newDueDate.getDate() + renewalDays);

      const { error } = await supabase
        .from('loans')
        .update({
          renewed_count: (
            loans.find((l) => l.id === loanId)?.renewed_count || 0
          ) + 1,
          due_date: newDueDate.toISOString().split('T')[0],
        })
        .eq('id', loanId);

      if (error) throw error;

      setLoans(
        loans.map((loan) =>
          loan.id === loanId
            ? {
                ...loan,
                renewed_count: (loan.renewed_count ?? 0) + 1,
                due_date: newDueDate.toISOString().split('T')[0],
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

  const estimateFine = (dueDate: string) => Math.max(0, Math.abs(Math.min(getDaysUntilDue(dueDate), 0)) * fineRate);

  const displayLoans = activeTab === 'active' ? activeLoans : historyLoans;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loans.loadingLoans')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <BackButton label={t('common.back')} />
          <h1 className="text-4xl font-bold text-gray-900">{t('loans.myLoans')}</h1>
          <p className="text-gray-600 mt-2">{t('loans.manageBorrowed')}</p>
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
                {t('loans.activeLoans', { count: activeLoans.length })}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-6 py-4 font-semibold border-b-2 transition-colors ${
                  activeTab === 'history'
                    ? 'text-primary-700 border-primary-700'
                    : 'text-gray-600 border-transparent hover:text-gray-900'
                }`}
              >
                {t('loans.history', { count: historyLoans.length })}
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
                    (loan.renewed_count ?? 0) < maxRenewals &&
                    !overdue;
                  const item = relatedOne(loan.catalogue_items);
                  const fine = (loan.fines ?? []).find((f) => f.status === 'unpaid' || f.status === 'outstanding');
                  const estimatedFine = overdue ? estimateFine(loan.due_date) : 0;

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
                            {item?.title ?? t('loans.libraryItem')}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {t('loans.byAuthor', { authors: Array.isArray(item?.authors) ? item?.authors.join('; ') : item?.authors || t('loans.unknownAuthor') })}
                          </p>
                        </div>
                        {overdue && (
                          <span className="badge badge-error px-3 py-1 rounded-full text-xs font-semibold">
                            {t('loans.overdue')}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 py-3 border-t border-gray-200">
                        <div>
                          <div className="text-xs text-gray-600 font-medium">
                            {t('loans.issued')}
                          </div>
                          <div className="text-sm font-semibold text-gray-900 mt-1">
                            {formatDate(loan.checkout_date)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 font-medium">
                            {t('loans.dueDate')}
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
                            {formatDate(loan.due_date)}
                          </div>
                          {activeTab === 'active' && (
                            <div className="text-xs text-gray-500 mt-1">
                              {overdue
                                ? t('loans.daysOverdue', { count: Math.abs(daysUntilDue) })
                                : t('loans.daysLeft', { count: daysUntilDue })}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 font-medium">
                            {t('loans.renewals')}
                          </div>
                          <div className="text-sm font-semibold text-gray-900 mt-1">
                            {t('loans.renewalsCount', { count: loan.renewed_count ?? 0, max: maxRenewals })}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 font-medium">
                            {t('loans.status')}
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
                                ? t('loans.active')
                                : t('loans.returned')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {activeTab === 'active' && (
                        <div className={`mb-4 rounded-xl border p-4 ${overdue ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className={`text-xs font-semibold uppercase tracking-wide ${overdue ? 'text-red-700' : 'text-emerald-700'}`}>{overdue ? t('loans.overdueCounter') : t('loans.returnCountdown')}</p>
                              <p className={`text-2xl font-bold ${overdue ? 'text-red-700' : 'text-emerald-700'}`}>{overdue ? t('loans.daysOverdueCounter', { count: Math.abs(daysUntilDue) }) : t('loans.daysRemaining', { count: daysUntilDue })}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{fine ? t('loans.recordedFine') : t('loans.estimatedFine')}</p>
                              <p className={`text-2xl font-bold ${(fine || estimatedFine > 0) ? 'text-red-700' : 'text-neutral-700'}`}>{t('loans.fineAmount', { amount: formatCurrency(Number(fine?.amount ?? estimatedFine)) })}</p>
                              <p className="text-xs text-neutral-500">{t('loans.fineRate', { rate: formatCurrency(fineRate) })}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'active' && (
                        <div className="flex gap-3 pt-3 border-t border-gray-200">
                          {canRenew && (
                            <button
                              onClick={() => handleRenew(loan.id)}
                              disabled={renewingId === loan.id}
                              className="btn-primary px-4 py-2 rounded font-semibold disabled:opacity-50"
                            >
                              {renewingId === loan.id ? t('loans.renewing') : t('loans.renew')}
                            </button>
                          )}
                          {!canRenew && activeTab === 'active' && (
                            <div className="text-sm text-gray-600">
                              {(loan.renewed_count ?? 0) >= maxRenewals
                                ? t('loans.noRenewalsRemaining')
                                : overdue
                                  ? t('loans.cannotRenewOverdue')
                                  : ''}
                            </div>
                          )}
                          <button className="btn-outline px-4 py-2 rounded font-semibold">
                            {t('loans.itemDetails')}
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
                    ? t('loans.noActiveLoans')
                    : t('loans.noLoanHistory')}
                </p>
                {activeTab === 'active' && (
                  <a
                    href="/catalogue"
                    className="btn-primary inline-block px-6 py-2 rounded font-semibold"
                  >
                    {t('loans.searchCatalogue')}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <a href="/dashboard" className="btn-ghost px-4 py-2 rounded font-semibold">
          {t('loans.backToDashboard')}
        </a>
      </div>
    </div>
  );
}
