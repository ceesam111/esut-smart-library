import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  sendEmail,
  emailRequestConfirmation,
} from '@/lib/email';
import BackButton from '@/components/BackButton';

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

const REASONS = [
  'Course Assignment',
  'Undergraduate Long Essay',
  'Personal Research',
  'Lecture Preparation',
];

const FORMATS = ['Physical Book', 'Digital Copy', 'Either'];

const STATUS_META: Record<string, { label: string; colour: string }> = {
  pending:              { label: 'Pending',              colour: 'bg-neutral-100 text-neutral-600' },
  being_sourced:        { label: 'Being Sourced',        colour: 'bg-amber-100 text-amber-700' },
  ready_for_collection: { label: 'Ready for Collection', colour: 'bg-success-100 text-success-700' },
  fulfilled:            { label: 'Fulfilled',            colour: 'bg-primary-100 text-primary-700' },
  cancelled:            { label: 'Cancelled',            colour: 'bg-error-100 text-error-600' },
  expired:              { label: 'Expired',              colour: 'bg-amber-100 text-amber-700' },
  cannot_fulfil:        { label: 'Cannot Fulfil',        colour: 'bg-error-100 text-error-600' },
};

interface ResourceRequest {
  id: string;
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
}

interface Reservation {
  id: string;
  status: string;
  request_type?: 'reserve' | 'borrow' | 'return' | null;
  priority: number | null;
  reservation_date: string;
  expiry_date: string;
  created_at: string;
  catalogue_items?: { id: string; title: string; authors: string[] | string | null; call_number: string | null } | { id: string; title: string; authors: string[] | string | null; call_number: string | null }[] | null;
}

function relatedOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PatronRequests() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillTitle = searchParams.get('title') ?? '';

  const [patron, setPatron] = useState<any>(null);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(!!prefillTitle);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null); // ref no after submit
  const [detailRequest, setDetailRequest] = useState<ResourceRequest | null>(null);

  // form fields
  const [fTitle, setFTitle]   = useState(prefillTitle);
  const [fText, setFText]     = useState('');
  const [fReason, setFReason] = useState(REASONS[0]);
  const [fCourse, setFCourse] = useState('');
  const [fDate, setFDate]     = useState('');
  const [fFormat, setFFormat] = useState('Either');

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }
      const { data: p } = await supabase.from('patrons')
        .select('id, full_name, email, faculty_code, department').eq('user_id', user.id).maybeSingle();
      if (!p) { setLoading(false); return; }
      setPatron(p);
      const { data: reqs } = await supabase.from('resource_requests')
        .select('*').eq('patron_id', p.id).order('created_at', { ascending: false });
      setRequests(reqs ?? []);
      const { data: holds } = await supabase
        .from('reservations')
        .select('id, status, request_type, priority, reservation_date, expiry_date, created_at, catalogue_items(id, title, authors, call_number)')
        .eq('patron_id', p.id)
        .order('created_at', { ascending: false });
      setReservations((holds ?? []) as unknown as Reservation[]);
      setLoading(false);
    };
    init();
  }, [navigate]);

  const handleSubmit = async () => {
    if (!fText.trim() || !patron) return;
    setSubmitting(true);
    const payload = {
      itemTitle:       fTitle.trim() || null,
      requestText:     fText.trim(),
      reason:          fReason,
      course:          fCourse.trim() || null,
      neededByDate:    fDate || null,
      preferredFormat: fFormat,
    };
    const response = await fetch('/api/resource-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(payload),
    });
    const raw = await response.json().catch(() => null);
    if (response.ok && raw?.data?.request) {
      const request = raw.data.request;
      setRequests(prev => [request, ...prev]);
      setSubmitted(request.reference_no);
      await sendEmail(
        patron.email,
        patron.full_name,
        `Request Received: ${request.reference_no}`,
        emailRequestConfirmation(request.reference_no, fText.trim(), fDate || null)
      );
      // reset form
      setFTitle(''); setFText(''); setFReason(REASONS[0]); setFCourse(''); setFDate(''); setFFormat('Either');
    } else {
      alert(raw?.error?.message || raw?.error || 'Could not submit request. Please try again.');
    }
    setSubmitting(false);
  };

  const openNew = () => { setSubmitted(null); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setSubmitted(null); };
  const cancelReservation = async (reservation: Reservation) => {
    const { data, error } = await supabase
      .from('reservations')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', reservation.id)
      .select('id, status, request_type, priority, reservation_date, expiry_date, created_at, catalogue_items(id, title, authors, call_number)')
      .single();
    if (!error && data) setReservations(prev => prev.map(r => r.id === reservation.id ? data as unknown as Reservation : r));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const sm = STATUS_META;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <BackButton />
          <h1 className="text-2xl font-serif font-semibold text-primary-800">My Resource Requests</h1>
          <p className="text-neutral-500 text-sm mt-1">Track and manage your library resource requests</p>
        </div>
        <button onClick={openNew} className="btn-primary shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Request
        </button>
      </div>

      {/* Catalogue reservations */}
      <div className="space-y-3 mb-8">
        <div>
          <h2 className="text-lg font-serif font-semibold text-primary-800">My Book Reservations</h2>
          <p className="text-neutral-500 text-sm mt-1">Items you reserved from the catalogue and their current queue status.</p>
        </div>
        {reservations.length === 0 ? (
          <div className="card p-6 text-sm text-neutral-500">
            You have no catalogue reservation, borrow, or return slips yet. Open any catalogue item and use the Reserve/Borrow/Return buttons.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-100">
                  <tr>
                    {['Book', 'Type', 'Submitted', 'Expires', 'Queue', 'Status', 'Action'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reservations.map(reservation => {
                    const meta = sm[reservation.status] ?? sm.pending;
                    const item = relatedOne(reservation.catalogue_items);
                    return (
                      <tr key={reservation.id} className="border-t border-neutral-100 hover:bg-neutral-50 transition-colors">
                        <td className="px-5 py-3 max-w-xs">
                          {item?.id ? (
                            <Link to={`/catalogue/${item.id}`} className="font-medium text-primary-700 hover:underline truncate block">{item.title}</Link>
                          ) : <span className="font-medium text-neutral-800">Catalogue item</span>}
                          {item?.call_number && <p className="text-xs font-mono text-neutral-400 mt-0.5">{item.call_number}</p>}
                        </td>
                        <td className="px-5 py-3"><span className="inline-flex rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold capitalize text-primary-800">{reservation.request_type ?? 'reserve'}</span></td>
                        <td className="px-5 py-3 text-neutral-500 whitespace-nowrap">{formatDate(reservation.reservation_date || reservation.created_at)}</td>
                        <td className="px-5 py-3 text-neutral-500 whitespace-nowrap">{formatDate(reservation.expiry_date)}</td>
                        <td className="px-5 py-3 text-neutral-500 whitespace-nowrap">#{reservation.priority ?? 1}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${meta.colour}`}>{meta.label}</span>
                        </td>
                        <td className="px-5 py-3">
                          {reservation.status === 'pending' ? (
                            <button onClick={() => cancelReservation(reservation)} className="text-xs text-error-600 hover:underline font-medium">Cancel</button>
                          ) : <span className="text-xs text-neutral-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Requests table */}
      {requests.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-14 h-14 mx-auto text-neutral-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-neutral-500 mb-4">You haven't submitted any resource requests yet.</p>
          <button onClick={openNew} className="btn-primary text-sm">Submit Your First Request</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-100">
                <tr>
                  {['Reference', 'Item / Topic', 'Date Submitted', 'Status', 'Action'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map(req => {
                  const meta = sm[req.status] ?? sm.pending;
                  return (
                    <tr key={req.id} className="border-t border-neutral-100 hover:bg-neutral-50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs font-semibold text-primary-700">{req.reference_no}</span>
                      </td>
                      <td className="px-5 py-3 max-w-xs">
                        <p className="font-medium text-neutral-800 truncate">{req.item_title || req.request_text}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">{req.reason}</p>
                      </td>
                      <td className="px-5 py-3 text-neutral-500 whitespace-nowrap">{formatDate(req.created_at)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${meta.colour}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button onClick={() => setDetailRequest(req)}
                          className="text-xs text-primary-600 hover:underline font-medium">View</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Request form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="card p-6 max-w-lg w-full my-8 space-y-5">
            {submitted ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-neutral-800 mb-2">Request Submitted!</h3>
                <p className="text-neutral-600 text-sm mb-4">
                  Your request <span className="font-mono font-bold text-primary-700">{submitted}</span> has been received.
                  The library will respond within <strong>2 working days</strong>.
                </p>
                <p className="text-xs text-neutral-400 mb-6">A confirmation has been sent to {patron?.email}.</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => { setSubmitted(null); }} className="btn-outline text-sm">Submit Another</button>
                  <button onClick={closeForm} className="btn-primary text-sm">Done</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-serif font-semibold text-primary-800">New Resource Request</h2>
                  <button onClick={closeForm} className="p-1 rounded text-neutral-400 hover:text-neutral-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div>
                  <label className="label text-xs font-semibold text-neutral-600 block mb-1">
                    Book Title / Author / Topic (optional hint)
                  </label>
                  <input type="text" value={fTitle} onChange={e => setFTitle(e.target.value)}
                    placeholder="e.g. Introduction to Early Childhood Education" className="input w-full" />
                </div>

                <div>
                  <label className="label text-xs font-semibold text-neutral-600 block mb-1">
                    What are you looking for? <span className="text-error-500">*</span>
                  </label>
                  <textarea value={fText} onChange={e => setFText(e.target.value)}
                    placeholder="Describe the resource you need — title, author, topic, or any relevant details…"
                    rows={3} className="input w-full resize-none" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label text-xs font-semibold text-neutral-600 block mb-1">
                      Why do you need it? <span className="text-error-500">*</span>
                    </label>
                    <select value={fReason} onChange={e => setFReason(e.target.value)} className="input w-full">
                      {REASONS.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs font-semibold text-neutral-600 block mb-1">
                      Preferred Format
                    </label>
                    <select value={fFormat} onChange={e => setFFormat(e.target.value)} className="input w-full">
                      {FORMATS.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label text-xs font-semibold text-neutral-600 block mb-1">
                    Which course is this for? (optional)
                  </label>
                  <input type="text" value={fCourse} onChange={e => setFCourse(e.target.value)}
                    placeholder="e.g. EDU 301 — Methods of Teaching" className="input w-full" />
                </div>

                <div>
                  <label className="label text-xs font-semibold text-neutral-600 block mb-1">
                    When do you need it by? (optional)
                  </label>
                  <input type="date" value={fDate} onChange={e => setFDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]} className="input w-full" />
                </div>

                <div className="flex gap-3 pt-1">
                  <button onClick={closeForm} disabled={submitting} className="btn-outline flex-1">Cancel</button>
                  <button onClick={handleSubmit} disabled={!fText.trim() || submitting}
                    className="btn-primary flex-1 disabled:opacity-50">
                    {submitting ? 'Submitting…' : 'Submit Request'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detailRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="card p-6 max-w-lg w-full my-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm font-bold text-primary-700">{detailRequest.reference_no}</span>
                <span className={`ml-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                  ${(sm[detailRequest.status] ?? sm.pending).colour}`}>
                  {(sm[detailRequest.status] ?? sm.pending).label}
                </span>
              </div>
              <button onClick={() => setDetailRequest(null)} className="p-1 text-neutral-400 hover:text-neutral-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2 text-sm">
              {detailRequest.item_title && (
                <div className="flex gap-3"><span className="w-32 text-neutral-400 shrink-0">Title</span><span className="text-neutral-800">{detailRequest.item_title}</span></div>
              )}
              <div className="flex gap-3"><span className="w-32 text-neutral-400 shrink-0">Description</span><span className="text-neutral-800">{detailRequest.request_text}</span></div>
              <div className="flex gap-3"><span className="w-32 text-neutral-400 shrink-0">Reason</span><span className="text-neutral-800">{detailRequest.reason}</span></div>
              {detailRequest.course && <div className="flex gap-3"><span className="w-32 text-neutral-400 shrink-0">Course</span><span className="text-neutral-800">{detailRequest.course}</span></div>}
              <div className="flex gap-3"><span className="w-32 text-neutral-400 shrink-0">Format</span><span className="text-neutral-800">{detailRequest.preferred_format}</span></div>
              {detailRequest.needed_by_date && <div className="flex gap-3"><span className="w-32 text-neutral-400 shrink-0">Needed by</span><span className="text-neutral-800">{formatDate(detailRequest.needed_by_date)}</span></div>}
              <div className="flex gap-3"><span className="w-32 text-neutral-400 shrink-0">Submitted</span><span className="text-neutral-800">{formatDate(detailRequest.created_at)}</span></div>
            </div>

            {detailRequest.status === 'ready_for_collection' && detailRequest.collection_location && (
              <div className="bg-success-50 border border-success-200 rounded-xl p-4 space-y-1">
                <p className="font-semibold text-success-700 text-sm">Ready for Collection</p>
                <p className="text-sm text-neutral-700"><strong>Location:</strong> {detailRequest.collection_location}</p>
                {detailRequest.collect_by_date && (
                  <p className="text-sm text-amber-700 font-medium">Collect by: {formatDate(detailRequest.collect_by_date)}</p>
                )}
              </div>
            )}

            {detailRequest.status === 'cannot_fulfil' && detailRequest.librarian_note && (
              <div className="bg-error-50 border border-error-200 rounded-xl p-4">
                <p className="font-semibold text-error-600 text-sm mb-1">Cannot Fulfil</p>
                <p className="text-sm text-neutral-700">{detailRequest.librarian_note}</p>
              </div>
            )}

            {detailRequest.librarian_note && detailRequest.status !== 'cannot_fulfil' && (
              <div className="bg-neutral-50 rounded-xl p-3">
                <p className="text-xs text-neutral-500 mb-1">Librarian Note</p>
                <p className="text-sm text-neutral-700">{detailRequest.librarian_note}</p>
              </div>
            )}

            <button onClick={() => setDetailRequest(null)} className="btn-outline w-full text-sm">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
