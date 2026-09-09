import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';
import ProfilePhotoInput from '@/components/auth/ProfilePhotoInput';
import { GENDERS } from '@/config/roles.config';
import BackButton from '@/components/BackButton';

export default function Settings() {
  const navigate = useNavigate();
  const [patron, setPatron] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [deleteState, setDeleteState] = useState<'idle' | 'confirm' | 'sending' | 'done'>('idle');
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [newsletterOptOut, setNewsletterOptOut] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [securityMsg, setSecurityMsg] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [accountForm, setAccountForm] = useState({
    email: '', full_name: '', surname: '', other_names: '', phone: '', date_of_birth: '', gender: '', institution: '', faculty_code: '', faculty_name: '', department: '', programme: '', current_level: '', matric_number: '', staff_id: '', rank: '', preferred_branch: '', short_bio: '', profile_photo_url: null as string | null,
  });
  const [passwordForm, setPasswordForm] = useState({
    password: '', confirm: '',
  });

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }

      const { data } = await supabase
        .from('patrons')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      setPatron(data);
      if (data) {
        setAccountForm({
          email: user.email ?? data.email ?? '',
          full_name: data.full_name ?? '',
          surname: data.surname ?? '',
          other_names: data.other_names ?? '',
          phone: data.phone ?? '',
          date_of_birth: data.date_of_birth ?? '',
          gender: data.gender ?? '',
          institution: data.institution ?? institutionConfig.name,
          faculty_code: data.faculty_code ?? '',
          faculty_name: data.faculty_name ?? '',
          department: data.department ?? '',
          programme: data.programme ?? '',
          current_level: data.current_level ?? data.level ?? '',
          matric_number: data.matric_number ?? '',
          staff_id: data.staff_id ?? '',
          rank: data.rank ?? data.academic_rank ?? '',
          preferred_branch: data.preferred_branch ?? '',
          short_bio: data.short_bio ?? '',
          profile_photo_url: data.profile_photo_url ?? null,
        });
        setNewsletterOptOut(!!data.newsletter_opt_out);
      }
      setLoading(false);
    };
    load();
  }, [navigate]);

  const downloadMyData = async () => {
    setDownloading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !patron) return;

      const patronId = (patron as { id: string }).id;

      const [loans, illReqs, readingLists, theses, repoItems, events] = await Promise.all([
        supabase.from('loans').select('*').eq('patron_id', patronId),
        supabase.from('ill_requests').select('*').eq('patron_id', patronId),
        supabase.from('reading_lists').select('*').eq('patron_id', patronId),
        supabase.from('theses').select('id, title, degree_programme, status, submission_date').eq('patron_id', patronId),
        supabase.from('repository_items').select('id, title, type, status, created_at'),
        supabase.from('event_registrations').select('*, events(title, start_at)').eq('patron_name', (patron as { full_name: string }).full_name),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        format_version: '1.0',
        data_controller: `${institutionConfig.name} Library`,
        ndpa_2023_right: 'Right of Access (Section 34)',
        profile: { ...patron, user_id: '[redacted]' },
        loans: loans.data ?? [],
        ill_requests: illReqs.data ?? [],
        reading_lists: readingLists.data ?? [],
        theses: theses.data ?? [],
        repository_submissions: repoItems.data ?? [],
        event_registrations: events.data ?? [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${institutionConfig.shortName.toLowerCase()}_my_data_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const requestDeletion = async () => {
    if (deleteInput.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm.');
      return;
    }
    setDeleteError('');
    setDeleteState('sending');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !patron) return;

      const patronId = (patron as { id: string }).id;
      await supabase
        .from('patrons')
        .update({ deletion_requested: true, deletion_requested_at: new Date().toISOString() })
        .eq('id', patronId);

      // Send confirmation email
      await supabase.functions.invoke('send-email', {
        body: {
          to: user.email,
          to_name: (patron as { full_name: string }).full_name,
          subject: `Account Deletion Request — ${institutionConfig.name} Library`,
          html: `<p>Dear ${(patron as { full_name: string }).full_name},</p>
<p>We have received your account deletion request. Your personal data will be permanently deleted within <strong>30 days</strong> in accordance with the Nigerian Data Protection Act 2023 (s.36).</p>
<p>If you submitted this request in error, please contact us immediately at <a href="mailto:${institutionConfig.supportEmail}">${institutionConfig.supportEmail}</a>.</p>
<p>Your academic records (thesis submissions, repository items) held as part of the institutional record may be retained under s.25(1)(e) of the NDPA.</p>
<p>Regards,<br/>${institutionConfig.name} Library</p>`,
        },
      });

      setDeleteState('done');
    } catch {
      setDeleteState('confirm');
      setDeleteError('An error occurred. Please try again or contact support.');
    }
  };

  const savePreferences = async () => {
    setSaveMsg('');
    await supabase
      .from('patrons')
      .update({ newsletter_opt_out: newsletterOptOut })
      .eq('id', (patron as { id: string }).id);
    setSaveMsg('Preferences saved.');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const saveProfile = async () => {
    if (!patron) return;
    setProfileError('');
    setProfileMsg('');
    if (!accountForm.full_name.trim()) {
      setProfileError('Full name is required.');
      return;
    }

    setSavingProfile(true);
    try {
      const update = {
        full_name: accountForm.full_name.trim(),
        surname: accountForm.surname.trim() || null,
        other_names: accountForm.other_names.trim() || null,
        phone: accountForm.phone.trim() || null,
        date_of_birth: accountForm.date_of_birth || null,
        gender: accountForm.gender || null,
        institution: accountForm.institution.trim() || institutionConfig.name,
        faculty_code: accountForm.faculty_code.trim() || null,
        faculty_name: accountForm.faculty_name.trim() || null,
        department: accountForm.department.trim() || null,
        programme: accountForm.programme.trim() || null,
        current_level: accountForm.current_level.trim() || null,
        level: accountForm.current_level.trim() || null,
        matric_number: accountForm.matric_number.trim() || null,
        staff_id: accountForm.staff_id.trim() || null,
        rank: accountForm.rank.trim() || null,
        preferred_branch: accountForm.preferred_branch.trim() || null,
        short_bio: accountForm.short_bio.trim() || null,
        profile_photo_url: accountForm.profile_photo_url,
      };
      const { data, error } = await supabase
        .from('patrons')
        .update(update)
        .eq('id', (patron as { id: string }).id)
        .select('*')
        .single();
      if (error) throw error;
      setPatron(data);
      setProfileMsg('Profile updated.');
      setTimeout(() => setProfileMsg(''), 3000);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not update your profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSecurity = async () => {
    if (!patron) return;
    setSecurityError('');
    setSecurityMsg('');
    const email = accountForm.email.trim();
    if (!email) {
      setSecurityError('Email address is required.');
      return;
    }
    if (passwordForm.password && passwordForm.password.length < 8) {
      setSecurityError('Password must be at least 8 characters.');
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      setSecurityError('Password confirmation does not match.');
      return;
    }

    setSavingSecurity(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in again to update account security.');
      const authUpdate: { email?: string; password?: string } = {};
      if (email !== user.email) authUpdate.email = email;
      if (passwordForm.password) authUpdate.password = passwordForm.password;
      if (Object.keys(authUpdate).length) {
        const { error } = await supabase.auth.updateUser(authUpdate);
        if (error) throw error;
      }
      if (email !== (patron as { email?: string }).email) {
        await supabase.from('patrons').update({ email }).eq('id', (patron as { id: string }).id).throwOnError();
        setPatron((prev) => prev ? { ...prev, email } : prev);
      }
      setPasswordForm({ password: '', confirm: '' });
      setSecurityMsg(authUpdate.email ? 'Account updated. Check the new email address for a confirmation link if requested.' : 'Account security updated.');
      setTimeout(() => setSecurityMsg(''), 5000);
    } catch (error) {
      setSecurityError(error instanceof Error ? error.message : 'Could not update account security.');
    } finally {
      setSavingSecurity(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      <div>
        <BackButton />
        <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-500 mt-1 text-sm">Manage your data, privacy preferences, and account actions.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-1">Email & Password</h2>
        <p className="text-xs text-neutral-500 mb-5">Update your sign-in email or set a new password.</p>
        {securityError && <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{securityError}</div>}
        <div className="space-y-4">
          <div>
            <label className="label">Email Address</label>
            <input className="input" type="email" value={accountForm.email} onChange={(e) => setAccountForm((prev) => ({ ...prev, email: e.target.value }))} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">New Password</label>
              <input className="input" type="password" value={passwordForm.password} onChange={(e) => setPasswordForm((prev) => ({ ...prev, password: e.target.value }))} placeholder="Leave blank to keep current password" />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input className="input" type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={saveSecurity} disabled={savingSecurity} className="btn-primary px-4 py-2 text-sm rounded">
              {savingSecurity ? 'Saving...' : 'Save Email / Password'}
            </button>
            {securityMsg && <span className="text-sm text-green-600">{securityMsg}</span>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-1">Basic Account Information</h2>
        <p className="text-xs text-neutral-500 mb-5">Update your visible profile details and library photo.</p>
        {profileError && <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{profileError}</div>}
        <div className="space-y-4">
          <ProfilePhotoInput
            value={accountForm.profile_photo_url}
            onChange={(value) => setAccountForm((prev) => ({ ...prev, profile_photo_url: value }))}
            onError={setProfileError}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name <span className="text-red-500">*</span></label>
              <input className="input" value={accountForm.full_name} onChange={(e) => setAccountForm((prev) => ({ ...prev, full_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Surname</label>
              <input className="input" value={accountForm.surname} onChange={(e) => setAccountForm((prev) => ({ ...prev, surname: e.target.value }))} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Other Names</label>
              <input className="input" value={accountForm.other_names} onChange={(e) => setAccountForm((prev) => ({ ...prev, other_names: e.target.value }))} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" type="tel" value={accountForm.phone} onChange={(e) => setAccountForm((prev) => ({ ...prev, phone: e.target.value }))} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Gender</label>
              <select className="input" value={accountForm.gender} onChange={(e) => setAccountForm((prev) => ({ ...prev, gender: e.target.value }))}>
                <option value="">Select...</option>
                {GENDERS.map((gender) => <option key={gender} value={gender}>{gender}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date of Birth</label>
              <input className="input" type="date" value={accountForm.date_of_birth} onChange={(e) => setAccountForm((prev) => ({ ...prev, date_of_birth: e.target.value }))} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Institution</label>
              <input className="input" value={accountForm.institution} onChange={(e) => setAccountForm((prev) => ({ ...prev, institution: e.target.value }))} />
            </div>
            <div>
              <label className="label">Faculty Code</label>
              <input className="input" value={accountForm.faculty_code} onChange={(e) => setAccountForm((prev) => ({ ...prev, faculty_code: e.target.value }))} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Faculty Name</label>
              <input className="input" value={accountForm.faculty_name} onChange={(e) => setAccountForm((prev) => ({ ...prev, faculty_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Department</label>
              <input className="input" value={accountForm.department} onChange={(e) => setAccountForm((prev) => ({ ...prev, department: e.target.value }))} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Programme</label>
              <input className="input" value={accountForm.programme} onChange={(e) => setAccountForm((prev) => ({ ...prev, programme: e.target.value }))} />
            </div>
            <div>
              <label className="label">Current Level</label>
              <input className="input" value={accountForm.current_level} onChange={(e) => setAccountForm((prev) => ({ ...prev, current_level: e.target.value }))} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Matric Number</label>
              <input className="input" value={accountForm.matric_number} onChange={(e) => setAccountForm((prev) => ({ ...prev, matric_number: e.target.value }))} />
            </div>
            <div>
              <label className="label">Staff ID</label>
              <input className="input" value={accountForm.staff_id} onChange={(e) => setAccountForm((prev) => ({ ...prev, staff_id: e.target.value }))} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Rank / Academic Rank</label>
              <input className="input" value={accountForm.rank} onChange={(e) => setAccountForm((prev) => ({ ...prev, rank: e.target.value }))} />
            </div>
            <div>
              <label className="label">Preferred Branch</label>
              <input className="input" value={accountForm.preferred_branch} onChange={(e) => setAccountForm((prev) => ({ ...prev, preferred_branch: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Short Bio</label>
            <textarea className="input" rows={3} value={accountForm.short_bio} onChange={(e) => setAccountForm((prev) => ({ ...prev, short_bio: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={saveProfile} disabled={savingProfile} className="btn-primary px-4 py-2 text-sm rounded">
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
            {profileMsg && <span className="text-sm text-green-600">{profileMsg}</span>}
          </div>
        </div>
      </div>

      {/* Communication preferences */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Communication Preferences</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={newsletterOptOut}
            onChange={(e) => setNewsletterOptOut(e.target.checked)}
            className="w-4 h-4 rounded border-neutral-300 text-primary-600"
          />
          <div>
            <div className="text-sm font-medium text-neutral-800">Opt out of newsletter emails</div>
            <div className="text-xs text-neutral-500">You will still receive transactional emails (loan reminders, overdue notices).</div>
          </div>
        </label>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={savePreferences} className="btn-primary px-4 py-2 text-sm rounded">
            Save Preferences
          </button>
          {saveMsg && <span className="text-sm text-green-600">{saveMsg}</span>}
        </div>
      </div>

      {/* My Data — NDPA 2023 */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-1">My Data</h2>
        <p className="text-xs text-neutral-500 mb-5">
          Your rights under the <strong>Nigerian Data Protection Act 2023</strong>.
          Download a machine-readable copy of all data we hold about you, or request permanent deletion.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          {[
            { right: 'Right of Access (s.34)', desc: 'Download a JSON export of your profile, loans, ILL requests, reading lists, thesis and repository submissions, and event registrations.' },
            { right: 'Right to Erasure (s.36)', desc: 'Request permanent deletion of your account and personal data. We will complete this within 30 days.' },
            { right: 'Right to Portability (s.38)', desc: 'Your data is provided in open JSON format, readable by any standard text editor or data tool.' },
            { right: 'Right to Rectification (s.35)', desc: 'Update your personal details at any time via Dashboard → My Profile.' },
          ].map((item) => (
            <div key={item.right} className="bg-neutral-50 rounded-lg p-4 border border-neutral-100">
              <div className="text-xs font-semibold text-primary-700 mb-1">{item.right}</div>
              <div className="text-xs text-neutral-600 leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>

        <div className="border-t border-neutral-100 pt-5 space-y-3">
          <button
            onClick={downloadMyData}
            disabled={downloading}
            className="btn-outline w-full sm:w-auto px-6 py-2.5 text-sm font-semibold rounded-lg flex items-center gap-2"
          >
            {downloading ? (
              <><span className="animate-spin h-4 w-4 border-b-2 border-primary-700 rounded-full inline-block" /> Preparing export…</>
            ) : (
              <>Download My Data (JSON)</>
            )}
          </button>
          <p className="text-xs text-neutral-400">
            Includes: profile, loans, ILL requests, reading lists, theses, repository submissions, event registrations.
          </p>
        </div>
      </div>

      {/* Delete Account */}
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-700 mb-1">Delete My Account</h2>
        <p className="text-xs text-neutral-500 mb-4">
          This will permanently delete your personal data within 30 days (NDPA 2023, s.36). Academic records
          (thesis, repository items) held as institutional records may be retained under s.25(1)(e).
          This action cannot be undone.
        </p>

        {deleteState === 'idle' && (
          <button
            onClick={() => setDeleteState('confirm')}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Request Account Deletion
          </button>
        )}

        {deleteState === 'confirm' && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
              You are about to request permanent deletion of your account. A confirmation email will be sent and
              your data will be deleted within 30 days.
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Type <strong>DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                className="input max-w-xs"
                placeholder="DELETE"
              />
              {deleteError && <p className="text-xs text-red-600 mt-1">{deleteError}</p>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={requestDeletion}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Confirm Deletion Request
              </button>
              <button
                onClick={() => { setDeleteState('idle'); setDeleteInput(''); setDeleteError(''); }}
                className="px-5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {deleteState === 'sending' && (
          <div className="flex items-center gap-3 text-sm text-neutral-600">
            <span className="animate-spin h-4 w-4 border-b-2 border-red-600 rounded-full inline-block" />
            Processing your request…
          </div>
        )}

        {deleteState === 'done' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
            Your deletion request has been received. You will receive a confirmation email. Your personal data
            will be permanently deleted within 30 days in accordance with NDPA 2023.
          </div>
        )}
      </div>

      <div className="text-xs text-neutral-400 text-center pb-4">
        For any data rights enquiries:{' '}
        <a href={`mailto:${institutionConfig.supportEmail}`} className="text-primary-600 hover:underline">
          {institutionConfig.supportEmail}
        </a>
        {' '}&bull;{' '}
        <a href="/privacy" className="text-primary-600 hover:underline">Privacy Policy</a>
      </div>
    </div>
  );
}
