import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import BackButton from '@/components/BackButton';

interface ThesisRecord {
  id: string;
  title: string;
  status: string;
  reference_no: string | null;
  submission_type: string | null;
  programme: string | null;
  session: string | null;
  created_at: string;
  updated_at: string;
  doi: string | null;
  revision_notes: string | null;
  embargo_enabled: boolean | null;
  similarity_score: number | null;
}

const STAGES = [
  { id: 'submitted', label: 'Submitted', desc: 'Initial submission received' },
  { id: 'supervisor_review', label: 'Supervisor Review', desc: 'Primary supervisor reviewing' },
  { id: 'committee_review', label: 'Committee Review', desc: 'Library committee reviewing' },
  { id: 'published', label: 'Published', desc: 'Published to repository' },
];

function stageIndex(status: string) {
  const map: Record<string, number> = {
    submitted: 0,
    supervisor_review: 1,
    returned_to_student: 1,
    committee_review: 2,
    published: 3,
  };
  return map[status] ?? 0;
}

export default function ThesisStatusPublic() {
  const [params] = useSearchParams();
  const [searchType, setSearchType] = useState<'ref' | 'id'>('ref');
  const [searchValue, setSearchValue] = useState(params.get('ref') ?? '');
  const [thesis, setThesis] = useState<ThesisRecord | null>(null);
  const [workflow, setWorkflow] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (params.get('ref')) handleSearch(null, params.get('ref')!);
  }, []);

  const handleSearch = async (e: React.FormEvent | null, overrideVal?: string) => {
    e?.preventDefault();
    const val = (overrideVal ?? searchValue).trim();
    if (!val) { setError('Please enter a reference number or thesis ID.'); return; }
    setLoading(true);
    setError('');
    setThesis(null);
    setWorkflow([]);

    try {
      let query = supabase.from('theses').select('id, title, status, reference_no, submission_type, programme, session, created_at, updated_at, doi, revision_notes, embargo_enabled, similarity_score');
      if (searchType === 'ref') {
        query = query.eq('reference_no', val);
      } else {
        query = query.eq('id', val);
      }
      const { data, error: qErr } = await query.maybeSingle();
      if (qErr) throw qErr;
      if (!data) { setError('No thesis found. Please check your reference number.'); setSearched(true); setLoading(false); return; }

      setThesis(data);

      // Load workflow history
      const { data: wf } = await supabase
        .from('thesis_workflow')
        .select('stage, action, notes, created_at')
        .eq('thesis_id', data.id)
        .order('created_at', { ascending: true });
      setWorkflow(wf ?? []);
    } catch (e: any) {
      setError('Error searching. Please try again.');
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const currentStage = thesis ? stageIndex(thesis.status) : -1;
  const isReturned = thesis?.status === 'returned_to_student';

  return (
    <div className="page">
      <div className="page-header">
        <BackButton />
        <h1>Thesis Status Tracker</h1>
        <p>Check the current status of your submitted work</p>
      </div>

      <section className="section max-w-2xl mx-auto">
        {/* Search form */}
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">Find Your Submission</h2>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-4">
              {(['ref', 'id'] as const).map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" value={t} checked={searchType === t} onChange={() => setSearchType(t)} />
                  {t === 'ref' ? 'Reference No. (e.g. ULE-2026-12345)' : 'UUID'}
                </label>
              ))}
            </div>
            <input
              type="text"
              className="input w-full"
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              placeholder={searchType === 'ref' ? 'ULE-2026-12345' : 'Thesis UUID'}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Searching…' : 'Check Status'}
            </button>
          </form>
        </div>

        {searched && !thesis && !loading && !error && (
          <p className="text-center text-neutral-500 py-8">No thesis found with those details.</p>
        )}

        {thesis && (
          <div className="space-y-6">
            {/* Summary card */}
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900">{thesis.title}</h3>
                  <p className="text-neutral-500 text-sm mt-1">{thesis.submission_type} · {thesis.programme} · {thesis.session}</p>
                </div>
                <span className={`badge text-xs shrink-0 ${thesis.status === 'published' ? 'badge-success' : thesis.status === 'returned_to_student' ? 'badge-error' : 'badge-primary'}`}>
                  {thesis.status.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {thesis.reference_no && (
                  <div>
                    <p className="text-neutral-400 text-xs mb-0.5">Reference No.</p>
                    <p className="font-mono font-semibold text-primary-700">{thesis.reference_no}</p>
                  </div>
                )}
                <div>
                  <p className="text-neutral-400 text-xs mb-0.5">Submitted</p>
                  <p className="font-medium">{new Date(thesis.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                {thesis.doi && (
                  <div>
                    <p className="text-neutral-400 text-xs mb-0.5">DOI</p>
                    <a href={`https://doi.org/${thesis.doi}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline font-medium">{thesis.doi}</a>
                  </div>
                )}
                {thesis.similarity_score !== null && (
                  <div>
                    <p className="text-neutral-400 text-xs mb-0.5">Similarity Check</p>
                    <p className={`font-semibold ${thesis.similarity_score < 15 ? 'text-green-600' : thesis.similarity_score < 30 ? 'text-amber-600' : 'text-red-600'}`}>
                      {thesis.similarity_score.toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Returned notice */}
            {isReturned && thesis.revision_notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h4 className="font-bold text-amber-800 mb-2">Revisions Required</h4>
                <p className="text-amber-700 text-sm">{thesis.revision_notes}</p>
                <p className="text-xs text-amber-500 mt-2">Please make the requested revisions and resubmit.</p>
              </div>
            )}

            {/* 4-stage progress bar */}
            <div className="card p-6">
              <h3 className="font-bold mb-6 text-neutral-800">Submission Progress</h3>
              <div className="relative">
                {/* Connector line */}
                <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-neutral-200" />
                <div className="space-y-8">
                  {STAGES.map((stage, i) => {
                    const done = i < currentStage;
                    const active = i === currentStage;
                    const future = i > currentStage;
                    const wfEntry = workflow.find(w => w.stage === stage.id || w.action === stage.id);

                    return (
                      <div key={stage.id} className="relative pl-14">
                        <div className={`absolute left-0 top-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${done ? 'bg-green-500 text-white' : active ? 'bg-primary-700 text-white' : 'bg-neutral-200 text-neutral-400'}`}>
                          {done ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          ) : i + 1}
                        </div>
                        <div className={future ? 'opacity-40' : ''}>
                          <h4 className="font-semibold text-neutral-900">{stage.label}</h4>
                          <p className="text-sm text-neutral-500 mt-0.5">{stage.desc}</p>
                          {active && !isReturned && (
                            <div className="mt-2 text-xs bg-primary-50 border border-primary-200 rounded-lg px-3 py-2 text-primary-700">
                              Currently at this stage — you will be notified when it progresses.
                            </div>
                          )}
                          {wfEntry && (
                            <p className="text-xs text-neutral-400 mt-1">
                              {new Date(wfEntry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {wfEntry.notes && ` · ${wfEntry.notes}`}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Published */}
            {thesis.status === 'published' && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
                <h3 className="text-xl font-bold text-green-800 mb-2">Congratulations!</h3>
                 <p className="text-green-700 text-sm mb-4">Your work is now published in the ESUT institutional repository.</p>
                {thesis.doi && (
                  <a href={`https://doi.org/${thesis.doi}`} target="_blank" rel="noopener noreferrer" className="btn-primary inline-block">
                    View Published Work
                  </a>
                )}
              </div>
            )}

            <div className="bg-neutral-50 rounded-xl p-4 text-sm text-center">
               <p className="text-neutral-500">Questions? Contact the library: <a href="mailto:library@esut.edu.ng" className="text-primary-600 hover:underline font-medium">library@esut.edu.ng</a></p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
