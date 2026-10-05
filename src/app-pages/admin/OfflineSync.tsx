import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

interface WorkstationRow {
  device_id: string;
  label: string | null;
  branch: string | null;
  registered_by: string | null;
  registered_at: string | null;
  last_seen_at: string | null;
  last_sync_at: string | null;
  last_seq: number | null;
}

interface TxnRow {
  client_txn_id: string;
  device_id: string;
  operator_id: string | null;
  queued_by: string | null;
  operation: string;
  local_seq: number;
  status: string;
  conflict_code: string | null;
  message: string | null;
  resolution: string | null;
  resolution_note: string | null;
  attempts: number | null;
  created_at: string;
  updated_at: string;
  applied_at: string | null;
}

interface MonitoringPayload {
  workstations: WorkstationRow[];
  recent: TxnRow[];
  counts: Record<string, number>;
}

const STATUS_STYLE: Record<string, string> = {
  APPLIED: 'bg-green-100 text-green-800',
  ALREADY_APPLIED: 'bg-green-100 text-green-800',
  PENDING: 'bg-amber-100 text-amber-800',
  RETRYABLE_ERROR: 'bg-amber-100 text-amber-800',
  CONFLICT: 'bg-red-100 text-red-800',
  REJECTED: 'bg-red-100 text-red-800',
};

const EMPTY: MonitoringPayload = { workstations: [], recent: [], counts: {} };

export default function OfflineSync() {
  const [data, setData] = useState<MonitoringPayload>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not signed in.');
      const res = await fetch('/api/admin/offline-sync', { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        throw new Error(body?.error ?? `Monitoring request failed (${res.status}).`);
      }
      setData({ workstations: body.workstations ?? [], recent: body.recent ?? [], counts: body.counts ?? {} });
      setLastLoaded(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load offline sync monitoring.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total = Object.values(data.counts).reduce((sum, n) => sum + n, 0);
  const visible = statusFilter ? data.recent.filter((t) => t.status === statusFilter) : data.recent;
  const statuses = Object.keys(data.counts).sort();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Offline Sync Monitoring</h1>
          <p className="text-gray-600 mt-1">
            Read-only view of offline workstations, ledger status counts and the latest transactions.
          </p>
        </div>
        <button onClick={() => void load()} className="btn-secondary" disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 font-medium">
          {error}
        </div>
      )}

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="card text-center">
          <div className="text-2xl font-bold">{total}</div>
          <div className="text-xs text-gray-500 mt-1">Ledger rows (sample ≤1000)</div>
        </div>
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={`card text-center transition-opacity ${statusFilter && statusFilter !== s ? 'opacity-50' : ''}`}
          >
            <div className="text-2xl font-bold">{data.counts[s]}</div>
            <div className="text-xs text-gray-500 mt-1">{s}</div>
          </button>
        ))}
      </div>

      {/* Workstations */}
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Registered Workstations ({data.workstations.length})</h2>
          {lastLoaded && (
            <span className="text-xs text-gray-500">Loaded {format(lastLoaded, 'HH:mm:ss')}</span>
          )}
        </div>
        {data.workstations.length === 0 ? (
          <p className="text-sm text-gray-400">No workstations have synced yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left p-3 font-semibold">Device</th>
                <th className="text-left p-3 font-semibold">Label</th>
                <th className="text-left p-3 font-semibold">Branch</th>
                <th className="text-left p-3 font-semibold">Last Seq</th>
                <th className="text-left p-3 font-semibold">Last Seen</th>
                <th className="text-left p-3 font-semibold">Last Sync</th>
              </tr>
            </thead>
            <tbody>
              {data.workstations.map((w) => (
                <tr key={w.device_id} className="border-b">
                  <td className="p-3 font-mono text-xs">{w.device_id}</td>
                  <td className="p-3">{w.label ?? '—'}</td>
                  <td className="p-3">{w.branch ?? '—'}</td>
                  <td className="p-3">{w.last_seq ?? '—'}</td>
                  <td className="p-3 text-xs text-gray-500">{w.last_seen_at ? format(new Date(w.last_seen_at), 'dd MMM yyyy HH:mm') : '—'}</td>
                  <td className="p-3 text-xs text-gray-500">{w.last_sync_at ? format(new Date(w.last_sync_at), 'dd MMM yyyy HH:mm') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent transactions */}
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">
            Recent Transactions ({visible.length}{statusFilter ? ` of ${data.recent.length}` : ''})
          </h2>
          {statusFilter && (
            <button onClick={() => setStatusFilter('')} className="btn-secondary text-xs py-1 px-2">
              Clear filter
            </button>
          )}
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-gray-400">No transactions recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left p-3 font-semibold">Seq</th>
                <th className="text-left p-3 font-semibold">Op</th>
                <th className="text-left p-3 font-semibold">Status</th>
                <th className="text-left p-3 font-semibold">Conflict / Message</th>
                <th className="text-left p-3 font-semibold">Resolution</th>
                <th className="text-left p-3 font-semibold">Attempts</th>
                <th className="text-left p-3 font-semibold">Device</th>
                <th className="text-left p-3 font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={`${t.device_id}:${t.local_seq}:${t.client_txn_id}`} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-mono text-xs">{t.local_seq}</td>
                  <td className="p-3 font-medium">{t.operation}</td>
                  <td className="p-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[t.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-gray-600 max-w-xs truncate">
                    {t.conflict_code ? <strong>{t.conflict_code}: </strong> : null}
                    {t.message ?? '—'}
                  </td>
                  <td className="p-3 text-xs">
                    {t.resolution ? `${t.resolution}${t.resolution_note ? ` — ${t.resolution_note}` : ''}` : '—'}
                  </td>
                  <td className="p-3">{t.attempts ?? 0}</td>
                  <td className="p-3 font-mono text-xs">{t.device_id}</td>
                  <td className="p-3 text-xs text-gray-500">{format(new Date(t.updated_at), 'dd MMM HH:mm')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
