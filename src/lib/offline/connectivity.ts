import type { ConnectivityState } from './types';

export interface ConnectivitySnapshot {
  state: ConnectivityState;
  serverTimeOffsetMs: number;
  lastProbeAt: string | null;
  lastError: string | null;
}

export interface ConnectivityMonitor {
  stop(): void;
  probeNow(): Promise<ConnectivitySnapshot>;
  getSnapshot(): ConnectivitySnapshot;
}

const PROBE_INTERVAL_MS = 15_000;
const PROBE_TIMEOUT_MS = 4_000;

async function probeHealth(signal: AbortSignal): Promise<{ ok: boolean; offsetMs: number; error: string | null }> {
  try {
    const res = await fetch('/api/health', { signal, cache: 'no-store' });
    if (!res.ok) return { ok: false, offsetMs: 0, error: `health ${res.status}` };
    const body = (await res.json().catch(() => null)) as { timestamp?: string } | null;
    const serverTs = body?.timestamp ? Date.parse(body.timestamp) : Number.NaN;
    return {
      ok: true,
      offsetMs: Number.isNaN(serverTs) ? 0 : serverTs - Date.now(),
      error: null,
    };
  } catch (err) {
    return { ok: false, offsetMs: 0, error: err instanceof Error ? err.message : 'probe failed' };
  }
}

/**
 * Connectivity state machine for the circulation desk:
 *  ONLINE   — navigator online AND health probe succeeded
 *  OFFLINE  — navigator offline event
 *  DEGRADED — navigator online but health probe failing (server unreachable)
 *  SYNCING  — set by the sync engine during an active sync
 *  SYNC_ERROR — last sync attempt failed while otherwise online
 */
export function startConnectivityMonitor(
  onChange: (snap: ConnectivitySnapshot) => void,
  options: { probeIntervalMs?: number } = {},
): ConnectivityMonitor {
  let snapshot: ConnectivitySnapshot = {
    state: typeof navigator !== 'undefined' && navigator.onLine === false ? 'OFFLINE' : 'ONLINE',
    serverTimeOffsetMs: 0,
    lastProbeAt: null,
    lastError: null,
  };
  let stopped = false;
  let inFlight: Promise<void> | null = null;

  const emit = () => onChange({ ...snapshot });

  const runProbe = async (): Promise<void> => {
    if (typeof navigator === 'undefined' || !navigator.onLine) {
      snapshot = { ...snapshot, state: 'OFFLINE', lastError: null };
      emit();
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const result = await probeHealth(controller.signal);
      if (stopped) return;
      snapshot = {
        state: result.ok ? 'ONLINE' : 'DEGRADED',
        serverTimeOffsetMs: result.ok ? result.offsetMs : snapshot.serverTimeOffsetMs,
        lastProbeAt: new Date().toISOString(),
        lastError: result.error,
      };
    } finally {
      clearTimeout(timer);
      emit();
    }
  };

  const probeNow = async (): Promise<ConnectivitySnapshot> => {
    if (inFlight) await inFlight;
    inFlight = runProbe().finally(() => {
      inFlight = null;
    });
    await inFlight;
    return { ...snapshot };
  };

  const handleOnline = () => {
    void probeNow();
  };
  const handleOffline = () => {
    snapshot = { ...snapshot, state: 'OFFLINE' };
    emit();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }
  const interval = setInterval(() => {
    if (!stopped && typeof navigator !== 'undefined' && navigator.onLine) void probeNow();
  }, options.probeIntervalMs ?? PROBE_INTERVAL_MS);

  void probeNow();

  return {
    stop() {
      stopped = true;
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    },
    probeNow,
    getSnapshot: () => ({ ...snapshot }),
  };
}
