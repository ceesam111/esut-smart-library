import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  sendEmail,
  emailBeingSourced,
  emailReadyForCollection,
  emailCannotFulfil,
} from '@/lib/email';
import BackButton from '@/components/BackButton';

interface ResourceRequest {
  id: string;
  patron_name: string | null;
  patron_email: string | null;
  patron_faculty: string | null;
  patron_department: string | null;
  reference_no: string;
  item_title: string | null;
  request_text: string;
  reason: string;
  course: string | null;
  needed_by_date: string | null;
  preferred_format: string;
  status: string;
  librarian_note: string | null;
  collection_location: string | null;
  collect_by_date: string | null;
  created_at: string;
  updated_at: string;
}

interface Reservation {
  id: string;
  status: string;
  request_type?: 'reserve' | 'borrow' | 'return' | null;
  priority: number | null;
  reservation_date: string;
  expiry_date: string;
  loan_id?: string | null;
  admin_note?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
  catalogue_items?: { id: string; title: string; call_number: string | null } | { id: string; title: string; call_number: string | null }[] | null;
  patrons?: { full_name: string | null; email: string | null; patron_id: string | null; department: string | null } | { full_name: string | null; email: string | null; patron_id: string | null; department: string | null }[] | null;
}

function relatedOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

type SortKey = 'newest' | 'urgent' | 'status';
type FilterStatus = 'all' | string;
type SlideAction = null | 'being_sourced' | 'ready' | 'cannot_fulfil' | 'fulfilled';

const STATUS_META: Record<string, { label: string; colour: string }> = {
  pending:              { label: 'Pending',              colour: 'bg-neutral-100 text-neutral-600' },
  being_sourced:        { label: 'Being Sourced',        colour: 'bg-amber-100 text-amber-700' },
  ready_for_collection: { label: 'Ready for Collection', colour: 'bg-success-100 text-success-700' },
  fulfilled:            { label: 'Fulfilled',            colour: 'bg-primary-100 text-primary-700' },
  cancelled:            { label: 'Cancelled',            colour: 'bg-error-100 text-error-600' },
  expired:              { label: 'Expired',              colour: 'bg-amber-100 text-amber-700' },
  cannot_fulfil:        { label: 'Cannot Fulfil',        colour: 'bg-error-100 text-error-600' },
};

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function urgencyDays(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function UrgencyBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-neutral-400">—</span>;
  if (days < 0)  return <span className="text-xs font-semibold text-error-600">Overdue</span>;
  if (days <= 3) return <span className="text-xs font-semibold text-error-600">{days}d — Urgent</span>;
  if (days <= 7) return <span className="text-xs font-semibold text-amber-600">{days} days</span>;
  return <span className="text-xs text-neutral-500">{days} days</span>;
}

export default function AdminRequests() {
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ResourceRequest | null>(null);
  const [slideAction, setSlideAction] = useState<SlideAction>(null);
  const [actionNote, setActionNote] = useState('');
  const [saving, setSaving] = useState(false);

  // filters + sort
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterDept, setFilterDept] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('resource_requests')
        .select('*')
        .order('created_at', { ascending: false });
      setRequests(data ?? []);
      const { data: holds } = await supabase
        .from('reservations')
        .select('id, status, request_type, priority, reservation_date, expiry_date, loan_id, admin_note, approved_at, created_at, updated_at, catalogue_items(id, title, call_number), patrons(full_name, email, patron_id, department)')
        .order('created_at', { ascending: false });
      setReservations((holds ?? []) as unknown as Reservation[]);
      setLoading(false);
    };
    load();
  }, []);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = (d: string) => {
      const dt = new Date(d);
      return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
    };
    return {
      pending:       requests.filter(r => r.status === 'pending').length,
      being_sourced: requests.filter(r => r.status === 'being_sourced').length,
      ready:         requests.filter(r => r.status === 'ready_for_collection').length,
      fulfilled_mo:  requests.filter(r => r.status === 'fulfilled' && thisMonth(r.updated_at)).length,
      cannot_mo:     requests.filter(r => r.status === 'cannot_fulfil' && thisMonth(r.updated_at)).length,
    };
  }, [requests]);

  const filtered = useMemo(() => {
    let list = [...requests];
    if (filterStatus !== 'all') list = list.filter(r => r.status === filterStatus);
    if (filterDept.trim()) list = list.filter(r =>
      (r.patron_department ?? '').toLowerCase().includes(filterDept.toLowerCase()) ||
      (r.patron_faculty ?? '').toLowerCase().includes(filterDept.toLowerCase())
    );
    if (filterFrom) list = list.filter(r => r.created_at >= filterFrom);
    if (filterTo)   list = list.filter(r => r.created_at <= filterTo + 'T23:59:59');

    list.sort((a, b) => {
      if (sortKey === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortKey === 'urgent') {
        const da = urgencyDays(a.needed_by_date) ?? 9999;
        const db = urgencyDays(b.needed_by_date) ?? 9999;
        return da - db;
      }
      return a.status.localeCompare(b.status);
    });
    return list;
  }, [requests, filterStatus, filterDept, filterFrom, filterTo, sortKey]);

  const reservationStats = useMemo(() => ({
    pending: reservations.filter(r => r.status === 'pending').length,
    ready: reservations.filter(r => r.status === 'ready_for_collection').length,
    fulfilled: reservations.filter(r => r.status === 'fulfilled').length,
    returns: reservations.filter(r => r.request_type === 'return' && r.status === 'pending').length,
  }), [reservations]);

  const updateStatus = async (
    req: ResourceRequest,
    newStatus: string,
    extra: { librarian_note?: string; collection_location?: string; collect_by_date?: string } = {}
  ) => {
    setSaving(true);
    const { data, error } = await supabase
      .from('resource_requests')
      .update({ status: newStatus, updated_at: new Date().toISOString(), ...extra })
      .eq('id', req.id)
      .select()
      .single();

    if (!error && data) {
      setRequests(prev => prev.map(r => r.id === req.id ? data : r));
      setSelected(data);

      // send email based on new status
      const email = req.patron_email ?? '';
      const name  = req.patron_name ?? 'Patron';
      const text  = req.item_title || req.request_text;
      if (email) {
        if (newStatus === 'being_sourced') {
          await sendEmail(email, name,
            `Update on Request ${req.reference_no}`,
            emailBeingSourced(req.reference_no, text)
          );
        } else if (newStatus === 'ready_for_collection' && extra.collection_location && extra.collect_by_date) {
          await sendEmail(email, name,
            `Ready for Collection: ${req.reference_no}`,
            emailReadyForCollection(req.reference_no, text, extra.collection_location, extra.collect_by_date)
          );
        } else if (newStatus === 'cannot_fulfil' && extra.librarian_note) {
          await sendEmail(email, name,
            `Update on Request ${req.reference_no}`,
            emailCannotFulfil(req.reference_no, text, extra.librarian_note)
          );
        }
      }
    }
    setSaving(false);
    setSlideAction(null);
    setActionNote('');
  };

  const handleAction = async () => {
    if (!selected || !slideAction) return;
    if (slideAction === 'being_sourced') {
      await updateStatus(selected, 'being_sourced');
    } else if (slideAction === 'ready') {
      if (!actionNote.trim()) return;
      const collectBy = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      await updateStatus(selected, 'ready_for_collection', {
        collection_location: actionNote.trim(),
        collect_by_date: collectBy,
      });
    } else if (slideAction === 'cannot_fulfil') {
      if (!actionNote.trim()) return;
      await updateStatus(selected, 'cannot_fulfil', { librarian_note: actionNote.trim() });
    } else if (slideAction === 'fulfilled') {
      await updateStatus(selected, 'fulfilled');
    }
  };

  const openSlide = (req: ResourceRequest) => {
    setSelected(req);
    setSlideAction(null);
    setActionNote('');
  };

  const closeSlide = () => { setSelected(null); setSlideAction(null); setActionNote(''); };
  const updateReservationStatus = async (reservation: Reservation, action: 'approve' | 'fulfill' | 'loan' | 'return' | 'cancel') => {
    setSaving(true);
    const { error } = await supabase.rpc('process_catalogue_item_request', { request_id: reservation.id, request_action: action, note: null });
    if (!error) {
      const { data } = await supabase
        .from('reservations')
        .select('id, status, request_type, priority, reservation_date, expiry_date, loan_id, admin_note, approved_at, created_at, updated_at, catalogue_items(id, title, call_number), patrons(full_name, email, patron_id, department)')
        .eq('id', reservation.id)
        .single();
      if (data) setReservations(prev => prev.map(r => r.id === reservation.id ? data as unknown as Reservation : r));
    } else {
      alert(error.message);
    }
    setSaving(false);
  };

  const STAT_CARDS = [
    { label: 'Pending',             value: stats.pending,       colour: 'text-neutral-700' },
    { label: 'Being Sourced',       value: stats.being_sourced, colour: 'text-amber-600' },
    { label: 'Ready',               value: stats.ready,         colour: 'text-success-600' },
    { label: 'Fulfilled (month)',   value: stats.fulfilled_mo,  colour: 'text-primary-600' },
    { label: 'Cannot Fulfil (mo.)', value: stats.cannot_mo,     colour: 'text-error-500' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <BackButton />
        <h1 className="text-xl font-serif font-semibold text-primary-800">Resource Requests</h1>
        <p className="text-neutral-500 text-sm mt-0.5">Manage patron resource requests and catalogue reservations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STAT_CARDS.map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div className={`text-3xl font-bold ${s.colour}`}>{s.value}</div>
            <div className="text-xs text-neutral-500 mt-1 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Catalogue Reservations */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif font-semibold text-primary-800">Catalogue Reservations</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Approve ready-for-collection holds, fulfil completed pickups, or cancel invalid reservations.</p>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-neutral-100 text-neutral-600">Pending: {reservationStats.pending}</span>
            <span className="px-2 py-1 rounded-full bg-success-100 text-success-700">Ready: {reservationStats.ready}</span>
            <span className="px-2 py-1 rounded-full bg-primary-100 text-primary-700">Fulfilled: {reservationStats.fulfilled}</span>
            <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700">Returns: {reservationStats.returns}</span>
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-neutral-400">Loading reservations...</div>
        ) : reservations.length === 0 ? (
          <div className="p-8 text-center text-neutral-400">No catalogue reservations found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-100">
                <tr>
                  {['Book', 'Patron', 'Type', 'Requested', 'Expires', 'Queue', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reservations.map(reservation => {
                  const meta = STATUS_META[reservation.status] ?? STATUS_META.pending;
                  const item = relatedOne(reservation.catalogue_items);
                  const patron = relatedOne(reservation.patrons);
                  return (
                    <tr key={reservation.id} className="border-t border-neutral-100 hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3 max-w-[220px]">
                        <p className="font-medium text-neutral-800 truncate">{item?.title ?? 'Catalogue item'}</p>
                        {item?.call_number && <p className="text-xs font-mono text-neutral-400">{item.call_number}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-800 whitespace-nowrap">{patron?.full_name ?? '—'}</p>
                        <p className="text-xs text-neutral-400 truncate max-w-[150px]">{patron?.email ?? patron?.patron_id ?? ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold capitalize text-primary-800">{reservation.request_type ?? 'reserve'}</span>
                      </td>
                      <td className="px-4 py-3 text-neutral-500 whitespace-nowrap text-xs">{formatDate(reservation.reservation_date || reservation.created_at)}</td>
                      <td className="px-4 py-3 text-neutral-500 whitespace-nowrap text-xs">{formatDate(reservation.expiry_date)}</td>
                      <td className="px-4 py-3 text-neutral-500 whitespace-nowrap text-xs">#{reservation.priority ?? 1}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${meta.colour}`}>{meta.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {reservation.status === 'pending' && reservation.request_type === 'reserve' && (
                            <button onClick={() => updateReservationStatus(reservation, 'approve')} disabled={saving} className="text-xs text-success-700 hover:underline disabled:opacity-50">Approve Ready</button>
                          )}
                          {reservation.status === 'pending' && reservation.request_type === 'borrow' && (
                            <button onClick={() => updateReservationStatus(reservation, 'loan')} disabled={saving} className="text-xs text-primary-700 hover:underline disabled:opacity-50">Confirm Loan</button>
                          )}
                          {reservation.status === 'pending' && reservation.request_type === 'return' && (
                            <button onClick={() => updateReservationStatus(reservation, 'return')} disabled={saving} className="text-xs text-primary-700 hover:underline disabled:opacity-50">Confirm Return</button>
                          )}
                          {reservation.status === 'ready_for_collection' && (
                            <button onClick={() => updateReservationStatus(reservation, 'loan')} disabled={saving} className="text-xs text-primary-700 hover:underline disabled:opacity-50">Confirm Loaned Out</button>
                          )}
                          {!['fulfilled', 'cancelled', 'expired'].includes(reservation.status) && (
                            <button onClick={() => updateReservationStatus(reservation, 'cancel')} disabled={saving} className="text-xs text-error-600 hover:underline disabled:opacity-50">Cancel</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Filters + Sort */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs font-semibold text-neutral-500 block mb-1">Sort</label>
          <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className="input py-1.5 text-sm">
            <option value="newest">Newest First</option>
            <option value="urgent">Most Urgent</option>
            <option value="status">By Status</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-500 block mb-1">Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input py-1.5 text-sm">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="being_sourced">Being Sourced</option>
            <option value="ready_for_collection">Ready</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="cannot_fulfil">Cannot Fulfil</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-500 block mb-1">Dept / Faculty</label>
          <input type="text" value={filterDept} onChange={e => setFilterDept(e.target.value)}
            placeholder="Filter…" className="input py-1.5 text-sm w-36" />
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-500 block mb-1">From Date</label>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="input py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-500 block mb-1">To Date</label>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="input py-1.5 text-sm" />
        </div>
        {(filterStatus !== 'all' || filterDept || filterFrom || filterTo) && (
          <button onClick={() => { setFilterStatus('all'); setFilterDept(''); setFilterFrom(''); setFilterTo(''); }}
            className="btn-ghost text-xs text-neutral-500 self-end pb-1.5">
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-neutral-400">No requests found.</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-100">
                <tr>
                  {['Ref No', 'Patron', 'Dept', 'Item / Topic', 'Submitted', 'Urgency', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(req => {
                  const meta = STATUS_META[req.status] ?? STATUS_META.pending;
                  const days = urgencyDays(req.needed_by_date);
                  return (
                    <tr key={req.id} className="border-t border-neutral-100 hover:bg-neutral-50 transition-colors cursor-pointer"
                      onClick={() => openSlide(req)}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-primary-700">{req.reference_no}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-800 whitespace-nowrap">{req.patron_name ?? '—'}</p>
                        <p className="text-xs text-neutral-400 truncate max-w-[120px]">{req.patron_email ?? ''}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
                        {req.patron_department || req.patron_faculty || '—'}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="truncate text-neutral-800">{req.item_title || req.request_text}</p>
                        <p className="text-xs text-neutral-400">{req.reason}</p>
                      </td>
                      <td className="px-4 py-3 text-neutral-500 whitespace-nowrap text-xs">{formatDate(req.created_at)}</td>
                      <td className="px-4 py-3"><UrgencyBadge days={days} /></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${meta.colour}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={e => { e.stopPropagation(); openSlide(req); }}
                          className="text-xs text-primary-600 hover:underline font-medium whitespace-nowrap">
                          View →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-over */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={closeSlide} />
          <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-neutral-100 px-6 py-4 flex items-center justify-between">
              <div>
                <span className="font-mono font-bold text-primary-700 text-sm">{selected.reference_no}</span>
                <span className={`ml-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                  ${(STATUS_META[selected.status] ?? STATUS_META.pending).colour}`}>
                  {(STATUS_META[selected.status] ?? STATUS_META.pending).label}
                </span>
              </div>
              <button onClick={closeSlide} className="p-1.5 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Patron info */}
              <div className="bg-neutral-50 rounded-xl p-4 space-y-1.5">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Patron</p>
                <p className="font-semibold text-neutral-800">{selected.patron_name ?? '—'}</p>
                {selected.patron_email && <p className="text-sm text-neutral-500">{selected.patron_email}</p>}
                {(selected.patron_department || selected.patron_faculty) && (
                  <p className="text-sm text-neutral-500">{[selected.patron_department, selected.patron_faculty].filter(Boolean).join(' · ')}</p>
                )}
              </div>

              {/* Request details */}
              <div className="space-y-2.5 text-sm">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Request Details</p>
                {selected.item_title && (
                  <div className="flex gap-3"><span className="w-28 text-neutral-400 shrink-0">Title</span><span className="text-neutral-800">{selected.item_title}</span></div>
                )}
                <div className="flex gap-3"><span className="w-28 text-neutral-400 shrink-0">Description</span><span className="text-neutral-800">{selected.request_text}</span></div>
                <div className="flex gap-3"><span className="w-28 text-neutral-400 shrink-0">Reason</span><span className="text-neutral-800">{selected.reason}</span></div>
                {selected.course && <div className="flex gap-3"><span className="w-28 text-neutral-400 shrink-0">Course</span><span className="text-neutral-800">{selected.course}</span></div>}
                <div className="flex gap-3"><span className="w-28 text-neutral-400 shrink-0">Format</span><span className="text-neutral-800">{selected.preferred_format}</span></div>
                <div className="flex gap-3"><span className="w-28 text-neutral-400 shrink-0">Needed by</span>
                  <span className={`${urgencyDays(selected.needed_by_date) !== null && (urgencyDays(selected.needed_by_date) ?? 999) <= 3 ? 'text-error-600 font-semibold' : 'text-neutral-800'}`}>
                    {selected.needed_by_date ? formatDate(selected.needed_by_date) : '—'}
                    {selected.needed_by_date && (
                      <span className="ml-1 text-neutral-400 font-normal">
                        ({urgencyDays(selected.needed_by_date)} days)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex gap-3"><span className="w-28 text-neutral-400 shrink-0">Submitted</span><span className="text-neutral-800">{formatDate(selected.created_at)}</span></div>
              </div>

              {/* Existing notes */}
              {selected.collection_location && (
                <div className="bg-success-50 border border-success-200 rounded-xl p-3 text-sm">
                  <p className="font-semibold text-success-700 mb-1">Collection Location</p>
                  <p>{selected.collection_location}</p>
                  {selected.collect_by_date && <p className="text-amber-700 mt-1">Collect by: {formatDate(selected.collect_by_date)}</p>}
                </div>
              )}
              {selected.librarian_note && (
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-sm">
                  <p className="text-xs text-neutral-500 mb-1">Librarian Note</p>
                  <p>{selected.librarian_note}</p>
                </div>
              )}

              {/* Actions */}
              {!['fulfilled', 'cannot_fulfil'].includes(selected.status) && (
                <div className="border-t border-neutral-100 pt-4 space-y-3">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Actions</p>

                  {/* No action selected — show buttons */}
                  {!slideAction && (
                    <div className="flex flex-wrap gap-2">
                      {selected.status !== 'being_sourced' && (
                        <button onClick={() => setSlideAction('being_sourced')}
                          className="btn-outline text-sm">
                          Mark Being Sourced
                        </button>
                      )}
                      <button onClick={() => { setSlideAction('ready'); setActionNote(''); }}
                        className="btn-outline text-sm text-success-700 border-success-300 hover:bg-success-50">
                        Mark Ready
                      </button>
                      <button onClick={() => { setSlideAction('cannot_fulfil'); setActionNote(''); }}
                        className="btn-outline text-sm text-error-600 border-error-300 hover:bg-error-50">
                        Cannot Fulfil
                      </button>
                      {selected.status === 'ready_for_collection' && (
                        <button onClick={() => setSlideAction('fulfilled')}
                          className="btn-outline text-sm text-primary-600 border-primary-300 hover:bg-primary-50">
                          Mark Fulfilled
                        </button>
                      )}
                    </div>
                  )}

                  {/* Being Sourced: confirm */}
                  {slideAction === 'being_sourced' && (
                    <div className="space-y-3">
                      <p className="text-sm text-neutral-600">Mark this request as <strong>Being Sourced</strong>? An email update will be sent to the patron.</p>
                      <div className="flex gap-2">
                        <button onClick={() => setSlideAction(null)} disabled={saving} className="btn-outline flex-1 text-sm">Cancel</button>
                        <button onClick={handleAction} disabled={saving} className="btn-primary flex-1 text-sm disabled:opacity-50">
                          {saving ? 'Saving…' : 'Confirm'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Ready: collection location */}
                  {slideAction === 'ready' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-neutral-600 block mb-1">
                          Collection Location <span className="text-error-500">*</span>
                        </label>
                        <input type="text" value={actionNote} onChange={e => setActionNote(e.target.value)}
                          placeholder="e.g. Main Desk — ask for Mrs Enugu"
                          className="input w-full text-sm" autoFocus />
                        <p className="text-xs text-neutral-400 mt-1">Patron will be asked to collect within 7 days.</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setSlideAction(null)} disabled={saving} className="btn-outline flex-1 text-sm">Cancel</button>
                        <button onClick={handleAction} disabled={!actionNote.trim() || saving}
                          className="btn-primary flex-1 text-sm disabled:opacity-50 bg-success-700 hover:bg-success-800 border-success-700">
                          {saving ? 'Saving…' : 'Mark Ready & Notify'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Cannot Fulfil: reason */}
                  {slideAction === 'cannot_fulfil' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-neutral-600 block mb-1">
                          Reason <span className="text-error-500">*</span>
                        </label>
                        <textarea value={actionNote} onChange={e => setActionNote(e.target.value)}
                          placeholder="Explain why this request cannot be fulfilled…"
                          rows={3} className="input w-full resize-none text-sm" autoFocus />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setSlideAction(null)} disabled={saving} className="btn-outline flex-1 text-sm">Cancel</button>
                        <button onClick={handleAction} disabled={!actionNote.trim() || saving}
                          className="btn-primary flex-1 text-sm disabled:opacity-50 bg-error-600 hover:bg-error-700 border-error-600">
                          {saving ? 'Saving…' : 'Submit & Notify Patron'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Fulfilled: confirm */}
                  {slideAction === 'fulfilled' && (
                    <div className="space-y-3">
                      <p className="text-sm text-neutral-600">Mark this request as <strong>Fulfilled</strong> and close it?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setSlideAction(null)} disabled={saving} className="btn-outline flex-1 text-sm">Cancel</button>
                        <button onClick={handleAction} disabled={saving}
                          className="btn-primary flex-1 text-sm disabled:opacity-50 bg-primary-600 hover:bg-primary-700 border-primary-600">
                          {saving ? 'Saving…' : 'Mark Fulfilled'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {['fulfilled', 'cannot_fulfil'].includes(selected.status) && (
                <div className="border-t border-neutral-100 pt-4">
                  <p className="text-sm text-neutral-500 italic">This request is closed.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
