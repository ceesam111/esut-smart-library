import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { downloadCsv } from '@/lib/localStore';

const INITIATIVES = [
  { key: 'ncce',           name: 'NUC Minimum Standards' },
  { key: 'webometrics',    name: 'Webometrics (Cybermetrics Lab)' },
  { key: 'the',            name: 'THE World University Rankings' },
  { key: 'qs',             name: 'QS World University Rankings' },
  { key: 'google_scholar', name: 'Google Scholar Metrics' },
  { key: 'scimago',        name: 'SCImago Institutions Rankings' },
  { key: 'ui_greenmetric', name: 'UI GreenMetric' },
  { key: 'nirf',           name: 'NIRF (Nigeria)' },
];

const ACTIONS = [
  { id: 1,  label: 'Submit sitemap.xml to Google Search Console' },
  { id: 2,  label: 'Register OAI-PMH with OpenDOAR' },
  { id: 3,  label: 'Submit OAI-PMH to BASE (Bielefeld)' },
  { id: 4,  label: 'Submit ESUT to Webometrics repository list' },
  { id: 5,  label: 'All lecturers to add ORCID to profiles' },
  { id: 6,  label: 'All lecturers to add Google Scholar ID' },
  { id: 7,  label: 'Achieve 100 published repository items' },
  { id: 8,  label: 'Achieve 50 published lecturer profiles' },
  { id: 9,  label: 'Achieve 2,500 volumes per NUC programme' },
  { id: 10, label: 'Submit ESUT to AJOL (African Journals Online)' },
  { id: 11, label: 'Register on SCImago institutions database' },
  { id: 12, label: 'Link ESUT domain to Google Scholar institution' },
  { id: 13, label: 'All publications to have DOI on ORCID' },
  { id: 14, label: 'Submit Bing Webmaster Tools sitemap' },
  { id: 15, label: 'Complete annual NIRF data submission' },
];

interface RankEdit { rank_text: string; rank_year: string; }

export default function AdminWebometrics() {
  const [ranks, setRanks]         = useState<Record<string, RankEdit>>({});
  const [actions, setActions]     = useState<Record<number, string>>({});
  const [saving, setSaving]       = useState(false);
  const [savedMsg, setSavedMsg]   = useState('');
  const [loading, setLoading]     = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [ranksRes, actRes] = await Promise.all([
      supabase.from('webometrics_ranks').select('*'),
      supabase.from('webometrics_actions').select('*'),
    ]);

    const rankMap: Record<string, RankEdit> = {};
    (ranksRes.data ?? []).forEach((r) => {
      rankMap[r.initiative_key] = {
        rank_text: r.rank_text ?? 'Not yet ranked',
        rank_year: r.rank_year ? String(r.rank_year) : '',
      };
    });
    // fill missing
    INITIATIVES.forEach((init) => {
      if (!rankMap[init.key]) {
        rankMap[init.key] = { rank_text: 'Not yet ranked', rank_year: '' };
      }
    });
    setRanks(rankMap);

    const actMap: Record<number, string> = {};
    (actRes.data ?? []).forEach((r) => { actMap[r.action_id] = r.status; });
    ACTIONS.forEach((a) => { if (!actMap[a.id]) actMap[a.id] = 'not_started'; });
    setActions(actMap);

    setLoading(false);
  };

  const save = async () => {
    setSaving(true);

    // Upsert all ranks
    const rankRows = INITIATIVES.map((init) => ({
      initiative_key: init.key,
      rank_text:      ranks[init.key]?.rank_text ?? 'Not yet ranked',
      rank_year:      ranks[init.key]?.rank_year ? parseInt(ranks[init.key].rank_year, 10) : null,
      updated_at:     new Date().toISOString(),
    }));

    // Upsert all action statuses
    const actRows = ACTIONS.map((a) => ({
      action_id: a.id,
      status:    actions[a.id] ?? 'not_started',
    }));

    await Promise.all([
      supabase.from('webometrics_ranks').upsert(rankRows, { onConflict: 'initiative_key' }),
      supabase.from('webometrics_actions').upsert(actRows, { onConflict: 'action_id' }),
    ]);

    setSavedMsg('Changes saved successfully.');
    setSaving(false);
    setTimeout(() => setSavedMsg(''), 4000);
  };

  const setRankField = (key: string, field: 'rank_text' | 'rank_year', value: string) => {
    setRanks((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const setActionStatus = (id: number, status: string) => {
    setActions((prev) => ({ ...prev, [id]: status }));
  };

  const exportSection = (section: 'rankings' | 'actions') => {
    if (section === 'rankings') {
      downloadCsv('webometrics-rankings.csv', INITIATIVES.map((init) => ({ Initiative: init.name, Rank: ranks[init.key]?.rank_text ?? '', Year: ranks[init.key]?.rank_year ?? '' })));
      return;
    }
    downloadCsv('webometrics-actions.csv', ACTIONS.map((action) => ({ Serial: action.id, Action: action.label, Status: actions[action.id] ?? 'not_started' })));
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-700 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Webometrics Admin</h1>
        <p className="text-neutral-500 text-sm mt-1">
          Update current rankings and manage visibility action statuses.
        </p>
      </div>

      <div className="card p-4 bg-primary-50 border-primary-200 text-sm text-primary-900">
        <p className="font-semibold mb-2">How to operate this module</p>
        <p>Enter the latest rank and year for each ranking body, then update each visibility action as Not Started, In Progress, or Done. Use the section downloads to export rankings and action checklists separately for reports.</p>
      </div>

      {savedMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
          {savedMsg}
        </div>
      )}

      {/* ── Rankings ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900">Current Rankings</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Enter the current rank for each initiative. Use text such as "Not yet ranked",
            "Top 500", or a specific position like "#342".
          </p>
        </div>
        <div className="divide-y divide-neutral-100">
          {INITIATIVES.map((init) => (
            <div key={init.key} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 font-medium text-neutral-800 text-sm">{init.name}</div>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  className="input text-sm w-44"
                  placeholder="Not yet ranked"
                  value={ranks[init.key]?.rank_text ?? ''}
                  onChange={(e) => setRankField(init.key, 'rank_text', e.target.value)}
                />
                <input
                  type="number"
                  className="input text-sm w-24"
                  placeholder="Year"
                  min={2000}
                  max={2099}
                  value={ranks[init.key]?.rank_year ?? ''}
                  onChange={(e) => setRankField(init.key, 'rank_year', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Action checklist ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900">Visibility Action Checklist</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Update the completion status for each visibility action.
          </p>
        </div>
        <div className="divide-y divide-neutral-100">
          {ACTIONS.map((action) => (
            <div key={action.id} className="px-6 py-4 flex items-center gap-4">
              <span className="text-xs font-mono text-neutral-400 w-6 shrink-0">{action.id}</span>
              <span className="flex-1 text-sm text-neutral-800">{action.label}</span>
              <select
                className="input text-sm w-36 shrink-0"
                value={actions[action.id] ?? 'not_started'}
                onChange={(e) => setActionStatus(action.id, e.target.value)}
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* ── Save ─────────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <button onClick={() => exportSection('rankings')} className="btn-outline px-4 py-2.5 text-sm mr-2">Download Rankings</button>
        <button onClick={() => exportSection('actions')} className="btn-outline px-4 py-2.5 text-sm mr-2">Download Actions</button>
        <button
          onClick={save}
          disabled={saving}
          className="btn-primary px-8 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
