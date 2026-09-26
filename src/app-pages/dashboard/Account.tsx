import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS, GENDERS, CURRENT_LEVELS, PREFERRED_BRANCHES, type AppRole } from '@/config/roles.config';
import HandbookSection from '@/components/dashboard/HandbookSection';
import BackButton from '@/components/BackButton';

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <h2 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2">
        <span className="text-lg">{icon}</span> {title}
      </h2>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">{children}</div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="font-medium text-neutral-800 break-words">{value}</p>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string | null;
  editing: boolean;
  type?: 'text' | 'tel' | 'date' | 'textarea' | 'select';
  options?: string[];
}

function Field({ id, label, value, editing, type = 'text', options }: FieldProps) {
  if (!editing) return <Item label={label} value={value} />;
  const className = 'input w-full';
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {type === 'textarea' ? (
        <textarea id={id} className={`${className} min-h-[90px]`} defaultValue={value ?? ''} />
      ) : type === 'select' ? (
        <select id={id} className={className} defaultValue={value ?? ''}>
          <option value="">Select…</option>
          {(options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : (
        <input id={id} type={type} className={className} defaultValue={value ?? ''} />
      )}
    </div>
  );
}

export default function Account() {
  const { loading, profile, role, roles, user, reload } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');

  const handleCancel = () => {
    setEditing(false);
    setSaveMsg('');
    setSaveError('');
  };

  const handleSave = async () => {
    if (!user) return;
    const el = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    const val = (id: string) => (el(id)?.value ?? '').trim();

    setSaving(true);
    setSaveMsg('');
    setSaveError('');
    try {
      const update: Record<string, string | null> = {
        surname: val('acct-surname') || null,
        other_names: val('acct-othernames') || null,
        full_name: val('acct-fullname') || null,
        gender: val('acct-gender') || null,
        date_of_birth: val('acct-dob') || null,
        phone: val('acct-phone') || null,
        institution: val('acct-institution') || institutionConfig.name,
        faculty_name: val('acct-facultyname') || null,
        department: val('acct-department') || null,
        programme: val('acct-programme') || null,
        current_level: val('acct-currentlevel') || null,
        matric_number: val('acct-matric') || null,
        staff_id: val('acct-staffid') || null,
        preferred_branch: val('acct-prefbranch') || null,
        short_bio: val('acct-shortbio') || null,
      };

      const { error } = await supabase.from('patrons').update(update).eq('user_id', user.id);
      if (error) throw error;

      await reload();
      setEditing(false);
      setSaveMsg('Profile updated.');
      setTimeout(() => setSaveMsg(''), 4000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not update your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto card p-8 text-center mt-10">
        <div className="text-5xl mb-4">👤</div>
        <h2 className="text-xl font-semibold text-neutral-800 mb-2">No profile found</h2>
        <p className="text-neutral-500 text-sm mb-6">Please complete registration to create your profile.</p>
        <Link to="/register" className="btn-primary">Register</Link>
      </div>
    );
  }

  const isStudent = role === 'student';
  const isAcademic = role === 'researcher_lecturer';
  const isStaff = role === 'admin_staff';
  const isLibrarian = role === 'librarian' || role === 'faculty_librarian';
  const pending = profile.status === 'pending';

  const roleLabel = ROLE_LABELS[(role as AppRole) ?? 'guest'];
  const showAcademic = isStudent || isAcademic || isLibrarian;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <BackButton />
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-serif font-semibold text-primary-800">My Account</h1>
            <p className="text-neutral-500 text-sm mt-1">{roleLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
              profile.status === 'active' ? 'bg-green-100 text-green-700'
              : pending ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-600'
            }`}>
              {profile.status === 'active' ? 'Active' : pending ? 'Pending Approval' : profile.status}
            </span>
            {!editing ? (
              <button type="button" className="btn-outline text-sm px-4 py-2" onClick={() => setEditing(true)}>
                Edit Profile
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" className="btn-outline text-sm px-4 py-2" onClick={handleCancel} disabled={saving}>
                  Cancel
                </button>
                <button type="button" className="btn-primary text-sm px-4 py-2" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        </div>
        {saveMsg && <div className="mt-3 px-4 py-2.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{saveMsg}</div>}
        {saveError && <div className="mt-3 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{saveError}</div>}
        {editing && (
          <div className="mt-3 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            Editing your profile. Library Number, Patron ID, account status and email are managed by the library and cannot be changed here.
          </div>
        )}
      </div>

      {pending && (
        <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          Your account is awaiting approval. Your Library Number and digital library card will be
          issued once a librarian approves your registration.
        </div>
      )}

      <Section icon="🧾" title="Identity">
        <Field id="acct-surname" label="Surname" value={profile.surname} editing={editing} />
        <Field id="acct-othernames" label="Other Names" value={profile.other_names} editing={editing} />
        <Field id="acct-fullname" label="Full Name" value={profile.full_name} editing={editing} />
        <Field id="acct-gender" label="Gender" value={profile.gender} editing={editing} type="select" options={GENDERS} />
        <Field id="acct-dob" label="Date of Birth" value={profile.date_of_birth} editing={editing} type="date" />
        <Item label="Account Type" value={roleLabel} />
      </Section>

      <Section icon="📇" title="Library Membership">
        <Item label="Library Number" value={profile.library_number ?? (pending ? '— issued on approval —' : '—')} />
        <Item label="Patron ID" value={profile.patron_id} />
        <Item label="Status" value={profile.status} />
        <Field id="acct-prefbranch" label="Preferred Branch" value={profile.preferred_branch} editing={editing} type="select" options={PREFERRED_BRANCHES} />
        <Item label="Member Since" value={profile.approved_at ? new Date(profile.approved_at).toLocaleDateString() : null} />
        {profile.membership_expires_at && (
          <Item label="Valid Until" value={new Date(profile.membership_expires_at).toLocaleDateString()} />
        )}
      </Section>

      <Section icon="📞" title="Contact">
        <Item label="Email" value={profile.email} />
        <Field id="acct-phone" label="Phone" value={profile.phone} editing={editing} type="tel" />
        <Field id="acct-institution" label="Institution" value={profile.institution ?? institutionConfig.name} editing={editing} />
      </Section>

      {showAcademic && (
        <Section icon="🎓" title="Academic">
          <Field id="acct-facultyname" label="Faculty" value={profile.faculty_name} editing={editing} />
          <Field id="acct-department" label="Department" value={profile.department} editing={editing} />
          {isStudent && <Field id="acct-programme" label="Programme" value={profile.programme} editing={editing} />}
          {isStudent && <Field id="acct-currentlevel" label="Current Level" value={profile.current_level} editing={editing} type="select" options={CURRENT_LEVELS} />}
          {isStudent && <Field id="acct-matric" label="Matriculation Number" value={profile.matric_number} editing={editing} />}
          {isStudent && <Item label="Student Type" value={profile.student_type} />}
          {isStudent && <Item label="Duration (years)" value={profile.duration_years} />}
          {(isAcademic || isLibrarian) && <Field id="acct-staffid" label="Staff ID" value={profile.staff_id} editing={editing} />}
          {isAcademic && <Item label="Academic Rank" value={profile.academic_rank} />}
          {isAcademic && <Item label="Highest Qualification" value={profile.highest_qualification} />}
        </Section>
      )}

      {isLibrarian && (
        <Section icon="🏛️" title="Library Staff">
          <Item label="Library Section" value={profile.library_section} />
          <Item label="Professional Qualification" value={profile.professional_qualification} />
          <Item label="Roles" value={roles.map((r) => ROLE_LABELS[r]).join(', ')} />
        </Section>
      )}

      {isStaff && (
        <Section icon="🗂️" title="Employment">
          <Field id="acct-staffid" label="Staff ID" value={profile.staff_id} editing={editing} />
          <Field id="acct-department" label="Department / Unit" value={profile.department} editing={editing} />
          <Item label="Job Title" value={profile.job_title} />
        </Section>
      )}

      {isAcademic && profile.research_interests && profile.research_interests.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2"><span>🔖</span> Research Interests</h2>
          <div className="flex flex-wrap gap-2">
            {profile.research_interests.map((t) => (
              <span key={t} className="px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-medium">{t}</span>
            ))}
          </div>
        </div>
      )}

      {(editing || profile.short_bio) && (
        <div className="card p-6">
          <h2 className="font-semibold text-neutral-800 mb-3 flex items-center gap-2"><span>✍️</span> Short Bio</h2>
          {editing ? (
            <textarea id="acct-shortbio" className="input w-full min-h-[90px]" defaultValue={profile.short_bio ?? ''} />
          ) : (
            <p className="text-neutral-700 text-sm leading-relaxed">{profile.short_bio}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link to="/dashboard/library-card" className="btn-primary">View Library Card</Link>
        <Link to="/dashboard/settings" className="btn-outline">Account Settings</Link>
      </div>

      <HandbookSection />
    </div>
  );
}
