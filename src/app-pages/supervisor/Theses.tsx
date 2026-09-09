import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  similarity_score: number | null;
  ai_content_score: number | null;
  matched_sources: any[] | null;
  plagiarism_scanned_at: string | null;
  revision_notes: string | null;
  file_url: string | null;
  abstract: string | null;
  keywords: any[];
  submitter_id: string | null;
}

function simColor(score: number) {
  return score < 15 ? 'text-green-700 bg-green-50 border-green-200'
    : score < 30 ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-red-700 bg-red-50 border-red-200';
}

export default function SupervisorTheses() {
  const navigate = useNavigate();
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Thesis | null>(null);
  const [action, setAction] = useState<'approve' | 'return' | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [supervisorName, setSupervisorName] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }
      setSupervisorEmail(user.email ?? '');

      const { data: patron } = await supabase.from('patrons').select('full_name').eq('user_id', user.id).maybeSingle();
      setSupervisorName(patron?.full_name ?? '');

      // Find theses where this user is a supervisor by email
      const { data: supRows } = await supabase
        .from('thesis_supervisors')
        .select('thesis_id')
        .eq('supervisor_email', user.email);

      const ids = (supRows ?? []).map((r: any) => r.thesis_id);
      if (ids.length === 0) { setLoading(false); return; }

      const { data } = await supabase
        .from('theses')
        .select('*')
        .in('id', ids)
        .order('created_at', { ascending: false });

      setTheses(data ?? []);
      setLoading(false);
    })();
  }, [navigate]);

  const handleAction = async () => {
    if (!selected || !action) return;
    if (action === 'return' && !notes.trim()) return;
    setSubmitting(true);

    const newStatus = action === 'approve' ? 'committee_review' : 'returned_to_student';

    const { error } = await supabase.from('theses').update({
      status: newStatus,
      revision_notes: action === 'return' ? notes.trim() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id);

    if (!error) {
      await supabase.from('thesis_workflow').insert({
        thesis_id: selected.id,
        stage: newStatus,
        action: action === 'approve' ? 'approved_by_supervisor' : 'returned_by_supervisor',
        notes: notes.trim() || null,
      });

      // Notify student submitter
      if (selected.submitter_id) {
        const { data: patron } = await supabase.from('patrons').select('email, full_name').eq('user_id', selected.submitter_id).maybeSingle();
        if (patron?.email) {
          const html = action === 'approve'
            ? `<p>Dear ${patron.full_name ?? 'Student'},</p><p>Your submission <strong>${selected.title}</strong> (Ref: ${selected.reference_no}) has been <strong>approved by your supervisor</strong> and forwarded to the Library Committee for final review.</p>`
            : `<p>Dear ${patron.full_name ?? 'Student'},</p><p>Your supervisor has reviewed your submission <strong>${selected.title}</strong> (Ref: ${selected.reference_no}) and requires revisions before it can proceed.</p><div style="background:#fef3c7;border:1px solid #fcd34d;padding:12px;border-radius:8px;margin:16px 0"><strong>Revision Notes:</strong><p>${notes.trim()}</p></div><p>Please address the feedback and contact your supervisor.</p>`;
          await sendEmail(patron.email, patron.full_name ?? patron.email, action === 'approve' ? `Supervisor approved: ${selected.reference_no}` : `Revisions required: ${selected.reference_no}`, html);
        }
      }

      setTheses(prev => prev.map(t => t.id === selected.id ? { ...t, status: newStatus, revision_notes: action === 'return' ? notes.trim() : null } : t));
      setSelected(null);
      setAction(null);
      setNotes('');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Thesis Supervision Queue</h1>
        <p className="text-neutral-600 mt-1">Review student submissions assigned to you as supervisor.</p>
      </div>

      {theses.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-5xl mb-4">📚</p>
          <h3 className="text-lg font-semibold text-neutral-800 mb-2">No theses assigned</h3>
          <p className="text-neutral-500 text-sm">When students list you as their supervisor, their submissions will appear here.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-neutral-50 text-left">
              <tr>
                <th className="p-3 font-semibold">Title</th>
                <th className="p-3 font-semibold">Reference</th>
                <th className="p-3 font-semibold">Type</th>
                <th className="p-3 font-semibold">Submitted</th>
                <th className="p-3 font-semibold">Similarity</th>
                <th className="p-3 font-semibold">AI Score</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {theses.map(t => (
                <tr key={t.id} className="border-b hover:bg-neutral-50">
                  <td className="p-3 max-w-xs">
                    <p className="font-medium line-clamp-1">{t.title}</p>
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
                  <td className="p-3 text-xs">
                    {t.ai_content_score !== null ? (
                      <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${simColor(t.ai_content_score)}`}>
                        {t.ai_content_score.toFixed(1)}%
                      </span>
                    ) : <span className="text-neutral-300">—</span>}
                  </td>
                  <td className="p-3">
                    <span className={`badge text-xs ${t.status === 'committee_review' ? 'badge-success' : t.status === 'returned_to_student' ? 'badge-error' : t.status === 'supervisor_review' ? 'badge-primary' : 'badge-secondary'}`}>
                      {t.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-3">
                    <button onClick={() => { setSelected(t); setAction(null); setNotes(''); }} className="btn-outline text-xs py-1 px-2">
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-over */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => { setSelected(null); setAction(null); }}>
          <div className="bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-start z-10">
              <div className="flex-1 pr-4">
                <h2 className="text-xl font-bold line-clamp-2">{selected.title}</h2>
                <p className="text-xs text-neutral-500 mt-1 font-mono">{selected.reference_no}</p>
              </div>
              <button onClick={() => { setSelected(null); setAction(null); }} className="text-2xl text-neutral-400 hover:text-neutral-700">×</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Type', selected.submission_type ?? '—'],
                  ['Programme', selected.programme ?? '—'],
                  ['Session', selected.session ?? '—'],
                  ['Status', selected.status.replace(/_/g, ' ')],
                ].map(([k, v]) => (
                  <div key={String(k)}>
                    <p className="text-neutral-400 text-xs mb-0.5">{k}</p>
                    <p className="font-medium">{String(v)}</p>
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
                <div className="border rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-neutral-700 uppercase tracking-wide">Plagiarism &amp; AI Detection</p>
                  <div className="grid grid-cols-2 gap-3">
                    {selected.similarity_score !== null && (
                      <div className={`rounded-xl border p-3 ${simColor(selected.similarity_score)}`}>
                        <p className="text-xs font-medium opacity-75 mb-1">Similarity</p>
                        <p className="text-xl font-bold">{selected.similarity_score.toFixed(1)}%</p>
                      </div>
                    )}
                    {selected.ai_content_score !== null && (
                      <div className={`rounded-xl border p-3 ${simColor(selected.ai_content_score)}`}>
                        <p className="text-xs font-medium opacity-75 mb-1">AI Content</p>
                        <p className="text-xl font-bold">{selected.ai_content_score.toFixed(1)}%</p>
                      </div>
                    )}
                  </div>
                  {Array.isArray(selected.matched_sources) && selected.matched_sources.length > 0 && (
                    <div>
                      <p className="text-xs text-neutral-500 font-semibold mb-1">Top Matched Sources</p>
                      <div className="space-y-1">
                        {selected.matched_sources.slice(0, 3).map((src: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-neutral-400">#{i + 1}</span>
                            <span className="flex-1 truncate text-neutral-600">{src.title || src.url}</span>
                            <span className="text-neutral-400 shrink-0">{src.matchedWords} words</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selected.plagiarism_scanned_at && (
                    <p className="text-xs text-neutral-400">Scanned: {new Date(selected.plagiarism_scanned_at).toLocaleString('en-GB')}</p>
                  )}
                </div>
              )}

              {/* Previous revision notes */}
              {selected.revision_notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-700 mb-1">Previous Revision Notes</p>
                  <p className="text-sm text-amber-700">{selected.revision_notes}</p>
                </div>
              )}

              {/* Actions */}
              {(selected.status === 'submitted' || selected.status === 'supervisor_review') && !action && (
                <div className="space-y-2 pt-4 border-t">
                  <button onClick={() => setAction('approve')} className="btn-primary w-full">
                    Approve — Forward to Library Committee
                  </button>
                  <button onClick={() => setAction('return')} className="btn-ghost w-full text-amber-700 border border-amber-200 hover:bg-amber-50">
                    Return for Revisions
                  </button>
                </div>
              )}

              {action && (
                <div className="space-y-3 pt-4 border-t">
                  <div className={`rounded-xl p-3 text-sm font-semibold ${action === 'approve' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                    {action === 'approve' ? 'Approving for Library Committee review' : 'Returning to student for revisions'}
                  </div>
                  <div>
                    <label className="label text-sm">{action === 'approve' ? 'Notes (optional)' : 'Revision Notes *'}</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={4}
                      className="input w-full resize-none"
                      placeholder={action === 'approve' ? 'Add any notes for the committee…' : 'Describe the revisions required…'}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setAction(null)} disabled={submitting} className="btn-ghost flex-1">Cancel</button>
                    <button
                      onClick={handleAction}
                      disabled={submitting || (action === 'return' && !notes.trim())}
                      className={`flex-1 disabled:opacity-50 ${action === 'approve' ? 'btn-primary' : 'btn-ghost text-amber-700 border border-amber-300 hover:bg-amber-50'}`}
                    >
                      {submitting ? 'Processing…' : action === 'approve' ? 'Confirm Approval' : 'Return to Student'}
                    </button>
                  </div>
                </div>
              )}

              {selected.status !== 'submitted' && selected.status !== 'supervisor_review' && (
                <div className="bg-neutral-50 rounded-xl p-4 text-sm text-neutral-500 text-center">
                  This thesis is currently at <strong>{selected.status.replace(/_/g, ' ')}</strong> — no action required from you.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
