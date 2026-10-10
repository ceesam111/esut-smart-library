import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useBarcodeScanner } from '@/features/barcode/useBarcodeScanner';

type Mode = 'AUTO' | 'CHECK_IN_ONLY' | 'CHECK_OUT_ONLY';

interface BranchRow {
  id: string;
  code: string;
  name: string;
  capacity: number;
  active: boolean;
}

interface OccupancyInfo {
  branchId: string;
  currentlyInside: number;
  capacity: number;
  availableSpaces: number;
  occupancyPct: number;
}

interface IdentityInfo {
  id: string;
  patronId: string;
  fullName: string;
  patronCategory: string;
  department: string | null;
  facultyCode: string | null;
}

interface ScanResultData {
  ok: boolean;
  event: 'CHECK_IN' | 'CHECK_OUT' | 'DUPLICATE' | 'DENIED' | null;
  errorCode: string | null;
  visit: { id: string; status: string; checked_in_at: string; checked_out_at: string | null; duration_minutes: number | null } | null;
  identity: IdentityInfo | null;
  visitor: { id: string; fullName: string } | null;
  occupancy: OccupancyInfo | null;
  timestamp: string;
}

interface ScanLogEntry {
  key: number;
  ok: boolean;
  event: string;
  errorCode: string | null;
  name: string;
  at: string;
}

interface PatronSearchRow {
  id: string;
  full_name: string;
  patron_category: string;
  department: string | null;
  patron_id: string | null;
  matric_number: string | null;
  staff_id: string | null;
  status: string;
  currentlyInside: boolean;
}

async function authFetch(url: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in.');
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || json.error || `Request failed with ${res.status}`);
  return json && json.success === true && 'data' in json ? json.data : json;
}

export default function AccessScanner() {
  const { t } = useI18n();
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [branchId, setBranchId] = useState('');
  const [mode, setMode] = useState<Mode>('AUTO');
  const [credential, setCredential] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResultData | null>(null);
  const [lastError, setLastError] = useState('');
  const [log, setLog] = useState<ScanLogEntry[]>([]);
  const [manualQuery, setManualQuery] = useState('');
  const [manualResults, setManualResults] = useState<PatronSearchRow[]>([]);
  const [manualBusy, setManualBusy] = useState(false);
  const logKeyRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch('/api/access/branches')
      .then((data: BranchRow[]) => {
        if (cancelled) return;
        const active = data.filter((b) => b.active);
        setBranches(active);
        if (active[0]) setBranchId(active[0].id);
      })
      .catch((err: Error) => { if (!cancelled) setLastError(err.message); });
    return () => { cancelled = true; };
  }, []);

  const submitScan = useCallback(async (rawCredential: string) => {
    const token = rawCredential.trim();
    if (!token) return;
    if (!branchId) { setLastError(t('slaas.selectBranch')); return; }
    setBusy(true);
    setLastError('');
    try {
      const result: ScanResultData = await authFetch('/api/access/scan', {
        method: 'POST',
        body: JSON.stringify({ credential: token, branchId, mode, idempotencyKey: crypto.randomUUID() }),
      });
      setLastResult(result);
      logKeyRef.current += 1;
      setLog((current) => [{
        key: logKeyRef.current,
        ok: result.ok,
        event: result.event ?? 'DENIED',
        errorCode: result.errorCode,
        name: result.identity?.fullName ?? '—',
        at: new Date(result.timestamp).toLocaleTimeString(),
      }, ...current].slice(0, 12));
    } catch (err) {
      setLastResult(null);
      setLastError((err as Error).message);
      logKeyRef.current += 1;
      setLog((current) => [{
        key: logKeyRef.current, ok: false, event: 'DENIED', errorCode: 'NETWORK_ERROR',
        name: '—', at: new Date().toLocaleTimeString(),
      }, ...current].slice(0, 12));
    } finally {
      setCredential('');
      setBusy(false);
      inputRef.current?.focus();
    }
  }, [branchId, mode, t]);

  const scanner = useBarcodeScanner({
    mode: 'qr',
    onDetected: (code) => submitScan(code),
  });

  const onFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void submitScan(credential);
  };

  async function searchManual() {
    const q = manualQuery.trim();
    if (q.length < 2) return;
    setManualBusy(true);
    setLastError('');
    try {
      const data = await authFetch('/api/access/manual', {
        method: 'POST',
        body: JSON.stringify({ action: 'search', query: q }),
      });
      setManualResults(data.results ?? []);
    } catch (err) {
      setLastError((err as Error).message);
    } finally {
      setManualBusy(false);
    }
  }

  async function manualAction(action: 'check_in' | 'check_out', target: PatronSearchRow & { visitId?: string }) {
    if (!branchId) { setLastError(t('slaas.selectBranch')); return; }
    setManualBusy(true);
    setLastError('');
    try {
      if (action === 'check_in') {
        await authFetch('/api/access/manual', {
          method: 'POST',
          body: JSON.stringify({ action: 'check_in', patronId: target.id, branchId }),
        });
        setLastResult({ ok: true, event: 'CHECK_IN', errorCode: null, visit: null, identity: null, visitor: null, occupancy: null, timestamp: new Date().toISOString() });
      } else {
        const openVisit = await authFetch('/api/access/visits?status=checked_in&pageSize=200');
        const match = (openVisit.rows as Array<{ id: string; patron_id: string }>).find((r) => r.patron_id === target.id);
        if (!match) { setLastError(t('slaas.notCurrentlyInside')); setManualBusy(false); return; }
        await authFetch('/api/access/manual', {
          method: 'POST',
          body: JSON.stringify({ action: 'check_out', visitId: match.id, branchId }),
        });
        setLastResult({ ok: true, event: 'CHECK_OUT', errorCode: null, visit: null, identity: null, visitor: null, occupancy: null, timestamp: new Date().toISOString() });
      }
      await searchManual();
    } catch (err) {
      setLastError((err as Error).message);
    } finally {
      setManualBusy(false);
    }
  }

  const resultHeading = useMemo(() => {
    if (!lastResult) return '';
    if (lastResult.ok && lastResult.event === 'CHECK_IN') return t('slaas.checkedIn');
    if (lastResult.ok && lastResult.event === 'CHECK_OUT') return t('slaas.checkedOut');
    const map: Record<string, string> = {
      DUPLICATE: t('slaas.duplicate'),
      INVALID_QR: t('slaas.invalidQr'),
      EXPIRED_QR: t('slaas.expiredQr'),
      REVOKED_QR: t('slaas.revokedQr'),
      USER_NOT_FOUND: t('slaas.userNotFound'),
      INACTIVE_ACCOUNT: t('slaas.inactiveAccount'),
      ACCESS_DENIED: t('slaas.accessDenied'),
      ALREADY_INSIDE: t('slaas.alreadyInside'),
      NOT_CURRENTLY_INSIDE: t('slaas.notCurrentlyInside'),
      BRANCH_NOT_FOUND: t('slaas.branchNotFound'),
      NETWORK_ERROR: t('slaas.networkError'),
      SYSTEM_ERROR: t('slaas.systemError'),
    };
    return lastResult.errorCode ? map[lastResult.errorCode] ?? lastResult.errorCode : t('slaas.systemError');
  }, [lastResult, t]);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-semibold text-primary-800">{t('slaas.scanner')}</h1>
        <p className="text-sm text-neutral-500">{t('slaas.cameraHint')}</p>
      </div>

      <section className="card p-4 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-neutral-600 font-medium">{t('slaas.branch')}</span>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="input mt-1" aria-label={t('slaas.selectBranch')}>
              <option value="">{t('slaas.selectBranch')}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <fieldset className="text-sm">
            <legend className="text-neutral-600 font-medium">{t('slaas.scanMode')}</legend>
            <div className="flex gap-2 mt-1">
              {([['AUTO', t('slaas.modeAuto')], ['CHECK_IN_ONLY', t('slaas.modeIn')], ['CHECK_OUT_ONLY', t('slaas.modeOut')]] as Array<[Mode, string]>).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setMode(value)} aria-pressed={mode === value}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === value ? 'bg-primary-700 text-white' : 'bg-white border border-neutral-200 text-neutral-700'}`}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <form onSubmit={onFormSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder={t('slaas.scanInputLabel')}
            aria-label={t('slaas.scanInputLabel')}
            autoFocus
            className="input flex-1 font-mono"
            autoComplete="off"
          />
          <button type="submit" disabled={busy} className="btn-primary px-5">{t('slaas.submitScan')}</button>
        </form>

        <div className="rounded-xl overflow-hidden bg-black min-h-56 flex items-center justify-center relative">
          <video ref={scanner.videoRef} className="w-full max-h-72 object-cover" playsInline muted autoPlay />
          {scanner.status !== 'scanning' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span className="text-white/70 text-sm">{t('slaas.cameraHint')}</span>
              <button type="button" onClick={() => void scanner.start()} className="btn-outline bg-white/10 text-white border-white/40">{t('slaas.startCamera')}</button>
            </div>
          )}
        </div>
        {scanner.status === 'scanning' && (
          <button type="button" onClick={() => void scanner.stop()} className="btn-outline w-full">{t('slaas.stopCamera')}</button>
        )}
        {scanner.error && <p className="text-xs text-red-600">{scanner.error}</p>}
      </section>

      <section className="card p-4" aria-live="polite" data-testid="scan-result">
        {lastError && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm font-medium" role="alert">{lastError}</div>
        )}
        {!lastError && !lastResult && <p className="text-sm text-neutral-500">{t('slaas.ready')}</p>}
        {lastResult && (
          <div className={`rounded-lg px-4 py-3 border ${lastResult.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className={`text-lg font-bold ${lastResult.ok ? 'text-green-800' : 'text-red-800'}`} data-testid="scan-result-label">
              {resultHeading}
            </div>
            {lastResult.identity && (
              <div className="mt-1 text-sm text-neutral-700">
                <span className="font-semibold">{lastResult.identity.fullName}</span>
                {' · '}{lastResult.identity.patronCategory}
                {lastResult.identity.department ? ` · ${lastResult.identity.department}` : ''}
              </div>
            )}
            {!lastResult.identity && lastResult.visitor && (
              <div className="mt-1 text-sm text-neutral-700">
                <span className="font-semibold">{lastResult.visitor.fullName}</span>
                {' · '}{t('slaas.visitor')}
              </div>
            )}
            {lastResult.occupancy && (
              <div className="mt-1 text-xs text-neutral-600">
                {t('slaas.currentlyInside')}: {lastResult.occupancy.currentlyInside}/{lastResult.occupancy.capacity} ({lastResult.occupancy.occupancyPct}%)
              </div>
            )}
            {lastResult.visit?.checked_in_at && (
              <div className="mt-1 text-xs text-neutral-600">
                {t('slaas.timestamp')}: {new Date(lastResult.visit.checked_in_at).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-semibold text-neutral-800 mb-3">{t('slaas.recentScans')}</h2>
        {log.length === 0 ? <p className="text-sm text-neutral-500">{t('slaas.noData')}</p> : (
          <div className="space-y-1.5">
            {log.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm">
                <span className="font-medium">{entry.name}</span>
                <span className={`text-xs font-semibold ${entry.ok ? 'text-green-700' : 'text-red-700'}`}>
                  {entry.ok ? entry.event : entry.errorCode ?? entry.event}
                </span>
                <span className="text-xs text-neutral-500">{entry.at}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold text-neutral-800">{t('slaas.manualOps')}</h2>
        <div className="flex gap-2">
          <input
            value={manualQuery}
            onChange={(e) => setManualQuery(e.target.value)}
            placeholder={t('slaas.searchPatron')}
            aria-label={t('slaas.searchPatron')}
            className="input flex-1"
          />
          <button type="button" onClick={() => void searchManual()} disabled={manualBusy} className="btn-outline px-4">{t('slaas.search')}</button>
        </div>
        {manualResults.length > 0 && (
          <div className="divide-y divide-neutral-100">
            {manualResults.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 gap-2">
                <div className="text-sm">
                  <span className="font-medium">{p.full_name}</span>
                  <span className="text-neutral-500"> · {p.patron_category}</span>
                  {p.currentlyInside && <span className="ml-2 text-xs font-semibold text-green-700 bg-green-50 rounded px-2 py-0.5">{t('slaas.insideBadge')}</span>}
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={manualBusy} onClick={() => void manualAction('check_in', p)} className="btn-outline text-xs px-3 py-1.5">{t('slaas.manualCheckIn')}</button>
                  <button type="button" disabled={manualBusy} onClick={() => void manualAction('check_out', p)} className="btn-outline text-xs px-3 py-1.5">{t('slaas.manualCheckOut')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
