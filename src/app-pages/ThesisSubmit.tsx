import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';
import { deriveDegree } from '@/lib/thesisFields';
import BackButton from '@/components/BackButton';

const SUBMISSION_TYPES = ['Undergraduate Long Essay', 'Final Year Project', 'M.Ed. Dissertation', 'B.Ed. Project', 'thesis', 'dissertation', 'project'];
const FACULTIES = ['Faculty of Arts', 'Faculty of Science', 'Faculty of Management & Social Sciences', 'Faculty of Education', 'Faculty of Vocational & Technical Education'];
const PROGRAMMES = ['B.Ed. Education', 'B.Ed. English', 'B.Ed. Mathematics', 'B.Ed. Biology', 'B.Ed. Chemistry', 'B.Ed. Physics', 'B.Ed. Economics', 'B.Ed. History', 'B.Ed. Social Studies', 'M.Ed. Curriculum Studies', 'M.Ed. Educational Administration', 'M.Ed. Guidance & Counselling', 'Ph.D. Education'];
const SESSIONS = ['2025/2026', '2024/2025', '2023/2024', '2022/2023', '2021/2022'];
const DEPARTMENTS = ['Arts Education', 'Science Education', 'Social Science Education', 'Technology & Vocational Education', 'Educational Foundations', 'Educational Management & Policy', 'Guidance & Counselling', 'Curriculum Studies', 'Library and Information Science'];
const SUBJECTS = ['Education', 'English Language', 'Mathematics', 'Biology', 'Chemistry', 'Physics', 'History', 'Economics', 'Geography', 'Social Studies', 'Agricultural Science', 'Integrated Science', 'Computer Science', 'French', 'Yoruba', 'Islamic Studies', 'Christian Religious Studies', 'Technical Education', 'Home Economics', 'Physical Education', 'Fine Arts', 'Music', 'Business Education'];

interface Supervisor {
  name: string;
  email: string;
  orcid: string;
  role: 'primary' | 'secondary';
}

export default function ThesisSubmit() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState('');
  const [patronId, setPatronId] = useState('');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [referenceNo, setReferenceNo] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Step 1 — Details
  const [title, setTitle] = useState('');
  const [submissionType, setSubmissionType] = useState('Undergraduate Long Essay');
  const [programme, setProgramme] = useState('');
  const [department, setDepartment] = useState('');
  const [faculty, setFaculty] = useState('');
  const [session, setSession] = useState(SESSIONS[0]);
  const [abstract, setAbstract] = useState('');

  // Step 2 — Supervision
  const [supervisors, setSupervisors] = useState<Supervisor[]>([{ name: '', email: '', orcid: '', role: 'primary' }]);

  // Step 3 — Classification
  const [subjects, setSubjects] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState('');
  const [embargoEnabled, setEmbargoEnabled] = useState(false);
  const [embargoMonths, setEmbargoMonths] = useState(6);

  // Step 4 — Upload
  const [file, setFile] = useState<File | null>(null);
  const [declaration, setDeclaration] = useState(false);
  const [declarationTime, setDeclarationTime] = useState('');

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }
      setUserId(user.id);
      const { data: patron } = await supabase
        .from('patrons')
        .select('id, department, faculty_name, programme')
        .eq('user_id', user.id)
        .maybeSingle();
      setPatronId(patron?.id ?? '');
      // Pre-fill from the patron profile so the student only corrects,
      // never re-types. The server resolves the same fields if left alone.
      if (patron?.department) setDepartment(patron.department);
      if (patron?.faculty_name) setFaculty(prev => prev || patron.faculty_name!);
      if (patron?.programme) setProgramme(prev => prev || patron.programme!);
      setProfileLoaded(true);
    })();
  }, []);

  const addKeyword = () => {
    const kw = kwInput.trim();
    if (kw && !keywords.includes(kw)) { setKeywords(p => [...p, kw]); setKwInput(''); }
  };

  const toggleSubject = (s: string) => setSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const addSupervisor = () => setSupervisors(p => [...p, { name: '', email: '', orcid: '', role: 'secondary' }]);
  const removeSupervisor = (i: number) => setSupervisors(p => p.filter((_, idx) => idx !== i));
  const updateSupervisor = (i: number, field: keyof Supervisor, value: string) =>
    setSupervisors(p => p.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  const derivedDegree = deriveDegree(null, programme);

  const canAdvance = () => {
    if (step === 1) return !!(title.trim() && submissionType && programme.trim() && department.trim() && session && abstract.trim().length >= 100 && (!profileLoaded || !!patronId));
    if (step === 2) return supervisors.length > 0 && supervisors.every(s => s.name.trim() && s.email.trim());
    if (step === 3) return subjects.length >= 1 && keywords.length >= 3;
    if (step === 4) return !!file && declaration;
    return false;
  };

  const handleDeclarationToggle = (checked: boolean) => {
    setDeclaration(checked);
    if (checked) setDeclarationTime(new Date().toISOString());
  };

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdThesisId, setCreatedThesisId] = useState('');
  const [workflowWarning, setWorkflowWarning] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const handleSubmit = async () => {
    if (!file || !userId) return;
    setSubmitting(true);
    setSubmitError(null);
    setUploadProgress(10);

    try {
      // Upload file — try 'repository' bucket first, fall back to 'theses'
      const ext = file.name.split('.').pop() ?? 'pdf';
      const path = `theses/${userId}/${Date.now()}.${ext}`;
      let uploadBucket = 'repository';

      let upErr = (await supabase.storage.from('repository').upload(path, file, { upsert: false })).error;
      if (upErr && (upErr.message?.toLowerCase().includes('bucket') || upErr.message?.toLowerCase().includes('not found'))) {
        // Fall back to 'theses' bucket
        uploadBucket = 'theses';
        const fallback = await supabase.storage.from('theses').upload(path, file, { upsert: false });
        upErr = fallback.error;
      }
      let storageNote: string | null = null;
      if (upErr) {
        if (upErr.message?.toLowerCase().includes('bucket')) {
          storageNote = `PDF upload pending: storage bucket is not configured. Original file: ${file.name} (${Math.round(file.size / 1024)} KB).`;
          uploadBucket = '';
        } else {
          throw new Error(upErr.message);
        }
      }
      setUploadNote(storageNote);
      setUploadProgress(50);

      // Both buckets are private, so store the object path (bucket/key) and
      // let the API mint a short-lived signed URL on download. A public URL
      // stored here would 404 for everyone.
      const fileUrl = uploadBucket ? `${uploadBucket}/${path}` : null;

      setUploadProgress(70);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Your session expired. Please sign in again.');

      const response = await fetch('/api/thesis/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          abstract: abstract.trim(),
          submissionType,
          programme: programme.trim(),
          department: department.trim(),
          faculty: faculty || null,
          session,
          keywords,
          subjects,
          fileUrl,
          fileSize: file.size,
          declarationTimestamp: declarationTime || null,
          embargoEnabled,
          embargoPeriodMonths: embargoEnabled ? embargoMonths : null,
          supervisors: supervisors.filter(s => s.name.trim()).map(s => ({
            name: s.name.trim(),
            email: s.email.trim(),
            orcid: s.orcid.trim() || null,
            role: s.role,
          })),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? `Submission failed (HTTP ${response.status}).`);
      }

      const created = payload.data ?? {};
      setUploadProgress(85);
      setCreatedThesisId(created.thesisId ?? '');
      setWorkflowWarning(created.workflowStarted ? null : (created.workflowWarning ?? 'The review workflow did not start.'));

      // Send supervisor notification emails
      const primarySup = supervisors.find(s => s.role === 'primary' && s.email.trim());
      if (primarySup) {
        const html = `<p>Dear ${primarySup.name},</p><p>A thesis/essay has been submitted for your supervision and requires your review.</p><p><strong>Title:</strong> ${title}</p><p><strong>Reference:</strong> ${created.referenceNo}</p><p>Please log in to the supervisor portal to review and take action.</p>`;
        await sendEmail(primarySup.email, primarySup.name, `New thesis submission for your supervision: ${created.referenceNo}`, html);
      }

      setUploadProgress(100);
      setReferenceNo(created.referenceNo ?? '');
      setStep(5);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const retryWorkflow = async () => {
    if (!createdThesisId) return;
    setRetrying(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Your session expired. Please sign in again.');
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ resourceType: 'thesis', thesisId: createdThesisId, submit: true }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`);
      setWorkflowWarning(payload.warning ? String(payload.warning) : null);
    } catch (e) {
      setWorkflowWarning(e instanceof Error ? e.message : 'Retry failed.');
    } finally {
      setRetrying(false);
    }
  };

  const STEPS = ['Details', 'Supervision', 'Classification', 'Upload & Declare', 'Confirmation'];

  return (
    <div className="page">
      <div className="max-w-3xl mx-auto py-10 px-4">
        {/* Step indicator */}
        {step < 5 && (
          <div className="mb-10">
            <div className="flex items-center justify-between">
              {STEPS.slice(0, 4).map((label, i) => {
                const n = i + 1;
                const done = step > n;
                const active = step === n;
                return (
                  <div key={label} className="flex items-center flex-1">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${done ? 'bg-green-500 text-white' : active ? 'bg-primary-700 text-white' : 'bg-neutral-200 text-neutral-500'}`}>
                      {done ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      ) : n}
                    </div>
                    <div className="ml-2 hidden sm:block">
                      <p className={`text-xs font-semibold ${active ? 'text-primary-700' : done ? 'text-green-600' : 'text-neutral-400'}`}>{label}</p>
                    </div>
                    {i < 3 && <div className={`flex-1 h-0.5 mx-3 ${done ? 'bg-green-400' : 'bg-neutral-200'}`} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 1 — Details */}
        {step === 1 && (
          <div className="card p-8 space-y-5">
            <BackButton />
            <div>
              <h2 className="text-2xl font-bold">Step 1: Work Details</h2>
              <p className="text-neutral-500 text-sm mt-1">Provide the core information about your academic work.</p>
            </div>

            {profileLoaded && !patronId && (
              <div className="p-4 bg-error-50 border border-error-200 rounded-xl text-sm text-error-700">
                This account has no library patron profile, so a deposit cannot be recorded against it.
                Register as a patron (or ask the library to activate your profile) before submitting.
              </div>
            )}

            <div>
              <label className="label">Submission Type *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                {SUBMISSION_TYPES.map(t => (
                  <button key={t}
                    onClick={() => setSubmissionType(t)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border text-left transition-colors ${submissionType === t ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary-400'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Title *</label>
              <input className="input w-full" value={title} onChange={e => setTitle(e.target.value)} placeholder="Full title of your work" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Programme *</label>
                <select className="input w-full" value={programme} onChange={e => setProgramme(e.target.value)}>
                  <option value="">Select programme…</option>
                  {PROGRAMMES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Session *</label>
                <select className="input w-full" value={session} onChange={e => setSession(e.target.value)}>
                  {SESSIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Department *</label>
                <input className="input w-full" list="thesis-departments" value={department}
                  onChange={e => setDepartment(e.target.value)}
                  placeholder="Start typing your department…" />
                <datalist id="thesis-departments">
                  {DEPARTMENTS.map(d => <option key={d} value={d} />)}
                </datalist>
                {!department.trim() && <p className="text-xs text-amber-600 mt-1">Required — used for review routing.</p>}
              </div>
              <div>
                <label className="label">Degree</label>
                <div className="input w-full bg-neutral-50 text-neutral-600" aria-readonly="true">
                  {derivedDegree ?? <span className="text-neutral-400">Derived from programme…</span>}
                </div>
                <p className="text-xs text-neutral-400 mt-1">Recorded automatically from your programme.</p>
              </div>
            </div>

            <div>
              <label className="label">Faculty</label>
              <select className="input w-full" value={faculty} onChange={e => setFaculty(e.target.value)}>
                <option value="">Select faculty…</option>
                {FACULTIES.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Abstract * <span className="text-neutral-400 font-normal">(min 100 characters)</span></label>
              <textarea className="input w-full resize-none" rows={6} value={abstract}
                onChange={e => setAbstract(e.target.value)}
                placeholder="Provide a comprehensive abstract of your work…" />
              <p className={`text-xs mt-1 ${abstract.length < 100 ? 'text-amber-600' : 'text-neutral-400'}`}>
                {abstract.length} / 100+ characters
              </p>
            </div>

            <button onClick={() => setStep(2)} disabled={!canAdvance()} className="btn-primary w-full disabled:opacity-50 py-3">
              Next: Supervision
            </button>
          </div>
        )}

        {/* Step 2 — Supervision */}
        {step === 2 && (
          <div className="card p-8 space-y-5">
            <div>
              <h2 className="text-2xl font-bold">Step 2: Supervision Details</h2>
              <p className="text-neutral-500 text-sm mt-1">Add your supervisor(s). Every supervisor needs a name and an email address — the deposit cannot be recorded without at least one named supervisor.</p>
            </div>

            {supervisors.map((sup, i) => (
              <div key={i} className="border border-neutral-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`badge text-xs ${sup.role === 'primary' ? 'badge-primary' : 'badge-secondary'}`}>
                    {sup.role === 'primary' ? 'Primary Supervisor' : `Supervisor ${i + 1}`}
                  </span>
                  {i > 0 && (
                    <button onClick={() => removeSupervisor(i)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">Full Name *</label>
                    <input className="input w-full text-sm" value={sup.name} onChange={e => updateSupervisor(i, 'name', e.target.value)} placeholder="Dr. / Prof. Name" />
                  </div>
                  <div>
                    <label className="label text-xs">Email Address *</label>
                    <input className="input w-full text-sm" type="email" value={sup.email} onChange={e => updateSupervisor(i, 'email', e.target.value)} placeholder="supervisor@esut.edu.ng" />
                    {!sup.email.trim() && <p className="text-xs text-amber-600 mt-1">Required for review notifications.</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">ORCID iD (optional)</label>
                    <input className="input w-full text-sm" value={sup.orcid} onChange={e => updateSupervisor(i, 'orcid', e.target.value)} placeholder="0000-0000-0000-0000" />
                  </div>
                  <div>
                    <label className="label text-xs">Role</label>
                    <select className="input w-full text-sm" value={sup.role} onChange={e => updateSupervisor(i, 'role', e.target.value as 'primary' | 'secondary')}>
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary / Co-supervisor</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            {supervisors.length < 3 && (
              <button onClick={addSupervisor} className="btn-outline w-full text-sm">
                + Add Co-supervisor
              </button>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)} className="btn-ghost flex-1">Back</button>
              <button onClick={() => setStep(3)} disabled={!canAdvance()} className="btn-primary flex-1 disabled:opacity-50">
                Next: Classification
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Classification */}
        {step === 3 && (
          <div className="card p-8 space-y-5">
            <div>
              <h2 className="text-2xl font-bold">Step 3: Subject Classification</h2>
              <p className="text-neutral-500 text-sm mt-1">Select subjects and add keywords to help others find your work.</p>
            </div>

            <div>
              <label className="label">Subject Areas * <span className="text-neutral-400 font-normal">(select at least 1)</span></label>
              <div className="flex flex-wrap gap-2 mt-2">
                {SUBJECTS.map(s => (
                  <button key={s}
                    onClick={() => toggleSubject(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${subjects.includes(s) ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary-400'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Keywords * <span className="text-neutral-400 font-normal">(at least 3)</span></label>
              <div className="flex gap-2 mt-1">
                <input className="input flex-1" value={kwInput} onChange={e => setKwInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                  placeholder="Type keyword and press Enter…" />
                <button onClick={addKeyword} disabled={!kwInput.trim()} className="btn-outline px-4 disabled:opacity-50">Add</button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {keywords.map(k => (
                    <span key={k} className="badge badge-secondary text-xs flex items-center gap-1">
                      {k}
                      <button onClick={() => setKeywords(p => p.filter(x => x !== k))} className="ml-1 hover:text-red-500">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Embargo */}
            <div className="border border-neutral-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">Embargo Period</p>
                  <p className="text-xs text-neutral-500">Delay public access to your work for a set period.</p>
                </div>
                <button
                  onClick={() => setEmbargoEnabled(p => !p)}
                  className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${embargoEnabled ? 'bg-primary-600' : 'bg-neutral-200'}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${embargoEnabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              {embargoEnabled && (
                <div>
                  <label className="label text-xs">Duration</label>
                  <div className="flex gap-2">
                    {[6, 12, 24].map(m => (
                      <button key={m}
                        onClick={() => setEmbargoMonths(m)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${embargoMonths === m ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary-400'}`}>
                        {m} months
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="btn-ghost flex-1">Back</button>
              <button onClick={() => setStep(4)} disabled={!canAdvance()} className="btn-primary flex-1 disabled:opacity-50">
                Next: Upload &amp; Declare
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Upload & Declare */}
        {step === 4 && (
          <div className="card p-8 space-y-5">
            <div>
              <h2 className="text-2xl font-bold">Step 4: Upload &amp; Declaration</h2>
              <p className="text-neutral-500 text-sm mt-1">Upload your final PDF and accept the originality declaration.</p>
            </div>

            {/* File upload */}
            <div>
              <label className="label">Upload PDF *</label>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              <button
                onClick={() => fileRef.current?.click()}
                className={`w-full border-2 border-dashed rounded-xl p-8 text-center transition-colors ${file ? 'border-green-400 bg-green-50' : 'border-neutral-300 hover:border-primary-400 hover:bg-primary-50'}`}
              >
                {file ? (
                  <div>
                    <p className="font-semibold text-green-700">{file.name}</p>
                    <p className="text-sm text-green-500 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB · Click to change</p>
                  </div>
                ) : (
                  <div>
                    <svg className="w-10 h-10 text-neutral-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    <p className="text-sm font-semibold text-neutral-600">Click to choose PDF</p>
                    <p className="text-xs text-neutral-400 mt-1">Maximum file size: 100 MB</p>
                  </div>
                )}
              </button>
            </div>

            {/* Declaration */}
            <div className="border border-neutral-200 rounded-xl p-5 space-y-3 bg-neutral-50">
              <h4 className="font-bold text-sm">Originality Declaration</h4>
              <div className="text-sm text-neutral-600 space-y-2 leading-relaxed">
                <p>By checking the box below, I declare that:</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li>This work is my own original research and has not been submitted elsewhere for a degree.</li>
                  <li>All sources used have been properly cited and acknowledged.</li>
                   <li>I grant Enugu State University of Science and Technology the right to archive and make this work accessible through the institutional repository.</li>
                  <li>I understand that submitting plagiarised work is a serious academic offence.</li>
                </ul>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={declaration} onChange={e => handleDeclarationToggle(e.target.checked)} className="mt-1 w-4 h-4 accent-primary-600" />
                <span className="text-sm font-semibold">I accept and understand the above declaration.</span>
              </label>
              {declaration && declarationTime && (
                <p className="text-xs text-neutral-400">Declared at: {new Date(declarationTime).toLocaleString('en-GB')}</p>
              )}
            </div>

            {submitError && (
              <div className="p-4 bg-error-50 border border-error-200 rounded-xl text-sm text-error-700">
                <strong>Submission failed:</strong> {submitError}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="btn-ghost flex-1" disabled={submitting}>Back</button>
              <button
                onClick={() => { void handleSubmit(); }}
                disabled={!canAdvance() || submitting}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting… {uploadProgress}%
                  </span>
                ) : 'Submit'}
              </button>
            </div>
          </div>
        )}

        {/* Step 5 — Confirmation */}
        {step === 5 && (
          <div className="card p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-neutral-900">Submission Successful!</h2>
              <p className="text-neutral-500 mt-2">Your work has been received and logged in the system.</p>
            </div>

            <div className="bg-primary-50 border border-primary-200 rounded-2xl p-6">
              <p className="text-sm text-primary-700 font-medium mb-2">Your Reference Number</p>
              <p className="text-3xl font-bold font-mono text-primary-800 tracking-wide">{referenceNo}</p>
              <p className="text-xs text-primary-600 mt-2">Keep this safe — use it to track your submission status.</p>
            </div>

            {workflowWarning && (
              <div className="text-left bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-800">Your work is saved, but not yet in review</p>
                <p className="text-sm text-amber-700">{workflowWarning}</p>
                <p className="text-xs text-amber-700">
                  The record was kept as a <strong>draft</strong> on purpose, so nothing is shown as
                  &ldquo;under review&rdquo; when it is not. Send it for review once the issue clears.
                </p>
                <button onClick={() => { void retryWorkflow(); }} disabled={retrying || !createdThesisId}
                  className="btn-primary text-sm px-4 py-2 disabled:opacity-50">
                  {retrying ? 'Sending…' : 'Send for review'}
                </button>
              </div>
            )}

            {uploadNote && (
              <div className="text-left bg-neutral-50 border border-neutral-200 rounded-xl p-4">
                <p className="text-sm text-neutral-600">{uploadNote}</p>
              </div>
            )}

            <div className="text-left bg-neutral-50 rounded-xl p-4 space-y-2 text-sm">
              <h4 className="font-bold">What happens next?</h4>
              <div className="space-y-1.5 text-neutral-600">
                <p>1. Your primary supervisor will receive an email notification.</p>
                <p>2. After supervisor approval, the library committee will review your work.</p>
                <p>3. Once approved, your work will be published to the institutional repository.</p>
                <p>4. You will receive email updates at each stage.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href={`/thesis/status?ref=${referenceNo}`} className="btn-primary px-6">Track Status</a>
              <a href="/thesis" className="btn-outline px-6">Back to Thesis Portal</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
