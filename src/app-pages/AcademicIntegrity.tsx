import { useState, useRef } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { supabase } from '@/lib/supabase';

const GREEN = '#6B1D2A';
const GOLD = '#D4A017';

type Tab = 'plagiarism' | 'citation';

interface PlagResult {
  similarity_score: number;
  ai_content_score: number;
  summary: string;
  wordCount: number;
  flagged_passages: { text: string; reason: string }[];
  matched_sources: { description: string; similarity: number }[];
}

interface CitationItem {
  reference: string;
  year: number | null;
  valid: boolean;
  issues: string[];
  corrected: string;
  outdated: boolean;
}

interface CiteResult {
  citations: CitationItem[];
  citation_count: number;
  outdated_count: number;
  currentYear: number;
  outdatedBefore: number;
}

async function runIntegrityCheck(action: Tab, text: string) {
  const { data, error } = await supabase.functions.invoke('academic-integrity', {
    body: { action, text },
  });
  if (!error && !data?.error) return data;

  const res = await fetch('/api/academic-integrity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, text }),
  });
  const fallbackData = await res.json().catch(() => ({}));
  if (!res.ok || fallbackData?.error) {
    throw new Error(fallbackData?.error ?? error?.message ?? 'Check failed.');
  }
  return fallbackData;
}

function scoreColor(score: number) {
  if (score <= 20) return { bg: 'rgba(22,163,74,0.1)', fg: '#15803d', label: 'Low' };
  if (score <= 40) return { bg: 'rgba(202,168,76,0.15)', fg: '#a16207', label: 'Moderate' };
  return { bg: 'rgba(220,38,38,0.1)', fg: '#dc2626', label: 'High' };
}

function Gauge({ label, score }: { label: string; score: number }) {
  const c = scoreColor(score);
  return (
    <div className="rounded-xl border border-neutral-200 p-4 bg-white">
      <div className="text-sm text-neutral-500 mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold" style={{ color: c.fg }}>{Math.round(score)}%</span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.fg }}>
          {c.label}
        </span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-neutral-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(score, 100)}%`, background: c.fg }} />
      </div>
    </div>
  );
}

export default function AcademicIntegrity() {
  usePageTitle('Academic Integrity Checker');
  const [tab, setTab] = useState<Tab>('plagiarism');

  return (
    <div>
      <div className="text-white" style={{ background: GREEN }}>
        <div className="section pt-24 pb-12">
          <div className="flex items-center gap-2 text-white/60 text-sm mb-4 font-medium">
            <a href="/" className="hover:text-white transition-colors">Home</a>
            <span>›</span>
            <span>Academic Integrity</span>
          </div>
          <h1 className="text-4xl font-bold mb-3">Academic Integrity Checker</h1>
          <p className="text-white/75 text-lg max-w-3xl">
            Check your writing for originality and AI-generated content, and validate your references against
            APA 7th edition. An indicative tool to help you review your work before submission.
          </p>
        </div>
      </div>

      <div className="section pt-6">
        <div className="flex gap-2 border-b border-neutral-200">
          {([['plagiarism', 'Plagiarism & AI Check'], ['citation', 'Citation Checker (APA 7th)']] as const).map(
            ([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                  tab === key ? '' : 'border-transparent text-neutral-500 hover:text-neutral-800'
                }`}
                style={tab === key ? { color: GREEN, borderColor: GREEN } : undefined}
              >
                {label}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="section py-10">
        {tab === 'plagiarism' ? <PlagiarismTab /> : <CitationTab />}
      </div>
    </div>
  );
}

function PlagiarismTab() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlagResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    if (file.type && !file.type.startsWith('text') && !file.name.match(/\.(txt|md|csv)$/i)) {
      setError('Please choose a plain text file (.txt, .md, or .csv). For PDF or Word files, copy the text and paste it into the text box.');
      return;
    }
    setError(null);
    setText(await file.text());
  };

  const run = async () => {
    setError(null);
    setResult(null);
    if (text.trim().length < 40) {
      setError('Please provide at least 40 characters of text.');
      return;
    }
    setLoading(true);
    try {
      const data = await runIntegrityCheck('plagiarism', text);
      setResult(data as PlagResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          placeholder="Paste your text, abstract, or essay here…"
          className={inputCls}
        />
        <div className="flex items-center justify-between mt-3 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={run}
              disabled={loading}
              className="px-5 py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
              style={{ background: GREEN }}
            >
              {loading ? 'Analysing…' : 'Check Originality'}
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2.5 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Upload .txt
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.csv,.pdf,.doc,.docx,text/plain,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </div>
          <span className="text-xs text-neutral-400">{text.trim().split(/\s+/).filter(Boolean).length} words</span>
        </div>
        {error && <p className="text-sm text-error-600 mt-3">{error}</p>}
        <p className="text-xs text-neutral-400 mt-4 leading-relaxed">
          This is an indicative AI-based assessment without web-wide source matching. Use it to guide your own
          review — it is not a definitive plagiarism verdict.
        </p>
      </div>

      <div>
        {!result ? (
          <div className="h-full min-h-64 rounded-xl border border-dashed border-neutral-300 flex items-center justify-center text-center p-8">
            <div>
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-neutral-500 text-sm">Your originality report will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Gauge label="Similarity / Unoriginal" score={result.similarity_score} />
              <Gauge label="Likely AI-generated" score={result.ai_content_score} />
            </div>
            {result.similarity_score > 20 && (
              <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700">
                ⚠️ This text may contain substantial unoriginal content
                ({Math.round(result.similarity_score)}% similarity detected). Please review before submission.
              </div>
            )}
            {result.summary && <p className="text-sm text-neutral-700">{result.summary}</p>}

            {result.flagged_passages.length > 0 && (
              <div>
                <h3 className="font-semibold text-neutral-900 mb-2 text-sm">Flagged passages</h3>
                <div className="space-y-2">
                  {result.flagged_passages.map((p, i) => (
                    <div key={i} className="rounded-lg border border-neutral-200 p-3 bg-white">
                      <p className="text-sm text-neutral-800 italic">“{p.text}”</p>
                      <p className="text-xs text-neutral-500 mt-1">{p.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.matched_sources.length > 0 && (
              <div>
                <h3 className="font-semibold text-neutral-900 mb-2 text-sm">Indicative matches</h3>
                <ul className="space-y-1">
                  {result.matched_sources.map((s, i) => (
                    <li key={i} className="flex items-center justify-between text-sm border-b border-neutral-100 py-1.5">
                      <span className="text-neutral-700">{s.description}</span>
                      <span className="text-neutral-400">{Math.round(s.similarity)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CitationTab() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CiteResult | null>(null);

  const run = async () => {
    setError(null);
    setResult(null);
    if (text.trim().length < 10) {
      setError('Please paste at least one citation.');
      return;
    }
    setLoading(true);
    try {
      const data = await runIntegrityCheck('citation', text);
      setResult(data as CiteResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          placeholder={'Paste your reference list here, one per line. e.g.\n\nSmith, J. (2019). The title of the work. Publisher.'}
          className={inputCls}
        />
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={run}
            disabled={loading}
            className="px-5 py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-50"
            style={{ background: GREEN }}
          >
            {loading ? 'Checking…' : 'Check Citations'}
          </button>
        </div>
        {error && <p className="text-sm text-error-600 mt-3">{error}</p>}
        <p className="text-xs text-neutral-400 mt-4 leading-relaxed">
          Validates references against APA 7th edition. References older than 10 years are flagged with a
          warning icon so you can consider more current sources.
        </p>
      </div>

      <div>
        {!result ? (
          <div className="h-full min-h-64 rounded-xl border border-dashed border-neutral-300 flex items-center justify-center text-center p-8">
            <div>
              <div className="text-4xl mb-3">📑</div>
              <p className="text-neutral-500 text-sm">Your citation report will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 font-medium">
                {result.citation_count} reference{result.citation_count === 1 ? '' : 's'}
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-success-100 text-success-700 font-medium">
                {result.citations.filter((c) => c.valid).length} well-formed
              </span>
              {result.outdated_count > 0 && (
                <span className="px-3 py-1.5 rounded-lg bg-warning-100 text-warning-700 font-medium">
                  ⚠️ {result.outdated_count} older than 10 years
                </span>
              )}
            </div>

            {result.citation_count === 0 ? (
              <p className="text-sm text-neutral-500">No recognisable references found in the text.</p>
            ) : (
              <div className="space-y-3">
                {result.citations.map((c, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-4 bg-white ${
                      c.valid ? 'border-neutral-200' : 'border-error-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">
                        {c.valid ? '✅' : '❌'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-neutral-800">{c.reference}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {c.year && (
                            <span className="text-xs text-neutral-400">{c.year}</span>
                          )}
                          {c.outdated && (
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded-full bg-warning-100 text-warning-700"
                              title={`Older than 10 years (before ${result.outdatedBefore})`}
                            >
                              ⚠️ Outdated source
                            </span>
                          )}
                        </div>
                        {c.issues.length > 0 && (
                          <ul className="mt-2 space-y-0.5">
                            {c.issues.map((iss, j) => (
                              <li key={j} className="text-xs text-error-600">• {iss}</li>
                            ))}
                          </ul>
                        )}
                        {!c.valid && c.corrected && (
                          <p className="text-xs text-neutral-600 mt-2">
                            <span className="font-semibold" style={{ color: GOLD }}>Suggested: </span>
                            {c.corrected}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
