import { useState } from 'react';
import type { OfflineCirculation } from '@/lib/offline/useOfflineCirculation';

const STATE_BADGE: Record<string, { cls: string; label: string }> = {
  pending: { cls: 'bg-blue-100 text-blue-800', label: 'Queued' },
  conflict: { cls: 'bg-amber-100 text-amber-800', label: 'Conflict' },
  rejected: { cls: 'bg-red-100 text-red-800', label: 'Rejected' },
};

const CONFLICT_LABELS: Record<string, string> = {
  ITEM_ALREADY_CHECKED_OUT: 'Item already checked out',
  ITEM_CHECKED_OUT_TO_DIFFERENT_PATRON: 'Checked out to another patron',
  ITEM_ALREADY_RETURNED: 'Already returned',
  ITEM_NOT_FOUND: 'Item not found',
  PATRON_NOT_FOUND: 'Patron not found',
  PATRON_BLOCKED: 'Patron suspended',
  PATRON_EXPIRED: 'Patron expired',
  MAX_LOANS_REACHED: 'Loan limit reached',
  LOAN_NOT_FOUND: 'Loan not found',
  LOAN_OVERDUE: 'Loan overdue',
  RENEWAL_LIMIT_REACHED: 'Renewal limit reached',
  HOLD_CONFLICT: 'Blocked by hold',
  RULE_CHANGED: 'Rules changed',
  STALE_CACHE: 'Cache stale',
  OPERATOR_MISMATCH: 'Different operator',
  REQUIRES_ONLINE: 'Requires connection',
  INVALID_PAYLOAD: 'Invalid payload',
  SYNC_IN_PROGRESS: 'Sync in progress',
  UNKNOWN_ERROR: 'Server error',
};

const OVERRIDEABLE = new Set(['MAX_LOANS_REACHED', 'RENEWAL_LIMIT_REACHED', 'STALE_CACHE', 'HOLD_CONFLICT']);

interface Props {
  offline: OfflineCirculation;
}

export default function OfflinePanel({ offline }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: string; msg: string } | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setMessage({ type: 'error', msg: err instanceof Error ? err.message : 'Action failed.' });
    } finally {
      setBusy(false);
    }
  };

  const handleSync = () =>
    run(async () => {
      const res = await offline.syncNow();
      if (!res.ok) {
        setMessage({ type: 'error', msg: res.error ?? 'Sync failed.' });
        return;
      }
      const s = res.summary;
      if (!s) {
        setMessage({ type: 'success', msg: 'Nothing to sync — queue is empty.' });
        return;
      }
      const parts: string[] = [];
      if (s.applied) parts.push(`${s.applied} applied`);
      if (s.already_applied) parts.push(`${s.already_applied} duplicate(s) ignored`);
      if (s.conflicts) parts.push(`${s.conflicts} conflict(s)`);
      if (s.rejected) parts.push(`${s.rejected} rejected`);
      if (s.retryable) parts.push(`${s.retryable} retry later`);
      setMessage({
        type: s.conflicts || s.rejected ? 'warning' : 'success',
        msg: `Sync complete: ${parts.join(', ') || 'no changes'}.`,
      });
    });

  const handleResolve = (clientTxnId: string, action: 'retry' | 'accept_server' | 'cancel' | 'override') =>
    run(async () => {
      let note = '';
      if (action === 'override') {
        const input = window.prompt('Override note (required — recorded in the audit log):');
        if (!input || !input.trim()) {
          setMessage({ type: 'warning', msg: 'Override cancelled — a note is required.' });
          return;
        }
        note = input.trim();
      } else if (action !== 'retry') {
        note = window.prompt('Resolution note (optional):') ?? '';
      }
      const res = await offline.resolve(clientTxnId, action, note);
      setMessage({
        type: 'success',
        msg: res.message ?? `Resolved (${action}).`,
      });
    });

  const { queue, pendingCount, conflictCount, lastSync, staleCache, cache, state } = offline;

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 text-sm">
            <span
              className={`font-semibold px-2.5 py-1 rounded-full ${
                state === 'ONLINE' ? 'bg-green-100 text-green-800' :
                state === 'SYNCING' ? 'bg-blue-100 text-blue-800' :
                state === 'DEGRADED' ? 'bg-amber-100 text-amber-800' :
                'bg-red-100 text-red-800'
              }`}
            >
              {state}
            </span>
            <span className="text-gray-600">{pendingCount} queued · {conflictCount} need review</span>
            {lastSync && <span className="text-gray-400 text-xs">Last sync: {new Date(lastSync).toLocaleString()}</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => void offline.refreshCache()} disabled={busy || offline.cacheLoading} className="btn-secondary text-sm disabled:opacity-50">
              {offline.cacheLoading ? 'Refreshing…' : 'Refresh Cache'}
            </button>
            <button
              onClick={() => void handleSync()}
              disabled={busy || offline.syncing || state === 'OFFLINE' || pendingCount === 0}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {offline.syncing || busy ? 'Syncing…' : `Sync Now (${pendingCount})`}
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
          <span>Cache: {cache ? `loaded ${new Date(cache.fetched_at).toLocaleString()}` : 'not loaded'}</span>
          {cache && <span>{cache.patrons.length} patrons · {cache.items.length} items · {cache.loans.length} active loans</span>}
          {staleCache && <span className="text-amber-600 font-semibold">Cache expired — reconnect to refresh before offline checkout.</span>}
          {offline.session && <span>Signed-in offline: {offline.session.email} (until {new Date(offline.session.expires_at).toLocaleTimeString()})</span>}
          {offline.lastError && <span className="text-red-600">Last error: {offline.lastError}</span>}
        </div>

        {message && (
          <div
            className={`p-3 rounded-lg text-sm font-medium ${
              message.type === 'success' ? 'bg-green-50 text-green-800' :
              message.type === 'warning' ? 'bg-amber-50 text-amber-800' :
              'bg-red-50 text-red-800'
            }`}
          >
            {message.msg}
          </div>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="card text-center text-gray-400 py-12">No offline transactions queued.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left p-3 font-semibold">#</th>
                <th className="text-left p-3 font-semibold">Type</th>
                <th className="text-left p-3 font-semibold">Patron</th>
                <th className="text-left p-3 font-semibold">Item</th>
                <th className="text-left p-3 font-semibold">Queued</th>
                <th className="text-left p-3 font-semibold">State</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {queue.map((tx) => {
                const badge = STATE_BADGE[tx.state] ?? STATE_BADGE.pending;
                const codeLabel = tx.conflict_code ? CONFLICT_LABELS[tx.conflict_code] ?? tx.conflict_code : null;
                return (
                  <tr key={tx.client_txn_id} className="border-b hover:bg-gray-50 align-top">
                    <td className="p-3 text-gray-500">{tx.local_seq}</td>
                    <td className="p-3">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          tx.operation === 'checkout' ? 'bg-blue-100 text-blue-800' :
                          tx.operation === 'checkin' ? 'bg-green-100 text-green-800' :
                          'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {tx.operation}
                      </span>
                    </td>
                    <td className="p-3">{(tx.payload as { patron_name?: string }).patron_name ?? '—'}</td>
                    <td className="p-3 font-medium">{(tx.payload as { item_title?: string }).item_title ?? '—'}</td>
                    <td className="p-3 text-gray-500 text-xs">{new Date(tx.client_timestamp).toLocaleString()}</td>
                    <td className="p-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                        {tx.state === 'conflict' || tx.state === 'rejected' ? (codeLabel ?? badge.label) : badge.label}
                      </span>
                      {tx.message && tx.state !== 'pending' && (
                        <div className="text-xs text-gray-500 mt-1 max-w-xs">{tx.message}</div>
                      )}
                      {tx.attempts > 0 && tx.state === 'pending' && (
                        <div className="text-xs text-gray-400 mt-1">attempts: {tx.attempts}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1 items-end">
                        {tx.state === 'pending' && (
                          <button
                            onClick={() => void handleResolve(tx.client_txn_id, 'cancel')}
                            className="text-xs text-red-500 hover:underline"
                            disabled={busy}
                          >
                            Cancel
                          </button>
                        )}
                        {(tx.state === 'conflict' || tx.state === 'rejected') && (
                          <>
                            <button
                              onClick={() => void handleResolve(tx.client_txn_id, 'retry')}
                              className="text-xs text-blue-600 hover:underline"
                              disabled={busy}
                            >
                              Retry
                            </button>
                            <button
                              onClick={() => void handleResolve(tx.client_txn_id, 'accept_server')}
                              className="text-xs text-gray-600 hover:underline"
                              disabled={busy}
                            >
                              Accept server
                            </button>
                            {tx.conflict_code && OVERRIDEABLE.has(tx.conflict_code) && (
                              <button
                                onClick={() => void handleResolve(tx.client_txn_id, 'override')}
                                className="text-xs text-amber-700 hover:underline font-semibold"
                                disabled={busy}
                              >
                                Override…
                              </button>
                            )}
                            <button
                              onClick={() => void handleResolve(tx.client_txn_id, 'cancel')}
                              className="text-xs text-red-500 hover:underline"
                              disabled={busy}
                            >
                              Cancel
                            </button>
                          </>
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

      <p className="text-xs text-gray-400">
        Queued transactions are stored durably in this device&apos;s IndexedDB and survive page reloads and logout.
        Sync applies them on the server in queue order with duplicate-safe idempotency; conflicts wait here for a
        librarian decision. Hold fulfilment and patron registration require a connection.
      </p>
    </div>
  );
}
