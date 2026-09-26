import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import BackButton from '@/components/BackButton';

// ─── Constants ────────────────────────────────────────────────────────────────

const SALUTATIONS = ['Prof.', 'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Engr.', 'Rev.'];
const ACADEMIC_RANKS = [
  'Graduate Assistant', 'Assistant Lecturer', 'Lecturer II', 'Lecturer I',
  'Senior Lecturer', 'Reader', 'Associate Professor', 'Professor',
  'Principal Lecturer', 'Chief Lecturer',
];
const EMPLOYMENT_STATUSES = ['Full-time', 'Part-time', 'Visiting', 'Adjunct'];
const DEPARTMENTS = [
  'Arts and Social Sciences Education', 'Business Education',
  'Computer Science Education', 'Counselling and Human Development Education',
  'Early Childhood Education', 'Educational Administration and Planning',
  'Educational Foundations', 'Integrated Science Education',
  'Language Arts and Communication Education', 'Library and Information Science',
  'Mathematics Education', 'Physical and Health Education',
  'Science Education', 'Social Studies Education',
  'Special Education', 'Vocational and Technical Education',
];
const PROGRAMMES = [
  'B.Ed. Curriculum Studies', 'B.Ed. Early Childhood Education',
  'B.Ed. Educational Administration', 'B.Ed. English Language',
  'B.Ed. Guidance & Counselling', 'B.Ed. Mathematics',
  'B.Ed. Science Education', 'B.Ed. Social Studies',
  'M.Ed. Curriculum Studies', 'M.Ed. Educational Administration',
  'M.Ed. Educational Technology', 'M.Ed. Guidance & Counselling',
  'M.Ed. Special Education', 'Ph.D. Education',
  'Certificate in Arabic', 'Certificate in Basic Science', 'Certificate in Chemistry', 'Certificate in Computer Science',
  'Certificate in Economics', 'Certificate in English Language', 'Certificate in Geography', 'Certificate in History',
  'Certificate in Home Economics', 'Certificate in Integrated Science', 'Certificate in Mathematics',
  'Certificate in Physical and Health Education', 'Certificate in Political Science', 'Certificate in Social Studies',
];
const DEGREE_TYPES = ['Ph.D.', 'M.Ed.', 'M.A.', 'M.Sc.', 'MBA', 'B.Ed.', 'PGDE', 'D.Ed.'];
const PROFESSIONAL_MEMBERSHIPS_SUGGESTIONS = [
  'Teacher Registration Council of Nigeria (TRCN)',
  'NUC Accreditation Panel Member',
  'Nigerian Academy of Education (NAEd)',
  'Nigerian Library Association (NLA)',
  'Mathematical Association of Nigeria (MAN)',
  'Science Teachers Association of Nigeria (STAN)',
  'Nigerian Association of Educational Researchers (NAER)',
  'Institute of Education Research and Development (IERD)',
];
const PUB_TYPES = ['journal', 'book', 'chapter', 'conference', 'report', 'other'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Qualification {
  degree: string; field: string; institution: string; year: string;
}
interface Publication {
  id?: string;
  title: string; authors: string[]; year: string; publication_type: string;
  journal_or_publisher: string; volume: string; issue: string; pages: string;
  doi: string; apa_formatted?: string;
}
interface Grant {
  id?: string; title: string; funding_body: string; amount: string; year: string; role: string;
}

// ─── APA formatter (client-side) ─────────────────────────────────────────────

function toSentenceCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/:\s+(\w)/g, (m, c) => m.replace(c, c.toUpperCase()));
}
function fmtAuthor(n: string) {
  const t = n.trim();
  if (t.includes(',')) return t;
  const parts = t.split(/\s+/);
  if (parts.length < 2) return t;
  const last = parts[parts.length - 1];
  const inits = parts.slice(0, -1).map((p) => `${p.charAt(0).toUpperCase()}.`).join(' ');
  return `${last}, ${inits}`;
}
function buildAPA(pub: Publication): string {
  const authors = pub.authors.filter(Boolean);
  if (!authors.length) return pub.title;
  const fmtd = authors.map(fmtAuthor);
  const authorStr = fmtd.length === 1 ? fmtd[0] : fmtd.length === 2
    ? `${fmtd[0]}, & ${fmtd[1]}`
    : `${fmtd.slice(0, -1).join(', ')}, & ${fmtd[fmtd.length - 1]}`;
  const yr = pub.year ? `(${pub.year})` : '(n.d.)';
  const title = toSentenceCase(pub.title);
  switch (pub.publication_type) {
    case 'journal': {
      let c = `${authorStr} ${yr}. ${title}. ${pub.journal_or_publisher}`;
      if (pub.volume) c += `, ${pub.volume}`;
      if (pub.issue) c += `(${pub.issue})`;
      if (pub.pages) c += `, ${pub.pages}`;
      c += '.';
      if (pub.doi) c += ` https://doi.org/${pub.doi}`;
      return c;
    }
    case 'book': return `${authorStr} ${yr}. ${title}. ${pub.journal_or_publisher}.`;
    case 'chapter': return `${authorStr} ${yr}. ${title}. In ${pub.journal_or_publisher}.`;
    case 'conference': return `${authorStr} ${yr}. ${title}. [Conference presentation]. ${pub.journal_or_publisher}.`;
    default: return `${authorStr} ${yr}. ${title}. ${pub.journal_or_publisher}${pub.doi ? ` https://doi.org/${pub.doi}` : ''}.`;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TagInput({ tags, onChange, placeholder, max }: { tags: string[]; onChange: (t: string[]) => void; placeholder?: string; max?: number }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v) && (!max || tags.length < max)) {
      onChange([...tags, v]);
      setInput('');
    }
  };
  return (
    <div className="flex flex-wrap gap-2 p-2 border border-neutral-200 rounded-lg bg-white min-h-[42px] focus-within:border-primary-500 transition-colors">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="hover:text-red-500 transition-colors">&times;</button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), add())}
        onBlur={add}
        placeholder={tags.length === 0 ? (placeholder ?? 'Type and press Enter') : ''}
        className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
      />
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHead({ n, title, done }: { n: number; title: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${done ? 'bg-green-500 text-white' : 'bg-primary-600 text-white'}`}>
        {done ? '✓' : n}
      </div>
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LecturerProfile() {
  const navigate = useNavigate();
  const [patronId, setPatronId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [orcidVerifying, setOrcidVerifying] = useState(false);
  const [orcidStatus, setOrcidStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [orcidName, setOrcidName] = useState('');
  const [fetchingPubs, setFetchingPubs] = useState(false);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [showPubForm, setShowPubForm] = useState(false);
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [editPubIdx, setEditPubIdx] = useState<number | null>(null);
  const [pubForm, setPubForm] = useState<Publication>({ title: '', authors: [''], year: '', publication_type: 'journal', journal_or_publisher: '', volume: '', issue: '', pages: '', doi: '' });
  const [grantForm, setGrantForm] = useState<Grant>({ title: '', funding_body: '', amount: '', year: '', role: '' });

  // Form state
  const [salutation, setSalutation] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [surname, setSurname] = useState('');
  const [academicRank, setAcademicRank] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [programmesTaught, setProgrammesTaught] = useState<string[]>([]);
  const [institutionalEmail, setInstitutionalEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [officeLocation, setOfficeLocation] = useState('');
  const [highestQual, setHighestQual] = useState<Qualification>({ degree: '', field: '', institution: '', year: '' });
  const [otherQuals, setOtherQuals] = useState<Qualification[]>([]);
  const [memberships, setMemberships] = useState<string[]>([]);
  const [specialisations, setSpecialisations] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [biography, setBiography] = useState('');
  const [orcidId, setOrcidId] = useState('');
  const [googleScholarId, setGoogleScholarId] = useState('');
  const [researchgateUrl, setResearchgateUrl] = useState('');
  const [academiaUrl, setAcademiaUrl] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [supervisPhD, setSupervisPhD] = useState({ completed: 0, current: 0 });
  const [supervisMEd, setSupervisMEd] = useState({ completed: 0, current: 0 });
  const [status, setStatus] = useState<string>('draft');
  const [returnNotes, setReturnNotes] = useState('');

  // ── Load existing profile ───────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }

      const { data: patronData } = await supabase
        .from('patrons')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!patronData) { setLoading(false); return; }
      setPatronId(patronData.id);

      const { data: profile } = await supabase
        .from('researcher_profiles')
        .select('*')
        .eq('patron_id', patronData.id)
        .maybeSingle();

      if (profile) {
        setProfileId(profile.id);
        setSalutation(profile.salutation ?? '');
        setFirstName(profile.first_name ?? '');
        setMiddleName(profile.middle_name ?? '');
        setSurname(profile.surname ?? '');
        setAcademicRank(profile.academic_rank ?? '');
        setEmploymentStatus(profile.employment_status ?? '');
        setDepartment(profile.department ?? '');
        setProgrammesTaught(profile.programmes_taught ?? []);
        setInstitutionalEmail(profile.institutional_email ?? '');
        setPhone(profile.phone ?? '');
        setOfficeLocation(profile.office_location ?? '');
        setHighestQual(profile.highest_qualification ?? { degree: '', field: '', institution: '', year: '' });
        setOtherQuals(profile.other_qualifications ?? []);
        setMemberships(profile.professional_memberships ?? []);
        setSpecialisations(profile.specialisations ?? []);
        setKeywords(profile.research_keywords ?? []);
        setBiography(profile.biography ?? '');
        setOrcidId(profile.orcid_id ?? '');
        if (profile.orcid_verified) setOrcidStatus('valid');
        setGoogleScholarId(profile.google_scholar_id ?? '');
        setResearchgateUrl(profile.researchgate_url ?? '');
        setAcademiaUrl(profile.academia_url ?? '');
        setProfilePhotoUrl(profile.profile_photo_url ?? '');
        setVisibility(profile.visibility ?? 'public');
        setSupervisPhD({ completed: profile.supervision_phd_completed ?? 0, current: profile.supervision_phd_current ?? 0 });
        setSupervisMEd({ completed: profile.supervision_med_completed ?? 0, current: profile.supervision_med_current ?? 0 });
        setStatus(profile.status ?? 'draft');
        setReturnNotes(profile.return_notes ?? '');

        // Load publications and grants
        const [pubs, grantData] = await Promise.all([
          supabase.from('researcher_publications').select('*').eq('researcher_id', profile.id).order('year', { ascending: false }),
          supabase.from('researcher_grants').select('*').eq('researcher_id', profile.id).order('year', { ascending: false }),
        ]);
        setPublications((pubs.data ?? []).map((p) => ({ ...p, authors: p.authors ?? [], year: String(p.year ?? '') })));
        setGrants((grantData.data ?? []).map((g) => ({ ...g, year: String(g.year ?? '') })));
      }
      setLoading(false);
    };
    load();
  }, [navigate]);

  // ── Progress calculation ───────────────────────────────────────────────────

  const progress = (() => {
    const checks = [
      !!firstName.trim(),
      !!surname.trim(),
      !!academicRank,
      !!employmentStatus,
      !!department,
      programmesTaught.length > 0,
      !!highestQual.degree && !!highestQual.field && !!highestQual.institution,
      specialisations.length > 0,
      keywords.length >= 5,
      biography.split(/\s+/).filter(Boolean).length >= 200,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  })();

  // ── Slug generator ─────────────────────────────────────────────────────────

  const generateSlug = useCallback((sal: string, fn: string, sn: string) => {
    const base = `${sal.replace(/\./g, '').toLowerCase()}-${fn.toLowerCase()}-${sn.toLowerCase()}-esut`
      .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return base;
  }, []);

  // ── Save ────────────────────────────────────────────────────────────────────

  const saveProfile = useCallback(async (asSubmit = false) => {
    if (!patronId) return;
    asSubmit ? setSubmitting(true) : setSaving(true);

    const slug = profileId
      ? undefined
      : generateSlug(salutation, firstName, surname);

    const payload = {
      patron_id: patronId,
      salutation: salutation || null,
      first_name: firstName,
      middle_name: middleName || null,
      surname,
      academic_rank: academicRank || null,
      employment_status: employmentStatus || null,
      department: department || null,
      programmes_taught: programmesTaught,
      institutional_email: institutionalEmail || null,
      phone: phone || null,
      office_location: officeLocation || null,
      highest_qualification: highestQual.degree ? highestQual : null,
      other_qualifications: otherQuals,
      professional_memberships: memberships,
      specialisations,
      research_keywords: keywords,
      biography: biography || null,
      orcid_id: orcidId || null,
      orcid_verified: orcidStatus === 'valid',
      google_scholar_id: googleScholarId || null,
      researchgate_url: researchgateUrl || null,
      academia_url: academiaUrl || null,
      profile_photo_url: profilePhotoUrl || null,
      visibility,
      supervision_phd_completed: supervisPhD.completed,
      supervision_phd_current: supervisPhD.current,
      supervision_med_completed: supervisMEd.completed,
      supervision_med_current: supervisMEd.current,
      status: asSubmit ? 'pending_review' : 'draft',
      last_updated_at: new Date().toISOString(),
      ...(slug ? { slug } : {}),
    };

    let id = profileId;
    if (profileId) {
      await supabase.from('researcher_profiles').update(payload).eq('id', profileId);
    } else {
      const { data } = await supabase.from('researcher_profiles').insert(payload).select('id').single();
      id = data?.id ?? null;
      setProfileId(id);
    }

    // Save publications
    if (id) {
      for (const pub of publications) {
        const pubPayload = {
          researcher_id: id,
          title: pub.title,
          authors: pub.authors.filter(Boolean),
          year: pub.year ? parseInt(pub.year) : null,
          journal_or_publisher: pub.journal_or_publisher || null,
          volume: pub.volume || null,
          issue: pub.issue || null,
          pages: pub.pages || null,
          doi: pub.doi || null,
          publication_type: pub.publication_type,
          apa_formatted: buildAPA(pub),
          source: 'manual',
        };
        if (pub.id) {
          await supabase.from('researcher_publications').update(pubPayload).eq('id', pub.id);
        } else {
          await supabase.from('researcher_publications').insert(pubPayload);
        }
      }
      // Save grants
      for (const g of grants) {
        const grantPayload = {
          researcher_id: id,
          title: g.title || null,
          funding_body: g.funding_body || null,
          amount: g.amount || null,
          year: g.year ? parseInt(g.year) : null,
          role: g.role || null,
        };
        if (g.id) {
          await supabase.from('researcher_grants').update(grantPayload).eq('id', g.id);
        } else {
          await supabase.from('researcher_grants').insert(grantPayload);
        }
      }
    }

    if (asSubmit) {
      setStatus('pending_review');
      setSubmitting(false);
      setSaveMsg('Profile submitted for review!');
    } else {
      setSaving(false);
      setSaveMsg('Saved');
    }
    setTimeout(() => setSaveMsg(''), 3000);
  }, [patronId, profileId, salutation, firstName, middleName, surname, academicRank, employmentStatus, department, programmesTaught, institutionalEmail, phone, officeLocation, highestQual, otherQuals, memberships, specialisations, keywords, biography, orcidId, orcidStatus, googleScholarId, researchgateUrl, academiaUrl, profilePhotoUrl, visibility, supervisPhD, supervisMEd, publications, grants, generateSlug]);

  // ── ORCID verify ────────────────────────────────────────────────────────────

  const verifyOrcid = async () => {
    if (!orcidId.trim()) return;
    setOrcidVerifying(true);
    setOrcidStatus('idle');
    try {
      const { data } = await supabase.functions.invoke('publication-fetch', {
        body: { action: 'verify_orcid', orcid: orcidId.trim() },
      });
      if (data?.valid) {
        setOrcidStatus('valid');
        setOrcidName(data.name ?? '');
      } else {
        setOrcidStatus('invalid');
      }
    } catch {
      setOrcidStatus('invalid');
    }
    setOrcidVerifying(false);
  };

  // ── Fetch publications from ORCID ─────────────────────────────────────────

  const fetchPublications = async () => {
    setFetchingPubs(true);
    try {
      const { data } = await supabase.functions.invoke('publication-fetch', {
        body: { action: 'fetch_publications', orcid: orcidId.trim(), first_name: firstName, surname },
      });
      if (data?.publications) {
        const fetched: Publication[] = data.publications.map((p: Record<string, unknown>) => ({
          title: String(p.title ?? ''),
          authors: (p.authors as string[]) ?? [],
          year: String(p.year ?? ''),
          publication_type: String(p.publication_type ?? 'journal'),
          journal_or_publisher: String(p.journal_or_publisher ?? ''),
          volume: String(p.volume ?? ''),
          issue: String(p.issue ?? ''),
          pages: String(p.pages ?? ''),
          doi: String(p.doi ?? ''),
          apa_formatted: String(p.apa_formatted ?? ''),
          source: String(p.source ?? 'orcid'),
        }));
        setPublications((prev) => {
          const existingDOIs = new Set(prev.map((p) => p.doi).filter(Boolean));
          const newPubs = fetched.filter((p) => !p.doi || !existingDOIs.has(p.doi));
          return [...prev, ...newPubs];
        });
      }
    } catch (err) {
      console.error('Publication fetch error:', err);
    }
    setFetchingPubs(false);
  };

  const wordCount = biography.split(/\s+/).filter(Boolean).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700" />
      </div>
    );
  }

  const canSubmit = progress === 100 && status !== 'pending_review' && status !== 'published';
  const isReturned = status === 'returned';

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <BackButton label="Back" />
      {/* Header + Progress */}
      <div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Research Profile</h1>
            <p className="text-neutral-500 text-sm mt-1">Your public academic profile on the ESUT Lecturer Directory.</p>
          </div>
          {status === 'published' && (
            <a href={`/lecturers/${generateSlug(salutation, firstName, surname)}`} className="btn-outline text-sm px-4 py-2 rounded-lg" target="_blank">
              View Published Profile
            </a>
          )}
        </div>

        {/* Status badge */}
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {status && (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              status === 'published' ? 'bg-green-100 text-green-700' :
              status === 'pending_review' ? 'bg-yellow-100 text-yellow-700' :
              status === 'returned' ? 'bg-red-100 text-red-700' :
              'bg-neutral-100 text-neutral-600'
            }`}>
              {status === 'published' ? 'Published' :
               status === 'pending_review' ? 'Under Review' :
               status === 'returned' ? 'Returned for Revision' :
               'Draft'}
            </span>
          )}
          <div className="flex-1 min-w-48">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-neutral-500">Profile Completeness</span>
              <span className="text-xs font-semibold text-neutral-800 ml-auto">{progress}%</span>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${progress === 100 ? 'bg-green-500' : 'bg-primary-600'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {isReturned && returnNotes && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
            <div className="font-semibold mb-1">Returned for revision:</div>
            <p className="leading-relaxed">{returnNotes}</p>
          </div>
        )}
      </div>

      {/* ── Section 1: Identity ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
        <SectionHead n={1} title="Identity" done={!!(firstName && surname && academicRank && employmentStatus && department && programmesTaught.length)} />
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Salutation</label>
            <select value={salutation} onChange={(e) => setSalutation(e.target.value)} className="input">
              <option value="">Select…</option>
              {SALUTATIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div />
          <div>
            <label className="label">First Name <span className="text-red-500">*</span></label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Middle Name</label>
            <input type="text" value={middleName} onChange={(e) => setMiddleName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Surname <span className="text-red-500">*</span></label>
            <input type="text" value={surname} onChange={(e) => setSurname(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Academic Rank <span className="text-red-500">*</span></label>
            <select value={academicRank} onChange={(e) => setAcademicRank(e.target.value)} className="input">
              <option value="">Select…</option>
              {ACADEMIC_RANKS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Employment Status <span className="text-red-500">*</span></label>
            <select value={employmentStatus} onChange={(e) => setEmploymentStatus(e.target.value)} className="input">
              <option value="">Select…</option>
              {EMPLOYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Department <span className="text-red-500">*</span></label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="input">
              <option value="">Select…</option>
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Institutional Email</label>
            <input type="email" value={institutionalEmail} onChange={(e) => setInstitutionalEmail(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Phone (optional)</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Office Location (optional)</label>
            <input type="text" value={officeLocation} onChange={(e) => setOfficeLocation(e.target.value)} className="input" placeholder="e.g. Block B, Room 204" />
          </div>
        </div>
        <div className="mt-4">
          <label className="label">Programmes Taught <span className="text-red-500">*</span></label>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2 max-h-56 overflow-y-auto border border-neutral-200 rounded-lg p-3">
            {PROGRAMMES.map((p) => (
              <label key={p} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={programmesTaught.includes(p)}
                  onChange={(e) => setProgrammesTaught(e.target.checked ? [...programmesTaught, p] : programmesTaught.filter((x) => x !== p))}
                  className="rounded"
                />
                {p}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <label className="label">Profile Photo URL (optional)</label>
          <input type="url" value={profilePhotoUrl} onChange={(e) => setProfilePhotoUrl(e.target.value)} className="input" placeholder="https://..." />
          {profilePhotoUrl && (
            <img src={profilePhotoUrl} alt="Preview" className="w-16 h-16 rounded-full object-cover mt-2" onError={(e) => (e.currentTarget.style.display = 'none')} />
          )}
        </div>
      </div>

      {/* ── Section 2: Qualifications ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
        <SectionHead n={2} title="Qualifications" done={!!(highestQual.degree && highestQual.field && highestQual.institution)} />
        <div>
          <div className="text-sm font-medium text-neutral-700 mb-3">Highest Qualification <span className="text-red-500">*</span></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Degree Type</label>
              <select value={highestQual.degree} onChange={(e) => setHighestQual({ ...highestQual, degree: e.target.value })} className="input">
                <option value="">Select…</option>
                {DEGREE_TYPES.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Field of Study</label>
              <input type="text" value={highestQual.field} onChange={(e) => setHighestQual({ ...highestQual, field: e.target.value })} className="input" placeholder="e.g. Educational Administration" />
            </div>
            <div>
              <label className="label">Awarding Institution</label>
              <input type="text" value={highestQual.institution} onChange={(e) => setHighestQual({ ...highestQual, institution: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Year</label>
              <input type="number" value={highestQual.year} onChange={(e) => setHighestQual({ ...highestQual, year: e.target.value })} className="input" min={1950} max={new Date().getFullYear()} />
            </div>
          </div>
        </div>

        {otherQuals.map((q, i) => (
          <div key={i} className="mt-5 pt-5 border-t border-neutral-100">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-neutral-700">Additional Qualification {i + 1}</div>
              <button type="button" onClick={() => setOtherQuals(otherQuals.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:text-red-700">Remove</button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Degree Type</label>
                <select value={q.degree} onChange={(e) => { const qs = [...otherQuals]; qs[i] = { ...q, degree: e.target.value }; setOtherQuals(qs); }} className="input">
                  <option value="">Select…</option>
                  {DEGREE_TYPES.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Field of Study</label>
                <input type="text" value={q.field} onChange={(e) => { const qs = [...otherQuals]; qs[i] = { ...q, field: e.target.value }; setOtherQuals(qs); }} className="input" />
              </div>
              <div>
                <label className="label">Institution</label>
                <input type="text" value={q.institution} onChange={(e) => { const qs = [...otherQuals]; qs[i] = { ...q, institution: e.target.value }; setOtherQuals(qs); }} className="input" />
              </div>
              <div>
                <label className="label">Year</label>
                <input type="number" value={q.year} onChange={(e) => { const qs = [...otherQuals]; qs[i] = { ...q, year: e.target.value }; setOtherQuals(qs); }} className="input" />
              </div>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setOtherQuals([...otherQuals, { degree: '', field: '', institution: '', year: '' }])} className="mt-4 text-sm text-primary-600 hover:text-primary-800 font-medium">
          + Add More Qualifications
        </button>

        <div className="mt-5 pt-5 border-t border-neutral-100">
          <label className="label">Professional Memberships</label>
          <TagInput tags={memberships} onChange={setMemberships} placeholder="Type and press Enter…" />
          <div className="mt-2 flex flex-wrap gap-1">
            {PROFESSIONAL_MEMBERSHIPS_SUGGESTIONS.filter((s) => !memberships.includes(s)).slice(0, 4).map((s) => (
              <button key={s} type="button" onClick={() => setMemberships([...memberships, s])} className="text-xs px-2 py-0.5 bg-neutral-100 hover:bg-neutral-200 rounded-full text-neutral-600 transition-colors">
                + {s.split('(')[0].trim()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 3: Research Identity ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
        <SectionHead n={3} title="Research Identity" done={specialisations.length > 0 && keywords.length >= 5 && wordCount >= 200} />
        <div className="space-y-5">
          <div>
            <label className="label">Areas of Specialisation <span className="text-red-500">*</span> <span className="text-neutral-400 font-normal">(up to 3)</span></label>
            <TagInput tags={specialisations} onChange={setSpecialisations} placeholder="e.g. Curriculum Development" max={3} />
          </div>
          <div>
            <label className="label">Research Keywords <span className="text-red-500">*</span> <span className="text-neutral-400 font-normal">({keywords.length}/20, min 5)</span></label>
            <TagInput tags={keywords} onChange={setKeywords} placeholder="Type keyword and press Enter…" max={20} />
            {keywords.length < 5 && <p className="text-xs text-amber-600 mt-1">At least 5 keywords required.</p>}
          </div>
          <div>
            <label className="label">Biography / Research Statement <span className="text-red-500">*</span></label>
            <textarea
              value={biography}
              onChange={(e) => setBiography(e.target.value)}
              rows={8}
              className="input resize-y"
              placeholder="Describe your research interests, current projects, and academic background…"
            />
            <div className={`text-xs mt-1 ${wordCount < 200 ? 'text-amber-600' : wordCount > 500 ? 'text-red-600' : 'text-green-600'}`}>
              {wordCount} words {wordCount < 200 ? `(${200 - wordCount} more needed)` : wordCount > 500 ? '(too long — max 500)' : '✓'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 4: Academic IDs ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
        <SectionHead n={4} title="Academic Identifiers" done={false} />
        <div className="space-y-4">
          <div>
            <label className="label">ORCID iD</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={orcidId}
                onChange={(e) => { setOrcidId(e.target.value); setOrcidStatus('idle'); }}
                className="input flex-1"
                placeholder="0000-0000-0000-0000"
              />
              <button type="button" onClick={verifyOrcid} disabled={orcidVerifying || !orcidId} className="btn-outline px-4 text-sm shrink-0 disabled:opacity-50">
                {orcidVerifying ? 'Checking…' : 'Verify'}
              </button>
            </div>
            {orcidStatus === 'valid' && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-green-600 font-medium">✓ Verified: {orcidName}</span>
                <button type="button" onClick={fetchPublications} disabled={fetchingPubs} className="text-xs text-primary-600 hover:text-primary-800 font-medium disabled:opacity-50">
                  {fetchingPubs ? 'Fetching…' : '→ Fetch publications'}
                </button>
              </div>
            )}
            {orcidStatus === 'invalid' && <p className="text-xs text-red-600 mt-1">ORCID not found. Check the format: 0000-0000-0000-0000</p>}
          </div>
          <div>
            <label className="label">Google Scholar Profile ID</label>
            <input type="text" value={googleScholarId} onChange={(e) => setGoogleScholarId(e.target.value)} className="input" placeholder="e.g. ABC123dEfGhi" />
          </div>
          <div>
            <label className="label">ResearchGate URL</label>
            <input type="url" value={researchgateUrl} onChange={(e) => setResearchgateUrl(e.target.value)} className="input" placeholder="https://www.researchgate.net/profile/..." />
          </div>
          <div>
            <label className="label">Academia.edu URL</label>
            <input type="url" value={academiaUrl} onChange={(e) => setAcademiaUrl(e.target.value)} className="input" placeholder="https://independent.academia.edu/..." />
          </div>
        </div>
      </div>

      {/* ── Section 5: Publications ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
        <SectionHead n={5} title={`Publications (${publications.length})`} done={publications.length > 0} />

        {publications.length > 0 && (
          <div className="space-y-3 mb-4">
            {publications.map((pub, i) => (
              <div key={i} className="flex gap-3 items-start bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                <div className="flex-1 min-w-0">
                  <div className="flex gap-2 flex-wrap mb-1">
                    {pub.year && <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded font-medium">{pub.year}</span>}
                    <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded capitalize">{pub.publication_type}</span>
                  </div>
                  <p className="text-xs text-neutral-700 leading-relaxed">{pub.apa_formatted ?? buildAPA(pub)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setPublications(publications.filter((_, j) => j !== i)); }}
                  className="text-neutral-400 hover:text-red-500 shrink-0 text-sm mt-0.5"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {showPubForm ? (
          <div className="border border-neutral-200 rounded-xl p-5 space-y-4">
            <div className="text-sm font-semibold text-neutral-800">Add Publication</div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Title <span className="text-red-500">*</span></label>
                <input type="text" value={pubForm.title} onChange={(e) => setPubForm({ ...pubForm, title: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Type</label>
                <select value={pubForm.publication_type} onChange={(e) => setPubForm({ ...pubForm, publication_type: e.target.value })} className="input">
                  {PUB_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Year</label>
                <input type="number" value={pubForm.year} onChange={(e) => setPubForm({ ...pubForm, year: e.target.value })} className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Journal / Publisher</label>
                <input type="text" value={pubForm.journal_or_publisher} onChange={(e) => setPubForm({ ...pubForm, journal_or_publisher: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Volume</label>
                <input type="text" value={pubForm.volume} onChange={(e) => setPubForm({ ...pubForm, volume: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Issue</label>
                <input type="text" value={pubForm.issue} onChange={(e) => setPubForm({ ...pubForm, issue: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Pages</label>
                <input type="text" value={pubForm.pages} onChange={(e) => setPubForm({ ...pubForm, pages: e.target.value })} className="input" placeholder="e.g. 120-135" />
              </div>
              <div>
                <label className="label">DOI</label>
                <input type="text" value={pubForm.doi} onChange={(e) => setPubForm({ ...pubForm, doi: e.target.value })} className="input" placeholder="10.xxxx/..." />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Authors (one per line)</label>
                <textarea
                  rows={3}
                  value={pubForm.authors.join('\n')}
                  onChange={(e) => setPubForm({ ...pubForm, authors: e.target.value.split('\n') })}
                  className="input resize-y text-sm"
                  placeholder="Surname, F. I.&#10;Co-Author, A. B."
                />
              </div>
            </div>
            {pubForm.title && (
              <div className="bg-neutral-50 rounded-lg p-3 text-xs text-neutral-600">
                <div className="font-medium text-neutral-700 mb-1">APA Preview:</div>
                {buildAPA(pubForm)}
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => {
                setPublications([...publications, { ...pubForm, apa_formatted: buildAPA(pubForm) }]);
                setPubForm({ title: '', authors: [''], year: '', publication_type: 'journal', journal_or_publisher: '', volume: '', issue: '', pages: '', doi: '' });
                setShowPubForm(false);
              }} className="btn-primary text-sm px-4 py-2" disabled={!pubForm.title}>Add</button>
              <button type="button" onClick={() => setShowPubForm(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setShowPubForm(true)} className="text-sm text-primary-600 hover:text-primary-800 font-medium">
            + Add Publication Manually
          </button>
        )}
      </div>

      {/* ── Section 6: Additional ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
        <SectionHead n={6} title="Additional Information (optional)" done={false} />
        <div className="space-y-6">
          {/* Grants */}
          <div>
            <div className="text-sm font-medium text-neutral-700 mb-3">Grants &amp; Research Funding</div>
            {grants.map((g, i) => (
              <div key={i} className="flex gap-2 items-start bg-neutral-50 rounded-xl p-4 border border-neutral-100 mb-3">
                <div className="flex-1 text-sm text-neutral-700">
                  <span className="font-medium">{g.title || 'Untitled'}</span>
                  {g.funding_body && <span className="text-neutral-500"> — {g.funding_body}</span>}
                  {g.year && <span className="text-neutral-500"> ({g.year})</span>}
                  {g.role && <span className="text-neutral-500"> · {g.role}</span>}
                </div>
                <button type="button" onClick={() => setGrants(grants.filter((_, j) => j !== i))} className="text-neutral-400 hover:text-red-500 text-sm">✕</button>
              </div>
            ))}
            {showGrantForm ? (
              <div className="border border-neutral-200 rounded-xl p-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="label">Grant Title</label>
                    <input type="text" value={grantForm.title} onChange={(e) => setGrantForm({ ...grantForm, title: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="label">Funding Body</label>
                    <input type="text" value={grantForm.funding_body} onChange={(e) => setGrantForm({ ...grantForm, funding_body: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="label">Year</label>
                    <input type="number" value={grantForm.year} onChange={(e) => setGrantForm({ ...grantForm, year: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="label">Your Role</label>
                    <input type="text" value={grantForm.role} onChange={(e) => setGrantForm({ ...grantForm, role: e.target.value })} className="input" placeholder="Principal Investigator / Co-PI" />
                  </div>
                  <div>
                    <label className="label">Amount</label>
                    <input type="text" value={grantForm.amount} onChange={(e) => setGrantForm({ ...grantForm, amount: e.target.value })} className="input" placeholder="e.g. ₦2,500,000" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setGrants([...grants, grantForm]); setGrantForm({ title: '', funding_body: '', amount: '', year: '', role: '' }); setShowGrantForm(false); }} className="btn-primary text-sm px-4 py-2">Add</button>
                  <button type="button" onClick={() => setShowGrantForm(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setShowGrantForm(true)} className="text-sm text-primary-600 hover:text-primary-800 font-medium">+ Add Grant</button>
            )}
          </div>

          {/* Supervision */}
          <div>
            <div className="text-sm font-medium text-neutral-700 mb-3">Postgraduate Supervision</div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: 'PhD Completed', value: supervisPhD.completed, onChange: (v: number) => setSupervisPhD({ ...supervisPhD, completed: v }) },
                { label: 'PhD Current', value: supervisPhD.current, onChange: (v: number) => setSupervisPhD({ ...supervisPhD, current: v }) },
                { label: 'M.Ed. Completed', value: supervisMEd.completed, onChange: (v: number) => setSupervisMEd({ ...supervisMEd, completed: v }) },
                { label: 'M.Ed. Current', value: supervisMEd.current, onChange: (v: number) => setSupervisMEd({ ...supervisMEd, current: v }) },
              ].map((item) => (
                <div key={item.label}>
                  <label className="label">{item.label}</label>
                  <input type="number" value={item.value} onChange={(e) => item.onChange(parseInt(e.target.value) || 0)} className="input" min={0} />
                </div>
              ))}
            </div>
          </div>

          {/* Visibility */}
          <div>
            <div className="text-sm font-medium text-neutral-700 mb-2">Profile Visibility</div>
            <div className="flex gap-4">
               {[{ value: 'public', label: 'Public — visible to everyone' }, { value: 'institution', label: 'ESUT Only — visible to authenticated users' }].map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" value={opt.value} checked={visibility === opt.value} onChange={() => setVisibility(opt.value)} className="rounded-full" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Save / Submit ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm text-neutral-500">
          {status === 'pending_review' && 'Your profile is under review by the Digital Resources Librarian.'}
          {status === 'published' && 'Your profile is live on the ESUT Lecturer Directory.'}
          {(status === 'draft' || status === 'returned') && 'Save a draft at any time. Submit when your profile is 100% complete.'}
        </div>
        <div className="flex items-center gap-3">
          {saveMsg && <span className="text-sm text-green-600 font-medium">{saveMsg}</span>}
          <button type="button" onClick={() => saveProfile(false)} disabled={saving || !firstName || !surname} className="btn-outline text-sm px-5 py-2.5 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          {canSubmit && (
            <button type="button" onClick={() => saveProfile(true)} disabled={submitting} className="btn-primary text-sm px-5 py-2.5 disabled:opacity-50">
              {submitting ? 'Submitting…' : 'Submit for Review'}
            </button>
          )}
          {progress < 100 && status !== 'published' && status !== 'pending_review' && (
            <div className="text-xs text-neutral-400">Complete all required fields to submit</div>
          )}
        </div>
      </div>
    </div>
  );
}
