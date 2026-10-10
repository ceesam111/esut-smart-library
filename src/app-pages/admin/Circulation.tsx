import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { differenceInDays } from 'date-fns';
import { useI18n } from '@/lib/i18n';
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
  const { t, formatDate, formatCurrency } = useI18n();
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
  }, [off]);

  // Preload the offline desk cache while the server is reachable.
  useEffect(() => {
    if (off.serverReachable && !off.cache && !off.cacheLoading) void off.refreshCache();
  }, [off.serverReachable, off]);

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
  const searchItems = useCallback(async (q: string) => {
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
  }, [serverReachable, off.cache]);

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
        setCoAlert({ type: 'error', msg: res.reason ?? t('circulation.couldNotQueueCheckout') });
      } else {
        setCoAlert({ type: 'warning', msg: t('circulation.checkoutQueued', { name: selectedPatron.full_name }) });
        resetCheckout();
      }
      setCoLoading(false);
      return;
    }

    const due = dueDate(selectedPatron);
    try {
      if ((selectedItem.available_copies ?? 0) <= 0) {
        throw new Error(t('circulation.noCopiesAvailable'));
      }

      const maxAllowed = maxItemsFor(selectedPatron.patron_category);
      const { count: activeLoanCount, error: countErr } = await supabase
        .from('loans')
        .select('id', { count: 'exact', head: true })
        .eq('patron_id', selectedPatron.id)
        .eq('status', 'active');
      if (countErr) throw countErr;
      if ((activeLoanCount ?? 0) >= maxAllowed) {
        throw new Error(t('circulation.maxLoansReached', { name: selectedPatron.full_name, count: activeLoanCount ?? 0, category: selectedPatron.patron_category, max: maxAllowed }));
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

      setCoAlert({ type: 'success', msg: t('circulation.checkoutSuccess', { title: selectedItem.title, name: selectedPatron.full_name, due }) });
      resetCheckout();
      void off.refreshCache();
    } catch (err) {
      setCoAlert({ type: 'error', msg: err instanceof Error ? err.message : t('circulation.checkoutFailed') });
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
        if (!res.ok) throw new Error(res.reason ?? t('circulation.couldNotQueueCheckin'));
        setCiAlert({ type: 'warning', msg: t('circulation.checkinQueued', { title: loan.catalogue_items?.title }) });
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
        notes: fine > 0 ? t('circulation.fineApplied', { amount: formatCurrency(fine) }) : '',
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

      const fineMsg = fine > 0 ? ` ${t('circulation.fineApplied', { amount: formatCurrency(fine) })}` : '';
      const examMsg = isExamPeriod() ? ` ${t('circulation.examPeriodNote')}` : '';
      setCiAlert({
        type: 'success',
        msg: t('circulation.checkinSuccess', { title: loan.catalogue_items?.title, fine: fineMsg, exam: examMsg }),
      });
      setCheckinResults([]);
      setCheckinQuery('');
      void off.refreshCache();
    } catch (err) {
      setCiAlert({ type: 'error', msg: err instanceof Error ? err.message : t('circulation.checkinFailed') });
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
        if (!res.ok) throw new Error(res.reason ?? t('circulation.couldNotQueueRenewal'));
        setCiAlert({ type: 'warning', msg: t('circulation.renewalQueued', { name: loan.patrons?.full_name }) });
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
        throw new Error(t('circulation.renewalLimitReached', { max: maxRenewals, category: category ?? 'this patron' }));
      }
      if (Date.parse(loan.due_date) < Date.now()) {
        throw new Error(t('circulation.cannotRenewOverdue'));
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

      setCiAlert({ type: 'success', msg: t('circulation.renewalSuccess', { title: loan.catalogue_items?.title, due: newDue }) });
      setCheckinResults([]);
      setCheckinQuery('');
    } catch (err) {
      setCiAlert({ type: 'error', msg: err instanceof Error ? err.message : t('circulation.renewalFailed') });
    } finally {
      setCiLoading(false);
    }
  };

  // ── Holds ───────────────────────────────────────────────────────────────────
  const checkoutFromHold = async (hold: HoldRow) => {
    if (!serverReachable) {
      setCoAlert({ type: 'error', msg: t('circulation.holdFulfilmentOffline') });
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
        setCoAlert({ type: 'error', msg: t('circulation.holdNotEligible') });
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
        setCoAlert({ type: 'error', msg: t('circulation.alreadyCheckedOut') });
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
        setCoAlert({ type: 'error', msg: t('circulation.checkoutFailedInline', { message: loanError.message }) });
        return;
      }
      await supabase
        .from('reservations')
        .update({ status: 'fulfilled' })
        .eq('id', freshHold.id);
      setCoAlert({ type: 'success', msg: t('circulation.checkoutFromHold') });
      void fetchHolds();
    } catch (err) {
      setCoAlert({ type: 'error', msg: err instanceof Error ? err.message : t('circulation.checkoutFromHoldFailed') });
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
      setHoldsAlert({ type: 'error', msg: t('circulation.holdsRequireConnection') });
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
    if (error) { setHoldsAlert({ type: 'error', msg: t('circulation.holdFailed', { message: error.message }) }); return; }
    setHoldsAlert({ type: 'success', msg: t('circulation.holdPlaced', { name: holdsPatron.full_name, title: holdsItem.title }) });
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
        placeholder={t('circulation.searchPatronPlaceholder')}
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
        placeholder={t('circulation.searchItemPlaceholder')}
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
    { id: 'checkout', label: t('circulation.checkOut') },
    { id: 'checkin',  label: t('circulation.checkIn') },
    { id: 'holds',    label: t('circulation.holds', { count: holds.length > 0 ? ` (${holds.length})` : '' }) },
    { id: 'offline',  label: t('circulation.offlineQueue', { count: off.queue.length > 0 ? ` (${off.queue.length})` : '' }) },
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
  }, [scanner.lastCode, searchItems]);

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
          <h1 className="text-3xl font-bold">{t('circulation.circulationTitle')}</h1>
          <p className="text-gray-600 mt-1">{t('circulation.circulationSubtitle')}</p>
        </div>
        <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full ${stateBadge}`}>
          <span className={`w-2 h-2 rounded-full ${stateDot}`} />
          {off.state}
        </div>
      </div>

      {/* Connectivity / queue banner */}
      {off.state === 'OFFLINE' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 font-medium">
          {t('circulation.offlineModeNote')} {!off.session && t('circulation.noStaffSession')}
        </div>
      )}
      {off.state === 'DEGRADED' && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium">
          {t('circulation.serverUnreachable', { error: off.lastError ?? '' })}
        </div>
      )}
      {off.state === 'ONLINE' && (off.pendingCount > 0 || off.conflictCount > 0) && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 font-medium flex items-center justify-between gap-3">
          <span>
            {off.pendingCount > 0 && t('circulation.queuedTransactions', { count: off.pendingCount })}
            {off.conflictCount > 0 && t('circulation.conflictsNeedDecision', { count: off.conflictCount })}
          </span>
          <button onClick={() => setTab('offline')} className="btn-secondary text-xs py-1 px-2">
            {t('circulation.openOfflineQueue')}
          </button>
        </div>
      )}
      {off.state === 'ONLINE' && off.cache && off.staleCache && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium flex items-center justify-between gap-3">
          <span>{t('circulation.cacheExpired')}</span>
          <button onClick={() => void off.refreshCache()} className="btn-secondary text-xs py-1 px-2" disabled={off.cacheLoading}>
            {off.cacheLoading ? t('circulation.refreshing') : t('circulation.refreshCache')}
          </button>
        </div>
      )}
      {!off.session && off.state !== 'ONLINE' && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium">
          {t('circulation.staffSessionRequired')}
        </div>
      )}

      {isExamPeriod() && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium">
          {t('circulation.examPeriodFinesSuspended')}
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
            <h2 className="font-semibold text-lg">{t('circulation.findPatron')}</h2>
            <PatronDropdown
              query={patronQuery}
              results={patronResults}
              onQuery={(q) => void searchPatrons(q)}
              onSelect={(p) => { setSelectedPatron(p); setPatronResults([]); }}
            />
            {selectedPatron && (
              <div className="p-3 bg-blue-50 rounded-lg text-sm">
                <strong>{selectedPatron.full_name}</strong> — {selectedPatron.patron_category}
                <span className="text-gray-500"> · {t('circulation.dueInDays', { days: durationDaysFor(selectedPatron.patron_category), due: dueDate(selectedPatron) })}</span>
              </div>
            )}
          </div>

          <div className="card space-y-4">
            <h2 className="font-semibold text-lg">{t('circulation.findItem')}</h2>
            <ItemDropdown
              query={itemQuery}
              results={itemResults}
              onQuery={(q) => void searchItems(q)}
              onSelect={(it) => { setSelectedItem(it); setItemResults([]); }}
            />
            <button
              onClick={() => setScannerOpen(true)}
              className="btn-secondary mt-2"
              title={t('circulation.scanBarcodeTitle')}
            >
              {t('circulation.scanBarcode')}
            </button>
            {selectedItem && (
              <div className={`p-3 rounded-lg text-sm ${selectedItem.available_copies > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <strong>{selectedItem.title}</strong>
                <span className="text-gray-600"> — {selectedItem.available_copies}/{selectedItem.total_copies} available</span>
              </div>
            )}
            {!serverReachable && (
              <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-800">
                {t('circulation.offlineEligibility')}
                {offlineEligible ? t('circulation.cacheReady') : t('circulation.cacheNotReady')}
              </div>
            )}
          </div>

          <button
            onClick={() => void handleCheckout()}
            disabled={!selectedPatron || !selectedItem || coLoading}
            className="btn-primary w-full py-3 text-base disabled:opacity-50"
          >
            {coLoading ? t('circulation.processing') : serverReachable ? t('circulation.checkOut') : t('circulation.checkOutQueue')}
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
            <h2 className="font-semibold text-lg">{t('circulation.findActiveLoan')}</h2>
            <input
              type="text"
              className="input w-full"
              placeholder={t('circulation.searchLoanPlaceholder')}
              value={checkinQuery}
              onChange={(e) => void searchLoans(e.target.value)}
            />
            {!serverReachable && (
              <p className="text-xs text-amber-700">{t('circulation.offlineResultsNote')}</p>
            )}
          </div>

          {checkinResults.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">{t('circulation.tableItem')}</th>
                    <th className="text-left p-3 font-semibold">{t('circulation.tablePatron')}</th>
                    <th className="text-left p-3 font-semibold">{t('circulation.tableDue')}</th>
                    <th className="text-left p-3 font-semibold">{t('circulation.tableFine')}</th>
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
                          {fine > 0 ? t('circulation.fineCurrency', { amount: formatCurrency(fine) }) : isExamPeriod() ? t('circulation.dash') : t('circulation.zeroCurrency', { amount: formatCurrency(0) })}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => void handleCheckin(loan)}
                              disabled={ciLoading}
                              className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
                            >
                              {t('circulation.return')}
                            </button>
                            <button
                              onClick={() => void handleRenew(loan)}
                              disabled={ciLoading}
                              className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50"
                              title={t('circulation.renewLoanTitle')}
                            >
                              {t('circulation.renew')}
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
              {t('circulation.holdsOfflineNote')}
            </div>
          )}
          <div className="max-w-xl card space-y-4">
            <h2 className="font-semibold text-lg">{t('circulation.placeHold')}</h2>
            {holdsAlert && (
              <div className={`p-3 rounded-lg text-sm font-medium ${alertCls(holdsAlert.type)}`}>
                {holdsAlert.msg}
              </div>
            )}
            <div>
              <label className="label">{t('circulation.patron')}</label>
              <PatronDropdown
                query={holdsPatronQuery}
                results={patronResults}
                onQuery={(q) => { setHoldsPatronQuery(q); void searchPatrons(q); }}
                onSelect={(p) => { setHoldsPatron(p); setPatronResults([]); setHoldsPatronQuery(p.full_name); }}
              />
            </div>
            <div>
              <label className="label">{t('circulation.item')}</label>
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
              {t('circulation.placeHoldButton')}
            </button>
          </div>

          <div className="card overflow-x-auto">
            <h2 className="font-semibold text-lg mb-4">{t('circulation.activeHoldQueue')}</h2>
            {holds.length === 0 ? (
              <p className="text-gray-400 text-sm">{t('circulation.noPendingHolds')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">{t('circulation.priority')}</th>
                    <th className="text-left p-3 font-semibold">{t('circulation.item')}</th>
                    <th className="text-left p-3 font-semibold">{t('circulation.patron')}</th>
                    <th className="text-left p-3 font-semibold">{t('circulation.requested')}</th>
                    <th className="text-left p-3 font-semibold">{t('circulation.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {holds.map((h) => (
                    <tr key={h.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-bold text-primary-700">{h.priority}</td>
                      <td className="p-3 font-medium">{h.catalogue_items?.title}</td>
                      <td className="p-3 text-gray-600">{h.patrons?.full_name} <span className="text-xs">({h.patrons?.patron_id})</span></td>
                      <td className="p-3 text-sm text-gray-500">{formatDate(h.created_at)}</td>
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
                            {t('circulation.checkOut')}
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
            <h3 className="font-semibold text-lg">{t('circulation.scanBarcodeModal')}</h3>
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: 240 }}>
              <video ref={scanner.videoRef} className="w-full" autoPlay playsInline muted />
              {!scanner.error && scanner.status !== 'scanning' && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                  <button onClick={() => void scanner.start()} className="btn-primary">{t('circulation.startCamera')}</button>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">{t('circulation.cameraHint')}</p>
            <div className="flex gap-2">
              {scanner.status === 'scanning' && (
                <button onClick={() => void scanner.stop()} className="btn-secondary flex-1">{t('circulation.stop')}</button>
              )}
              <button onClick={() => { void scanner.stop(); setScannerOpen(false); }} className="btn-secondary flex-1">{t('circulation.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
