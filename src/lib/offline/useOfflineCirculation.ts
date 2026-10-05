import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  computeDueDate,
  maxItemsFor,
  renewalsFor,
  rulesFingerprint,
} from '@/lib/circulationRules';
import { OfflineStore, offlineStore as defaultStore } from './store';
import {
  activeLoanFor,
  activeLoansForPatron,
  buildOfflineSession,
  cacheIsStale,
  patronEligibleOffline,
} from './cache';
import { startConnectivityMonitor, type ConnectivitySnapshot } from './connectivity';
import { refreshOfflineCache, resolveConflict, syncNow } from './sync';
import type {
  CacheItem,
  CacheLoan,
  CachePatron,
  ConnectivityState,
  OfflineSession,
  QueuedTx,
} from './types';

export interface EnqueueResult {
  ok: boolean;
  reason?: string;
  tx?: QueuedTx;
}

const LEGACY_KEY = 'circ_offline_queue';

export function useOfflineCirculation(store: OfflineStore = defaultStore) {
  const { user, role, roles } = useAuth();
  const [monitor, setMonitor] = useState<ConnectivitySnapshot>({
    state: 'ONLINE',
    serverTimeOffsetMs: 0,
    lastProbeAt: null,
    lastError: null,
  });
  const [syncing, setSyncing] = useState(false);
  const [queue, setQueue] = useState<QueuedTx[]>([]);
  const [session, setSession] = useState<OfflineSession | null>(null);
  const [cache, setCache] = useState<Awaited<ReturnType<OfflineStore['loadCache']>>>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [cacheLoading, setCacheLoading] = useState(false);
  const monitorRef = useRef<ReturnType<typeof startConnectivityMonitor> | null>(null);

  const reloadQueue = useCallback(async () => {
    setQueue(await store.listQueue());
    setLastSync(await store.getLastSync());
  }, [store]);

  useEffect(() => {
    let cancelled = false;
    monitorRef.current = startConnectivityMonitor((snap) => {
      if (!cancelled) setMonitor(snap);
    });
    void (async () => {
      const s = await store.loadSession();
      const c = await store.loadCache();
      if (cancelled) return;
      setSession(s);
      setCache(c);
      await reloadQueue();
    })();
    return () => {
      cancelled = true;
      monitorRef.current?.stop();
      monitorRef.current = null;
    };
  }, [store, reloadQueue]);

  // Grant (or refresh) the bounded offline staff session while online.
  useEffect(() => {
    if (!user || user.email === undefined) return;
    void (async () => {
      const existing = await store.loadSession();
      if (existing && existing.operator_id === user.id) return;
      const granted = buildOfflineSession(user.id, user.email ?? '', roles as string[]);
      await store.saveSession(granted);
      setSession(granted);
    })();
  }, [user, roles, store]);

  const isOffline = monitor.state === 'OFFLINE';
  const state: ConnectivityState = syncing ? 'SYNCING' : monitor.state === 'SYNCING' ? 'ONLINE' : monitor.state;
  const serverReachable = state === 'ONLINE';

  const ensureSession = useCallback(async (): Promise<OfflineSession | null> => {
    const existing = await store.loadSession();
    if (existing) {
      setSession(existing);
      return existing;
    }
    if (!user) return null;
    const granted = buildOfflineSession(user.id, user.email ?? '', roles as string[]);
    await store.saveSession(granted);
    setSession(granted);
    return granted;
  }, [store, user, roles]);

  const migrateLegacyQueue = useCallback(async () => {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    let legacy: Array<Record<string, unknown>>;
    try {
      legacy = JSON.parse(raw) as Array<Record<string, unknown>>;
    } catch {
      legacy = [];
    }
    if (!Array.isArray(legacy) || legacy.length === 0) {
      localStorage.removeItem(LEGACY_KEY);
      return;
    }
    const active = (await store.loadSession()) ?? (await ensureSession());
    if (!active) return;
    const fp = cache?.rules_fingerprint ?? rulesFingerprint();
    for (const old of legacy) {
      const type = String(old.type ?? 'checkout');
      if (type === 'checkout') {
        await store.enqueue(
          'checkout',
          {
            patron_id: String(old.patron_id ?? ''),
            catalogue_item_id: String(old.catalogue_item_id ?? ''),
            patron_name: String(old.patron_name ?? ''),
            item_title: String(old.item_title ?? ''),
            rules_fingerprint: fp,
          },
          active.operator_id,
        );
      } else if (type === 'checkin') {
        await store.enqueue(
          'checkin',
          {
            patron_id: String(old.patron_id ?? ''),
            catalogue_item_id: String(old.catalogue_item_id ?? ''),
            patron_name: String(old.patron_name ?? ''),
            item_title: String(old.item_title ?? ''),
          },
          active.operator_id,
        );
      }
    }
    localStorage.removeItem(LEGACY_KEY);
    await reloadQueue();
  }, [store, cache, ensureSession, reloadQueue]);

  const enqueueCheckout = useCallback(
    async (patron: CachePatron, item: CacheItem): Promise<EnqueueResult> => {
      const active = (await store.loadSession()) ?? (await ensureSession());
      if (!active) return { ok: false, reason: 'No active staff session. Reconnect once to sign in.' };
      const c = await store.loadCache();
      if (!c) return { ok: false, reason: 'Offline cache not ready — connect once to preload the desk cache.' };
      if (cacheIsStale(c)) {
        return { ok: false, reason: 'Offline cache has expired — reconnect to refresh before checking out.' };
      }
      const eligibility = patronEligibleOffline(patron);
      if (!eligibility.ok) return { ok: false, reason: eligibility.reason };

      const currentLoans = activeLoansForPatron(c, patron.id);
      const q = await store.listQueue();
      const queuedCheckouts = q.filter(
        (tx) =>
          tx.operation === 'checkout' &&
          tx.state !== 'rejected' &&
          (tx.payload as { patron_id?: string }).patron_id === patron.id,
      ).length;
      const returnedSince = q.filter(
        (tx) =>
          tx.operation === 'checkin' &&
          tx.state !== 'rejected' &&
          (tx.payload as { patron_id?: string }).patron_id === patron.id,
      ).length;
      const pendingCount = currentLoans.length + queuedCheckouts - returnedSince;
      const maxItems = maxItemsFor(patron.patron_category);
      if (pendingCount >= maxItems) {
        return {
          ok: false,
          reason: `${patron.full_name} already has ${pendingCount} active loan(s). Maximum for ${patron.patron_category} is ${maxItems}.`,
        };
      }

      const alreadyOut = activeLoanFor(c, patron.id, item.id);
      if (alreadyOut) return { ok: false, reason: 'Item is already checked out to this patron.' };
      if ((item.available_copies ?? 0) <= 0) return { ok: false, reason: 'No copies available (offline cache).' };

      const tx = await store.enqueue(
        'checkout',
        {
          patron_id: patron.id,
          catalogue_item_id: item.id,
          patron_name: patron.full_name,
          item_title: item.title,
          rules_fingerprint: c.rules_fingerprint,
        },
        active.operator_id,
      );
      await reloadQueue();
      return { ok: true, tx };
    },
    [store, ensureSession, reloadQueue],
  );

  const enqueueCheckin = useCallback(
    async (loan: Pick<CacheLoan, 'id' | 'patron_id' | 'catalogue_item_id'>, patronName: string, itemTitle: string): Promise<EnqueueResult> => {
      const active = (await store.loadSession()) ?? (await ensureSession());
      if (!active) return { ok: false, reason: 'No active staff session. Reconnect once to sign in.' };
      const tx = await store.enqueue(
        'checkin',
        {
          loan_id: loan.id,
          patron_id: loan.patron_id,
          catalogue_item_id: loan.catalogue_item_id,
          patron_name: patronName,
          item_title: itemTitle,
        },
        active.operator_id,
      );
      await reloadQueue();
      return { ok: true, tx };
    },
    [store, ensureSession, reloadQueue],
  );

  const enqueueRenew = useCallback(
    async (loan: CacheLoan, patron: CachePatron | null, itemTitle: string): Promise<EnqueueResult> => {
      const active = (await store.loadSession()) ?? (await ensureSession());
      if (!active) return { ok: false, reason: 'No active staff session. Reconnect once to sign in.' };
      if (!patron) return { ok: false, reason: 'Patron not found in offline cache.' };
      if (Date.parse(loan.due_date) < Date.now()) {
        return { ok: false, reason: 'Loan is overdue — overdue loans cannot be renewed.' };
      }
      const maxRenewals = renewalsFor(patron.patron_category);
      if ((loan.renewed_count ?? 0) >= maxRenewals) {
        return { ok: false, reason: `Renewal limit of ${maxRenewals} already reached.` };
      }
      const c = await store.loadCache();
      const foreignHold = c?.holds.some(
        (h) => h.catalogue_item_id === loan.catalogue_item_id && h.patron_id !== loan.patron_id && h.status === 'pending',
      );
      if (foreignHold) return { ok: false, reason: 'Another patron has a pending hold on this item — renewal blocked.' };

      const tx = await store.enqueue(
        'renew',
        {
          loan_id: loan.id,
          patron_id: loan.patron_id,
          catalogue_item_id: loan.catalogue_item_id,
          patron_name: patron.full_name,
          item_title: itemTitle,
        },
        active.operator_id,
      );
      await reloadQueue();
      return { ok: true, tx };
    },
    [store, ensureSession, reloadQueue],
  );

  const runSync = useCallback(async (): Promise<{ ok: boolean; summary?: Awaited<ReturnType<typeof syncNow>>; error?: string }> => {
    if (syncing) return { ok: false, error: 'Sync already in progress.' };
    setSyncing(true);
    setLastError(null);
    try {
      const token = await supabase.auth.getSession().then((r) => r.data.session?.access_token ?? null);
      if (!token) throw new Error('Authentication required — sign in while online to sync.');
      const summary = await syncNow({ store, getAccessToken: async () => token });
      await reloadQueue();
      const c = await store.loadCache();
      setCache(c);
      return { ok: true, summary };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed.';
      setLastError(message);
      return { ok: false, error: message };
    } finally {
      setSyncing(false);
    }
  }, [store, syncing, reloadQueue]);

  const refreshCache = useCallback(async () => {
    setCacheLoading(true);
    try {
      const token = await supabase.auth.getSession().then((r) => r.data.session?.access_token ?? null);
      if (!token) return null;
      const c = await refreshOfflineCache({ store, getAccessToken: async () => token, fetchFn: fetch });
      if (c) setCache(c);
      return c;
    } finally {
      setCacheLoading(false);
    }
  }, [store]);

  const resolve = useCallback(
    async (clientTxnId: string, action: 'retry' | 'accept_server' | 'cancel' | 'override', note: string) => {
      const token = await supabase.auth.getSession().then((r) => r.data.session?.access_token ?? null);
      const res = await resolveConflict(clientTxnId, action, note, {
        store,
        getAccessToken: async () => token,
        fetchFn: fetch,
      });
      await reloadQueue();
      return res;
    },
    [store, reloadQueue],
  );

  const logout = useCallback(async () => {
    await store.clearSession();
    setSession(null);
    // Queue is intentionally preserved across logout.
    await reloadQueue();
  }, [store, reloadQueue]);

  const pendingCount = useMemo(() => queue.filter((tx) => tx.state === 'pending').length, [queue]);
  const conflictCount = useMemo(
    () => queue.filter((tx) => tx.state === 'conflict' || tx.state === 'rejected').length,
    [queue],
  );
  const staleCache = useMemo(() => cacheIsStale(cache), [cache]);

  return {
    state,
    isOffline,
    serverReachable,
    isOnline: state === 'ONLINE' || state === 'DEGRADED' || state === 'SYNC_ERROR',
    canOperateOffline: !!session && !staleCache && !!cache,
    monitor,
    syncing,
    queue,
    session,
    cache,
    cacheLoading,
    staleCache,
    lastSync,
    lastError,
    pendingCount,
    conflictCount,
    userRole: role,
    ensureSession,
    migrateLegacyQueue,
    enqueueCheckout,
    enqueueCheckin,
    enqueueRenew,
    syncNow: runSync,
    refreshCache,
    resolve,
    logout,
    reloadQueue,
    computeDueDateFor: computeDueDate,
  };
}

export type OfflineCirculation = ReturnType<typeof useOfflineCirculation>;
