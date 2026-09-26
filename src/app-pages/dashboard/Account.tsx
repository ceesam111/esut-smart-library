import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS, type AppRole } from '@/config/roles.config';
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

export default function Account() {
  const { loading, profile, role, roles } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const handleSave = async () => {
    if (!patron) return;
    setSaveMsg('');
    setProfileError('');
    const getInput = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    const update: Record<string, unknown> = {
      full_name: (getInput('acct-fullname')?.value ?? '').trim() || null,
      surname: (getInput('acct-surname')?.value ?? '').trim() || null,
      other_names: (getInput('acct-othernames')?.value ?? '').trim() || null,
      phone: (getInput('acct-phone')?.value ?? '').trim() || null,
      date_of_birth: (getInput('acct-dob')?.value ?? '').trim() || null,
      gender: (getInput('acct-gender')?.value ?? '').trim() || null,
      institution: (getInput('acct-institution')?.value ?? institutionConfig.name).trim() || institutionConfig.name,
      faculty_code: (getInput('acct-facultycode')?.value ?? '').trim() || null,
      faculty_name: (getInput('acct-facultyname')?.value ?? '').trim() || null,
      department: (getInput('acct-department')?.value ?? '').trim() || null,
      programme: (getInput('acct-programme')?.value ?? '').trim() || null,
      current_level: (getInput('acct-currentlevel')?.value ?? '').trim() || null,
      level: (getInput('acct-currentlevel')?.value ?? '').trim() || null,
      matric_number: (getInput('acct-matric')?.value ?? '').trim() || null,
      staff_id: (getInput('acct-staffid')?.value ?? '').trim() || null,
      rank: (getInput('acct-rank')?.value ?? '').trim() || null,
      preferred_branch: (getInput('acct-prefbranch')?.value ?? '').trim() || null,
      short_bio: (getInput('acct-shortbio')?.value ?? '').trim() || null,
    };
    try {
      const { data, error } = await supabase
        .from('patrons')
        .update(update)
        .eq('id', (patron as { id: string }).id)
        .select('*')
        .single();
      if (error) throw error;
      setPatron(data);
      setSaveMsg('Profile updated.');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not update your profile.');
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <BackButton />
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-serif font-semibold text-primary-800">My Account</h1>
            <p className="text-neutral-500 text-sm mt-1">{roleLabel}</p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            profile.status === 'active' ? 'bg-green-100 text-green-700'
            : pending ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-600'
          }`}>
            {profile.status === 'active' ? 'Active' : pending ? 'Pending Approval' : profile.status}
          </span>
        </div>
      </div>

      {pending && (
        <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          Your account is awaiting approval. Your Library Number and digital library card will be
          issued once a librarian approves your registration.
        </div>
      )}

      <Section icon="🧾" title="Identity">
        <Item label="Surname" value={profile.surname} />
        <Item label="Other Names" value={profile.other_names} />
        <Item label="Full Name" value={profile.full_name} />
        <Item label="Gender" value={profile.gender} />
        <Item label="Date of Birth" value={profile.date_of_birth} />
        <Item label="Account Type" value={roleLabel} />
      </Section>

      <Section icon="📇" title="Library Membership">
        <Item label="Library Number" value={profile.library_number ?? '— issued on approval —'} />
        <Item label="Patron ID" value={profile.patron_id} />
        <Item label="Status" value={profile.status} />
        <Item label="Preferred Branch" value={profile.preferred_branch} />
        <Item label="Member Since" value={profile.approved_at ? new Date(profile.approved_at).toLocaleDateString() : null} />
        {profile.membership_expires_at && (
          <Item label="Valid Until" value={new Date(profile.membership_expires_at).toLocaleDateString()} />
        )}
      </Section>

      <Section icon="📞" title="Contact">
        <Item label="Email" value={profile.email} />
        <Item label="Phone" value={profile.phone} />
        <Item label="Institution" value={profile.institution} />
      </Section>

      {(isStudent || isAcademic || isLibrarian) && (
        <Section icon="🎓" title="Academic">
          <Item label="Faculty" value={profile.faculty_name} />
          <Item label="Department" value={profile.department} />
          {isStudent && <Item label="Student Type" value={profile.student_type} />}
          {isStudent && <Item label="Programme" value={profile.programme} />}
          {isStudent && <Item label="Duration (years)" value={profile.duration_years} />}
          {isStudent && <Item label="Current Level" value={profile.current_level} />}
          {isStudent && <Item label="Matriculation Number" value={profile.matric_number} />}
          {(isAcademic || isLibrarian) && <Item label="Staff ID" value={profile.staff_id} />}
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
          <Item label="Staff ID" value={profile.staff_id} />
          <Item label="Department / Unit" value={profile.department} />
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

      {profile.short_bio && (
        <div className="card p-6">
          <h2 className="font-semibold text-neutral-800 mb-3 flex items-center gap-2"><span>✍️</span> Short Bio</h2>
          <p className="text-neutral-700 text-sm leading-relaxed">{profile.short_bio}</p>
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
