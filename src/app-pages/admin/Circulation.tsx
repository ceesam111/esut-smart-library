import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { format, differenceInDays } from 'date-fns';
import { logCirculationEvent } from '@/lib/audit';
import { trackClientEvent } from '@/lib/analytics';
import { useBarcodeScanner } from '@/features/barcode/useBarcodeScanner';
import {
  computeDueDate,
  durationDaysFor,
  maxItemsFor,
  renewalsFor,
  calculateFine as computeFine,
  isExamPeriodAt,
} from '@/lib/circulationRules';
import { useOfflineCirculation } from '@/lib/offline/useOfflineCirculation';
import {
  cacheIsStale,
  findItemByBarcode,
  searchItems as cacheSearchItems,
  searchPatrons as cacheSearchPatrons,
} from '@/lib/offline/cache';
import OfflinePanel from '@/components/offline/OfflinePanel';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Patron {
  id: string;
  patron_id: string;
  user_id?: string | null;
  full_name: string;
  email: string;
  patron_category: string;
  faculty_name: string;
  status?: string;
  membership_expires_at?: string | null;
}

interface CatalogueItem {
  id: string;
  title: string;
  authors: unknown;
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
  renewed_count?: number | null;
  status: string;
  catalogue_items: { title: string; call_number: string };
  patrons: { full_name: string; patron_id: string; user_id?: string | null; patron_category?: string };
}

interface HoldRow {
  id: string;
  status: string;
  priority: number;
  created_at: string;
  catalogue_items: { title: string } | null;
  patrons: { full_name: string; patron_id: string } | null;
}

const ITEM_COLS = 'id, title, authors, call_number, available_copies, total_copies, format';
const PATRON_COLS = 'id, patron_id, user_id, full_name, email, patron_category, faculty_name, status, membership_expires_at';

export default function Circulation() {
  const off = useOfflineCirculation();
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
  const [holds, setHolds]                       = useState<HoldRow[]>([]);

  const patronRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchHolds();
    void off.migrateLegacyQueue();
  }, []);

  // Preload the offline desk cache while the server is reachable.
  useEffect(() => {
    if (off.serverReachable && !off.cache && !off.cacheLoading) void off.refreshCache();
  }, [off.serverReachable]);

  const serverReachable = off.serverReachable;

  // ── Patron search (online first, offline cache fallback) ────────────────────
  const searchPatrons = async (q: string) => {
    setPatronQuery(q);
    if (q.length < 2) { setPatronResults([]); return; }
    if (!serverReachable) {
      setPatronResults(cacheSearchPatrons(off.cache, q) as Patron[]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('patrons')
        .select(PATRON_COLS)
        .or(`full_name.ilike.%${q}%,patron_id.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(8);
      if (error) throw error;
      setPatronResults((data ?? []) as Patron[]);
    } catch {
      setPatronResults(cacheSearchPatrons(off.cache, q) as Patron[]);
    }
  };

  // ── Item search: barcode exact-match first, then title/call number, then cache
  const searchItems = async (q: string) => {
    setItemQuery(q);
    if (q.length < 2) { setItemResults([]); return; }
    const byBarcode = findItemByBarcode(off.cache, q) as CatalogueItem | null;
    if (!serverReachable) {
      setItemResults(byBarcode ? [byBarcode] : (cacheSearchItems(off.cache, q) as CatalogueItem[]));
      return;
    }
    try {
      const code = q.trim();
      const { data: copy } = await supabase
        .from('catalogue_copies')
        .select('item_id')
        .eq('barcode', code)
        .maybeSingle();
      if (copy) {
        const { data: item } = await supabase
          .from('catalogue_items')
          .select(ITEM_COLS)
          .eq('id', copy.item_id)
          .maybeSingle();
        if (item) { setItemResults([item as CatalogueItem]); return; }
      }
      const { data, error } = await supabase
        .from('catalogue_items')
        .select(ITEM_COLS)
        .or(`title.ilike.%${q}%,call_number.ilike.%${q}%`)
        .limit(8);
      if (error) throw error;
      setItemResults((data ?? []) as CatalogueItem[]);
    } catch {
      setItemResults(byBarcode ? [byBarcode] : (cacheSearchItems(off.cache, q) as CatalogueItem[]));
    }
  };

  const dueDate = (patron: Patron): string => computeDueDate(new Date(), patron.patron_category);

  // ── Checkout
  const fireNotice = (action: string, payload: Record<string, unknown>) => {
    void fetch('/api/admin/notices/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, channel: 'in-app', ...payload }),
    }).catch(() => undefined);
  };

  const handleCheckout = async () => {
    if (!selectedPatron || !selectedItem) return;
    setCoLoading(true);
    setCoAlert(null);

    if (!serverReachable) {
      const res = await off.enqueueCheckout(
        {
          ...selectedPatron,
          user_id: selectedPatron.user_id ?? null,
          status: selectedPatron.status ?? 'active',
          membership_expires_at: selectedPatron.membership_expires_at ?? null,
        },
        selectedItem,
      );
      if (!res.ok) {
        setCoAlert({ type: 'error', msg: res.reason ?? 'Could not queue checkout.' });
      } else {
        setCoAlert({ type: 'warning', msg: `OFFLINE — checkout queued for ${selectedPatron.full_name}. It will sync when the desk reconnects.` });
        resetCheckout();
      }
      setCoLoading(false);
      return;
    }

    const due = dueDate(selectedPatron);
    try {
      if ((selectedItem.available_copies ?? 0) <= 0) {
        throw new Error('No copies available. Place a hold instead.');
      }

      const maxAllowed = maxItemsFor(selectedPatron.patron_category);
      const { count: activeLoanCount, error: countErr } = await supabase
        .from('loans')
        .select('id', { count: 'exact', head: true })
        .eq('patron_id', selectedPatron.id)
        .eq('status', 'active');
      if (countErr) throw countErr;
      if ((activeLoanCount ?? 0) >= maxAllowed) {
        throw new Error(`${selectedPatron.full_name} already has ${activeLoanCount} active loan(s). Maximum allowed for ${selectedPatron.patron_category} is ${maxAllowed}.`);
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
        offline_id: crypto.randomUUID(),
      });

      await logCirculationEvent({
        action: 'checkout',
        patron_id: selectedPatron.id,
        catalogue_item_id: selectedItem.id,
        loan_id: loan.id,
        metadata: { due_date: due, title: selectedItem.title },
      });

      void trackClientEvent({
        event_type: 'checkout',
        entity_id: String(loan.id),
        entity_type: 'loan',
        path: '/admin/circulation',
        metadata: { title: selectedItem.title, item_id: selectedItem.id },
      });

      if (selectedPatron.user_id) {
        fireNotice('checkout', {
          userId: selectedPatron.user_id,
          itemTitle: selectedItem.title,
          loanId: loan.id,
          dueDate: due,
        });
      }

      setCoAlert({ type: 'success', msg: `Checked out "${selectedItem.title}" to ${selectedPatron.full_name}. Due: ${due}.` });
      resetCheckout();
      void off.refreshCache();
    } catch (err) {
      setCoAlert({ type: 'error', msg: err instanceof Error ? err.message : 'Checkout failed.' });
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

  // ── Check-in search (online first, offline cache fallback) ─────────────────
  const searchLoans = async (q: string) => {
    setCheckinQuery(q);
    if (q.length < 2) { setCheckinResults([]); return; }
    if (!serverReachable) {
      setCheckinResults(cacheLoanSearch(q));
      return;
    }
    try {
      const { data, error } = await supabase
        .from('loans')
        .select('id, patron_id, catalogue_item_id, checkout_date, due_date, renewed_count, status, catalogue_items(title, call_number), patrons(full_name, patron_id, user_id, patron_category)')
        .eq('status', 'active')
        .or(`catalogue_items.title.ilike.%${q}%,catalogue_items.call_number.ilike.%${q}%,patrons.full_name.ilike.%${q}%`)
        .limit(10);
      if (error) throw error;
      setCheckinResults((data ?? []) as unknown as ActiveLoan[]);
    } catch {
      setCheckinResults(cacheLoanSearch(q));
    }
  };

  const cacheLoanSearch = (q: string): ActiveLoan[] => {
    const cache = off.cache;
    if (!cache) return [];
    const needle = q.trim().toLowerCase();
    return cache.loans
      .filter((l) => l.status === 'active' || l.status === 'overdue')
      .map((l) => {
        const patron = cache.patrons.find((p) => p.id === l.patron_id);
        const item = cache.items.find((i) => i.id === l.catalogue_item_id);
        return {
          id: l.id,
          patron_id: l.patron_id,
          catalogue_item_id: l.catalogue_item_id,
          checkout_date: l.checkout_date,
          due_date: l.due_date,
          renewed_count: l.renewed_count,
          status: l.status,
          catalogue_items: { title: item?.title ?? 'Unknown item', call_number: item?.call_number ?? '' },
          patrons: {
            full_name: patron?.full_name ?? 'Unknown patron',
            patron_id: patron?.patron_id ?? '',
            user_id: patron?.user_id ?? null,
            patron_category: patron?.patron_category,
          },
        } as ActiveLoan;
      })
      .filter(
        (l) =>
          l.catalogue_items.title.toLowerCase().includes(needle) ||
          l.patrons.full_name.toLowerCase().includes(needle) ||
          l.patrons.patron_id.toLowerCase().includes(needle),
      )
      .slice(0, 10);
  };

  const isExamPeriod = (): boolean => isExamPeriodAt();

  const calculateFine = (dueDateStr: string): number => computeFine(dueDateStr).amount;

  const handleCheckin = async (loan: ActiveLoan) => {
    setCiLoading(true);
    setCiAlert(null);
    try {
      if (!serverReachable) {
        const res = await off.enqueueCheckin(
          { id: loan.id, patron_id: loan.patron_id, catalogue_item_id: loan.catalogue_item_id },
          loan.patrons?.full_name ?? '',
          loan.catalogue_items?.title ?? '',
        );
        if (!res.ok) throw new Error(res.reason ?? 'Could not queue check-in.');
        setCiAlert({ type: 'warning', msg: `OFFLINE — check-in queued for "${loan.catalogue_items?.title}". It will sync when the desk reconnects.` });
        setCheckinResults([]);
        setCheckinQuery('');
        return;
      }

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

      await logCirculationEvent({
        action: 'checkin',
        patron_id: loan.patron_id,
        catalogue_item_id: loan.catalogue_item_id,
        loan_id: loan.id,
        metadata: { fine: fine > 0 ? fine : null, title: loan.catalogue_items?.title },
      });

      void trackClientEvent({
        event_type: 'checkin',
        entity_id: String(loan.id),
        entity_type: 'loan',
        path: '/admin/circulation',
        metadata: { title: loan.catalogue_items?.title, item_id: loan.catalogue_item_id },
      });

      // Notify next patron in hold queue
      const { data: nextHold } = await supabase
        .from('reservations')
        .select('id, patron_id, patrons(email, full_name, user_id)')
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
        const nextPatronUser = Array.isArray(nextHold.patrons)
          ? nextHold.patrons[0]?.user_id
          : (nextHold.patrons as { user_id?: string | null } | null)?.user_id;
        if (nextPatronUser) {
          fireNotice('hold_ready', {
            userId: nextPatronUser,
            itemTitle: loan.catalogue_items?.title ?? 'Library item',
            holdId: nextHold.id,
          });
        }
      }

      if (loan.patrons?.user_id) {
        fireNotice('checkin', {
          userId: loan.patrons.user_id,
          itemTitle: loan.catalogue_items?.title ?? 'Library item',
          loanId: loan.id,
        });
      }

      setCiAlert({
        type: 'success',
        msg: `Checked in "${loan.catalogue_items?.title}".${fine > 0 ? ` Fine applied: ₦${fine.toLocaleString()}.` : ''} ${isExamPeriod() ? '(Exam period — fines suspended)' : ''}`,
      });
      setCheckinResults([]);
      setCheckinQuery('');
      void off.refreshCache();
    } catch (err) {
      setCiAlert({ type: 'error', msg: err instanceof Error ? err.message : 'Check-in failed.' });
    } finally {
      setCiLoading(false);
    }
  };

  // ── Renewal (online direct, offline queued) ────────────────────────────────
  const handleRenew = async (loan: ActiveLoan) => {
    setCiLoading(true);
    setCiAlert(null);
    try {
      if (!serverReachable) {
        const patron = off.cache?.patrons.find((p) => p.id === loan.patron_id) ?? null;
        const res = await off.enqueueRenew(
          {
            id: loan.id,
            patron_id: loan.patron_id,
            catalogue_item_id: loan.catalogue_item_id,
            checkout_date: loan.checkout_date,
            due_date: loan.due_date,
            renewed_count: loan.renewed_count ?? 0,
            status: loan.status,
          },
          patron,
          loan.catalogue_items?.title ?? '',
        );
        if (!res.ok) throw new Error(res.reason ?? 'Could not queue renewal.');
        setCiAlert({ type: 'warning', msg: `OFFLINE — renewal queued for ${loan.patrons?.full_name}. It will sync when the desk reconnects.` });
        setCheckinResults([]);
        setCheckinQuery('');
        return;
      }

      const { data: patronRow } = await supabase
        .from('patrons')
        .select('patron_category, full_name')
        .eq('id', loan.patron_id)
        .single();
      const category = patronRow?.patron_category;
      const renewed = loan.renewed_count ?? 0;
      const maxRenewals = renewalsFor(category);
      if (renewed >= maxRenewals) {
        throw new Error(`Renewal limit of ${maxRenewals} already reached for ${category ?? 'this patron'}.`);
      }
      if (Date.parse(loan.due_date) < Date.now()) {
        throw new Error('Loan is overdue — overdue loans cannot be renewed.');
      }
      const newDue = computeDueDate(new Date(), category);
      const { error } = await supabase.from('loans').update({
        due_date: newDue,
        renewed_count: renewed + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', loan.id);
      if (error) throw error;

      await supabase.from('circulation_transactions').insert({
        transaction_type: 'renew',
        patron_id: loan.patron_id,
        catalogue_item_id: loan.catalogue_item_id,
        loan_id: loan.id,
        offline_id: crypto.randomUUID(),
      });

      await logCirculationEvent({
        action: 'renewal',
        patron_id: loan.patron_id,
        catalogue_item_id: loan.catalogue_item_id,
        loan_id: loan.id,
        metadata: { new_due_date: newDue, title: loan.catalogue_items?.title },
      });

      void trackClientEvent({
        event_type: 'renewal',
        entity_id: String(loan.id),
        entity_type: 'loan',
        path: '/admin/circulation',
        metadata: { title: loan.catalogue_items?.title, item_id: loan.catalogue_item_id },
      });

      if (loan.patrons?.user_id) {
        fireNotice('renewal', {
          userId: loan.patrons.user_id,
          itemTitle: loan.catalogue_items?.title ?? 'Library item',
          loanId: loan.id,
          dueDate: newDue,
        });
      }

      setCiAlert({ type: 'success', msg: `Renewed "${loan.catalogue_items?.title}" — now due ${newDue}.` });
      setCheckinResults([]);
      setCheckinQuery('');
    } catch (err) {
      setCiAlert({ type: 'error', msg: err instanceof Error ? err.message : 'Renewal failed.' });
    } finally {
      setCiLoading(false);
    }
  };

  // ── Holds ───────────────────────────────────────────────────────────────────
  const checkoutFromHold = async (hold: HoldRow) => {
    if (!serverReachable) {
      setCoAlert({ type: 'error', msg: 'Hold fulfilment requires a connection — complete it when the desk is back online.' });
      setTab('holds');
      return;
    }
    setCoLoading(true);
    setCoAlert(null);
    try {
      const { data: freshHold } = await supabase
        .from('reservations')
        .select('id, status, patron_id, catalogue_item_id')
        .eq('id', hold.id)
        .maybeSingle();
      if (!freshHold || freshHold.status !== 'ready_for_collection') {
        setCoAlert({ type: 'error', msg: 'Hold is no longer eligible for checkout.' });
        void fetchHolds();
        return;
      }
      const { data: existingLoan } = await supabase
        .from('loans')
        .select('id')
        .eq('catalogue_item_id', freshHold.catalogue_item_id)
        .eq('status', 'active')
        .maybeSingle();
      if (existingLoan) {
        setCoAlert({ type: 'error', msg: 'Item is already checked out.' });
        return;
      }
      const { error: loanError } = await supabase
        .from('loans')
        .insert({
          patron_id: freshHold.patron_id,
          catalogue_item_id: freshHold.catalogue_item_id,
          checkout_date: new Date().toISOString(),
          due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
          status: 'active',
        });
      if (loanError) {
        setCoAlert({ type: 'error', msg: 'Checkout failed: ' + loanError.message });
        return;
      }
      await supabase
        .from('reservations')
        .update({ status: 'fulfilled' })
        .eq('id', freshHold.id);
      setCoAlert({ type: 'success', msg: 'Checked out from hold.' });
      void fetchHolds();
    } catch (err) {
      setCoAlert({ type: 'error', msg: err instanceof Error ? err.message : 'Checkout from hold failed.' });
    } finally {
      setCoLoading(false);
    }
  };

  const fetchHolds = async () => {
    const { data } = await supabase
      .from('reservations')
      .select('id, status, priority, created_at, catalogue_items(title), patrons(full_name, patron_id)')
      .eq('status', 'pending')
      .order('created_at');
    setHolds((data ?? []) as unknown as HoldRow[]);
  };

  const placeHold = async () => {
    if (!holdsPatron || !holdsItem) return;
    if (!serverReachable) {
      setHoldsAlert({ type: 'error', msg: 'Placing holds requires a connection.' });
      return;
    }
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
    void fetchHolds();
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
        placeholder="Search item by title, call number or scan barcode…"
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
    { id: 'offline',  label: `Offline Queue${off.queue.length > 0 ? ` (${off.queue.length})` : ''}` },
  ] as const;

  const [scannerOpen, setScannerOpen] = useState(false);
  const scanner = useBarcodeScanner({
    mode: 'catalogue',
    onDetected: (code: string) => {
      setItemQuery(code);
      setScannerOpen(false);
    },
  });
  useEffect(() => {
    if (scanner.lastCode) {
      setItemQuery(scanner.lastCode);
      void searchItems(scanner.lastCode);
    }
  }, [scanner.lastCode]);

  const alertCls = (type: string) =>
    type === 'success' ? 'bg-green-50 text-green-800' :
    type === 'warning' ? 'bg-amber-50 text-amber-800' :
    'bg-red-50 text-red-800';

  const stateBadge =
    off.state === 'ONLINE' ? 'bg-green-100 text-green-700' :
    off.state === 'SYNCING' ? 'bg-blue-100 text-blue-700' :
    off.state === 'DEGRADED' ? 'bg-amber-100 text-amber-700' :
    'bg-red-100 text-red-700';
  const stateDot =
    off.state === 'ONLINE' ? 'bg-green-500' :
    off.state === 'SYNCING' ? 'bg-blue-500' :
    off.state === 'DEGRADED' ? 'bg-amber-500' :
    'bg-red-500';

  const offlineEligible = off.canOperateOffline && !cacheIsStale(off.cache);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Circulation</h1>
          <p className="text-gray-600 mt-1">Check out, check in, renew, and manage patron holds.</p>
        </div>
        <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full ${stateBadge}`}>
          <span className={`w-2 h-2 rounded-full ${stateDot}`} />
          {off.state}
        </div>
      </div>

      {/* Connectivity / queue banner */}
      {off.state === 'OFFLINE' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 font-medium">
          Offline — checkout, check-in and renewal are validated against the local desk cache and queued durably.
          They will sync (in order, duplicate-safe) when the connection returns.
          {!off.session && ' No staff session yet — connect once to sign in for offline work.'}
        </div>
      )}
      {off.state === 'DEGRADED' && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium">
          Server unreachable — transactions are being queued locally. {off.lastError ?? ''}
        </div>
      )}
      {off.state === 'ONLINE' && (off.pendingCount > 0 || off.conflictCount > 0) && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 font-medium flex items-center justify-between gap-3">
          <span>
            {off.pendingCount > 0 && `${off.pendingCount} queued transaction(s) waiting to sync. `}
            {off.conflictCount > 0 && `${off.conflictCount} conflict(s) need a librarian decision.`}
          </span>
          <button onClick={() => setTab('offline')} className="btn-secondary text-xs py-1 px-2">
            Open Offline Queue
          </button>
        </div>
      )}
      {off.state === 'ONLINE' && off.cache && off.staleCache && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium flex items-center justify-between gap-3">
          <span>Offline cache has expired — refresh before starting offline work.</span>
          <button onClick={() => void off.refreshCache()} className="btn-secondary text-xs py-1 px-2" disabled={off.cacheLoading}>
            {off.cacheLoading ? 'Refreshing…' : 'Refresh Cache'}
          </button>
        </div>
      )}
      {!off.session && off.state !== 'ONLINE' && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium">
          Offline operations require an active staff session. Reconnect once to sign in.
        </div>
      )}

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
              onQuery={(q) => void searchPatrons(q)}
              onSelect={(p) => { setSelectedPatron(p); setPatronResults([]); }}
            />
            {selectedPatron && (
              <div className="p-3 bg-blue-50 rounded-lg text-sm">
                <strong>{selectedPatron.full_name}</strong> — {selectedPatron.patron_category}
                <span className="text-gray-500"> · Due in {durationDaysFor(selectedPatron.patron_category)} days → {dueDate(selectedPatron)}</span>
              </div>
            )}
          </div>

          <div className="card space-y-4">
            <h2 className="font-semibold text-lg">2. Find Item</h2>
            <ItemDropdown
              query={itemQuery}
              results={itemResults}
              onQuery={(q) => void searchItems(q)}
              onSelect={(it) => { setSelectedItem(it); setItemResults([]); }}
            />
            <button
              onClick={() => setScannerOpen(true)}
              className="btn-secondary mt-2"
              title="Scan Barcode"
            >
              Scan Barcode
            </button>
            {selectedItem && (
              <div className={`p-3 rounded-lg text-sm ${selectedItem.available_copies > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <strong>{selectedItem.title}</strong>
                <span className="text-gray-600"> — {selectedItem.available_copies}/{selectedItem.total_copies} available</span>
              </div>
            )}
            {!serverReachable && (
              <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-800">
                Offline mode: eligibility is checked against the local cache
                {offlineEligible ? ' (cache ready).' : ' (cache not ready — reconnect to preload before checking out).'}
              </div>
            )}
          </div>

          <button
            onClick={() => void handleCheckout()}
            disabled={!selectedPatron || !selectedItem || coLoading}
            className="btn-primary w-full py-3 text-base disabled:opacity-50"
          >
            {coLoading ? 'Processing…' : serverReachable ? 'Check Out' : 'Check Out (Queue Offline)'}
          </button>
        </div>
      )}

      {/* ── Check In / Renew ─────────────────────────────────── */}
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
              placeholder="Search by patron name, title, call number or barcode…"
              value={checkinQuery}
              onChange={(e) => void searchLoans(e.target.value)}
            />
            {!serverReachable && (
              <p className="text-xs text-amber-700">Offline: results come from the local desk cache.</p>
            )}
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
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => void handleCheckin(loan)}
                              disabled={ciLoading}
                              className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
                            >
                              Return
                            </button>
                            <button
                              onClick={() => void handleRenew(loan)}
                              disabled={ciLoading}
                              className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50"
                              title="Renew loan"
                            >
                              Renew
                            </button>
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
      )}

      {/* ── Holds ─────────────────────────────────────────────── */}
      {tab === 'holds' && (
        <div className="space-y-6">
          {!serverReachable && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium">
              Hold placement and fulfilment require a connection. Returns (check-in) remain available offline.
            </div>
          )}
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
                onQuery={(q) => { setHoldsPatronQuery(q); void searchPatrons(q); }}
                onSelect={(p) => { setHoldsPatron(p); setPatronResults([]); setHoldsPatronQuery(p.full_name); }}
              />
            </div>
            <div>
              <label className="label">Item</label>
              <ItemDropdown
                query={holdsItemQuery}
                results={itemResults}
                onQuery={(q) => { setHoldsItemQuery(q); void searchItems(q); }}
                onSelect={(it) => { setHoldsItem(it); setItemResults([]); setHoldsItemQuery(it.title); }}
              />
            </div>
            <button
              onClick={() => void placeHold()}
              disabled={!holdsPatron || !holdsItem || !serverReachable}
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
                      <td className="p-3">
                        {h.status === 'ready_for_collection' && (
                          <button
                            onClick={() => void checkoutFromHold(h)}
                            disabled={coLoading}
                            className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
                          >
                            Check Out
                          </button>
                        )}
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
      {tab === 'offline' && <OfflinePanel offline={off} />}

      {scannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="font-semibold text-lg">Scan Barcode</h3>
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: 240 }}>
              <video ref={scanner.videoRef} className="w-full" autoPlay playsInline muted />
              {!scanner.error && scanner.status !== 'scanning' && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                  <button onClick={() => void scanner.start()} className="btn-primary">Start Camera</button>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">Point camera at barcode. Scan populates the item search field (works offline against the cached barcode index).</p>
            <div className="flex gap-2">
              {scanner.status === 'scanning' && (
                <button onClick={() => void scanner.stop()} className="btn-secondary flex-1">Stop</button>
              )}
              <button onClick={() => { void scanner.stop(); setScannerOpen(false); }} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
