'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface WorkflowRow {
  id: string;
  current_state: string;
  status: string;
  created_at: string;
  repository_items?: { title?: string; status?: string } | null;
  theses?: { title?: string; status?: string; reference_no?: string } | null;
}

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

function stateClass(state: string) {
  if (state === 'PUBLISHED') return 'bg-green-100 text-green-800';
  if (state === 'RETURNED') return 'bg-amber-100 text-amber-800';
  if (state === 'REJECTED' || state === 'WITHDRAWN') return 'bg-neutral-200 text-neutral-700';
  return 'bg-blue-100 text-blue-800';
}

export default function MyWorkflows() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<WorkflowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate('/login');
        return;
      }
      const res = await fetch('/api/workflows', {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Failed to load submissions');
        return;
      }
      setRows(json.data ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">My submissions</h1>
          <p className="text-neutral-600 mt-1">
            Track every repository or thesis submission and its review progress.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/repository/submit" className="btn-outline text-sm">
            New repository item
          </Link>
          <Link to="/thesis/submit" className="btn-primary text-sm">
            New thesis submission
          </Link>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="card p-10 text-center text-neutral-500">Loading your submissions…</div>
      ) : rows.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">📄</p>
          <h3 className="text-lg font-semibold text-neutral-800 mb-2">No submissions yet</h3>
          <p className="text-neutral-500 text-sm">
            Submit a thesis or a repository item and its review workflow will appear here.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-neutral-50 text-left">
              <tr>
                <th className="p-3 font-semibold">Item</th>
                <th className="p-3 font-semibold">Reference</th>
                <th className="p-3 font-semibold">Stage</th>
                <th className="p-3 font-semibold">Started</th>
                <th className="p-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const item = row.theses ?? row.repository_items ?? null;
                return (
                  <tr key={row.id} className="border-b hover:bg-neutral-50">
                    <td className="p-3 max-w-md">
                      <p className="font-medium line-clamp-2">{item?.title ?? 'Untitled item'}</p>
                    </td>
                    <td className="p-3 font-mono text-xs text-primary-700">
                      {'reference_no' in (item ?? {}) ? (item as { reference_no?: string }).reference_no ?? '—' : '—'}
                    </td>
                    <td className="p-3">
                      <span className={`badge text-xs ${stateClass(row.current_state)}`}>
                        {STATE_LABELS[row.current_state] ?? row.current_state}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-neutral-500">
                      {new Date(row.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="p-3">
                      <Link to={`/dashboard/workflows/${row.id}`} className="btn-outline text-xs py-1 px-2">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
