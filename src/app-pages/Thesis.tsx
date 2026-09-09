import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const SUBMISSION_TYPES = [
  { id: 'Undergraduate Long Essay', label: 'Undergraduate Long Essay', description: 'Undergraduate long essay submissions', icon: '📄' },
  { id: 'Final Year Project', label: 'Final Year Project', description: 'Final year undergraduate project reports', icon: '🎓' },
  { id: 'M.Ed. Dissertation', label: 'M.Ed. Dissertation', description: 'Master of Education dissertations', icon: '📚' },
  { id: 'B.Ed. Project', label: 'B.Ed. Project', description: 'Bachelor of Education project submissions', icon: '✏️' },
  { id: 'thesis', label: 'PhD Thesis', description: 'Doctor of Philosophy theses', icon: '🔬' },
  { id: 'dissertation', label: 'Dissertation', description: 'Postgraduate dissertations', icon: '📝' },
];

const WORKFLOW_STAGES = [
  { id: 'submitted', label: 'Submitted', desc: 'Initial submission received and logged' },
  { id: 'supervisor_review', label: 'Supervisor Review', desc: 'Primary supervisor reviews and endorses' },
  { id: 'committee_review', label: 'Committee Review', desc: 'Library committee approves for publication' },
  { id: 'published', label: 'Published', desc: 'Published to repository with DOI' },
];

export default function Thesis() {
  const [stats, setStats] = useState({ total: 0, byType: [] as { type: string; count: number }[] });
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: theses }, { data: recentData }] = await Promise.all([
        supabase.from('theses').select('submission_type').eq('status', 'published'),
        supabase.from('theses').select('id, title, submission_type, reference_no, programme, created_at')
          .eq('status', 'published').order('created_at', { ascending: false }).limit(6),
      ]);

      const typeMap: Record<string, number> = {};
      (theses ?? []).forEach((t: any) => {
        const k = t.submission_type ?? 'Other';
        typeMap[k] = (typeMap[k] ?? 0) + 1;
      });
      const byType = Object.entries(typeMap)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

      setStats({ total: theses?.length ?? 0, byType });
      setRecent(recentData ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="page">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-800 to-primary-700 text-white py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-primary-200 text-sm font-medium uppercase tracking-widest mb-3">ESUT Academic Repository</p>
          <h1 className="text-5xl font-bold mb-5">Thesis &amp; Academic Work Portal</h1>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Submit, track, and publish your academic work. From undergraduate long essays to PhD theses — your research belongs in the permanent record.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/thesis/submit" className="btn-primary text-lg px-8 py-3">
              Submit Your Work
            </Link>
            <Link to="/thesis/status" className="bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded-xl px-8 py-3 font-semibold transition-colors">
              Check Status
            </Link>
          </div>
        </div>
      </section>

      {/* Submission types */}
      <section className="section">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold">What Can You Submit?</h2>
          <p className="text-neutral-500 mt-2">We accept all forms of academic work from ESUT students and researchers.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SUBMISSION_TYPES.map(t => (
            <div key={t.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="text-3xl mb-3">{t.icon}</div>
              <h3 className="font-bold text-neutral-900 mb-1">{t.label}</h3>
              <p className="text-sm text-neutral-500">{t.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4-stage workflow */}
      <section className="section bg-neutral-50 rounded-2xl py-12 px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold">Submission Workflow</h2>
          <p className="text-neutral-500 mt-2">Your submission goes through four clear stages before publication.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {WORKFLOW_STAGES.map((stage, i) => (
            <div key={stage.id} className="text-center">
              <div className="w-14 h-14 rounded-full bg-primary-700 text-white flex items-center justify-center text-xl font-bold mx-auto mb-3">
                {i + 1}
              </div>
              <h3 className="font-bold text-neutral-900 mb-1">{stage.label}</h3>
              <p className="text-sm text-neutral-500">{stage.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      {!loading && (
        <section className="section">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6 text-center">
              <p className="text-neutral-500 text-sm mb-2">Total Published Works</p>
              <p className="text-5xl font-bold text-primary-700">{stats.total}</p>
            </div>
            <div className="md:col-span-2 card p-6">
              <h3 className="font-bold text-neutral-800 mb-4">Published by Type</h3>
              {stats.byType.length === 0 ? (
                <p className="text-neutral-400 text-sm">No published works yet.</p>
              ) : (
                <div className="space-y-3">
                  {stats.byType.map(item => (
                    <div key={item.type} className="flex items-center gap-3">
                      <span className="w-40 text-sm font-medium text-neutral-700 truncate">{item.type}</span>
                      <div className="flex-1 bg-neutral-200 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-primary-600 rounded-full"
                          style={{ width: `${(item.count / Math.max(...stats.byType.map(b => b.count), 1)) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-sm font-bold text-primary-700">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Recent publications */}
      {recent.length > 0 && (
        <section className="section">
          <h2 className="text-2xl font-bold mb-6">Recent Publications</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recent.map(t => (
              <div key={t.id} className="card p-4 hover:shadow-md transition-shadow">
                <span className="badge badge-secondary text-xs mb-2 inline-block">{t.submission_type}</span>
                <p className="font-semibold text-sm text-neutral-900 line-clamp-2">{t.title}</p>
                {t.programme && <p className="text-xs text-neutral-400 mt-1">{t.programme}</p>}
                {t.reference_no && <p className="text-xs text-neutral-300 mt-1 font-mono">{t.reference_no}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="section text-center bg-primary-50 rounded-2xl py-12">
        <h2 className="text-2xl font-bold mb-3">Ready to Submit Your Work?</h2>
        <p className="text-neutral-600 mb-6 max-w-xl mx-auto">
          Complete our guided 5-step submission form. You'll receive a reference number immediately.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/thesis/submit" className="btn-primary px-8 py-3">Start Submission</Link>
          <a href="mailto:library@esut.edu.ng" className="btn-outline px-8 py-3">Contact Library</a>
        </div>
      </section>
    </div>
  );
}
