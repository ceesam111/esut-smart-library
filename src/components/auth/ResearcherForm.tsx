import { useState, FormEvent, ReactNode } from 'react';
import { Field, TextInput, SelectInput, TextArea, PasswordInput, TagInput } from './fields';
import ProfilePhotoInput from './ProfilePhotoInput';
import { TermsCheckbox, SubmitButton } from './StudentForm';
import { GENDERS, FACULTIES, ACADEMIC_RANKS, PREFERRED_BRANCHES, DEFAULT_INSTITUTION } from '@/config/roles.config';
import { institutionConfig } from '@config/institution.config';
import { registerAccount, type RegisterResult } from '@/lib/registration';

export default function ResearcherForm({ onSuccess, turnstileToken, turnstileRequired, turnstileWidget }: { onSuccess: (result: RegisterResult) => void; turnstileToken?: string | null; turnstileRequired?: boolean; turnstileWidget?: ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [f, setF] = useState({
    surname: '', otherNames: '', gender: '', phone: '', email: '',
    password: '', confirm: '', staffId: '', institution: DEFAULT_INSTITUTION,
    faculty: '', department: '', rank: '', highestQual: '', bio: '', branch: PREFERRED_BRANCHES[0],
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (f.password !== f.confirm) return setError('Passwords do not match.');
    if (f.password.length < 8) return setError('Password must be at least 8 characters.');
    if (!agreed) return setError('Please agree to the Terms and Privacy Policy.');
    if (turnstileRequired && !turnstileToken) return setError('Please complete the Cloudflare security verification before submitting.');
    setLoading(true);
    const res = await registerAccount({
      role: 'researcher_lecturer',
      email: f.email,
      password: f.password,
      fullName: `${f.surname} ${f.otherNames}`.trim(),
      patronCategory: 'Academic Staff',
      turnstileToken,
      profile: {
        surname: f.surname, other_names: f.otherNames, gender: f.gender || null,
        phone: f.phone || null, staff_id: f.staffId || null, institution: f.institution,
        faculty_name: f.faculty || null, department: f.department || null,
        academic_rank: f.rank || null, rank: f.rank || null,
        research_interests: interests.length ? interests : null,
        highest_qualification: f.highestQual || null, short_bio: f.bio || null,
        preferred_branch: f.branch,
        profile_photo_url: profilePhotoUrl,
      },
    });
    setLoading(false);
    if (!res.ok) return setError(res.error ?? 'Registration failed.');
    onSuccess(res);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Surname" required><TextInput value={f.surname} onChange={(v) => set('surname', v)} required /></Field>
        <Field label="Other Names" required><TextInput value={f.otherNames} onChange={(v) => set('otherNames', v)} required /></Field>
      </div>
      <Field label="Gender"><SelectInput value={f.gender} onChange={(v) => set('gender', v)} options={GENDERS} /></Field>
      <Field label="Phone" required><TextInput type="tel" value={f.phone} onChange={(v) => set('phone', v)} required /></Field>
      <Field label="Email Address" required><TextInput type="email" value={f.email} onChange={(v) => set('email', v)} required /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Password" required><PasswordInput value={f.password} onChange={(v) => set('password', v)} required /></Field>
        <Field label="Confirm Password" required><PasswordInput value={f.confirm} onChange={(v) => set('confirm', v)} required /></Field>
      </div>
      <Field label="Staff ID" required><TextInput mono value={f.staffId} onChange={(v) => set('staffId', v)} required /></Field>
      <Field label="Institution" required><TextInput value={f.institution} onChange={(v) => set('institution', v)} required /></Field>
      <Field label="Faculty" required><SelectInput value={f.faculty} onChange={(v) => set('faculty', v)} options={FACULTIES} required /></Field>
      <Field label="Department" required><TextInput value={f.department} onChange={(v) => set('department', v)} required /></Field>
      <Field label="Academic Rank" required><SelectInput value={f.rank} onChange={(v) => set('rank', v)} options={ACADEMIC_RANKS} required /></Field>
      <Field label="Research Interests"><TagInput tags={interests} onChange={setInterests} placeholder="e.g. Machine Learning" /></Field>
      <Field label="Highest Qualification"><TextInput value={f.highestQual} onChange={(v) => set('highestQual', v)} placeholder="e.g. PhD Computer Science" /></Field>
      {institutionConfig.libraryMode === 'multi' && (
        <Field label="Preferred Branch" required><SelectInput value={f.branch} onChange={(v) => set('branch', v)} options={PREFERRED_BRANCHES} required /></Field>
      )}
      <Field label="Short Bio" hint="Optional, max 200 characters"><TextArea value={f.bio} onChange={(v) => set('bio', v)} maxLength={200} /></Field>
      <ProfilePhotoInput value={profilePhotoUrl} onChange={setProfilePhotoUrl} onError={setError} />
      <TermsCheckbox agreed={agreed} setAgreed={setAgreed} />
      {turnstileWidget}
      <SubmitButton loading={loading} />
    </form>
  );
}
