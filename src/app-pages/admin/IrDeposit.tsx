import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackButton from '@/components/BackButton';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { IR_ITEM_TYPES, makeRepositoryHandle } from '@/lib/moduleSeparation';

const CHECKLIST = [
  'The work is scholarly output, thesis, dissertation, staff publication, dataset, or institutional research material.',
  'I have permission to deposit this file in the Institutional Repository.',
  'The uploaded file is a PDF/A, Microsoft Word document, or approved preservation copy.',
  'The selected licence and embargo date are correct.',
  'Supervisor details are supplied for theses, dissertations, projects, and long essays.',
];

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function isAcceptedDocument(file: File) {
  const name = file.name.toLowerCase();
  return ACCEPTED_TYPES.includes(file.type) || /\.(pdf|doc|docx)$/.test(name);
}

export default function IrDeposit() {
  const navigate = useNavigate();
  const { user, profile, hasRole, loading } = useAuth();
  const allowed = hasRole('super_admin', 'ir_admin', 'dept_ir_officer', 'librarian');
  const [form, setForm] = useState({
    title: '', creators: '', contributors: '', item_type: 'Thesis', abstract: '', keywords: '',
    department: profile?.department ?? '', faculty: profile?.faculty_name ?? '',
    date_issued: String(new Date().getFullYear()), publisher: 'Enugu State University of Science and Technology',
    doi: '', license: 'CC BY 4.0', embargo_until: '', supervisors: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [checks, setChecks] = useState<Record<number, boolean>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) return <div className="p-8 text-sm text-neutral-500">Loading...</div>;
  if (!user || !allowed) return <div className="p-8"><div className="card p-8 max-w-lg"><h1 className="font-semibold text-lg mb-2">IR access required</h1><p className="text-sm text-neutral-600 mb-4">Only super admins, IR admins, department IR officers, and librarians can deposit repository items.</p><Link to="/admin" className="btn-primary text-sm">Back to Admin</Link></div></div>;

  const allChecked = CHECKLIST.every((_, index) => checks[index]);
  const isThesisLike = /thesis|dissertation|project|essay/i.test(form.item_type);

  const submit = async () => {
    setError('');
    if (!form.title.trim() || !form.creators.trim() || !form.abstract.trim() || !form.department.trim()) { setError('Title, creators, abstract, and department are required.'); return; }
    if (!file) { setError('Upload a PDF, DOC, or DOCX file before deposit.'); return; }
    if (!isAcceptedDocument(file)) { setError('Only PDF, DOC, and DOCX files are accepted.'); return; }
    if (isThesisLike && !form.supervisors.trim()) { setError('Supervisor is required for thesis, dissertation, project, and long essay deposits.'); return; }
    if (!allChecked) { setError('Complete the IR Deposit Checklist before submitting.'); return; }

    setSaving(true);
    const year = form.date_issued.match(/(?:18|19|20)\d{2}/)?.[0] ?? String(new Date().getFullYear());
    const localId = crypto.randomUUID();
    const handle = makeRepositoryHandle(year, localId);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${user.id}/${Date.now()}_${safeName}`;
    const upload = await supabase.storage.from('repository').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    const fileUrl = upload.error ? null : supabase.storage.from('repository').getPublicUrl(path).data.publicUrl;
    const contributors = form.contributors.split(/[;,]/).map((name) => name.trim()).filter(Boolean);
    const supervisors = form.supervisors.split(/[;,]/).map((name) => name.trim()).filter(Boolean);
    const payload = {
      title: form.title.trim(),
      authors: form.creators.split(/[;,]/).map((name) => name.trim()).filter(Boolean),
      item_type: form.item_type,
      type: form.item_type,
      abstract: form.abstract.trim(),
      keywords: form.keywords.split(/[;,]/).map((x) => x.trim()).filter(Boolean),
      department: form.department.trim(),
      faculty: form.faculty.trim() || null,
      year: Number(year),
      date_issued: form.date_issued,
      publisher: form.publisher.trim() || null,
      doi: form.doi.trim() || null,
      handle,
      license: form.license,
      embargo_until: form.embargo_until || null,
      file_url: fileUrl,
      file_size: file.size,
      file_paths: fileUrl ? [fileUrl] : [],
      metadata_json: { contributors, supervisors, deposit_checklist: CHECKLIST, original_file_name: file.name, mime_type: file.type || null },
      deposit_date: new Date().toISOString(),
      submitter_id: user.id,
      depositor_id: user.id,
      status: 'published',
      visibility: form.embargo_until ? 'private' : 'global',
    };
    const { error: insertError } = await supabase.from('repository_items').insert(payload).select('id').single();
    await supabase.from('ir_audit_logs').insert({ user_id: user.id, action: 'deposit', target_handle: handle, metadata: { title: form.title, department: form.department, file_type: file.type || safeName.split('.').pop() } });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    navigate(`/repository/${encodeURIComponent(handle)}`);
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl space-y-6">
      <div>
        <BackButton />
        <h1 className="text-2xl font-bold text-neutral-900">Deposit to Institutional Repository</h1>
        <p className="text-sm text-neutral-500 mt-1">Dublin Core oriented deposit form for theses, staff publications, datasets, and scholarly output.</p>
      </div>
      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}
      <div className="card p-5 space-y-4"><h2 className="font-semibold">IR Deposit Checklist</h2>{CHECKLIST.map((item, index) => <label key={item} className="flex gap-2 text-sm"><input type="checkbox" checked={!!checks[index]} onChange={(e) => setChecks((prev) => ({ ...prev, [index]: e.target.checked }))} />{item}</label>)}</div>
      <div className="card p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Title *" value={form.title} onChange={(v) => setForm((p) => ({ ...p, title: v }))} wide />
        <Field label="Creators *" value={form.creators} onChange={(v) => setForm((p) => ({ ...p, creators: v }))} placeholder="Separate names with semicolon" />
        <Field label="Contributors" value={form.contributors} onChange={(v) => setForm((p) => ({ ...p, contributors: v }))} placeholder="Separate names with semicolon" />
        <label><span className="label">Item Type *</span><select className="input" value={form.item_type} onChange={(e) => setForm((p) => ({ ...p, item_type: e.target.value }))}>{IR_ITEM_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
        <Field label="Department *" value={form.department} onChange={(v) => setForm((p) => ({ ...p, department: v }))} />
        <Field label="Faculty" value={form.faculty} onChange={(v) => setForm((p) => ({ ...p, faculty: v }))} />
        <Field label="Date issued / Year" value={form.date_issued} onChange={(v) => setForm((p) => ({ ...p, date_issued: v }))} />
        <Field label="Publisher" value={form.publisher} onChange={(v) => setForm((p) => ({ ...p, publisher: v }))} />
        <Field label="DOI" value={form.doi} onChange={(v) => setForm((p) => ({ ...p, doi: v }))} />
        <Field label="Keywords" value={form.keywords} onChange={(v) => setForm((p) => ({ ...p, keywords: v }))} placeholder="Separate terms with semicolon" />
        <Field label="Licence" value={form.license} onChange={(v) => setForm((p) => ({ ...p, license: v }))} />
        <Field label="Embargo Until" value={form.embargo_until} onChange={(v) => setForm((p) => ({ ...p, embargo_until: v }))} placeholder="YYYY-MM-DD" />
        <Field label="Supervisor(s)" value={form.supervisors} onChange={(v) => setForm((p) => ({ ...p, supervisors: v }))} placeholder="Required for projects/theses" wide />
        <label className="md:col-span-2"><span className="label">Abstract *</span><textarea className="input min-h-28" value={form.abstract} onChange={(e) => setForm((p) => ({ ...p, abstract: e.target.value }))} /></label>
        <label className="md:col-span-2"><span className="label">Upload File *</span><input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><span className="text-xs text-neutral-500 mt-1 block">Accepted: PDF, Microsoft Word DOC, and DOCX.</span></label>
      </div>
      <button onClick={submit} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Depositing...' : 'Deposit to IR'}</button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, wide }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; wide?: boolean }) {
  return <label className={wide ? 'md:col-span-2' : ''}><span className="label">{label}</span><input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>;
}
