import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';
import { format, differenceInDays } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Patron {
  id: string;
  patron_id: string;
  full_name: string;
  email: string;
  patron_category: string;
  faculty_name: string;
}

interface CatalogueItem {
  id: string;
  title: string;
  authors: string;
  call_number: string;
  available_copies: number;
  total_copies: number;
  format: string;
}

interface ActiveLoan {
  id: string;
  patron_id: string;
  catalogue_item_id: string;
  checkout_date: string;
  due_date: string;
  status: string;
  catalogue_items: { title: string; call_number: string };
  patrons: { full_name: string; patron_id: string };
}

interface OfflineTx {
  offline_id: string;
  type: 'checkout' | 'checkin';
  patron_id: string;
  patron_name: string;
  item_title: string;
  catalogue_item_id: string;
  copy_barcode: string;
  ts: number;
}

const LOAN_DAYS: Record<string, number> = {
  undergraduate:      institutionConfig.loanRules.undergraduate.durationDays,
  postgraduate:       institutionConfig.loanRules.postgraduate.durationDays,
  academic_staff:     institutionConfig.loanRules.academic_staff.durationDays,
  non_academic_staff: institutionConfig.loanRules.non_academic_staff.durationDays,
};
const defaultLoanDays = 14;

const OFFLINE_KEY = 'circ_offline_queue';

function loadOfflineQueue(): OfflineTx[] {
  try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) ?? '[]'); } catch { return []; }
}
function saveOfflineQueue(q: OfflineTx[]) {
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(q));
}

export default function Circulation() {
  const [tab, setTab] = useState<'checkout' | 'checkin' | 'holds' | 'offline'>('checkout');

  // ── Checkout state
  const [patronQuery, setPatronQuery]     = useState('');
  const [patronResults, setPatronResults] = useState<Patron[]>([]);
  const [selectedPatron, setSelectedPatron] = useState<Patron | null>(null);
  const [itemQuery, setItemQuery]         = useState('');
  const [itemResults, setItemResults]     = useState<CatalogueItem[]>([]);
  const [selectedItem, setSelectedItem]   = useState<CatalogueItem | null>(null);
  const [coLoading, setCoLoading]         = useState(false);
  const [coAlert, setCoAlert]             = useState<{ type: string; msg: string } | null>(null);

  // ── Check-in state
  const [checkinQuery, setCheckinQuery]   = useState('');
  const [checkinResults, setCheckinResults] = useState<ActiveLoan[]>([]);
  const [ciLoading, setCiLoading]         = useState(false);
  const [ciAlert, setCiAlert]             = useState<{ type: string; msg: string } | null>(null);

  // ── Holds state
  const [holdsPatronQuery, setHoldsPatronQuery] = useState('');
  const [holdsPatron, setHoldsPatron]           = useState<Patron | null>(null);
  const [holdsItemQuery, setHoldsItemQuery]     = useState('');
  const [holdsItem, setHoldsItem]               = useState<CatalogueItem | null>(null);
  const [holdsAlert, setHoldsAlert]             = useState<{ type: string; msg: string } | null>(null);
  const [holds, setHolds]                       = useState<any[]>([]);

  // ── Offline
  const [offlineQueue, setOfflineQueue]   = useState<OfflineTx[]>(loadOfflineQueue);
  const [syncing, setSyncing]             = useState(false);
  const [isOnline, setIsOnline]           = useState(navigator.onLine);
  const patronRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => { fetchHolds(); }, []);

  // ── Patron search
  const searchPatrons = async (q: string) => {
    setPatronQuery(q);
    if (q.length < 2) { setPatronResults([]); return; }
    const { data } = await supabase
      .from('patrons')
      .select('id, patron_id, full_name, email, patron_category, faculty_name')
      .or(`full_name.ilike.%${q}%,patron_id.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8);
    setPatronResults(data ?? []);
  };

  // ── Item search
  const searchItems = async (q: string) => {
    setItemQuery(q);
    if (q.length < 2) { setItemResults([]); return; }
    const { data } = await supabase
      .from('catalogue_items')
      .select('id, title, authors, call_number, available_copies, total_copies, format')
      .or(`title.ilike.%${q}%,call_number.ilike.%${q}%`)
      .limit(8);
    setItemResults(data ?? []);
  };

  const dueDate = (patron: Patron): string => {
    const days = LOAN_DAYS[patron.patron_category] ?? defaultLoanDays;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  // ── Checkout
  const handleCheckout = async () => {
    if (!selectedPatron || !selectedItem) return;
    setCoLoading(true);
    setCoAlert(null);
    const due = dueDate(selectedPatron);

    const tx: OfflineTx = {
      offline_id: crypto.randomUUID(),
      type: 'checkout',
      patron_id: selectedPatron.id,
      patron_name: selectedPatron.full_name,
      item_title: selectedItem.title,
      catalogue_item_id: selectedItem.id,
      copy_barcode: '',
      ts: Date.now(),
    };

    if (!isOnline) {
      const q = [...offlineQueue, tx];
      setOfflineQueue(q);
      saveOfflineQueue(q);
      setCoAlert({ type: 'warning', msg: `Offline — checkout queued for ${selectedPatron.full_name}. Will sync on reconnect.` });
      resetCheckout();
      setCoLoading(false);
      return;
    }

    try {
      if ((selectedItem.available_copies ?? 0) <= 0) {
        throw new Error('No copies available. Place a hold instead.');
      }
      const { data: loan, error: loanErr } = await supabase.from('loans').insert({
        patron_id: selectedPatron.id,
        catalogue_item_id: selectedItem.id,
        checkout_date: new Date().toISOString(),
        due_date: due,
        status: 'active',
      }).select('id').single();
      if (loanErr) throw loanErr;

      await supabase.from('catalogue_items').update({
        available_copies: (selectedItem.available_copies ?? 1) - 1,
      }).eq('id', selectedItem.id);

      await supabase.from('circulation_transactions').insert({
        transaction_type: 'checkout',
        patron_id: selectedPatron.id,
        catalogue_item_id: selectedItem.id,
        loan_id: loan.id,
        offline_id: tx.offline_id,
      });

      setCoAlert({ type: 'success', msg: `Checked out "${selectedItem.title}" to ${selectedPatron.full_name}. Due: ${due}.` });
      resetCheckout();
    } catch (err: any) {
      setCoAlert({ type: 'error', msg: err?.message ?? 'Checkout failed.' });
    } finally {
      setCoLoading(false);
    }
  };

  const resetCheckout = () => {
    setSelectedPatron(null);
    setSelectedItem(null);
    setPatronQuery('');
    setItemQuery('');
    setPatronResults([]);
    setItemResults([]);
    patronRef.current?.focus();
  };

  // ── Check-in
  const searchLoans = async (q: string) => {
    setCheckinQuery(q);
    if (q.length < 2) { setCheckinResults([]); return; }
    const { data } = await supabase
      .from('loans')
      .select('id, patron_id, catalogue_item_id, checkout_date, due_date, status, catalogue_items(title, call_number), patrons(full_name, patron_id)')
      .eq('status', 'active')
      .or(`catalogue_items.title.ilike.%${q}%,catalogue_items.call_number.ilike.%${q}%,patrons.full_name.ilike.%${q}%`)
      .limit(10);
    setCheckinResults((data ?? []) as unknown as ActiveLoan[]);
  };

  const isExamPeriod = (): boolean => {
    const today = new Date();
    const c = institutionConfig;
    const ranges = [
      { start: c.examOneDates.start, end: c.examOneDates.end },
      { start: c.examTwoDates.start, end: c.examTwoDates.end },
    ];
    return ranges.some(({ start, end }) => today >= new Date(start) && today <= new Date(end));
  };

  const calculateFine = (dueDate: string): number => {
    if (isExamPeriod()) return 0;
    const days = differenceInDays(new Date(), new Date(dueDate));
    if (days <= 0) return 0;
    const rate = institutionConfig.fineRatePerDay ?? 50;
    return days * rate;
  };

  const handleCheckin = async (loan: ActiveLoan) => {
    setCiLoading(true);
    setCiAlert(null);
    try {
      const fine = calculateFine(loan.due_date);
      await supabase.from('loans').update({
        return_date: new Date().toISOString(),
        status: 'returned',
      }).eq('id', loan.id);

      const { data: item } = await supabase
        .from('catalogue_items')
        .select('available_copies')
        .eq('id', loan.catalogue_item_id)
        .single();

      await supabase.from('catalogue_items').update({
        available_copies: (item?.available_copies ?? 0) + 1,
      }).eq('id', loan.catalogue_item_id);

      if (fine > 0) {
        await supabase.from('fines').insert({
          patron_id: loan.patron_id,
          amount: fine,
          reason: `Overdue fine — ${loan.catalogue_items?.title}`,
          reference_type: 'loan',
          reference_id: loan.id,
          status: 'unpaid',
        });
      }

      await supabase.from('circulation_transactions').insert({
        transaction_type: 'checkin',
        patron_id: loan.patron_id,
        catalogue_item_id: loan.catalogue_item_id,
        loan_id: loan.id,
        offline_id: crypto.randomUUID(),
        notes: fine > 0 ? `Fine applied: ₦${fine}` : '',
      });

      // Notify next patron in hold queue
      const { data: nextHold } = await supabase
        .from('reservations')
        .select('id, patron_id, patrons(email, full_name)')
        .eq('catalogue_item_id', loan.catalogue_item_id)
        .eq('status', 'pending')
        .order('priority')
        .limit(1)
        .single();

      if (nextHold) {
        await supabase.from('reservations').update({ status: 'ready_for_collection', notify_sent: true }).eq('id', nextHold.id);
        await supabase.from('notifications').insert({
          patron_id: nextHold.patron_id,
          title: 'Hold Available',
          message: `"${loan.catalogue_items?.title}" is now available for collection. Please collect within 3 days.`,
          type: 'hold',
        });
      }

      setCiAlert({
        type: 'success',
        msg: `Checked in "${loan.catalogue_items?.title}".${fine > 0 ? ` Fine applied: ₦${fine.toLocaleString()}.` : ''} ${isExamPeriod() ? '(Exam period — fines suspended)' : ''}`,
      });
      setCheckinResults([]);
      setCheckinQuery('');
    } catch (err: any) {
      setCiAlert({ type: 'error', msg: err?.message ?? 'Check-in failed.' });
    } finally {
      setCiLoading(false);
    }
  };

  // ── Holds
  const fetchHolds = async () => {
    const { data } = await supabase
      .from('reservations')
      .select('id, status, priority, created_at, catalogue_items(title), patrons(full_name, patron_id)')
      .eq('status', 'pending')
      .order('created_at');
    setHolds((data ?? []) as any[]);
  };

  const placeHold = async () => {
    if (!holdsPatron || !holdsItem) return;
    setHoldsAlert(null);
    const { count } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('catalogue_item_id', holdsItem.id)
      .eq('status', 'pending');

    const { error } = await supabase.from('reservations').insert({
      patron_id: holdsPatron.id,
      catalogue_item_id: holdsItem.id,
      reservation_date: new Date().toISOString(),
      expiry_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: 'pending',
      priority: (count ?? 0) + 1,
    });
    if (error) { setHoldsAlert({ type: 'error', msg: 'Hold failed: ' + error.message }); return; }
    setHoldsAlert({ type: 'success', msg: `Hold placed for ${holdsPatron.full_name} on "${holdsItem.title}".` });
    setHoldsPatron(null);
    setHoldsItem(null);
    setHoldsPatronQuery('');
    setHoldsItemQuery('');
    fetchHolds();
  };

  // ── Offline sync
  const syncOffline = async () => {
    if (!isOnline || offlineQueue.length === 0) return;
    setSyncing(true);
    const remaining: OfflineTx[] = [];
    for (const tx of offlineQueue) {
      try {
        if (tx.type === 'checkout') {
          const { data: item } = await supabase
            .from('catalogue_items')
            .select('available_copies, patron_category')
            .eq('id', tx.catalogue_item_id)
            .single();
          if ((item?.available_copies ?? 0) <= 0) { remaining.push(tx); continue; }
          const due = new Date();
          due.setDate(due.getDate() + defaultLoanDays);
          const { data: loan } = await supabase.from('loans').insert({
            patron_id: tx.patron_id,
            catalogue_item_id: tx.catalogue_item_id,
            checkout_date: new Date(tx.ts).toISOString(),
            due_date: due.toISOString().split('T')[0],
            status: 'active',
          }).select('id').single();
          await supabase.from('catalogue_items').update({
            available_copies: (item?.available_copies ?? 1) - 1,
          }).eq('id', tx.catalogue_item_id);
          await supabase.from('circulation_transactions').insert({
            transaction_type: 'checkout',
            patron_id: tx.patron_id,
            catalogue_item_id: tx.catalogue_item_id,
            loan_id: loan?.id,
            offline_id: tx.offline_id,
            synced_at: new Date().toISOString(),
          });
        }
      } catch {
        remaining.push(tx);
      }
    }
    setOfflineQueue(remaining);
    saveOfflineQueue(remaining);
    setSyncing(false);
  };

  // ── Shared patron dropdown helper
  const PatronDropdown = ({
    query, results, onQuery, onSelect,
  }: {
    query: string; results: Patron[]; onQuery: (q: string) => void; onSelect: (p: Patron) => void;
  }) => (
    <div className="relative">
      <input
        type="text"
        className="input w-full"
        placeholder="Search patron by name, ID or email…"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        autoComplete="off"
      />
      {results.length > 0 && (
        <div className="absolute z-20 bg-white border rounded-lg shadow-xl mt-1 w-full max-h-60 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b last:border-0"
              onClick={() => { onSelect(p); onQuery(p.full_name); }}
            >
              <div className="font-medium text-sm">{p.full_name}</div>
              <div className="text-xs text-gray-500">{p.patron_id} · {p.patron_category} · {p.faculty_name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const ItemDropdown = ({
    query, results, onQuery, onSelect,
  }: {
    query: string; results: CatalogueItem[]; onQuery: (q: string) => void; onSelect: (i: CatalogueItem) => void;
  }) => (
    <div className="relative">
      <input
        type="text"
        className="input w-full"
        placeholder="Search item by title or call number…"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        autoComplete="off"
      />
      {results.length > 0 && (
        <div className="absolute z-20 bg-white border rounded-lg shadow-xl mt-1 w-full max-h-60 overflow-y-auto">
          {results.map((it) => (
            <button
              key={it.id}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b last:border-0"
              onClick={() => { onSelect(it); onQuery(it.title); }}
            >
              <div className="font-medium text-sm">{it.title}</div>
              <div className="text-xs text-gray-500">
                {it.call_number} · {it.format} · {it.available_copies}/{it.total_copies} available
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const TABS = [
    { id: 'checkout', label: 'Check Out' },
    { id: 'checkin',  label: 'Check In' },
    { id: 'holds',    label: `Holds${holds.length > 0 ? ` (${holds.length})` : ''}` },
    { id: 'offline',  label: `Offline Queue${offlineQueue.length > 0 ? ` (${offlineQueue.length})` : ''}` },
  ] as const;

  const alertCls = (type: string) =>
    type === 'success' ? 'bg-green-50 text-green-800' :
    type === 'warning' ? 'bg-amber-50 text-amber-800' :
    'bg-red-50 text-red-800';

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Circulation</h1>
          <p className="text-gray-600 mt-1">Check out, check in, and manage patron holds.</p>
        </div>
        <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      {isExamPeriod() && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium">
          Exam period active — overdue fines are currently suspended.
        </div>
      )}

      {/* Tabs */}
      <div className="border-b flex gap-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-primary-700 text-primary-800' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Check Out ─────────────────────────────────────────── */}
      {tab === 'checkout' && (
        <div className="max-w-xl space-y-5">
          {coAlert && (
            <div className={`p-4 rounded-lg text-sm font-medium ${alertCls(coAlert.type)}`}>
              {coAlert.msg}
            </div>
          )}

          <div className="card space-y-4">
            <h2 className="font-semibold text-lg">1. Find Patron</h2>
            <PatronDropdown
              query={patronQuery}
              results={patronResults}
              onQuery={searchPatrons}
              onSelect={(p) => { setSelectedPatron(p); setPatronResults([]); }}
            />
            {selectedPatron && (
              <div className="p-3 bg-blue-50 rounded-lg text-sm">
                <strong>{selectedPatron.full_name}</strong> — {selectedPatron.patron_category}
                <span className="text-gray-500"> · Due in {LOAN_DAYS[selectedPatron.patron_category] ?? defaultLoanDays} days → {dueDate(selectedPatron)}</span>
              </div>
            )}
          </div>

          <div className="card space-y-4">
            <h2 className="font-semibold text-lg">2. Find Item</h2>
            <ItemDropdown
              query={itemQuery}
              results={itemResults}
              onQuery={searchItems}
              onSelect={(it) => { setSelectedItem(it); setItemResults([]); }}
            />
            {selectedItem && (
              <div className={`p-3 rounded-lg text-sm ${selectedItem.available_copies > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <strong>{selectedItem.title}</strong>
                <span className="text-gray-600"> — {selectedItem.available_copies}/{selectedItem.total_copies} available</span>
              </div>
            )}
          </div>

          <button
            onClick={handleCheckout}
            disabled={!selectedPatron || !selectedItem || coLoading}
            className="btn-primary w-full py-3 text-base disabled:opacity-50"
          >
            {coLoading ? 'Processing…' : 'Check Out'}
          </button>
        </div>
      )}

      {/* ── Check In ──────────────────────────────────────────── */}
      {tab === 'checkin' && (
        <div className="max-w-xl space-y-5">
          {ciAlert && (
            <div className={`p-4 rounded-lg text-sm font-medium ${alertCls(ciAlert.type)}`}>
              {ciAlert.msg}
            </div>
          )}
          <div className="card space-y-3">
            <h2 className="font-semibold text-lg">Find Active Loan</h2>
            <input
              type="text"
              className="input w-full"
              placeholder="Search by patron name or item title…"
              value={checkinQuery}
              onChange={(e) => searchLoans(e.target.value)}
            />
          </div>

          {checkinResults.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Item</th>
                    <th className="text-left p-3 font-semibold">Patron</th>
                    <th className="text-left p-3 font-semibold">Due</th>
                    <th className="text-left p-3 font-semibold">Fine</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {checkinResults.map((loan) => {
                    const fine = calculateFine(loan.due_date);
                    const overdue = differenceInDays(new Date(), new Date(loan.due_date)) > 0;
                    return (
                      <tr key={loan.id} className={`border-b ${overdue ? 'bg-red-50' : ''}`}>
                        <td className="p-3 font-medium">{loan.catalogue_items?.title}</td>
                        <td className="p-3 text-gray-600">
                          {loan.patrons?.full_name}
                          <br />
                          <span className="text-xs">{loan.patrons?.patron_id}</span>
                        </td>
                        <td className={`p-3 text-sm ${overdue ? 'text-red-600 font-semibold' : ''}`}>
                          {loan.due_date}
                        </td>
                        <td className="p-3 text-sm font-semibold text-red-700">
                          {fine > 0 ? `₦${fine.toLocaleString()}` : isExamPeriod() ? '—' : '₦0'}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleCheckin(loan)}
                            disabled={ciLoading}
                            className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
                          >
                            Return
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Holds ─────────────────────────────────────────────── */}
      {tab === 'holds' && (
        <div className="space-y-6">
          <div className="max-w-xl card space-y-4">
            <h2 className="font-semibold text-lg">Place a Hold</h2>
            {holdsAlert && (
              <div className={`p-3 rounded-lg text-sm font-medium ${alertCls(holdsAlert.type)}`}>
                {holdsAlert.msg}
              </div>
            )}
            <div>
              <label className="label">Patron</label>
              <PatronDropdown
                query={holdsPatronQuery}
                results={patronResults}
                onQuery={(q) => { setHoldsPatronQuery(q); searchPatrons(q); }}
                onSelect={(p) => { setHoldsPatron(p); setPatronResults([]); setHoldsPatronQuery(p.full_name); }}
              />
            </div>
            <div>
              <label className="label">Item</label>
              <ItemDropdown
                query={holdsItemQuery}
                results={itemResults}
                onQuery={(q) => { setHoldsItemQuery(q); searchItems(q); }}
                onSelect={(it) => { setHoldsItem(it); setItemResults([]); setHoldsItemQuery(it.title); }}
              />
            </div>
            <button
              onClick={placeHold}
              disabled={!holdsPatron || !holdsItem}
              className="btn-primary w-full disabled:opacity-50"
            >
              Place Hold
            </button>
          </div>

          <div className="card overflow-x-auto">
            <h2 className="font-semibold text-lg mb-4">Active Hold Queue</h2>
            {holds.length === 0 ? (
              <p className="text-gray-400 text-sm">No pending holds.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Priority</th>
                    <th className="text-left p-3 font-semibold">Item</th>
                    <th className="text-left p-3 font-semibold">Patron</th>
                    <th className="text-left p-3 font-semibold">Requested</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {holds.map((h) => (
                    <tr key={h.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-bold text-primary-700">{h.priority}</td>
                      <td className="p-3 font-medium">{h.catalogue_items?.title}</td>
                      <td className="p-3 text-gray-600">{h.patrons?.full_name} <span className="text-xs">({h.patrons?.patron_id})</span></td>
                      <td className="p-3 text-sm text-gray-500">{format(new Date(h.created_at), 'dd MMM yyyy')}</td>
                      <td className="p-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${h.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                          {h.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Offline Queue ─────────────────────────────────────── */}
      {tab === 'offline' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-600 text-sm">
              Transactions queued while offline are stored locally and synced when you reconnect.
            </p>
            <button
              onClick={syncOffline}
              disabled={!isOnline || offlineQueue.length === 0 || syncing}
              className="btn-primary disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : `Sync Now (${offlineQueue.length})`}
            </button>
          </div>

          {offlineQueue.length === 0 ? (
            <div className="card text-center text-gray-400 py-12">
              No offline transactions queued.
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Type</th>
                    <th className="text-left p-3 font-semibold">Patron</th>
                    <th className="text-left p-3 font-semibold">Item</th>
                    <th className="text-left p-3 font-semibold">Time</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {offlineQueue.map((tx) => (
                    <tr key={tx.offline_id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tx.type === 'checkout' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="p-3">{tx.patron_name}</td>
                      <td className="p-3 font-medium">{tx.item_title}</td>
                      <td className="p-3 text-gray-500 text-xs">{new Date(tx.ts).toLocaleString()}</td>
                      <td className="p-3">
                        <button
                          onClick={() => {
                            const q = offlineQueue.filter((x) => x.offline_id !== tx.offline_id);
                            setOfflineQueue(q);
                            saveOfflineQueue(q);
                          }}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
