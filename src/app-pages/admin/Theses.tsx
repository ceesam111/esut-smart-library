import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';

interface Thesis {
  id: string;
  title: string;
  submission_type: string | null;
  programme: string | null;
  session: string | null;
  status: string;
  reference_no: string | null;
  created_at: string;
  updated_at: string;
  similarity_score: number | null;
  ai_content_score: number | null;
  matched_sources: any[] | null;
  plagiarism_scanned_at: string | null;
  file_url: string | null;
  abstract: string | null;
  keywords: any[];
  doi: string | null;
  zenodo_id: string | null;
  repository_item_id: string | null;
  submitter_id: string | null;
  embargo_enabled: boolean | null;
}

type FilterStatus = '' | 'submitted' | 'supervisor_review' | 'committee_review' | 'returned_to_student' | 'published';

function statusColor(s: string) {
  return s === 'submitted' ? 'badge-warning'
    : s === 'supervisor_review' ? 'badge-primary'
    : s === 'committee_review' ? 'badge-secondary'
    : s === 'returned_to_student' ? 'badge-error'
    : s === 'published' ? 'badge-success'
    : 'badge-secondary';
}

function simColor(score: number) {
  return score < 15 ? 'text-green-700 bg-green-50 border-green-200'
    : score < 30 ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-red-700 bg-red-50 border-red-200';
}

export default function AdminTheses() {
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('');
  const [selected, setSelected] = useState<Thesis | null>(null);
  const [slideOpen, setSlideOpen] = useState(false);
  const [submitterName, setSubmitterName] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishResult, setPublishResult] = useState<{ ok: boolean; doi?: string; error?: string } | null>(null);
  const [returnNotes, setReturnNotes] = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { fetchTheses(); }, [filter]);

  const fetchTheses = async () => {
    setLoading(true);
    let q = supabase.from('theses').select('*').order('created_at', { ascending: false });
    if (filter) q = q.eq('status', filter);
    const { data } = await q;
    setTheses(data ?? []);
    setLoading(false);
  };

  const openThesis = async (t: Thesis) => {
    setSelected(t);
    setSlideOpen(true);
    setPublishResult(null);
    setShowReturnForm(false);
    setReturnNotes('');
    if (t.submitter_id) {
      const { data: patron } = await supabase.from('patrons').select('full_name, email').eq('user_id', t.submitter_id).maybeSingle();
      setSubmitterName(patron?.full_name ?? '');
      setSubmitterEmail(patron?.email ?? '');
    } else {
      setSubmitterName(''); setSubmitterEmail('');
    }
  };

  const handlePublish = async () => {
    if (!selected) return;
    setPublishLoading(true);
    setPublishResult(null);

    try {
      // 1. Create repository_items record
      const { data: repoItem, error: repoErr } = await supabase
        .from('repository_items')
        .insert({
          title: selected.title,
          abstract: selected.abstract,
          item_type: selected.submission_type ?? 'Undergraduate Long Essay',
          type: 'thesis',
          keywords: selected.keywords ?? [],
          file_url: selected.file_url,
          status: 'submitted',
          visibility: selected.embargo_enabled ? 'private' : 'global',
          access_type: selected.embargo_enabled ? 'restricted' : 'open',
          language: 'English',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (repoErr || !repoItem) throw new Error(repoErr?.message ?? 'Failed to create repository item');

      // 2. Try Zenodo publish
      let doi = '';
      let zenodoId = '';
      try {
        const { data: zenData, error: zenErr } = await supabase.functions.invoke('zenodo-publish', {
          body: { item_id: repoItem.id },
        });
        if (!zenErr && zenData?.ok) {
          doi = zenData.doi ?? '';
          zenodoId = String(zenData.zenodo_id ?? '');
        }
      } catch {
        // Zenodo not configured — continue without DOI
      }

      // 3. Update thesis: published + link repository item
      await supabase.from('theses').update({
        status: 'published',
        doi: doi || null,
        zenodo_id: zenodoId || null,
        repository_item_id: repoItem.id,
        updated_at: new Date().toISOString(),
      }).eq('id', selected.id);

      // 4. Workflow record
      await supabase.from('thesis_workflow').insert({
        thesis_id: selected.id,
        stage: 'published',
        action: 'approved_by_committee',
        notes: doi ? `Published with DOI: ${doi}` : 'Published without DOI',
      });

      setPublishResult({ ok: true, doi });
      setSelected(prev => prev ? { ...prev, status: 'published', doi } : null);
      fetchTheses();

      // 5. Email student
      if (submitterEmail) {
        const html = `<p>Dear ${submitterName || 'Student'},</p><p>Congratulations! Your work <strong>${selected.title}</strong> (Ref: ${selected.reference_no}) has been approved by the Library Committee and is now published in the ESUT institutional repository.</p>${doi ? `<p>Your DOI: <a href="https://doi.org/${doi}">https://doi.org/${doi}</a></p>` : ''}<p>Your work is now accessible to researchers worldwide.</p>`;
        await sendEmail(submitterEmail, submitterName || submitterEmail, `Your work is published: ${selected.reference_no}`, html);
      }
    } catch (e: any) {
      setPublishResult({ ok: false, error: e.message });
    } finally {
      setPublishLoading(false);
    }
  };

  const handleReturnToStudent = async () => {
    if (!selected || !returnNotes.trim()) return;
    setActionLoading(true);
    await supabase.from('theses').update({
      status: 'returned_to_student',
      revision_notes: returnNotes.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id);

    await supabase.from('thesis_workflow').insert({
      thesis_id: selected.id,
      stage: 'returned_to_student',
      action: 'returned_by_committee',
      notes: returnNotes.trim(),
    });

    if (submitterEmail) {
      const html = `<p>Dear ${submitterName || 'Student'},</p><p>The Library Committee has reviewed your submission <strong>${selected.title}</strong> (Ref: ${selected.reference_no}) and requires revisions.</p><div style="background:#fef3c7;border:1px solid #fcd34d;padding:12px;border-radius:8px;margin:16px 0"><strong>Notes:</strong><p>${returnNotes.trim()}</p></div><p>Please address the feedback and resubmit.</p>`;
      await sendEmail(submitterEmail, submitterName || submitterEmail, `Revision required: ${selected.reference_no}`, html);
    }

    setSelected(prev => prev ? { ...prev, status: 'returned_to_student', revision_notes: returnNotes.trim() } : null);
    setShowReturnForm(false);
    fetchTheses();
    setActionLoading(false);
  };

  const FILTER_OPTIONS: FilterStatus[] = ['', 'submitted', 'supervisor_review', 'committee_review', 'returned_to_student', 'published'];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Thesis &amp; Essay Review — Library Committee</h1>
        <p className="text-neutral-600 mt-1">Final approval, publication, and DOI assignment for all submitted works.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {FILTER_OPTIONS.slice(1).map(s => {
          const count = theses.filter(t => t.status === s).length;
          return (
            <div key={s} className="card p-3 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter(s)}>
              <p className="text-xs text-neutral-500 mb-1 capitalize">{s.replace(/_/g, ' ')}</p>
              <p className="text-2xl font-bold text-neutral-800">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="card p-3 flex flex-wrap gap-2">
        {FILTER_OPTIONS.map(s => (
          <button key={s || 'all'}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${filter === s ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary-400'}`}>
            {s === '' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-neutral-400">Loading…</div>
        ) : theses.length === 0 ? (
          <div className="p-8 text-center text-neutral-400">No theses found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-neutral-50 text-left">
              <tr>
                <th className="p-3 font-semibold">Title</th>
                <th className="p-3 font-semibold">Ref</th>
                <th className="p-3 font-semibold">Type</th>
                <th className="p-3 font-semibold">Submitted</th>
                <th className="p-3 font-semibold">Similarity</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">DOI</th>
                <th className="p-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {theses.map(t => (
                <tr key={t.id} className="border-b hover:bg-neutral-50 cursor-pointer" onClick={() => openThesis(t)}>
                  <td className="p-3 font-medium max-w-xs">
                    <p className="line-clamp-1">{t.title}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{t.programme}</p>
                  </td>
                  <td className="p-3 font-mono text-xs text-primary-700">{t.reference_no ?? '—'}</td>
                  <td className="p-3 text-xs text-neutral-600">{t.submission_type}</td>
                  <td className="p-3 text-xs text-neutral-400">{new Date(t.created_at).toLocaleDateString('en-GB')}</td>
                  <td className="p-3 text-xs">
                    {t.similarity_score !== null ? (
                      <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${simColor(t.similarity_score)}`}>
                        {t.similarity_score.toFixed(1)}%
                      </span>
                    ) : <span className="text-neutral-300">—</span>}
                  </td>
                  <td className="p-3">
                    <span className={`badge text-xs ${statusColor(t.status)}`}>{t.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="p-3 text-xs">
                    {t.doi ? <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>DOI</span> : '—'}
                  </td>
                  <td className="p-3">
                    <button className="btn-outline text-xs py-1 px-2" onClick={e => { e.stopPropagation(); openThesis(t); }}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Slide-over */}
      {slideOpen && selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setSlideOpen(false)}>
          <div className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-start z-10">
              <div className="flex-1 pr-4">
                <h2 className="text-xl font-bold line-clamp-2">{selected.title}</h2>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span className={`badge text-xs ${statusColor(selected.status)}`}>{selected.status.replace(/_/g, ' ')}</span>
                  {selected.reference_no && <span className="badge badge-secondary text-xs font-mono">{selected.reference_no}</span>}
                  {selected.doi && <span className="badge text-xs" style={{ background: '#fef3c7', color: '#92400e' }}>DOI: {selected.doi}</span>}
                </div>
              </div>
              <button onClick={() => setSlideOpen(false)} className="text-2xl text-neutral-400 hover:text-neutral-700">×</button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Type', selected.submission_type ?? '—'],
                  ['Programme', selected.programme ?? '—'],
                  ['Session', selected.session ?? '—'],
                  ['Submitter', submitterName || '—'],
                  ['Email', submitterEmail || '—'],
                  ['Embargo', selected.embargo_enabled ? 'Yes' : 'No'],
                ].map(([k, v]) => (
                  <div key={String(k)}>
                    <p className="text-neutral-400 text-xs mb-0.5">{k}</p>
                    <p className="font-medium text-sm">{String(v)}</p>
                  </div>
                ))}
              </div>

              {selected.abstract && (
                <div>
                  <p className="text-xs font-semibold text-neutral-600 mb-2">Abstract</p>
                  <p className="text-sm text-neutral-600 leading-relaxed bg-neutral-50 rounded-xl p-3">{selected.abstract}</p>
                </div>
              )}

              {selected.file_url && (
                <a href={selected.file_url} target="_blank" rel="noopener noreferrer" className="btn-outline text-sm w-full text-center block">
                  Download PDF
                </a>
              )}

              {/* Plagiarism scores */}
              {(selected.similarity_score !== null || selected.ai_content_score !== null) && (
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-neutral-50 px-4 py-2 border-b text-xs font-bold text-neutral-700 uppercase tracking-wide">
                    Plagiarism &amp; AI Detection
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {selected.similarity_score !== null && (
                        <div className={`rounded-xl border p-3 ${simColor(selected.similarity_score)}`}>
                          <p className="text-xs font-medium opacity-75 mb-1">Similarity</p>
                          <p className="text-2xl font-bold">{selected.similarity_score.toFixed(1)}%</p>
                        </div>
                      )}
                      {selected.ai_content_score !== null && (
                        <div className={`rounded-xl border p-3 ${simColor(selected.ai_content_score)}`}>
                          <p className="text-xs font-medium opacity-75 mb-1">AI Content</p>
                          <p className="text-2xl font-bold">{selected.ai_content_score.toFixed(1)}%</p>
                        </div>
                      )}
                    </div>
                    {Array.isArray(selected.matched_sources) && selected.matched_sources.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-neutral-600">Top Matched Sources</p>
                        {selected.matched_sources.slice(0, 5).map((src: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-neutral-400">#{i + 1}</span>
                            <span className="flex-1 truncate text-neutral-600">{src.title || src.url}</span>
                            <span className="text-neutral-400 shrink-0">{src.matchedWords} words</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Publish result */}
              {publishResult && (
                <div className={`rounded-xl p-4 text-sm ${publishResult.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                  {publishResult.ok ? (
                    <>
                      <p className="font-semibold">Published to repository!</p>
                      {publishResult.doi && <p className="mt-1">DOI: <a href={`https://doi.org/${publishResult.doi}`} target="_blank" rel="noopener noreferrer" className="underline">{publishResult.doi}</a></p>}
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">Publish failed</p>
                      <p className="mt-1 text-xs">{publishResult.error}</p>
                    </>
                  )}
                </div>
              )}

              {/* Actions */}
              {selected.status === 'committee_review' && !showReturnForm && (
                <div className="space-y-2 pt-4 border-t">
                  <button
                    onClick={handlePublish}
                    disabled={publishLoading}
                    className="btn-primary w-full disabled:opacity-50"
                  >
                    {publishLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Publishing…
                      </span>
                    ) : 'Approve &amp; Publish to Repository'}
                  </button>
                  <button onClick={() => setShowReturnForm(true)} className="btn-ghost w-full text-amber-700 border border-amber-200 hover:bg-amber-50">
                    Return for Revisions
                  </button>
                </div>
              )}

              {showReturnForm && (
                <div className="space-y-3 pt-4 border-t">
                  <label className="label">Revision Notes *</label>
                  <textarea
                    value={returnNotes}
                    onChange={e => setReturnNotes(e.target.value)}
                    rows={4}
                    className="input w-full resize-none"
                    placeholder="Explain what revisions are needed…"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowReturnForm(false)} className="btn-ghost flex-1">Cancel</button>
                    <button
                      onClick={handleReturnToStudent}
                      disabled={!returnNotes.trim() || actionLoading}
                      className="flex-1 btn-ghost text-amber-700 border border-amber-300 hover:bg-amber-50 disabled:opacity-50"
                    >
                      {actionLoading ? 'Processing…' : 'Return to Student'}
                    </button>
                  </div>
                </div>
              )}

              {selected.status === 'published' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 text-center">
                  This work is published.
                  {selected.doi && <p className="mt-1"><a href={`https://doi.org/${selected.doi}`} target="_blank" rel="noopener noreferrer" className="underline font-medium">View via DOI</a></p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
