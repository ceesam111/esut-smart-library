'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface WorkflowInstance {
  id: string;
  current_state: string;
  status: string;
  created_by: string | null;
  repository_item_id: string | null;
  thesis_id: string | null;
  repository_items?: { title?: string; status?: string } | null;
  theses?: { title?: string; status?: string; reference_no?: string } | null;
  workflow_tasks?: Array<{ id: string; status: string; assigned_to: string | null; claimed_by: string | null }>;
}

interface WorkflowComment {
  id: string;
  body: string;
  is_private: boolean;
  created_at: string;
}

interface WorkflowHistoryRow {
  id?: string;
  action: string;
  previous_state?: string | null;
  new_state?: string | null;
  comment?: string | null;
  created_at?: string;
}

const STAFF_ROLES = [
  'super_admin',
  'catalog_admin',
  'ir_admin',
  'dept_ir_officer',
  'librarian',
  'faculty_librarian',
] as const;

const MANAGER_ROLES = ['super_admin', 'catalog_admin', 'ir_admin', 'librarian'] as const;

const STATE_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  SUPERVISOR_REVIEW: 'Supervisor review',
  DEPARTMENT_REVIEW: 'Department review',
  FACULTY_REVIEW: 'Faculty review',
  LIBRARY_METADATA_REVIEW: 'Library metadata review',
  COPYRIGHT_REVIEW: 'Copyright review',
  FINAL_APPROVAL: 'Final approval',
  RETURNED: 'Returned for correction',
  REJECTED: 'Rejected',
  PUBLISHED: 'Published',
  WITHDRAWN: 'Withdrawn',
};

const STAGE_ORDER = [
  'DRAFT',
  'SUBMITTED',
  'SUPERVISOR_REVIEW',
  'DEPARTMENT_REVIEW',
  'FACULTY_REVIEW',
  'LIBRARY_METADATA_REVIEW',
  'COPYRIGHT_REVIEW',
  'FINAL_APPROVAL',
  'PUBLISHED',
];

export default function WorkflowDashboard({ instanceId: instanceIdProp }: { instanceId?: string }) {
  const params = useParams<{ id?: string }>();
  const location = useLocation();
  const instanceId = instanceIdProp ?? params.id ?? '';
  const backHref = location.pathname.startsWith('/admin') ? '/admin/workflows' : '/dashboard/workflows';
  const { user, hasRole } = useAuth();

  const isStaff = hasRole(...STAFF_ROLES);
  const isManager = hasRole(...MANAGER_ROLES);

  const [instance, setInstance] = useState<WorkflowInstance | null>(null);
  const [comments, setComments] = useState<WorkflowComment[]>([]);
  const [history, setHistory] = useState<WorkflowHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [returning, setReturning] = useState(false);
  const [returnNotes, setReturnNotes] = useState('');
  const [reassignTo, setReassignTo] = useState('');

  const authHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error('You must be signed in.');
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` };
  }, []);

  const loadAll = useCallback(async () => {
    if (!instanceId) return;
    try {
      const headers = await authHeaders();
      const [instanceRes, commentsRes, historyRes] = await Promise.all([
        fetch(`/api/workflows/${instanceId}`, { headers }),
        fetch(`/api/workflows/${instanceId}/comments`, { headers }),
        fetch(`/api/workflows/${instanceId}/history`, { headers }),
      ]);
      const instanceJson = await instanceRes.json().catch(() => ({}));
      const commentsJson = await commentsRes.json().catch(() => ({}));
      const historyJson = await historyRes.json().catch(() => ({}));

      if (!instanceRes.ok) {
        setError(instanceJson.error || 'Failed to load workflow');
        setInstance(null);
        return;
      }
      setInstance(instanceJson.data ?? null);
      setComments(commentsJson.data ?? []);
      setHistory(historyJson.data ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workflow');
    } finally {
      setLoading(false);
    }
  }, [instanceId, authHeaders]);

  useEffect(() => {
    setLoading(true);
    void loadAll();
  }, [loadAll]);

  const runAction = async (body: Record<string, unknown>) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/workflows/${instanceId}/transition`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        setError(json.error || 'Action failed');
        return false;
      }
      setNotice('Updated.');
      await loadAll();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const runTaskAction = async (taskId: string, action: 'claim' | 'unclaim' | 'assign') => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const headers = await authHeaders();
      if (action === 'assign') {
        if (!reassignTo.trim()) {
          setError('Enter the user id to reassign to.');
          return;
        }
        const res = await fetch(`/api/workflows/${instanceId}/transition`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'reassign', taskId, assignTo: reassignTo.trim() }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
          setError(json.error || 'Reassignment failed');
          return;
        }
        setReassignTo('');
        setNotice('Task reassigned.');
        await loadAll();
        return;
      }

      const res = await fetch(`/api/workflows/${instanceId}/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ taskId, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        setError(json.error || 'Task action failed');
        return;
      }
      setNotice('Task updated.');
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setBusy(false);
    }
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/workflows/${instanceId}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ body: commentText.trim(), isPrivate }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Could not add comment');
        return;
      }
      setCommentText('');
      setIsPrivate(false);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    }
  };

  const confirmReturn = async () => {
    const ok = await runAction({ action: 'return_for_correction', comment: returnNotes.trim() });
    if (ok) {
      setReturning(false);
      setReturnNotes('');
    }
  };

  if (loading) return <div className="p-6 text-neutral-500">Loading workflow…</div>;
  if (!instance) return <div className="p-6 text-red-600">{error || 'Workflow not found'}</div>;

  const state = instance.current_state;
  const isTerminal = state === 'REJECTED' || state === 'WITHDRAWN';
  const isSubmitted = state !== 'DRAFT' && state !== 'RETURNED';
  const isCreator = !!user && instance.created_by === user.id;
  const pendingTask = (instance.workflow_tasks ?? []).find((t) => t.status === 'pending');
  const stageIndex = STAGE_ORDER.indexOf(state);

  const canSubmit = isCreator && (state === 'DRAFT' || state === 'RETURNED');
  const canWithdraw = (isCreator || isManager) && isSubmitted && !isTerminal;
  const canReview = isStaff && isSubmitted && !isTerminal && state !== 'PUBLISHED';
  const canPublish = isManager && state === 'FINAL_APPROVAL';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Submission workflow</h2>
          <p className="text-sm text-neutral-500">
            {instance.theses?.reference_no || instance.theses?.title || instance.repository_items?.title || 'Untitled item'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            {STATE_LABELS[state] ?? state}
          </span>
          <Link to={backHref} className="btn-outline text-sm">
            Back
          </Link>
        </div>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs">
        {STAGE_ORDER.map((s, i) => (
          <li
            key={s}
            className={`px-2 py-1 rounded border ${
              i < stageIndex
                ? 'bg-green-50 border-green-200 text-green-700'
                : i === stageIndex
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-neutral-200 text-neutral-400'
            }`}
          >
            {STATE_LABELS[s]}
          </li>
        ))}
      </ol>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {notice && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">{notice}</div>}

      {pendingTask && (
        <div className="p-4 bg-white border border-neutral-200 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Review task</p>
              <p className="text-xs text-neutral-500">
                {pendingTask.claimed_by
                  ? `Claimed by ${pendingTask.claimed_by === user?.id ? 'you' : pendingTask.claimed_by}`
                  : 'Unclaimed'}
              </p>
            </div>
            <div className="flex gap-2">
              {isStaff && !pendingTask.claimed_by && (
                <button
                  className="btn-outline text-sm"
                  disabled={busy}
                  onClick={() => void runTaskAction(pendingTask.id, 'claim')}
                >
                  Claim
                </button>
              )}
              {isStaff && pendingTask.claimed_by === user?.id && (
                <button
                  className="btn-outline text-sm"
                  disabled={busy}
                  onClick={() => void runTaskAction(pendingTask.id, 'unclaim')}
                >
                  Unclaim
                </button>
              )}
            </div>
          </div>
          {isManager && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[16rem]">
                <label className="label text-xs" htmlFor="reassign-to">
                  Reassign to (user id)
                </label>
                <input
                  id="reassign-to"
                  className="input w-full text-sm"
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  placeholder="User UUID"
                />
              </div>
              <button
                className="btn-outline text-sm"
                disabled={busy || !reassignTo.trim()}
                onClick={() => void runTaskAction(pendingTask.id, 'assign')}
              >
                Reassign
              </button>
            </div>
          )}
        </div>
      )}

      {!isTerminal && (
        <div className="p-4 bg-white border border-neutral-200 rounded-lg space-y-3">
          <p className="font-medium text-sm">Actions</p>
          <div className="flex flex-wrap gap-2">
            {canSubmit && (
              <button
                className="btn-primary text-sm"
                disabled={busy}
                onClick={() => void runAction({ action: state === 'DRAFT' ? 'submit' : 'resubmit' })}
              >
                {state === 'DRAFT' ? 'Submit for review' : 'Resubmit'}
              </button>
            )}
            {canReview && (
              <button className="btn-primary text-sm" disabled={busy} onClick={() => void runAction({ action: 'approve' })}>
                Approve &amp; advance
              </button>
            )}
            {canReview && (
              <button className="btn-outline text-sm" disabled={busy} onClick={() => setReturning((v) => !v)}>
                Return for correction
              </button>
            )}
            {canReview && (
              <button
                className="btn-outline text-sm text-red-600 border-red-200 hover:bg-red-50"
                disabled={busy}
                onClick={() => void runAction({ action: 'reject' })}
              >
                Reject
              </button>
            )}
            {canPublish && (
              <button className="btn-primary text-sm" disabled={busy} onClick={() => void runAction({ action: 'publish' })}>
                Publish
              </button>
            )}
            {canWithdraw && (
              <button
                className="btn-outline text-sm"
                disabled={busy}
                onClick={() => void runAction({ action: 'withdraw' })}
              >
                Withdraw
              </button>
            )}
          </div>

          {returning && (
            <div className="space-y-2 pt-2 border-t">
              <label className="label text-xs" htmlFor="return-notes">
                Revision notes *
              </label>
              <textarea
                id="return-notes"
                className="input w-full text-sm"
                rows={3}
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Describe the revisions required"
              />
              <button
                className="btn-primary text-sm"
                disabled={busy || !returnNotes.trim()}
                onClick={() => void confirmReturn()}
              >
                Return to submitter
              </button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="font-medium">Comments</h3>
        {comments.length === 0 && <p className="text-sm text-neutral-500">No comments yet.</p>}
        {comments.map((c) => (
          <div
            key={c.id}
            className={`p-3 rounded-lg text-sm ${
              c.is_private ? 'bg-amber-50 border border-amber-200' : 'bg-neutral-50'
            }`}
          >
            <p>{c.body}</p>
            <p className="text-xs text-neutral-400 mt-1">
              {c.is_private ? 'Internal note · ' : ''}
              {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
            </p>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            className="input flex-1 min-w-[14rem] text-sm"
            placeholder="Add a comment…"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
          />
          {isStaff && (
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              Internal
            </label>
          )}
          <button className="btn-secondary text-sm" onClick={() => void addComment()} disabled={!commentText.trim()}>
            Add
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">History</h3>
        {history.length === 0 && <p className="text-sm text-neutral-500">No actions recorded yet.</p>}
        {history.map((h, i) => (
          <div key={h.id ?? i} className="p-2 bg-neutral-50 rounded text-sm">
            <span className="font-medium">{h.action}</span>
            {h.previous_state && (
              <span className="text-neutral-500">
                {' '}
                {STATE_LABELS[h.previous_state] ?? h.previous_state} → {STATE_LABELS[h.new_state ?? ''] ?? h.new_state}
              </span>
            )}
            {h.comment && <p className="text-neutral-600 mt-1">{h.comment}</p>}
            <p className="text-xs text-neutral-400">{h.created_at ? new Date(h.created_at).toLocaleString() : ''}</p>
          </div>
        ))}
      </div>

      <div className="text-sm">
        <Link to={backHref} className="text-primary-700 hover:underline">
          ← All submissions
        </Link>
      </div>
    </div>
  );
}
