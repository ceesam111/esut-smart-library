import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { sendEmail, emailRepositoryRejected, emailRepositoryPublished } from '@/lib/email';

// ── Export helpers ───────────────────────────────────────────────────────────
function buildCSV(items: RepoItem[]): string {
  const esc = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;
  const authorStr = (a: any) =>
    (Array.isArray(a) ? a : []).map((x: any) => (typeof x === 'string' ? x : x?.name ?? '')).join('; ');
  const header = ['Title','Authors','Abstract','Year','Item Type','Department','Faculty','Subjects','Keywords','DOI','Visibility','Download Count','View Count','Status'].join(',');
  const rows = items.map(i => [
    esc(i.title), esc(authorStr(i.authors)), esc(i.abstract ?? ''),
    i.year ?? '', esc(i.item_type ?? ''), esc(i.department ?? ''), esc(i.faculty_code ?? ''),
    esc(Array.isArray(i.subjects) ? i.subjects.join('; ') : String(i.subjects ?? '')),
    esc(Array.isArray(i.keywords) ? i.keywords.join('; ') : String(i.keywords ?? '')),
    esc(i.doi ?? ''), esc(i.visibility), '', '', i.status,
  ].join(','));
  return [header, ...rows].join('\n');
}

function buildDublinCoreXML(items: RepoItem[]): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const authorStr = (a: any) =>
    (Array.isArray(a) ? a : []).map((x: any) => (typeof x === 'string' ? x : x?.name ?? '')).filter(Boolean);
  const records = items.map(i => {
    const creators = authorStr(i.authors).map((n: string) => `    <dc:creator>${esc(n)}</dc:creator>`).join('\n');
    const subjects = (Array.isArray(i.subjects) ? i.subjects : [String(i.subjects ?? '')]).map((s: string) => `    <dc:subject>${esc(s)}</dc:subject>`).join('\n');
    return `  <record>
    <dc:title>${esc(i.title)}</dc:title>
${creators}
${subjects}
    <dc:description>${esc(i.abstract ?? '')}</dc:description>
    <dc:date>${i.year ?? ''}</dc:date>
    <dc:type>${esc(i.item_type ?? 'Text')}</dc:type>
    <dc:language>en</dc:language>
    ${i.doi ? `<dc:identifier>https://doi.org/${esc(i.doi)}</dc:identifier>` : ''}
    <dc:rights>CC BY 4.0</dc:rights>
  </record>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<collection xmlns:dc="http://purl.org/dc/elements/1.1/">
${records}
</collection>`;
}

function buildMARCXML(items: RepoItem[]): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const authorStr = (a: any) =>
    (Array.isArray(a) ? a : []).map((x: any) => (typeof x === 'string' ? x : x?.name ?? '')).filter(Boolean);
  const records = items.map(i => {
    const creators = authorStr(i.authors);
    return `  <record>
    <leader>00000nam a2200000 i 4500</leader>
    ${creators[0] ? `<datafield tag="100" ind1="1" ind2=" "><subfield code="a">${esc(creators[0])}</subfield></datafield>` : ''}
    <datafield tag="245" ind1="1" ind2="0"><subfield code="a">${esc(i.title)}</subfield></datafield>
    <datafield tag="264" ind1=" " ind2="1"><subfield code="c">${i.year ?? ''}</subfield></datafield>
    ${i.doi ? `<datafield tag="024" ind1="7" ind2=" "><subfield code="a">${esc(i.doi)}</subfield><subfield code="2">doi</subfield></datafield>` : ''}
    ${creators.slice(1).map((c: string) => `<datafield tag="700" ind1="1" ind2=" "><subfield code="a">${esc(c)}</subfield></datafield>`).join('\n    ')}
  </record>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<collection xmlns="http://www.loc.gov/MARC21/slim">
${records}
</collection>`;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

interface RepoItem {
  id: string; title: string; item_type: string | null; type: string;
  faculty_code: string | null; department: string | null;
  submitter_id: string | null; status: string;
  created_at: string; authors: any[]; abstract: string | null;
  keywords: any[]; subjects: any[]; year: number | null;
  language: string; doi: string | null; zenodo_id: string | null;
  file_url: string | null; visibility: string;
  similarity_score: number | null; ai_content_score: number | null;
  matched_sources: any[] | null; plagiarism_scanned_at: string | null;
}

type FilterStatus = '' | 'submitted' | 'review' | 'approved' | 'published' | 'rejected';

function statusColor(s: string) {
  return s === 'submitted' ? 'badge-warning'
    : s === 'review' ? 'badge-primary'
    : s === 'approved' ? 'badge-success'
    : s === 'published' ? 'badge-success'
    : s === 'rejected' ? 'badge-error'
    : 'badge-secondary';
}

function similarityColor(score: number) {
  if (score < 15) return 'text-green-700 bg-green-50 border-green-200';
  if (score < 30) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function SimilarityBar({ score }: { score: number }) {
  const color = score < 15 ? 'bg-green-500' : score < 30 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="w-full bg-neutral-200 rounded-full h-2">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
    </div>
  );
}

export default function AdminRepository() {
  const [items, setItems] = useState<RepoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('');
  const [selected, setSelected] = useState<RepoItem | null>(null);
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [zenodoLoading, setZenodoLoading] = useState(false);
  const [zenodoResult, setZenodoResult] = useState<{ ok: boolean; doi?: string; error?: string } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting]           = useState(false);

  useEffect(() => { fetchItems(); }, [filterStatus]);

  const fetchItems = async () => {
    setLoading(true);
    let q = supabase.from('repository_items').select('*').order('created_at', { ascending: false });
    if (filterStatus) q = q.eq('status', filterStatus);
    const { data, error } = await q;
    if (!error) setItems(data ?? []);
    setLoading(false);
  };

  const openItem = async (item: RepoItem) => {
    setSelected(item);
    setSlideOpen(true);
    setShowRejectForm(false);
    setRejectReason('');
    setZenodoResult(null);

    if (item.submitter_id) {
      const { data: patron } = await supabase
        .from('patrons')
        .select('full_name, email')
        .eq('user_id', item.submitter_id)
        .maybeSingle();
      setSubmitterName(patron?.full_name ?? '');
      setSubmitterEmail(patron?.email ?? '');
    } else {
      setSubmitterName(''); setSubmitterEmail('');
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!selected) return;
    setActionLoading(true);
    const { error } = await supabase
      .from('repository_items')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', selected.id);
    if (!error) {
      setSelected(prev => prev ? { ...prev, status: newStatus } : null);
      fetchItems();
    }
    setActionLoading(false);
  };

  const handleApproveAndPublish = async () => {
    if (!selected) return;
    setZenodoLoading(true);
    setZenodoResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('zenodo-publish', {
        body: { item_id: selected.id },
      });
      if (error) throw new Error(error.message ?? 'Zenodo call failed');
      if (data?.error) throw new Error(data.error);
      const doi: string = data?.doi ?? '';
      setZenodoResult({ ok: true, doi });
      setSelected(prev => prev ? { ...prev, status: 'published', doi } : null);
      if (submitterEmail) {
        const html = emailRepositoryPublished(selected.title, doi);
        sendEmail(submitterEmail, submitterName || submitterEmail, 'Your submission has been published', html);
      }
      fetchItems();
    } catch (e: any) {
      if (e.message?.includes('ZENODO_TOKEN')) {
        await updateStatus('published');
        setZenodoResult({ ok: true, doi: '' });
        if (submitterEmail) {
          const html = emailRepositoryPublished(selected.title, '');
          sendEmail(submitterEmail, submitterName || submitterEmail, 'Your submission has been published', html);
        }
      } else {
        setZenodoResult({ ok: false, error: e.message });
      }
    } finally {
      setZenodoLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) return;
    setActionLoading(true);
    const { error } = await supabase
      .from('repository_items')
      .update({ status: 'rejected', rejection_reason: rejectReason.trim(), updated_at: new Date().toISOString() })
      .eq('id', selected.id);
    if (!error) {
      if (submitterEmail) {
        const html = emailRepositoryRejected(selected.title, rejectReason.trim());
        sendEmail(submitterEmail, submitterName || submitterEmail, 'Update on your repository submission', html);
      }
      setSlideOpen(false);
      fetchItems();
    }
    setActionLoading(false);
  };

  const authorNames = (authors: any[]) =>
    (Array.isArray(authors) ? authors : []).map((a: any) => typeof a === 'string' ? a : (a.name ?? '')).join('; ');

  const handleExport = async (type: 'csv' | 'dc' | 'marc') => {
    setExporting(true);
    setShowExportMenu(false);
    const { data } = await supabase.from('repository_items').select('*').eq('status', 'published');
    const all = (data ?? []) as RepoItem[];
    const date = new Date().toISOString().slice(0, 10);
    if (type === 'csv')  downloadFile(buildCSV(all),           `repository-${date}.csv`,        'text/csv');
    if (type === 'dc')   downloadFile(buildDublinCoreXML(all), `repository-dc-${date}.xml`,     'application/xml');
    if (type === 'marc') downloadFile(buildMARCXML(all),       `repository-marc21-${date}.xml`, 'application/xml');
    setExporting(false);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Repository Approval Queue</h1>
          <p className="text-neutral-600 mt-1">Review, approve, and publish research submissions.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-neutral-500">{items.length} item{items.length !== 1 ? 's' : ''}</div>
          <div className="relative">
            <button onClick={() => setShowExportMenu(v => !v)} disabled={exporting} className="btn-outline text-sm">
              {exporting ? 'Exporting…' : 'Export ▾'}
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-xl z-20 w-52">
                <button onClick={() => handleExport('csv')}  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b">CSV (.csv)</button>
                <button onClick={() => handleExport('dc')}   className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b">Dublin Core XML (.xml)</button>
                <button onClick={() => handleExport('marc')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50">MARC21 XML (.xml)</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-3">
        <label className="label text-sm whitespace-nowrap">Filter by status:</label>
        <div className="flex flex-wrap gap-2">
          {(['', 'submitted', 'review', 'approved', 'published', 'rejected'] as FilterStatus[]).map(s => (
            <button key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${filterStatus === s ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary-400'}`}>
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-neutral-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-neutral-400">No items found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-neutral-50 text-left">
              <tr>
                <th className="p-3 font-semibold">Title</th>
                <th className="p-3 font-semibold">Type</th>
                <th className="p-3 font-semibold">Department</th>
                <th className="p-3 font-semibold">Submitted</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Similarity</th>
                <th className="p-3 font-semibold">DOI</th>
                <th className="p-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b hover:bg-neutral-50 cursor-pointer" onClick={() => openItem(item)}>
                  <td className="p-3 font-medium max-w-xs">
                    <p className="line-clamp-1">{item.title}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{authorNames(item.authors).slice(0, 50) || '—'}</p>
                  </td>
                  <td className="p-3 text-xs text-neutral-600">{item.item_type || item.type || '—'}</td>
                  <td className="p-3 text-xs text-neutral-600">{item.department || item.faculty_code || '—'}</td>
                  <td className="p-3 text-xs text-neutral-400">{new Date(item.created_at).toLocaleDateString('en-GB')}</td>
                  <td className="p-3">
                    <span className={`badge text-xs ${statusColor(item.status)}`}>{item.status}</span>
                  </td>
                  <td className="p-3 text-xs">
                    {item.similarity_score !== null && item.similarity_score !== undefined ? (
                      <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${similarityColor(item.similarity_score)}`}>
                        {item.similarity_score.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="p-3 text-xs">
                    {item.doi ? <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>DOI</span> : '—'}
                  </td>
                  <td className="p-3">
                    <button className="btn-outline text-xs py-1 px-2" onClick={e => { e.stopPropagation(); openItem(item); }}>
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
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className={`badge text-xs ${statusColor(selected.status)}`}>{selected.status}</span>
                  {selected.item_type && <span className="badge badge-primary text-xs">{selected.item_type}</span>}
                  {selected.doi && <span className="badge text-xs" style={{ background: '#fef3c7', color: '#92400e' }}>DOI: {selected.doi}</span>}
                </div>
              </div>
              <button onClick={() => setSlideOpen(false)} className="text-2xl text-neutral-400 hover:text-neutral-700 leading-none mt-1">×</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Authors', authorNames(selected.authors) || '—'],
                  ['Type', selected.item_type || selected.type || '—'],
                  ['Department', selected.department || selected.faculty_code || '—'],
                  ['Year', selected.year ?? '—'],
                  ['Language', selected.language || 'English'],
                  ['Visibility', selected.visibility || '—'],
                  ['Submitter', submitterName || '—'],
                  ['Email', submitterEmail || '—'],
                ].map(([k, v]) => (
                  <div key={String(k)}>
                    <p className="text-neutral-400 text-xs font-medium mb-0.5">{k}</p>
                    <p className="text-neutral-800 font-medium">{String(v)}</p>
                  </div>
                ))}
              </div>

              {/* Abstract */}
              {selected.abstract && (
                <div>
                  <h4 className="font-semibold text-sm text-neutral-700 mb-2">Abstract</h4>
                  <p className="text-sm text-neutral-600 leading-relaxed bg-neutral-50 rounded-xl p-3">{selected.abstract}</p>
                </div>
              )}

              {/* Keywords */}
              {Array.isArray(selected.keywords) && selected.keywords.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-neutral-700 mb-2">Keywords</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.keywords.map((k: any) => (
                      <span key={String(k)} className="badge badge-secondary text-xs">{String(k)}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* File */}
              {selected.file_url && (
                <div>
                  <h4 className="font-semibold text-sm text-neutral-700 mb-2">File</h4>
                  <a href={selected.file_url} target="_blank" rel="noopener noreferrer"
                    className="btn-outline text-sm inline-flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Download / Preview
                  </a>
                </div>
              )}

              {/* ── Plagiarism Panel ── */}
              <div className="border rounded-xl overflow-hidden">
                <div className="bg-neutral-50 px-4 py-3 border-b">
                  <h4 className="font-semibold text-sm text-neutral-800">Plagiarism &amp; AI Detection</h4>
                </div>

                {selected.plagiarism_scanned_at && selected.similarity_score !== null ? (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className={`rounded-lg border p-3 ${similarityColor(selected.similarity_score ?? 0)}`}>
                        <p className="text-xs font-medium opacity-75 mb-1">Similarity Score</p>
                        <p className="text-2xl font-bold">{(selected.similarity_score ?? 0).toFixed(1)}%</p>
                        <SimilarityBar score={selected.similarity_score ?? 0} />
                        <p className="text-xs mt-1 opacity-75">
                          {(selected.similarity_score ?? 0) < 15 ? 'Low — acceptable' : (selected.similarity_score ?? 0) < 30 ? 'Moderate — review sources' : 'High — action required'}
                        </p>
                      </div>
                      <div className={`rounded-lg border p-3 ${similarityColor(selected.ai_content_score ?? 0)}`}>
                        <p className="text-xs font-medium opacity-75 mb-1">AI Content Score</p>
                        <p className="text-2xl font-bold">{(selected.ai_content_score ?? 0).toFixed(1)}%</p>
                        <SimilarityBar score={selected.ai_content_score ?? 0} />
                        <p className="text-xs mt-1 opacity-75">
                          {(selected.ai_content_score ?? 0) < 15 ? 'Low — likely human-written' : (selected.ai_content_score ?? 0) < 40 ? 'Moderate — review' : 'High — likely AI-generated'}
                        </p>
                      </div>
                    </div>

                    {Array.isArray(selected.matched_sources) && selected.matched_sources.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-neutral-600 mb-2">Top Matched Sources</p>
                        <div className="space-y-2">
                          {selected.matched_sources.map((src: any, i: number) => (
                            <div key={i} className="flex items-start gap-3 text-xs bg-neutral-50 rounded-lg p-2.5">
                              <span className="font-bold text-neutral-400 min-w-[20px]">#{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-neutral-700 truncate">{src.title || src.url}</p>
                                {src.url && (
                                  <a href={src.url} target="_blank" rel="noopener noreferrer"
                                    className="text-primary-600 hover:underline truncate block">{src.url}</a>
                                )}
                              </div>
                              <span className={`ml-2 px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap ${similarityColor(src.similarity ?? 0)}`}>
                                {src.matchedWords ?? 0} words
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-neutral-400">
                      Scanned: {new Date(selected.plagiarism_scanned_at).toLocaleString('en-GB')}
                    </p>
                  </div>
                ) : (
                  <div className="p-4">
                    <p className="text-sm text-neutral-500">
                      No plagiarism scan results yet. Configure a plagiarism detection service to enable automated scanning.
                    </p>
                  </div>
                )}
              </div>

              {/* Zenodo result */}
              {zenodoResult && (
                <div className={`rounded-xl p-4 text-sm ${zenodoResult.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                  {zenodoResult.ok ? (
                    <>
                      <p className="font-semibold">Published successfully!</p>
                      {zenodoResult.doi && <p className="mt-1">DOI: <a href={`https://doi.org/${zenodoResult.doi}`} target="_blank" rel="noopener noreferrer" className="underline">{zenodoResult.doi}</a></p>}
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">Zenodo publish failed</p>
                      <p className="mt-1 text-xs">{zenodoResult.error}</p>
                      <p className="mt-1 text-xs text-neutral-500">The item was published locally. Set ZENODO_TOKEN to enable DOI minting.</p>
                    </>
                  )}
                </div>
              )}

              {/* Actions */}
              {!showRejectForm ? (
                <div className="space-y-3 pt-4 border-t">
                  {selected.status !== 'published' && (
                    <button
                      onClick={handleApproveAndPublish}
                      disabled={zenodoLoading || actionLoading || selected.status === 'published'}
                      className="btn-primary w-full disabled:opacity-50"
                    >
                      {zenodoLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Publishing to Zenodo…
                        </span>
                      ) : 'Approve & Publish (Zenodo DOI)'}
                    </button>
                  )}
                  {selected.status !== 'review' && selected.status !== 'published' && (
                    <button onClick={() => updateStatus('review')} disabled={actionLoading} className="btn-outline w-full disabled:opacity-50">
                      Return for Review
                    </button>
                  )}
                  {selected.status !== 'rejected' && selected.status !== 'published' && (
                    <button onClick={() => setShowRejectForm(true)} className="btn-ghost w-full text-red-600 border border-red-200 hover:bg-red-50">
                      Reject Submission
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3 pt-4 border-t">
                  <div>
                    <label className="label">Rejection Reason *</label>
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      rows={4}
                      className="input w-full resize-none"
                      placeholder="Provide a detailed reason for rejection. This will be emailed to the submitter."
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowRejectForm(false)} className="btn-ghost flex-1">Cancel</button>
                    <button
                      onClick={handleReject}
                      disabled={!rejectReason.trim() || actionLoading}
                      className="flex-1 btn-ghost text-red-700 border border-red-300 hover:bg-red-50 disabled:opacity-50"
                    >
                      {actionLoading ? 'Rejecting…' : 'Confirm Rejection'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
