import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface SubjectConfig {
  subject: string;
  enabled: boolean;
}

interface HarvestLog {
  id: string;
  run_date: string;
  subject: string | null;
  source: string | null;
  items_found: number;
  items_added: number;
  items_skipped: number;
  status: string;
  error_message: string | null;
}

interface RunSummary {
  total_added: number;
  subjects: number;
  log: HarvestLog[];
}

const SOURCES = [
  { name: 'OpenAlex',         badge: 'Articles',  desc: 'Open Access works published after 2020, 200M+ papers indexed globally.' },
  { name: 'DOAJ',             badge: 'Journals',  desc: 'Directory of Open Access Journals — fully peer-reviewed, no embargo.' },
  { name: 'CORE',             badge: 'Articles',  desc: 'Aggregated open-access research from 10,000+ repositories worldwide.' },
  { name: 'Project Gutenberg',badge: 'eBooks',    desc: '70,000+ public-domain books — literature, history, philosophy, science.' },
  { name: 'Open Library',     badge: 'eBooks',    desc: 'Internet Archive digital library — millions of books with full-text access.' },
  { name: 'OAPEN',            badge: 'eBooks',    desc: '28,000+ peer-reviewed open-access academic books, humanities & social sciences.' },
  { name: 'DOAB',             badge: 'eBooks',    desc: '80,000+ peer-reviewed OA books from 600+ publishers worldwide.' },
];

const BADGE_COLOR: Record<string, string> = {
  Articles: 'bg-blue-100 text-blue-700',
  Journals: 'bg-green-100 text-green-700',
  eBooks:   'bg-amber-100 text-amber-700',
};

export default function ContentEngine() {
  const [subjects, setSubjects]     = useState<SubjectConfig[]>([]);
  const [logs, setLogs]             = useState<HarvestLog[]>([]);
  const [lastRun, setLastRun]       = useState<string | null>(null);
  const [lastAdded, setLastAdded]   = useState<number | null>(null);
  const [totalAdded, setTotalAdded] = useState<number>(0);
  const [status, setStatus]         = useState<'Idle' | 'Running' | 'Failed'>('Idle');
  const [loading, setLoading]       = useState(true);
  const [runResult, setRunResult]   = useState<RunSummary | null>(null);
  const [newSubject, setNewSubject] = useState('');
  const [addingSubject, setAddingSubject] = useState(false);
  const [tab, setTab]               = useState<'subjects' | 'log' | 'sources'>('subjects');

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data: cfgData }, { data: logData }, { count }] = await Promise.all([
      supabase.from('content_engine_config').select('subject, enabled').order('subject'),
      supabase.from('harvest_log').select('*').order('run_date', { ascending: false }).limit(100),
      supabase.from('catalogue_items').select('*', { count: 'exact', head: true }).eq('is_harvested', true),
    ]);

    setSubjects(cfgData ?? []);
    setLogs(logData ?? []);
    setTotalAdded(count ?? 0);

    if (logData?.length) {
      setLastRun(logData[0].run_date);
      const lastRunDate = logData[0].run_date.slice(0, 16);
      const added = logData
        .filter(l => l.run_date.slice(0, 16) === lastRunDate)
        .reduce((s, l) => s + (l.items_added ?? 0), 0);
      setLastAdded(added);
    }
    setLoading(false);
  }

  const toggleSubject = async (subject: string, current: boolean) => {
    setSubjects(prev => prev.map(s => s.subject === subject ? { ...s, enabled: !current } : s));
    await supabase.from('content_engine_config').update({ enabled: !current }).eq('subject', subject);
  };

  const toggleAll = async (val: boolean) => {
    setSubjects(prev => prev.map(s => ({ ...s, enabled: val })));
    await supabase.from('content_engine_config').update({ enabled: val });
  };

  const addSubject = async () => {
    const trimmed = newSubject.trim();
    if (!trimmed || subjects.some(s => s.subject.toLowerCase() === trimmed.toLowerCase())) return;
    setAddingSubject(true);
    const { error } = await supabase.from('content_engine_config').insert({ subject: trimmed, enabled: true });
    if (!error) {
      setSubjects(prev => [...prev, { subject: trimmed, enabled: true }].sort((a, b) => a.subject.localeCompare(b.subject)));
      setNewSubject('');
    }
    setAddingSubject(false);
  };

  const removeSubject = async (subject: string) => {
    if (!confirm(`Remove "${subject}" from harvest subjects?`)) return;
    await supabase.from('content_engine_config').delete().eq('subject', subject);
    setSubjects(prev => prev.filter(s => s.subject !== subject));
  };

  const runHarvest = async () => {
    setStatus('Running');
    setRunResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const headers = { 'Content-Type': 'application/json', ...(sessionData.session ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}) };
      const activeSubjects = subjects.filter((subject) => subject.enabled).map((subject) => subject.subject);
      const results = [];
      for (const subject of activeSubjects) {
        const response = await fetch('/api/admin/harvest', { method: 'POST', headers, body: JSON.stringify({ query: subject, limitPerSource: 5 }) });
        const raw = await response.json();
        if (!response.ok) throw new Error(raw.error?.message || raw.error || `Harvest failed for ${subject}.`);
        results.push(raw.data ?? raw);
      }
      setRunResult({ total_added: results.reduce((sum, result) => sum + (result.candidates?.length ?? 0), 0), subjects: activeSubjects.length, log: [] });
      setStatus('Idle');
      await load();
    } catch (err) {
      console.error('Harvest error:', err);
      setStatus('Failed');
    }
  };

  const runGroups = logs.reduce((acc: Record<string, HarvestLog[]>, log) => {
    const key = log.run_date.slice(0, 16);
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {});

  const sortedRunKeys = Object.keys(runGroups).sort((a, b) => b.localeCompare(a)).slice(0, 10);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const enabledCount = subjects.filter(s => s.enabled).length;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-neutral-900">Content Harvest Engine</h1>
        <p className="text-neutral-500 mt-1 text-sm">
          Automatically harvests open-access articles, journals, and ebooks from 7 global sources daily.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`rounded-xl border p-4 ${
          status === 'Running' ? 'text-amber-700 bg-amber-50 border-amber-200'
          : status === 'Failed' ? 'text-red-700 bg-red-50 border-red-200'
          : 'text-green-700 bg-green-50 border-green-200'
        }`}>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">Status</p>
          <p className="font-bold text-lg flex items-center gap-2">
            {status === 'Running' && <span className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />}
            {status}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">Last Run</p>
          <p className="font-bold text-neutral-800 text-sm">{lastRun ? new Date(lastRun).toLocaleString('en-GB') : 'Never'}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">Items Last Run</p>
          <p className="font-bold text-neutral-800 text-lg">+{lastAdded ?? 0}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">Total Harvested</p>
          <p className="font-bold text-neutral-800 text-lg">{totalAdded.toLocaleString()}</p>
        </div>
      </div>

      {/* Run result banner */}
      {runResult && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-5 py-4 text-green-800 text-sm">
          Harvest complete — <strong>{runResult.total_added}</strong> new items added across{' '}
          <strong>{runResult.subjects}</strong> subjects from 7 sources.
        </div>
      )}

      {/* Schedule + trigger */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-neutral-800">Automatic Schedule</p>
            <p className="text-sm text-neutral-500 mt-0.5">
              Runs daily at <strong>02:00 WAT (01:00 UTC)</strong> via pg_cron.
              Harvests all <strong>{enabledCount}</strong> enabled subject areas from 7 open-access sources.
            </p>
          </div>
          <button
            onClick={runHarvest}
            disabled={status === 'Running'}
            className="btn-primary px-6 shrink-0 disabled:opacity-50 whitespace-nowrap"
          >
            {status === 'Running' ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Running…
              </span>
            ) : 'Run Now'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200">
        <div className="flex gap-1">
          {(['subjects', 'log', 'sources'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
                tab === t
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {t === 'subjects' ? `Subject Areas (${subjects.length})` : t === 'log' ? 'Harvest Log' : 'Active Sources (7)'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Subject Areas */}
      {tab === 'subjects' && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">{enabledCount} of {subjects.length} subjects enabled</p>
            <div className="flex gap-2">
              <button onClick={() => toggleAll(true)} className="btn-ghost text-xs py-1 px-3">Enable All</button>
              <button onClick={() => toggleAll(false)} className="btn-ghost text-xs py-1 px-3">Disable All</button>
            </div>
          </div>

          {/* Add new subject */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newSubject}
              onChange={e => setNewSubject(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSubject()}
              placeholder="Add a new subject area (e.g. Linguistics)…"
              className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={addSubject}
              disabled={addingSubject || !newSubject.trim()}
              className="btn-primary px-4 text-sm disabled:opacity-50"
            >
              {addingSubject ? '…' : 'Add'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {subjects.map(s => (
              <div
                key={s.subject}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                  s.enabled ? 'bg-primary-50 border-primary-200' : 'bg-neutral-50 border-neutral-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={() => toggleSubject(s.subject, s.enabled)}
                  className="w-4 h-4 accent-primary-700 shrink-0"
                />
                <span className={`text-sm font-medium flex-1 min-w-0 truncate ${
                  s.enabled ? 'text-primary-800' : 'text-neutral-500'
                }`}>
                  {s.subject}
                </span>
                <button
                  onClick={() => removeSubject(s.subject)}
                  className="text-neutral-300 hover:text-red-500 transition-colors shrink-0 text-xs leading-none"
                  title="Remove subject"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Harvest Log */}
      {tab === 'log' && (
        <div className="card p-6">
          {sortedRunKeys.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-neutral-400 text-sm">No harvest runs yet.</p>
              <p className="text-neutral-400 text-xs mt-1">Click "Run Now" to start your first harvest.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedRunKeys.map(key => {
                const group = runGroups[key];
                const totalAddedRun = group.reduce((s, l) => s + l.items_added, 0);
                const totalFound = group.reduce((s, l) => s + l.items_found, 0);
                const totalSkipped = group.reduce((s, l) => s + l.items_skipped, 0);
                const hasError = group.some(l => l.status === 'error');

                return (
                  <div key={key} className="border border-neutral-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-neutral-800 text-sm">
                          {new Date(key).toLocaleString('en-GB')}
                        </p>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {group.length} source-subject pairs
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-green-700 font-semibold">+{totalAddedRun} added</span>
                        <span className="text-neutral-400">{totalFound} found</span>
                        <span className="text-neutral-400">{totalSkipped} skipped</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          hasError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {hasError ? 'Partial' : 'OK'}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                      {group.map(l => (
                        <div key={l.id} className={`rounded-lg px-2 py-1.5 text-xs ${
                          l.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-neutral-50 text-neutral-600'
                        }`}>
                          <span className="font-medium">{l.source}</span>
                          <span className="mx-1 text-neutral-300">·</span>
                          <span className="text-neutral-400">{l.subject?.split(' ').slice(0, 2).join(' ')}</span>
                          <span className="ml-1 text-green-700 font-semibold">+{l.items_added}</span>
                        </div>
                      ))}
                    </div>
                    {group.some(l => l.error_message) && (
                      <p className="text-xs text-red-600 mt-2 bg-red-50 px-3 py-1.5 rounded-lg">
                        {group.find(l => l.error_message)?.error_message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Active Sources */}
      {tab === 'sources' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOURCES.map(src => (
            <div key={src.name} className="card p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-semibold text-neutral-800">{src.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${BADGE_COLOR[src.badge] ?? 'bg-neutral-100 text-neutral-600'}`}>
                  {src.badge}
                </span>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed">{src.desc}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-xs text-green-700 font-medium">Active</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
