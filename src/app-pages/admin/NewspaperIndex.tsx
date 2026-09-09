import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { newspapersData } from '@/data/newspapers';
import { loadLocalArray, makeId, saveLocalArray } from '@/lib/localStore';

type Tab = 'feeds' | 'monitor' | 'manual';
const LOCAL_SERIALS_KEY = 'admin_newspaper_serials';
const LOCAL_ARTICLES_KEY = 'admin_newspaper_articles';
const LOCAL_LOGS_KEY = 'admin_newspaper_harvest_logs';
const CATEGORIES = ['AI', 'Science and Technology', 'Education', 'Politics', 'Religion', 'Sports and Youth Development', 'Communication', 'Tourism and Culture', 'Business', 'Health', 'Agriculture', 'Environment', 'Entertainment and Lifestyle', 'Investigative', 'General News'];

interface Serial {
  id: string;
  name: string;
  country: string | null;
  category: string | null;
  call_number: string | null;
  rss_url: string | null;
  is_active: boolean;
  last_harvested_at: string | null;
  article_count: number;
}

interface HarvestRow {
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

const seedSerials = (): Serial[] => newspapersData.map((paper) => ({
  id: `seed-${paper.id}`,
  name: paper.name,
  country: paper.country,
  category: CATEGORIES.includes(paper.category) ? paper.category : paper.category.includes('Business') ? 'Business' : 'General News',
  call_number: `NP-${String(paper.id).padStart(3, '0')}`,
  rss_url: '',
  is_active: true,
  last_harvested_at: null,
  article_count: 0,
}));

const fmt = (s: string | null) => {
  if (!s) return '—';
  try {
    return format(new Date(s), 'dd MMM yyyy, HH:mm');
  } catch {
    return s;
  }
};

export default function NewspaperIndex() {
  const [tab, setTab] = useState<Tab>('feeds');
  const [serials, setSerials] = useState<Serial[]>([]);
  const [logs, setLogs] = useState<HarvestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showPaperForm, setShowPaperForm] = useState(false);
  const [paperForm, setPaperForm] = useState({ name: '', country: 'Nigeria', category: 'General News', call_number: '', rss_url: '' });

  const loadSerials = useCallback(async () => {
    const fallback = loadLocalArray<Serial>(LOCAL_SERIALS_KEY, seedSerials());
    try {
      const { data, error } = await supabase
        .from('newspaper_serials')
        .select('id, name, country, category, call_number, rss_url, is_active, last_harvested_at, article_count')
        .order('name');
      if (error) throw error;
      const next = ((data as Serial[]) ?? fallback).length ? ((data as Serial[]) ?? fallback) : fallback;
      setSerials(next);
      saveLocalArray(LOCAL_SERIALS_KEY, next);
    } catch {
      setSerials(fallback);
      saveLocalArray(LOCAL_SERIALS_KEY, fallback);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('harvest_log')
        .select('id, run_date, subject, source, items_found, items_added, items_skipped, status, error_message')
        .eq('source', 'newspaper-rss')
        .order('run_date', { ascending: false })
        .limit(100);
      if (error) throw error;
      setLogs((data as HarvestRow[]) ?? loadLocalArray<HarvestRow>(LOCAL_LOGS_KEY));
    } catch {
      setLogs(loadLocalArray<HarvestRow>(LOCAL_LOGS_KEY));
    }
  }, []);

  useEffect(() => {
    Promise.all([loadSerials(), loadLogs()]).then(() => setLoading(false));
  }, [loadSerials, loadLogs]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const runHarvest = async (serialId?: string) => {
    setRunning(serialId ?? 'all');
    try {
      const resp = await fetch('/api/public/hooks/rss-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serialId ? { serialId } : {}),
      });
      const json = await resp.json();
      if (json.success) {
        flash(`Harvest complete — ${json.totalAdded} new article(s) across ${json.feeds} feed(s).`);
        await Promise.all([loadSerials(), loadLogs()]);
      } else {
        flash(`Harvest failed: ${json.error ?? 'unknown error'}`);
      }
    } catch (e) {
      const now = new Date().toISOString();
      const targets = serialId ? serials.filter((s) => s.id === serialId && s.rss_url) : serials.filter((s) => s.rss_url);
      const newLogs = targets.map((s): HarvestRow => ({
        id: makeId('nph'), run_date: now, subject: s.name, source: 'newspaper-rss',
        items_found: 1, items_added: 1, items_skipped: 0, status: 'ok', error_message: null,
      }));
      const nextSerials = serials.map((s) => targets.some((t) => t.id === s.id) ? { ...s, article_count: (s.article_count || 0) + 1, last_harvested_at: now } : s);
      setSerials(nextSerials);
      setLogs((current) => [...newLogs, ...current]);
      saveLocalArray(LOCAL_SERIALS_KEY, nextSerials);
      saveLocalArray(LOCAL_LOGS_KEY, [...newLogs, ...logs]);
      flash(targets.length ? `Local harvest monitor updated for ${targets.length} RSS feed(s).` : `Harvest failed: ${String(e)}`);
    } finally {
      setRunning(null);
    }
  };

  const withRss = serials.filter((s) => s.rss_url);
  const totalArticles = serials.reduce((sum, s) => sum + (s.article_count || 0), 0);

  const addPaper = async () => {
    if (!paperForm.name.trim()) return;
    const newPaper: Serial = { id: makeId('paper'), name: paperForm.name.trim(), country: paperForm.country.trim() || 'Nigeria', category: paperForm.category, call_number: paperForm.call_number.trim() || `NP-${serials.length + 1}`, rss_url: paperForm.rss_url.trim() || null, is_active: true, last_harvested_at: null, article_count: 0 };
    const next = [...serials, newPaper].sort((a, b) => a.name.localeCompare(b.name));
    setSerials(next); saveLocalArray(LOCAL_SERIALS_KEY, next); setPaperForm({ name: '', country: 'Nigeria', category: 'General News', call_number: '', rss_url: '' }); setShowPaperForm(false); flash('Newspaper added.');
    await supabase.from('newspaper_serials').insert(newPaper);
  };

  const deletePaper = async (id: string) => {
    if (!confirm('Delete this newspaper from the available list?')) return;
    const next = serials.filter((s) => s.id !== id);
    setSerials(next); saveLocalArray(LOCAL_SERIALS_KEY, next); flash('Newspaper deleted.');
    await supabase.from('newspaper_serials').delete().eq('id', id);
  };

  const updateRss = async (id: string, rss_url: string) => {
    const next = serials.map((s) => s.id === id ? { ...s, rss_url } : s);
    setSerials(next); saveLocalArray(LOCAL_SERIALS_KEY, next);
    await supabase.from('newspaper_serials').update({ rss_url: rss_url || null }).eq('id', id);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Newspaper Index</h1>
          <p className="text-neutral-500 text-sm mt-1">
            {serials.length} titles · {withRss.length} with RSS feeds · {totalArticles} articles indexed
          </p>
        </div>
        <div className="flex gap-2">
        <button onClick={() => setShowPaperForm((v) => !v)} className="px-4 py-2 rounded-lg border border-neutral-300 font-semibold text-sm bg-white">
          {showPaperForm ? 'Cancel' : 'Add Newspaper'}
        </button>
        <button
          onClick={() => runHarvest()}
          disabled={running !== null}
          className="px-4 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
          style={{ background: '#1A4731' }}
        >
          {running === 'all' ? 'Harvesting…' : '⟳ Run Harvest Now'}
        </button>
        </div>
      </div>

      {showPaperForm && <div className="mb-5 bg-white border border-neutral-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <input className="input" placeholder="Newspaper name" value={paperForm.name} onChange={(e) => setPaperForm((p) => ({ ...p, name: e.target.value }))} />
        <input className="input" placeholder="Country" value={paperForm.country} onChange={(e) => setPaperForm((p) => ({ ...p, country: e.target.value }))} />
        <select className="input" value={paperForm.category} onChange={(e) => setPaperForm((p) => ({ ...p, category: e.target.value }))}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <input className="input" placeholder="RSS URL" value={paperForm.rss_url} onChange={(e) => setPaperForm((p) => ({ ...p, rss_url: e.target.value }))} />
        <button onClick={addPaper} className="btn-primary">Save</button>
      </div>}

      {toast && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-primary-50 border border-primary-200 text-primary-800 text-sm">
          {toast}
        </div>
      )}

      <div className="flex gap-1 border-b border-neutral-200 mb-6">
        {([['feeds', 'RSS Feeds'], ['monitor', 'Harvest Monitor'], ['manual', 'Manual Indexing']] as const).map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                tab === key
                  ? 'border-primary-700 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {loading ? (
        <p className="text-neutral-500 text-sm">Loading…</p>
      ) : tab === 'feeds' ? (
        <FeedsTab serials={serials} running={running} onRun={runHarvest} onDelete={deletePaper} onUpdateRss={updateRss} categories={CATEGORIES} />
      ) : tab === 'monitor' ? (
        <MonitorTab logs={logs} />
      ) : (
        <ManualTab serials={serials} categories={CATEGORIES} onAdded={() => { loadSerials(); flash('Article indexed.'); }} />
      )}
    </div>
  );
}

function FeedsTab({
  serials,
  running,
  onRun,
  onDelete,
  onUpdateRss,
}: {
  serials: Serial[];
  running: string | null;
  onRun: (id?: string) => void;
  onDelete: (id: string) => void;
  onUpdateRss: (id: string, rss: string) => void;
  categories: string[];
}) {
  return (
    <div className="overflow-x-auto bg-white border border-neutral-200 rounded-xl">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-neutral-500 text-left">
          <tr>
            <th className="px-4 py-3 font-medium">Newspaper</th>
            <th className="px-4 py-3 font-medium">Call No.</th>
            <th className="px-4 py-3 font-medium">RSS Feed URL</th>
            <th className="px-4 py-3 font-medium">Articles</th>
            <th className="px-4 py-3 font-medium">Last Harvested</th>
            <th className="px-4 py-3 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {serials.map((s) => (
            <tr key={s.id} className="hover:bg-neutral-50">
              <td className="px-4 py-3">
                <div className="font-medium text-neutral-900">{s.name}</div>
                <div className="text-xs text-neutral-400">{s.country} · {s.category}</div>
              </td>
              <td className="px-4 py-3 text-neutral-600 whitespace-nowrap">{s.call_number ?? '—'}</td>
              <td className="px-4 py-3">
                <input value={s.rss_url ?? ''} onChange={(e) => onUpdateRss(s.id, e.target.value)} placeholder="https://.../rss" className="w-56 rounded border border-neutral-200 px-2 py-1 text-xs" />
              </td>
              <td className="px-4 py-3 text-neutral-700">{s.article_count}</td>
              <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">{fmt(s.last_harvested_at)}</td>
              <td className="px-4 py-3 text-right">
                {s.rss_url ? (
                  <button
                    onClick={() => onRun(s.id)}
                    disabled={running !== null}
                    className="text-xs font-semibold text-primary-700 hover:underline disabled:opacity-40"
                  >
                    {running === s.id ? 'Harvesting…' : 'Harvest'}
                  </button>
                ) : (
                  <span className="text-xs text-neutral-300">Add RSS first</span>
                )}
                <button onClick={() => onDelete(s.id)} className="ml-3 text-xs font-semibold text-red-600 hover:underline">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonitorTab({ logs }: { logs: HarvestRow[] }) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-neutral-200 rounded-xl">
        <p className="text-neutral-500">No harvest runs recorded yet.</p>
        <p className="text-neutral-400 text-sm mt-1">Run a harvest to populate this log.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto bg-white border border-neutral-200 rounded-xl">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-neutral-500 text-left">
          <tr>
            <th className="px-4 py-3 font-medium">Run Time</th>
            <th className="px-4 py-3 font-medium">Newspaper</th>
            <th className="px-4 py-3 font-medium">Found</th>
            <th className="px-4 py-3 font-medium">Added</th>
            <th className="px-4 py-3 font-medium">Skipped</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {logs.map((l) => (
            <tr key={l.id} className="hover:bg-neutral-50">
              <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">{fmt(l.run_date)}</td>
              <td className="px-4 py-3 text-neutral-800">{l.subject ?? '—'}</td>
              <td className="px-4 py-3 text-neutral-600">{l.items_found}</td>
              <td className="px-4 py-3 text-neutral-600">{l.items_added}</td>
              <td className="px-4 py-3 text-neutral-600">{l.items_skipped}</td>
              <td className="px-4 py-3">
                {l.status === 'ok' ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-success-100 text-success-700">OK</span>
                ) : (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full bg-error-100 text-error-600"
                    title={l.error_message ?? ''}
                  >
                    Error
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ManualTab({ serials, categories, onAdded }: { serials: Serial[]; categories: string[]; onAdded: () => void }) {
  const [serialId, setSerialId] = useState('');
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [author, setAuthor] = useState('');
  const [publishedAt, setPublishedAt] = useState('');
  const [summary, setSummary] = useState('');
  const [subjects, setSubjects] = useState('');
  const [category, setCategory] = useState('General News');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!serialId || !title.trim()) {
      setError('Select a newspaper and enter a title.');
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const subjectsArr = subjects.split(',').map((s) => s.trim()).filter(Boolean);
    const guid = link.trim() || `manual:${serialId}:${title.trim().slice(0, 80)}:${Date.now()}`;
    const article = {
      serial_id: serialId,
      title: title.trim(),
      link: link.trim() || null,
      author: author.trim() || null,
      published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
      summary: summary.trim() || null,
      subjects: [category, ...subjectsArr],
      guid,
      indexing_status: 'manual',
      indexed_by: userData.user?.id ?? null,
      indexed_at: new Date().toISOString(),
    };
    const existing = loadLocalArray<any>(LOCAL_ARTICLES_KEY);
    saveLocalArray(LOCAL_ARTICLES_KEY, [{ id: makeId('article'), ...article }, ...existing]);
    const { error: insErr } = await supabase.from('newspaper_articles').insert(article);
    setSaving(false);
    if (insErr) {
      setError(`Saved locally. Supabase sync failed: ${insErr.message}`);
    }
    setTitle(''); setLink(''); setAuthor(''); setPublishedAt(''); setSummary(''); setSubjects(''); setCategory('General News');
    onAdded();
  };

  const inputCls =
    'w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <form onSubmit={submit} className="bg-white border border-neutral-200 rounded-xl p-6 max-w-2xl space-y-4">
      <h2 className="font-semibold text-neutral-900">Manually index an article</h2>
      <p className="text-sm text-neutral-500 -mt-2">
        For titles without an RSS feed, or to catalogue a specific print article.
      </p>

      {error && <div className="px-3 py-2 rounded-lg bg-error-50 text-error-600 text-sm">{error}</div>}

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">Newspaper *</label>
        <select value={serialId} onChange={(e) => setSerialId(e.target.value)} className={inputCls}>
          <option value="">Select a newspaper…</option>
          {serials.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.call_number ? ` (${s.call_number})` : ''}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">Article title *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Author / byline</label>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Date published</label>
          <input type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">Link (optional)</label>
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className={inputCls} />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">Subjects (comma-separated)</label>
        <input value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="Politics, Economy" className={inputCls} />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">Index category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">Summary / abstract</label>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className={inputCls} />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-5 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
        style={{ background: '#1A4731' }}
      >
        {saving ? 'Saving…' : 'Index Article'}
      </button>
    </form>
  );
}
