import { useState, useEffect, useCallback } from 'react';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';

interface Patron {
  id: string;
  user_id: string;
  patron_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  patron_category: string;
  faculty_code: string | null;
  faculty_name: string | null;
  department: string | null;
  level: string | null;
  matric_number: string | null;
  staff_id: string | null;
  rank: string | null;
  status: string;
  membership_expires_at: string;
  created_at: string;
}

interface PatronDetail extends Patron {
  date_of_birth: string | null;
  gender: string | null;
  programme: string | null;
}

interface LoanRecord {
  id: string;
  item_title: string;
  checkout_date: string;
  due_date: string;
  return_date: string | null;
  status: string;
  fine_amount: number | null;
}

const patronCategories = [
  'Undergraduate',
  'Postgraduate Taught',
  'Postgraduate Research',
  'Academic Staff',
  'Non-Academic Staff',
  'Visiting Scholar',
  'External Reader',
  'Alumni',
];

const patronCategoryKeys = [
  'patrons.undergraduate',
  'patrons.postgraduateTaught',
  'patrons.postgraduateResearch',
  'patrons.academicStaff',
  'patrons.nonAcademicStaff',
  'patrons.visitingScholar',
  'patrons.externalReader',
  'patrons.alumni',
] as const;

const statusOptions = [
  { value: 'active', labelKey: 'patrons.statusActive', color: 'badge-success' },
  { value: 'suspended', labelKey: 'patrons.statusSuspended', color: 'badge-warning' },
  { value: 'expired', labelKey: 'patrons.statusExpired', color: 'badge-error' },
  { value: 'graduated', labelKey: 'patrons.statusGraduated', color: 'badge-secondary' },
  { value: 'withdrawn', labelKey: 'patrons.statusWithdrawn', color: 'badge-error' },
  { value: 'retired', labelKey: 'patrons.statusRetired', color: 'badge-secondary' },
  { value: 'disengaged', labelKey: 'patrons.statusDisengaged', color: 'badge-error' },
  { value: 'visitor', labelKey: 'patrons.statusVisitor', color: 'badge-secondary' },
] as const;

export default function Patrons() {
  const { t, formatDate, formatCurrency } = useI18n();
  const [patrons, setPatrons] = useState<Patron[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [filterFaculty, setFilterFaculty] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPatrons, setTotalPatrons] = useState(0);
  const [selectedPatron, setSelectedPatron] = useState<PatronDetail | null>(null);
  const [loanHistory, setLoanHistory] = useState<LoanRecord[]>([]);
  const [slideOpen, setSlideOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const pageSize = 25;

  const fetchPatrons = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('patrons')
        .select('*', { count: 'exact' });

      // Search filter
      if (appliedSearch) {
        query = query.or(
          `full_name.ilike.%${appliedSearch}%,patron_id.ilike.%${appliedSearch}%,email.ilike.%${appliedSearch}%,matric_number.ilike.%${appliedSearch}%,staff_id.ilike.%${appliedSearch}%`
        );
      }

      // Faculty filter
      if (filterFaculty) {
        query = query.eq('faculty_code', filterFaculty);
      }

      // Category filter
      if (filterCategory) {
        query = query.eq('patron_category', filterCategory);
      }

      // Status filter
      if (filterStatus) {
        query = query.eq('status', filterStatus);
      }

      // Date range filter
      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      if (dateTo) {
        query = query.lte('created_at', `${dateTo}T23:59:59`);
      }

      // Pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setPatrons(data || []);
      setTotalPatrons(count || 0);
    } catch (error) {
      console.error('Error fetching patrons:', error);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, filterFaculty, filterCategory, filterStatus, dateFrom, dateTo, currentPage, pageSize]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      setAppliedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  useEffect(() => {
    void fetchPatrons();
  }, [currentPage, filterFaculty, filterCategory, filterStatus, dateFrom, dateTo, fetchPatrons]);

  const viewPatronDetails = async (patron: Patron) => {
    setSelectedPatron(patron as PatronDetail);
    setSlideOpen(true);
    setLoadingDetails(true);
    setLoanHistory([]);

    try {
      // Fetch loan history
      const { data: loans } = await supabase
        .from('loans')
        .select(`
          id,
          checkout_date,
          due_date,
          return_date,
          status,
          catalogue_items(title)
        `)
        .eq('patron_id', patron.id)
        .order('checkout_date', { ascending: false })
        .limit(20);

      if (loans) {
        type LoanRow = {
          id: string;
          checkout_date: string;
          due_date: string;
          return_date: string | null;
          status: string;
          catalogue_items?: { title: string } | null;
        };
        const formattedLoans: LoanRecord[] = (loans as unknown as LoanRow[]).map((loan) => ({
          id: loan.id,
          item_title: loan.catalogue_items?.title || t('patrons.unknownItem'),
          checkout_date: loan.checkout_date,
          due_date: loan.due_date,
          return_date: loan.return_date,
          status: loan.status,
          fine_amount: null,
        }));
        setLoanHistory(formattedLoans);
      }

      // Fetch fine details
      const { data: fines } = await supabase
        .from('fines')
        .select('loan_id, amount')
        .eq('patron_id', patron.id)
        .eq('status', 'unpaid');

      if (fines && fines.length > 0) {
        setLoanHistory(prev => prev.map(loan => {
          const fine = fines.find((f: { loan_id: string; amount: number }) => f.loan_id === loan.id);
          return { ...loan, fine_amount: fine?.amount || null };
        }));
      }
    } catch (error) {
      console.error('Error fetching patron details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const exportCSV = () => {
    const headers = [
      t('patrons.csvPatronId'),
      t('patrons.csvFullName'),
      t('patrons.csvEmail'),
      t('patrons.csvPhone'),
      t('patrons.csvFaculty'),
      t('patrons.csvDepartment'),
      t('patrons.csvCategory'),
      t('patrons.csvLevel'),
      t('patrons.csvMatricNumber'),
      t('patrons.csvStaffId'),
      t('patrons.csvRegistrationDate'),
      t('patrons.csvExpiryDate'),
      t('patrons.csvStatus'),
    ];

    const rows = patrons.map((p) => [
      p.patron_id,
      p.full_name,
      p.email,
      p.phone || '',
      p.faculty_name || '',
      p.department || '',
      p.patron_category,
      p.level || '',
      p.matric_number || '',
      p.staff_id || '',
      new Date(p.created_at).toLocaleDateString(),
      new Date(p.membership_expires_at).toLocaleDateString(),
      p.status,
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `patrons-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterFaculty('');
    setFilterCategory('');
    setFilterStatus('');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const updatePatronStatus = async (patron: Patron, status: string) => {
    const nextExpiry = ['graduated', 'withdrawn', 'retired', 'disengaged', 'visitor'].includes(status) ? new Date().toISOString() : patron.membership_expires_at;
    setPatrons((current) => current.map((p) => p.id === patron.id ? { ...p, status, membership_expires_at: nextExpiry } : p));
    if (selectedPatron?.id === patron.id) setSelectedPatron({ ...selectedPatron, status, membership_expires_at: nextExpiry });
    await supabase.from('patrons').update({ status, membership_expires_at: nextExpiry, clearance_status: status === 'active' ? null : 'final_clearance_required' }).eq('id', patron.id);
  };

  const totalPages = Math.ceil(totalPatrons / pageSize);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalPatrons);

  const getStatusBadge = (status: string) => {
    const option = statusOptions.find(o => o.value === status);
    return option?.color || 'badge-secondary';
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-neutral-800">{t('patrons.patronDirectory')}</h1>
          <p className="text-neutral-500 mt-1">
            {t('patrons.managePatrons', { count: totalPatrons })}
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/admin/patrons/import" className="btn-outline">
            {t('patrons.importCsv')}
          </a>
          <button onClick={exportCSV} className="btn-primary">
            {t('patrons.exportCsv')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <label className="label">{t('patrons.search')}</label>
            <div className="relative">
              <input
                type="text"
                placeholder={t('patrons.searchPlaceholder')}
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg className="absolute left-3 top-3 w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </div>
          </div>

          {/* Faculty */}
          <div className="w-full lg:w-48">
            <label className="label">{t('patrons.faculty')}</label>
            <select
              className="input"
              value={filterFaculty}
              onChange={(e) => { setFilterFaculty(e.target.value); setCurrentPage(1); }}
            >
              <option value="">{t('patrons.allFaculties')}</option>
              {institutionConfig.faculties.map((f) => (
                <option key={f.code} value={f.code}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div className="w-full lg:w-48">
            <label className="label">{t('patrons.category')}</label>
            <select
              className="input"
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}
            >
              <option value="">{t('patrons.allCategories')}</option>
              {patronCategories.map((c, i) => (
                <option key={c} value={c}>{t(patronCategoryKeys[i])}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="w-full lg:w-36">
            <label className="label">{t('patrons.status')}</label>
            <select
              className="input"
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
            >
              <option value="">{t('patrons.allStatus')}</option>
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date range */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 sm:max-w-xs">
            <label className="label">{t('patrons.registeredFrom')}</label>
            <input
              type="date"
              className="input"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <div className="flex-1 sm:max-w-xs">
            <label className="label">{t('patrons.registeredTo')}</label>
            <input
              type="date"
              className="input"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <div className="flex items-end">
            <button onClick={clearFilters} className="btn-ghost text-sm">
              {t('patrons.clearFilters')}
            </button>
          </div>
        </div>
      </div>

      {/* Results table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left p-3 font-semibold text-neutral-600">{t('patrons.colPatronId')}</th>
                <th className="text-left p-3 font-semibold text-neutral-600">{t('patrons.colName')}</th>
                <th className="text-left p-3 font-semibold text-neutral-600">{t('patrons.colEmail')}</th>
                <th className="text-left p-3 font-semibold text-neutral-600">{t('patrons.colFaculty')}</th>
                <th className="text-left p-3 font-semibold text-neutral-600">{t('patrons.colDepartment')}</th>
                <th className="text-left p-3 font-semibold text-neutral-600">{t('patrons.colCategory')}</th>
                <th className="text-left p-3 font-semibold text-neutral-600">{t('patrons.colMatricStaffId')}</th>
                <th className="text-left p-3 font-semibold text-neutral-600">{t('patrons.colRegistered')}</th>
                <th className="text-left p-3 font-semibold text-neutral-600">{t('patrons.colExpiry')}</th>
                <th className="text-left p-3 font-semibold text-neutral-600">{t('patrons.colStatus')}</th>
                <th className="text-left p-3 font-semibold text-neutral-600"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-neutral-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                      {t('patrons.loadingPatrons')}
                    </div>
                  </td>
                </tr>
              ) : patrons.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-neutral-400">
                    <div className="text-4xl mb-2">📇</div>
                    <p className="font-medium">{t('patrons.noPatronsFound')}</p>
                    <p className="text-sm">{t('patrons.tryAdjustingFilters')}</p>
                  </td>
                </tr>
              ) : (
                patrons.map((patron) => (
                  <tr key={patron.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                    <td className="p-3 font-mono text-xs text-neutral-600">{patron.patron_id}</td>
                    <td className="p-3 font-medium text-neutral-800">{patron.full_name}</td>
                    <td className="p-3 text-neutral-600">{patron.email}</td>
                    <td className="p-3 text-neutral-600">{patron.faculty_name || '—'}</td>
                    <td className="p-3 text-neutral-600">{patron.department || '—'}</td>
                    <td className="p-3">
                      <span className="badge badge-secondary">{patron.patron_category}</span>
                    </td>
                    <td className="p-3 font-mono text-xs text-neutral-500">
                      {patron.matric_number || patron.staff_id || '—'}
                    </td>
                    <td className="p-3 text-neutral-500">
                      {formatDate(patron.created_at)}
                    </td>
                    <td className="p-3 text-neutral-500">
                      {formatDate(patron.membership_expires_at)}
                    </td>
                    <td className="p-3">
                      <span className={`badge ${getStatusBadge(patron.status)}`}>
                        {patron.status}
                      </span>
                    </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => viewPatronDetails(patron)} className="text-primary-600 hover:text-primary-800 font-medium text-left">{t('patrons.view')}</button>
                      <select value="" onChange={(e) => e.target.value && updatePatronStatus(patron, e.target.value)} className="rounded border border-neutral-200 px-1 py-0.5 text-xs">
                        <option value="">Clearance/status...</option>
                        <option value="graduated">{t('patrons.clearanceGraduated')}</option>
                        <option value="withdrawn">{t('patrons.clearanceWithdrawn')}</option>
                        <option value="retired">{t('patrons.clearanceRetired')}</option>
                        <option value="disengaged">{t('patrons.clearanceDisengaged')}</option>
                        <option value="visitor">{t('patrons.clearanceVisitor')}</option>
                        <option value="active">{t('patrons.clearanceRestore')}</option>
                      </select>
                    </div>
                  </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPatrons > 0 && (
          <div className="flex items-center justify-between p-4 bg-neutral-50 border-t border-neutral-100">
            <div className="text-sm text-neutral-500">
              {t('patrons.showingPatrons', { from: startItem, to: endItem, count: totalPatrons })}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn-outline px-3 py-1.5 text-sm disabled:opacity-40"
              >
                {t('patrons.previous')}
              </button>
              <div className="flex items-center gap-1">
                {(() => {
                  const pages: (number | string)[] = [];
                  const showPages = 5;
                  let start = Math.max(1, currentPage - 2);
                  const end = Math.min(totalPages, start + showPages - 1);
                  if (end - start + 1 < showPages) {
                    start = Math.max(1, end - showPages + 1);
                  }
                  if (start > 1) {
                    pages.push(1);
                    if (start > 2) pages.push('...');
                  }
                  for (let i = start; i <= end; i++) {
                    pages.push(i);
                  }
                  if (end < totalPages) {
                    if (end < totalPages - 1) pages.push('...');
                    pages.push(totalPages);
                  }
                  return pages.map((p, idx) =>
                    typeof p === 'number' ? (
                      <button
                        key={idx}
                        onClick={() => setCurrentPage(p)}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          currentPage === p
                            ? 'bg-primary-600 text-white'
                            : 'text-neutral-600 hover:bg-neutral-100'
                        }`}
                      >
                        {p}
                      </button>
                    ) : (
                      <span key={idx} className="px-2 text-neutral-400">{p}</span>
                    )
                  );
                })()}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn-outline px-3 py-1.5 text-sm disabled:opacity-40"
              >
                {t('patrons.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over panel */}
      {slideOpen && selectedPatron && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSlideOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <div>
                <h2 className="text-xl font-semibold text-neutral-800">{selectedPatron.full_name}</h2>
                <p className="font-mono text-sm text-neutral-500">{selectedPatron.patron_id}</p>
              </div>
              <button
                onClick={() => setSlideOpen(false)}
                className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Profile info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">{t('patrons.detailEmail')}</p>
                      <p className="text-sm text-neutral-800">{selectedPatron.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">{t('patrons.detailPhone')}</p>
                      <p className="text-sm text-neutral-800">{selectedPatron.phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">{t('patrons.detailCategory')}</p>
                      <span className="badge badge-secondary">{selectedPatron.patron_category}</span>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">{t('patrons.detailStatus')}</p>
                      <span className={`badge ${getStatusBadge(selectedPatron.status)}`}>
                        {selectedPatron.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">{t('patrons.detailFaculty')}</p>
                      <p className="text-sm text-neutral-800">{selectedPatron.faculty_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">{t('patrons.detailDepartment')}</p>
                      <p className="text-sm text-neutral-800">{selectedPatron.department || '—'}</p>
                    </div>
                    {selectedPatron.matric_number && (
                      <div>
                        <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">{t('patrons.detailMatricNumber')}</p>
                        <p className="font-mono text-sm text-neutral-800">{selectedPatron.matric_number}</p>
                      </div>
                    )}
                    {selectedPatron.staff_id && (
                      <div>
                        <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">{t('patrons.detailStaffId')}</p>
                        <p className="font-mono text-sm text-neutral-800">{selectedPatron.staff_id}</p>
                      </div>
                    )}
                    {selectedPatron.level && (
                      <div>
                        <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">{t('patrons.detailLevel')}</p>
                        <p className="text-sm text-neutral-800">{selectedPatron.level}</p>
                      </div>
                    )}
                    {selectedPatron.rank && (
                      <div>
                        <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">{t('patrons.detailRank')}</p>
                        <p className="text-sm text-neutral-800">{selectedPatron.rank}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">{t('patrons.detailRegistered')}</p>
                      <p className="text-sm text-neutral-800">
                        {formatDate(selectedPatron.created_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">{t('patrons.detailExpires')}</p>
                      <p className="text-sm text-neutral-800">
                        {formatDate(selectedPatron.membership_expires_at)}
                      </p>
                    </div>
                  </div>

                  {/* Loan History */}
                  <div className="border-t border-neutral-200 pt-6">
                    <h3 className="font-semibold text-neutral-800 mb-4">{t('patrons.loanHistory')}</h3>
                    {loanHistory.length === 0 ? (
                      <p className="text-neutral-500 text-sm">{t('patrons.noLoanHistory')}</p>
                    ) : (
                      <div className="space-y-3">
                        {loanHistory.map((loan) => (
                          <div key={loan.id} className="p-4 bg-neutral-50 rounded-xl">
                            <div className="flex items-start justify-between mb-2">
                              <p className="font-medium text-neutral-800">{loan.item_title}</p>
                              <span className={`badge text-xs ${
                                loan.status === 'returned'
                                  ? 'badge-success'
                                  : loan.status === 'overdue'
                                  ? 'badge-error'
                                  : 'badge-warning'
                              }`}>
                                {loan.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-neutral-500">
                              <div>
                                <span className="text-neutral-400">{t('patrons.checkout')}</span>{' '}
                                {formatDate(loan.checkout_date)}
                              </div>
                              <div>
                                <span className="text-neutral-400">{t('patrons.due')}</span>{' '}
                                {formatDate(loan.due_date)}
                              </div>
                              {loan.return_date && (
                                <div>
                                  <span className="text-neutral-400">{t('patrons.returned')}</span>{' '}
                                  {formatDate(loan.return_date)}
                                </div>
                              )}
                              {loan.fine_amount && (
                                <div className="text-error-600">
                                  {t('patrons.fine', { amount: formatCurrency(loan.fine_amount) })}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-neutral-200 p-4 flex gap-3">
              <button
                className="btn-outline flex-1"
                onClick={() => {
                  if (!selectedPatron) return;
                  if (selectedPatron.status === 'suspended') {
                    void updatePatronStatus(selectedPatron, 'active');
                  } else {
                    void updatePatronStatus(selectedPatron, 'suspended');
                  }
                }}
              >
                {selectedPatron?.status === 'suspended' ? t('patrons.reactivateAccount') : t('patrons.suspendAccount')}
              </button>
              <button
                className="btn-primary flex-1"
                onClick={async () => {
                  if (!selectedPatron) return;
                  const currentExpiry = selectedPatron.membership_expires_at ? new Date(selectedPatron.membership_expires_at) : new Date();
                  const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
                  const newExpiry = new Date(baseDate);
                  newExpiry.setFullYear(newExpiry.getFullYear() + 1);
                  await supabase.from('patrons').update({ membership_expires_at: newExpiry.toISOString() }).eq('id', selectedPatron.id);
                  setPatrons((prev) => prev.map((p) => p.id === selectedPatron.id ? { ...p, membership_expires_at: newExpiry.toISOString() } : p));
                  setSelectedPatron({ ...selectedPatron, membership_expires_at: newExpiry.toISOString() });
                }}
              >
                {t('patrons.renewMembership')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
