import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';
import BackButton from '@/components/BackButton';
import { roleCan } from '@/config/roles.config';
import { useAuth } from '@/hooks/useAuth';

const ITEM_TYPES = [
  'Undergraduate Long Essay', 'Final Year Project', 'Research Paper', 'Conference Paper',
  'Book Chapter', 'Government Publication', 'Learning Material', 'Historical Document',
];

const SUBJECT_CATEGORIES = [
  'Agriculture', 'Arts & Humanities', 'Biology', 'Chemistry', 'Computer Science',
  'Economics', 'Education', 'Engineering', 'Environmental Science', 'Geography',
  'Health Sciences', 'History', 'Law', 'Library Science', 'Linguistics',
  'Mathematics', 'Physics', 'Political Science', 'Psychology', 'Religious Studies',
  'Social Sciences', 'Sociology', 'Statistics',
];

const LANGUAGES = ['English', 'Yoruba', 'Hausa', 'Igbo', 'French', 'Arabic', 'Other'];

interface Author { name: string; orcid: string; orcidStatus: 'idle' | 'checking' | 'valid' | 'invalid'; orcidName: string; }

function orcidFormat(raw: string): string {
  return raw.replace(/\D/g, '').replace(/(.{4})/g, '$1-').replace(/-$/, '').substring(0, 19);
}

async function validateOrcid(orcid: string): Promise<{ valid: boolean; name: string }> {
  try {
    const cleaned = orcid.replace(/-/g, '').replace(/\s/g, '');
    if (cleaned.length !== 16) return { valid: false, name: '' };
    const formatted = `${cleaned.slice(0,4)}-${cleaned.slice(4,8)}-${cleaned.slice(8,12)}-${cleaned.slice(12,16)}`;
    const res = await fetch(`https://pub.orcid.org/v3.0/${formatted}/record`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { valid: false, name: '' };
    const data = await res.json();
    const given = data?.person?.name?.['given-names']?.value ?? '';
    const family = data?.person?.name?.['family-name']?.value ?? '';
    return { valid: true, name: `${given} ${family}`.trim() };
  } catch {
    return { valid: false, name: '' };
  }
}

export default function RepositorySubmit() {
  const navigate = useNavigate();
  const { role, isApproved } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [patron, setPatron] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState<Author[]>([{ name: '', orcid: '', orcidStatus: 'idle', orcidName: '' }]);
  const [abstract, setAbstract] = useState('');
  const [itemType, setItemType] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [language, setLanguage] = useState('English');
  const [department, setDepartment] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [embargoEnabled, setEmbargoEnabled] = useState(false);
  const [embargoMonths, setEmbargoMonths] = useState('6');
  const [visibility, setVisibility] = useState<'global' | 'faculty' | 'private'>('global');
  const [declared, setDeclared] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const isStudentType = ['Undergraduate Long Essay', 'Final Year Project'].includes(itemType);

  useEffect(() => {
    const load = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { setAuthLoading(false); return; }
      setUser(u);
      const { data: p } = await supabase.from('patrons').select('*').eq('user_id', u.id).maybeSingle();
      setPatron(p);
      if (p?.department) setDepartment(p.department);
      setAuthLoading(false);
    };
    load();
  }, []);

  const orcidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateAuthor = (idx: number, field: keyof Author, value: string) => {
    setAuthors(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === 'orcid') {
        updated[idx].orcidStatus = 'idle';
        updated[idx].orcidName = '';
        if (orcidTimer.current) clearTimeout(orcidTimer.current);
        const formatted = orcidFormat(value);
        updated[idx].orcid = formatted;
        if (formatted.replace(/-/g, '').length === 16) {
          updated[idx].orcidStatus = 'checking';
          orcidTimer.current = setTimeout(async () => {
            const result = await validateOrcid(formatted);
            setAuthors(prev2 => {
              const a2 = [...prev2];
              a2[idx] = { ...a2[idx], orcidStatus: result.valid ? 'valid' : 'invalid', orcidName: result.name };
              return a2;
            });
          }, 800);
        }
        return updated;
      }
      return updated;
    });
  };

  const addAuthor = () => setAuthors(prev => [...prev, { name: '', orcid: '', orcidStatus: 'idle', orcidName: '' }]);
  const removeAuthor = (idx: number) => setAuthors(prev => prev.filter((_, i) => i !== idx));

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords(prev => [...prev, kw]);
    }
    setKeywordInput('');
  };
  const removeKeyword = (kw: string) => setKeywords(prev => prev.filter(k => k !== kw));
  const toggleSubject = (s: string) =>
    setSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const validate = (): string => {
    if (!title.trim()) return 'Title is required.';
    if (!authors[0]?.name.trim()) return 'At least one author name is required.';
    if (!abstract.trim()) return 'Abstract is required.';
    if (!itemType) return 'Item type is required.';
    if (subjects.length === 0) return 'Select at least one subject category.';
    if (keywords.length < 5) return `Add at least 5 keywords (${keywords.length} so far).`;
    if (!file) return 'Please upload a PDF file.';
    if (file.type !== 'application/pdf') return 'Only PDF files are accepted.';
    if (file.size > 100 * 1024 * 1024) return 'File must be under 100 MB.';
    if (!declared) return 'You must declare this is your original work.';
    return '';
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSubmitting(true);

    try {
      let fileUrl: string | null = null;
      let fileSizeBytes: number | null = null;

      if (file) {
        const path = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: uploadErr } = await supabase.storage
          .from('repository')
          .upload(path, file, { contentType: 'application/pdf', upsert: false });
        if (uploadErr) {
          if (!uploadErr.message?.toLowerCase().includes('bucket')) throw new Error(`Upload failed: ${uploadErr.message}`);
          fileUrl = null;
        } else {
          const { data: { publicUrl } } = supabase.storage.from('repository').getPublicUrl(path);
          fileUrl = publicUrl;
        }
        fileSizeBytes = file.size;
      }

      const embargoUntil = embargoEnabled
        ? new Date(Date.now() + parseInt(embargoMonths) * 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const authorsJson = authors.filter(a => a.name.trim()).map(a => ({
        name: a.name.trim(),
        orcid: a.orcid || undefined,
      }));

      const { data: inserted, error: insertErr } = await supabase.from('repository_items').insert({
        title: title.trim(),
        authors: authorsJson,
        abstract: abstract.trim(),
        item_type: itemType,
        type: itemType,
        subjects,
        keywords,
        year: parseInt(year),
        language,
        department,
        supervisor: supervisor.trim() || null,
        file_url: fileUrl,
        file_size: fileSizeBytes,
        embargo_until: embargoUntil,
        visibility,
        status: 'submitted',
        submitter_id: user.id,
        faculty_code: patron?.faculty_code ?? null,
      }).select('id').single();

      if (insertErr) throw new Error(insertErr.message);

      // Fire-and-forget background plagiarism scan. Does not block submission;
      // the result (and any warning) surfaces on the item page once complete.
      supabase.functions
        .invoke('academic-integrity', { body: { action: 'scan-repository', itemId: inserted.id } })
        .catch(() => { /* non-blocking */ });

      navigate(`/repository/${inserted.id}`, { state: { submitted: true } });
    } catch (e: any) {
      setError(e.message ?? 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="card p-10 text-center max-w-sm w-full">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="text-xl font-bold mb-2">Sign in required</h2>
          <p className="text-neutral-600 text-sm mb-6">You must be logged in to submit works to the repository.</p>
          <Link to="/login" className="btn-primary w-full">Sign In</Link>
          <Link to="/register" className="btn-outline w-full mt-2">Create Account</Link>
        </div>
      </div>
    );
  }

  if (!isApproved || !roleCan(role, 'repositorySubmit')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="card p-10 text-center max-w-sm w-full">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="text-xl font-bold mb-2">Not available for your account</h2>
          <p className="text-neutral-600 text-sm mb-6">
            Repository submission is available to researchers, lecturers and library staff.
          </p>
          <Link to="/repository" className="btn-primary w-full">Browse Repository</Link>
        </div>
      </div>
    );
  }


  return (
    <div className="bg-neutral-50 min-h-screen">
      <div className="page-header">
        <div className="section">
          <BackButton />
          <Link to="/repository" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 mb-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Repository
          </Link>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>Submit Work</h1>
          <p className="text-neutral-600 mt-1">Share your scholarly work with the ESUT community and beyond.</p>
        </div>
      </div>

      <div className="section py-6">
        <div className="max-w-3xl space-y-6">

          {/* Workflow banner */}
          <div className="card p-4 bg-primary-50 border border-primary-200">
            <p className="text-sm text-primary-800">
              <strong>Submission workflow:</strong> Draft → Submitted → Under Review → Approved → Published.
              You will receive an email notification at each stage.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">{error}</div>
          )}

          {/* Title */}
          <div className="card p-6 space-y-4">
            <h2 className="font-bold text-lg" style={{ color: 'var(--color-primary)' }}>Basic Information</h2>

            <div>
              <label className="label">Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="input w-full" placeholder="Full title of your work" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Item Type *</label>
                <select value={itemType} onChange={e => setItemType(e.target.value)} className="input w-full">
                  <option value="">Select type…</option>
                  {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Year *</label>
                <select value={year} onChange={e => setYear(e.target.value)} className="input w-full">
                  {Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() - i)).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Language *</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} className="input w-full">
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Department</label>
                <input value={department} onChange={e => setDepartment(e.target.value)} className="input w-full"
                  placeholder={patron?.department ?? 'Your department'} />
              </div>
            </div>

            {isStudentType && (
              <div>
                <label className="label">Faculty Supervisor *</label>
                <input value={supervisor} onChange={e => setSupervisor(e.target.value)} className="input w-full"
                  placeholder="Supervisor's full name" />
              </div>
            )}
          </div>

          {/* Authors */}
          <div className="card p-6 space-y-4">
            <h2 className="font-bold text-lg" style={{ color: 'var(--color-primary)' }}>Authors</h2>
            {authors.map((author, idx) => (
              <div key={idx} className="border border-neutral-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-700">Author {idx + 1}</span>
                  {idx > 0 && (
                    <button onClick={() => removeAuthor(idx)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  )}
                </div>
                <div>
                  <label className="label text-xs mb-1 block">Full Name *</label>
                  <input value={author.name} onChange={e => updateAuthor(idx, 'name', e.target.value)}
                    className="input w-full" placeholder="First Last" />
                </div>
                <div>
                  <label className="label text-xs mb-1 block">ORCID (optional)</label>
                  <div className="relative">
                    <input
                      value={author.orcid}
                      onChange={e => updateAuthor(idx, 'orcid', e.target.value)}
                      className="input w-full pr-8"
                      placeholder="0000-0000-0000-0000"
                      maxLength={19}
                    />
                    {author.orcidStatus === 'checking' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">…</span>
                    )}
                    {author.orcidStatus === 'valid' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 text-sm">✓</span>
                    )}
                    {author.orcidStatus === 'invalid' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 text-sm">✗</span>
                    )}
                  </div>
                  {author.orcidStatus === 'valid' && author.orcidName && (
                    <p className="text-xs text-green-600 mt-1">✓ Verified: {author.orcidName}</p>
                  )}
                  {author.orcidStatus === 'invalid' && (
                    <p className="text-xs text-red-500 mt-1">ORCID not found. Please check the ID.</p>
                  )}
                </div>
              </div>
            ))}
            <button onClick={addAuthor} className="btn-ghost text-sm">+ Add Author</button>
          </div>

          {/* Abstract */}
          <div className="card p-6 space-y-4">
            <h2 className="font-bold text-lg" style={{ color: 'var(--color-primary)' }}>Abstract & Keywords</h2>
            <div>
              <label className="label">Abstract *</label>
              <textarea value={abstract} onChange={e => setAbstract(e.target.value)}
                rows={6} className="input w-full resize-none"
                placeholder="Provide a comprehensive abstract of your work…" />
              <p className="text-xs text-neutral-400 mt-1">{abstract.length} characters</p>
            </div>

            <div>
              <label className="label">Subject Categories *</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {SUBJECT_CATEGORIES.map(s => (
                  <button key={s} type="button"
                    onClick={() => toggleSubject(s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      subjects.includes(s)
                        ? 'border-primary-600 bg-primary-100 text-primary-800'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-primary-400'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-xs text-neutral-400 mt-2">{subjects.length} selected</p>
            </div>

            <div>
              <label className="label">Keywords * <span className="text-neutral-400 font-normal">(minimum 5)</span></label>
              <div className="flex gap-2">
                <input
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                  className="input flex-1" placeholder="Type a keyword and press Enter" />
                <button onClick={addKeyword} className="btn-outline text-sm px-3">Add</button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {keywords.map(kw => (
                  <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded-full text-xs">
                    {kw}
                    <button onClick={() => removeKeyword(kw)} className="text-neutral-400 hover:text-red-500 ml-0.5">×</button>
                  </span>
                ))}
              </div>
              {keywords.length < 5 && keywords.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">{5 - keywords.length} more keyword(s) needed.</p>
              )}
            </div>
          </div>

          {/* File Upload */}
          <div className="card p-6 space-y-4">
            <h2 className="font-bold text-lg" style={{ color: 'var(--color-primary)' }}>File Upload</h2>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-neutral-300 rounded-xl p-10 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
            >
              <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
              {file ? (
                <div>
                  <p className="text-2xl mb-2">📄</p>
                  <p className="font-semibold text-neutral-800">{file.name}</p>
                  <p className="text-sm text-neutral-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <button onClick={e => { e.stopPropagation(); setFile(null); }} className="text-xs text-red-500 hover:text-red-700 mt-2">Remove</button>
                </div>
              ) : (
                <div>
                  <p className="text-3xl mb-2">☁️</p>
                  <p className="font-semibold text-neutral-700">Click to upload PDF</p>
                  <p className="text-xs text-neutral-400 mt-1">PDF only · Max 100 MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Access & Embargo */}
          <div className="card p-6 space-y-4">
            <h2 className="font-bold text-lg" style={{ color: 'var(--color-primary)' }}>Access & Embargo</h2>

            <div>
              <label className="label">Visibility *</label>
              <div className="space-y-2 mt-1">
                {([
                  { value: 'global', label: 'Open Access', desc: 'Visible to everyone worldwide' },
                   { value: 'faculty', label: 'ESUT Members Only', desc: 'Visible only to authenticated ESUT patrons' },
                  { value: 'private', label: 'Private', desc: 'Visible only to you and library administrators' },
                ] as const).map(opt => (
                  <label key={opt.value} className="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-neutral-50 transition-colors">
                    <input type="radio" name="visibility" value={opt.value}
                      checked={visibility === opt.value} onChange={() => setVisibility(opt.value)}
                      className="mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className="text-xs text-neutral-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={embargoEnabled} onChange={e => setEmbargoEnabled(e.target.checked)} className="rounded" />
                <span className="text-sm font-medium">Apply embargo period</span>
              </label>
              {embargoEnabled && (
                <div className="mt-3 ml-7">
                  <label className="label text-xs mb-1 block">Embargo Duration</label>
                  <select value={embargoMonths} onChange={e => setEmbargoMonths(e.target.value)} className="input w-40">
                    <option value="6">6 months</option>
                    <option value="12">12 months</option>
                    <option value="24">24 months</option>
                  </select>
                  <p className="text-xs text-neutral-500 mt-1">Full text will be restricted until embargo expires.</p>
                </div>
              )}
            </div>
          </div>

          {/* Declaration */}
          <div className="card p-6">
            <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--color-primary)' }}>Declaration</h2>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={declared} onChange={e => setDeclared(e.target.checked)} className="rounded mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm leading-relaxed text-neutral-700">
                  I declare that this work is my original contribution and does not infringe any copyright.
                   I grant {institutionConfig.name ?? 'ESUT'} Library the non-exclusive right to preserve and
                  provide access to this work. I understand this submission will be reviewed by a librarian
                  before publication.
                </p>
                <p className="text-xs text-neutral-400 mt-2">
                  Submitted: {new Date().toLocaleString('en-GB')} — recorded on confirmation
                </p>
              </div>
            </label>
          </div>

          {/* Submit button */}
          <div className="flex gap-3 pb-10">
            <button
              onClick={handleSubmit}
              disabled={submitting || !declared}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading & Submitting…
                </span>
              ) : 'Submit for Review'}
            </button>
            <button onClick={() => navigate('/repository')} className="btn-ghost">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
