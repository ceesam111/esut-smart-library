import { useState, FormEvent } from 'react';
import { Field, TextInput, SelectInput, TextArea, PasswordInput } from './fields';
import ProfilePhotoInput from './ProfilePhotoInput';
import {
  GENDERS, STUDENT_TYPES, FACULTIES, CURRENT_LEVELS, PREFERRED_BRANCHES, DEFAULT_INSTITUTION, STUDENT_DEPARTMENTS,
} from '@/config/roles.config';
import { institutionConfig } from '@config/institution.config';
import { registerAccount, type RegisterResult } from '@/lib/registration';

const GREEN = '#6B1D2A';

export default function StudentForm({ onSuccess }: { onSuccess: (result: RegisterResult) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [f, setF] = useState({
    surname: '', otherNames: '', gender: '', dob: '', phone: '', email: '',
    password: '', confirm: '', studentType: 'Undergraduate',
    institution: DEFAULT_INSTITUTION, faculty: '', department: '', programme: '',
    duration: '', level: '100L', matric: '', branch: PREFERRED_BRANCHES[0], bio: '',
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (f.password !== f.confirm) return setError('Passwords do not match.');
    if (f.password.length < 8) return setError('Password must be at least 8 characters.');
    if (!agreed) return setError('Please agree to the Terms and Privacy Policy.');
    setLoading(true);
    let res: RegisterResult;
    try {
      res = await registerAccount({
      role: 'student',
      email: f.email,
      password: f.password,
      fullName: `${f.surname} ${f.otherNames}`.trim(),
      patronCategory: f.studentType === 'Undergraduate' ? 'Student' : 'Postgraduate Student',
      profile: {
        surname: f.surname, other_names: f.otherNames, gender: f.gender || null,
        date_of_birth: f.dob || null, phone: f.phone || null,
        student_type: f.studentType, institution: f.institution,
        faculty_name: f.faculty || null, department: f.department || null,
        programme: f.programme || null,
        duration_years: f.duration ? Number(f.duration) : null,
        current_level: f.level, level: f.level, matric_number: f.matric || null,
        preferred_branch: f.branch, short_bio: f.bio || null,
        profile_photo_url: profilePhotoUrl,
      },
      });
    } catch {
      res = { ok: false, error: 'Registration failed due to an unexpected error. Please try again.' };
    } finally {
      setLoading(false);
    }
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
      <div className="grid grid-cols-2 gap-4">
        <Field label="Gender"><SelectInput value={f.gender} onChange={(v) => set('gender', v)} options={GENDERS} /></Field>
        <Field label="Date of Birth" hint="Click the field to open the date picker, or type as YYYY-MM-DD."><TextInput type="date" max={new Date().toISOString().split('T')[0]} value={f.dob} onChange={(v) => set('dob', v)} /></Field>
      </div>
      <Field label="Phone" required><TextInput type="tel" value={f.phone} onChange={(v) => set('phone', v)} required /></Field>
      <Field label="Email Address" required><TextInput type="email" value={f.email} onChange={(v) => set('email', v)} required /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Password" required><PasswordInput value={f.password} onChange={(v) => set('password', v)} required /></Field>
        <Field label="Confirm Password" required><PasswordInput value={f.confirm} onChange={(v) => set('confirm', v)} required /></Field>
      </div>
      <Field label="Student Type" required><SelectInput value={f.studentType} onChange={(v) => set('studentType', v)} options={STUDENT_TYPES} required /></Field>
      <Field label="Institution" required hint="Defaults to Enugu State University of Science and Technology"><TextInput value={f.institution} onChange={(v) => set('institution', v)} required /></Field>
      <Field label="Faculty" required><SelectInput value={f.faculty} onChange={(v) => set('faculty', v)} options={FACULTIES} required /></Field>
      <Field label="Department" required><SelectInput value={f.department} onChange={(v) => set('department', v)} options={STUDENT_DEPARTMENTS} required /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Programme"><TextInput value={f.programme} onChange={(v) => set('programme', v)} placeholder="e.g. B.Sc Biology" /></Field>
        <Field label="Duration (years)"><TextInput type="number" value={f.duration} onChange={(v) => set('duration', v)} placeholder="4" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Current Level" required><SelectInput value={f.level} onChange={(v) => set('level', v)} options={CURRENT_LEVELS} required /></Field>
        <Field label="Matriculation Number"><TextInput mono value={f.matric} onChange={(v) => set('matric', v)} placeholder="ESUT/2024/00142" /></Field>
      </div>
      {institutionConfig.libraryMode === 'multi' && (
        <Field label="Preferred Branch" required><SelectInput value={f.branch} onChange={(v) => set('branch', v)} options={PREFERRED_BRANCHES} required /></Field>
      )}
      <Field label="Short Bio" hint="Optional, max 200 characters"><TextArea value={f.bio} onChange={(v) => set('bio', v)} maxLength={200} placeholder="Tell us a little about yourself" /></Field>
      <ProfilePhotoInput value={profilePhotoUrl} onChange={setProfilePhotoUrl} onError={setError} />

      <TermsCheckbox agreed={agreed} setAgreed={setAgreed} />
      <SubmitButton loading={loading} />
    </form>
  );
}

export function TermsCheckbox({ agreed, setAgreed }: { agreed: boolean; setAgreed: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3 pt-1">
      <input type="checkbox" id="agree" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-primary-700" />
      <label htmlFor="agree" className="text-sm text-neutral-600 leading-relaxed cursor-pointer">
        I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium hover:underline" style={{ color: GREEN }}>Terms of Use</a>
        {' '}and <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium hover:underline" style={{ color: GREEN }}>Privacy Policy</a>
      </label>
    </div>
  );
}

export function SubmitButton({ loading }: { loading: boolean }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full py-3 rounded-lg text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 mt-2"
      style={{ background: GREEN }}>
      {loading ? 'Creating Account…' : 'Submit Registration'}
    </button>
  );
}
