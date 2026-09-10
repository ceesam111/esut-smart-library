import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import BackButton from '@/components/BackButton';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAuth } from '@/hooks/useAuth';

interface Database {
  id: string;
  name: string;
  description: string;
  url: string | null;
  provider: string;
  type: string;
  coverage: string;
  subjects: any;
  access_type: string;
  is_active: boolean;
  logo_url: string | null;
  subject_tags: string[] | null;
  content_type: string | null;
}

interface OAJournal {
  id: string;
  bibjson: {
    title: string;
    publisher: { name: string };
    identifier: { type: string; id: string }[];
    subject: { term: string }[];
    language: string[];
  };
  links?: { url: string; type: string }[];
}

const FREE_EBOOK_COLLECTIONS = [
  {
    name: 'Project Gutenberg',
    url: 'https://www.gutenberg.org',
    description: '70,000+ free ebooks in the public domain. The oldest digital library, covering classic literature, history, science, and philosophy. No registration required.',
    badge: '70,000+ books',
    badgeCls: 'bg-orange-100 text-orange-800',
  },
  {
    name: 'Open Library',
    url: 'https://openlibrary.org',
    description: 'Internet Archive\'s catalogue of 36 million records with millions of free full-text titles. Covers academic, popular, and reference works across all disciplines.',
    badge: '36M records',
    badgeCls: 'bg-sky-100 text-sky-800',
  },
  {
    name: 'OAPEN Library',
    url: 'https://library.oapen.org',
    description: 'Peer-reviewed open access academic monographs and edited volumes, primarily in the humanities, social sciences, and education. European scholarship focus.',
    badge: '20,000+ books',
    badgeCls: 'bg-teal-100 text-teal-800',
  },
  {
    name: 'DOAB',
    url: 'https://directory.doabooks.org',
    description: 'Curated directory of peer-reviewed open access books from reputable academic publishers worldwide. A reliable source for vetted scholarly monographs.',
    badge: '60,000+ books',
    badgeCls: 'bg-cyan-100 text-cyan-800',
  },
  {
    name: 'Google Books Free',
    url: 'https://books.google.com/ebooks/search?filter=free-ebooks',
    description: 'Full-text access to out-of-copyright books and millions of free ebooks. Excellent for finding book excerpts, classic texts, and recent African titles.',
    badge: 'Free ebooks',
    badgeCls: 'bg-red-100 text-red-800',
  },
  {
    name: 'Internet Archive Books',
    url: 'https://archive.org/details/books',
    description: '41M+ digitised books including rare historical Nigerian and African texts. Access through digital borrowing or free for out-of-copyright works.',
    badge: '41M+ items',
    badgeCls: 'bg-amber-100 text-amber-800',
  },
];

export default function Databases() {
  usePageTitle('Research Databases');
  const { can, user, profile } = useAuth();
  const [databases, setDatabases]     = useState<Database[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [subject, setSubject]         = useState('');
  const [accessType, setAccessType]   = useState('');
  const [subjects, setSubjects]       = useState<string[]>([]);
  const [requestDb, setRequestDb]     = useState<Database | null>(null);
  const [reqForm, setReqForm]         = useState({ patron_name: '', patron_email: '', department: '', reason: '' });
  const [reqSending, setReqSending]   = useState(false);
  const [reqDone, setReqDone]         = useState(false);
  const [oaJournals, setOaJournals]   = useState<OAJournal[]>([]);
  const [oaLoading, setOaLoading]     = useState(true);
  const [consortiumDbs, setConsortiumDbs]         = useState<any[]>([]);
  const [consortiumMembers, setConsortiumMembers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('databases')
        .select('id, name, description, url, provider, type, coverage, subjects, access_type, is_active, logo_url, subject_tags, content_type')
        .eq('is_active', true)
        .order('name');
      const dbs = (data ?? []) as Database[];
      setDatabases(dbs);
      const allTags = dbs.flatMap(d => d.subject_tags ?? []);
      setSubjects([...new Set(allTags)].sort());
      setLoading(false);
    })();

    // Fetch DOAJ journals for education/Africa
    (async () => {
      try {
        const res = await fetch('https://doaj.org/api/journals?q=education+africa&pageSize=6&sort=last_updated:desc');
        if (res.ok) {
          const json = await res.json();
          setOaJournals((json.results ?? []).slice(0, 6));
        }
      } catch { /* DOAJ may block client-side requests; gracefully degrade */ }
      setOaLoading(false);
    })();

    // Fetch consortium members (safe public columns via security-definer fn) + their contributed databases
    (async () => {
      const [{ data: members }, { data: cdbs }] = await Promise.all([
        supabase.rpc('list_consortium_members_public'),
        supabase.from('consortium_databases').select('id, member_id, name, provider, description, access_url, subjects, access_type').eq('is_active', true).order('name'),
      ]);
      setConsortiumMembers(members ?? []);
      setConsortiumDbs(cdbs ?? []);
    })();
  }, []);

  // A user is a consortium user if their email domain or institution matches an active member.
  const emailDomain = (user?.email ?? '').split('@')[1]?.toLowerCase() ?? '';
  const isConsortiumUser = !!user && consortiumMembers.some(m => {
    const memberDomain = (m.email_domain ?? '').toLowerCase();
    const inst = (profile?.institution ?? '').toLowerCase();
    return (
      (memberDomain && emailDomain && memberDomain === emailDomain) ||
      (inst && m.institution_name && inst.includes(m.institution_name.toLowerCase())) ||
      (inst && m.short_code && inst.includes(String(m.short_code).toLowerCase())) ||
      // ESUT users are the founding member — grant by default
      emailDomain.endsWith('esut.edu.ng')
    );
  });

  const logConsortiumAccess = async (db: any) => {
    if (!user) return;
    await supabase.from('consortium_access_logs').insert({
      database_id: db.id,
      member_id: db.member_id,
      user_id: user.id,
      user_name: profile?.full_name ?? user.email ?? null,
    });
  };

  const canSubscribed = can('subscribedDatabases');
  const canConsortium = can('consortiumDatabases');

  const accessible = databases.filter(db => {
    if (db.access_type === 'open') return true;          // open access: everyone
    if (db.access_type === 'restricted') return canConsortium; // consortium / restricted
    return canSubscribed;                                // campus / licensed (subscribed)
  });

  const hiddenCount = databases.length - accessible.length;

  const filtered = accessible.filter(db => {
    const q = search.toLowerCase();
    const matchSearch  = !q || db.name.toLowerCase().includes(q) || db.description?.toLowerCase().includes(q) || db.provider?.toLowerCase().includes(q);
    const matchSubject = !subject || (db.subject_tags ?? []).includes(subject);
    const matchAccess  = !accessType || db.access_type === accessType;
    return matchSearch && matchSubject && matchAccess;
  });

  async function requestAccess() {
    if (!requestDb || !reqForm.patron_name.trim() || !reqForm.patron_email.trim()) return;
    setReqSending(true);
    await supabase.from('database_access_requests').insert({
      database_id: requestDb.id, patron_name: reqForm.patron_name.trim(),
      patron_email: reqForm.patron_email.trim(), department: reqForm.department.trim(),
      reason: reqForm.reason.trim(), status: 'pending',
    });
    setReqSending(false);
    setReqDone(true);
  }

  const accessBadge = (type: string) => ({
    open: { label: 'Open Access', cls: 'bg-green-50 text-green-700 border border-green-200' },
    campus: { label: 'Licensed', cls: 'bg-primary-50 text-primary-700 border border-primary-200' },
    restricted: { label: 'Request Required', cls: 'bg-neutral-100 text-neutral-600 border border-neutral-200' },
  }[type] ?? { label: type, cls: 'bg-neutral-100 text-neutral-600 border border-neutral-200' });

  const journalISSN = (j: OAJournal): string => {
    const id = (j.bibjson?.identifier ?? []).find((i: any) => i.type === 'pissn' || i.type === 'eissn');
    return id?.id ?? '';
  };
  const journalSubjects = (j: OAJournal): string => {
    return (j.bibjson?.subject ?? []).map((s: any) => s.term).slice(0, 3).join(' · ');
  };
  const journalLang = (j: OAJournal): string => {
    return (j.bibjson?.language ?? []).slice(0, 2).join(', ');
  };
  const journalUrl = (j: OAJournal): string => {
    const link = (j.links ?? []).find((l: any) => l.type === 'homepage');
    return link?.url ?? 'https://doaj.org';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-10">
        <BackButton />
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Research Databases</h1>
        <p className="text-neutral-500">Access licensed databases, open-access resources and research tools available through ESUT Library.</p>
      </div>

      {hiddenCount > 0 && (
        <div className="mb-8 px-4 py-3 rounded-lg bg-primary-50 border border-primary-200 text-primary-800 text-sm flex items-center justify-between gap-4 flex-wrap">
          <span>
            {user
              ? `${hiddenCount} subscribed database${hiddenCount !== 1 ? 's are' : ' is'} restricted for your account type. Open-access resources remain available below.`
              : `${hiddenCount} subscribed database${hiddenCount !== 1 ? 's are' : ' is'} available to registered members. Sign in to access them.`}
          </span>
          {!user && <Link to="/login" className="btn-primary text-xs px-4 py-1.5 shrink-0">Sign In</Link>}
        </div>
      )}

      {/* Consortium databases */}
      {consortiumDbs.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-neutral-900">Consortium Databases</h2>
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">Partner-shared</span>
          </div>
          <p className="text-neutral-500 text-sm mb-4">
            Databases contributed by partner institutions in the ESUT Library Consortium.
            {isConsortiumUser
              ? ' Your membership grants full access.'
              : user
                ? ' Available to users of partner institutions.'
                : ' Sign in with a partner institution account to access these.'}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {consortiumDbs.map(db => {
              const member = consortiumMembers.find(m => m.id === db.member_id);
              return (
                <div key={db.id} className="border border-neutral-200 rounded-2xl p-5 flex flex-col bg-white">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-neutral-900 leading-tight">{db.name}</h3>
                    <span className="text-[10px] uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">Consortium</span>
                  </div>
                  {db.provider && <p className="text-xs text-neutral-500 mb-1">{db.provider}</p>}
                  {db.description && <p className="text-sm text-neutral-600 line-clamp-3 mb-3">{db.description}</p>}
                  {db.subjects && db.subjects.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {db.subjects.slice(0, 3).map((s: string) => (
                        <span key={s} className="text-[11px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto pt-2 flex items-center justify-between">
                    <span className="text-xs text-neutral-400">{member ? `via ${member.short_code ?? member.institution_name}` : 'Consortium'}</span>
                    {isConsortiumUser && db.access_url ? (
                      <a
                        href={db.access_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => logConsortiumAccess(db)}
                        className="btn-primary text-xs px-4 py-1.5"
                      >
                        Access
                      </a>
                    ) : (
                      <span className="text-xs text-neutral-400">{user ? 'Member access only' : 'Sign in required'}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}





      {/* Search & filters */}
      <div className="flex flex-wrap gap-3 mb-8">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search databases…"
          className="flex-1 min-w-48 border border-neutral-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {subjects.length > 0 && (
          <select value={subject} onChange={e => setSubject(e.target.value)}
            className="border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Subjects</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <select value={accessType} onChange={e => setAccessType(e.target.value)}
          className="border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Access Types</option>
          <option value="open">Open Access</option>
          <option value="campus">Licensed</option>
          <option value="restricted">Request Required</option>
        </select>
      </div>

      {/* Licensed / Managed Databases */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {[...Array(6)].map((_, i) => <div key={i} className="h-44 bg-neutral-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-400">No databases found matching your filters.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {filtered.map(db => {
            const badge = accessBadge(db.access_type);
            return (
              <div key={db.id} className="bg-white rounded-2xl border border-neutral-200 p-5 hover:shadow-md transition-shadow flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  {db.logo_url ? (
                    <img src={db.logo_url} alt={db.name} className="w-10 h-10 object-contain rounded-lg border border-neutral-100" />
                  ) : (
                    <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center font-bold text-primary-700 text-sm shrink-0">
                      {db.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="font-semibold text-neutral-900 leading-tight">{db.name}</h2>
                    <p className="text-xs text-neutral-400 mt-0.5">{db.provider}</p>
                  </div>
                </div>
                {db.description && <p className="text-sm text-neutral-600 line-clamp-2 mb-3 flex-1">{db.description}</p>}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                  {db.type && <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">{db.type}</span>}
                  {db.content_type && <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">{db.content_type}</span>}
                </div>
                {db.coverage && <p className="text-xs text-neutral-400 mb-3">Coverage: {db.coverage}</p>}
                {(db.subject_tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(db.subject_tags ?? []).slice(0, 4).map(t => (
                      <span key={t} className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
                <div className="mt-auto pt-3 border-t border-neutral-100">
                  {(db.access_type === 'open' || db.access_type === 'campus') && db.url ? (
                    <a href={db.url} target="_blank" rel="noopener noreferrer"
                      className="w-full block text-center bg-primary-700 hover:bg-primary-800 text-white text-sm py-2 rounded-lg font-medium transition-colors">
                      {db.access_type === 'campus' ? 'Access (Campus Only) →' : 'Access Database →'}
                    </a>
                  ) : (
                    <button
                      onClick={() => { setRequestDb(db); setReqForm({ patron_name: '', patron_email: '', department: '', reason: '' }); setReqDone(false); }}
                      className="w-full text-center border border-primary-300 text-primary-700 hover:bg-primary-50 text-sm py-2 rounded-lg font-medium transition-colors">
                      Request Access
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Open Access Resources ─────────────────────────────────────── */}
      <div className="border-t border-neutral-200 pt-12 space-y-12">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-1">Free Open Access Resources</h2>
          <p className="text-neutral-500 text-sm">No login required — freely available to all users worldwide.</p>
        </div>

        {/* A — Open Access Journals from DOAJ */}
        <div>
          <h3 className="text-lg font-semibold text-neutral-800 mb-1">
            Open Access Journals
            <span className="ml-2 text-xs font-normal text-neutral-400">via DOAJ — Directory of Open Access Journals</span>
          </h3>
          <p className="text-sm text-neutral-500 mb-5">Peer-reviewed open access journals relevant to education and African scholarship. Free to read, no subscription required.</p>

          {oaLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <div key={i} className="h-36 bg-neutral-100 rounded-xl animate-pulse" />)}
            </div>
          ) : oaJournals.length === 0 ? (
            <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-8 text-center">
              <p className="text-neutral-400 text-sm">DOAJ journal data unavailable. Visit <a href="https://doaj.org" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">doaj.org</a> to browse directly.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {oaJournals.map((j, i) => (
                <div key={i} className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md transition-shadow flex flex-col">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-sm shrink-0">📰</div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm text-neutral-900 leading-snug line-clamp-2">{j.bibjson?.title}</h4>
                      <p className="text-xs text-neutral-400 mt-0.5">{j.bibjson?.publisher?.name}</p>
                    </div>
                  </div>
                  {journalISSN(j) && <p className="text-xs text-neutral-400 mb-1">ISSN: {journalISSN(j)}</p>}
                  {journalSubjects(j) && <p className="text-xs text-neutral-500 mb-1 line-clamp-1">{journalSubjects(j)}</p>}
                  {journalLang(j) && <p className="text-xs text-neutral-400 mb-3">Language: {journalLang(j)}</p>}
                  <div className="mt-auto">
                    <a href={journalUrl(j)} target="_blank" rel="noopener noreferrer"
                      className="w-full block text-center bg-green-700 hover:bg-green-800 text-white text-xs py-2 rounded-lg font-medium transition-colors">
                      Browse Journal →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-neutral-400 mt-3">
            Browse all 20,000+ open access journals at{' '}
            <a href="https://doaj.org" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">doaj.org</a>
          </p>
        </div>

        {/* B — Free Ebook Collections */}
        <div>
          <h3 className="text-lg font-semibold text-neutral-800 mb-1">Free Open Access Resources</h3>
          <p className="text-sm text-neutral-500 mb-5">Permanent free access to millions of academic and public domain books. No registration required.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FREE_EBOOK_COLLECTIONS.map((col) => (
              <div key={col.name} className="bg-white rounded-xl border border-neutral-200 border-l-4 p-5 hover:shadow-md transition-shadow flex flex-col" style={{ borderLeftColor: '#6B1D2A' }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-bold text-neutral-900 text-base leading-snug">{col.name}</h4>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${col.badgeCls}`}>{col.badge}</span>
                </div>
                <p className="text-sm text-neutral-600 flex-1 leading-relaxed mb-4">{col.description}</p>
                <a href={col.url} target="_blank" rel="noopener noreferrer"
                  className="block text-center text-sm font-semibold py-2 rounded-lg text-white transition-opacity hover:opacity-90"
                  style={{ background: '#6B1D2A' }}>
                  Visit Resource →
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Request Access Modal */}
      {requestDb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => { if (e.target === e.currentTarget) setRequestDb(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-neutral-900">Request Access</h2>
              <button onClick={() => setRequestDb(null)} className="text-neutral-400 hover:text-neutral-600 text-xl">×</button>
            </div>
            <p className="text-sm text-neutral-600 mb-5">Request access to <strong>{requestDb.name}</strong>. The library team will review and respond by email.</p>
            {reqDone ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-3">✓</div>
                <p className="font-medium text-neutral-900">Request submitted!</p>
                <p className="text-sm text-neutral-500 mt-1">We'll be in touch soon.</p>
                <button onClick={() => setRequestDb(null)} className="mt-5 text-sm text-primary-700 hover:underline">Close</button>
              </div>
            ) : (
              <div className="space-y-3">
                <input required value={reqForm.patron_name} onChange={e => setReqForm(f => ({ ...f, patron_name: e.target.value }))} placeholder="Your full name *" className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <input type="email" required value={reqForm.patron_email} onChange={e => setReqForm(f => ({ ...f, patron_email: e.target.value }))} placeholder="Your email *" className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <input value={reqForm.department} onChange={e => setReqForm(f => ({ ...f, department: e.target.value }))} placeholder="Department / Faculty" className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <textarea value={reqForm.reason} onChange={e => setReqForm(f => ({ ...f, reason: e.target.value }))} rows={3} placeholder="Reason for access (optional)" className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setRequestDb(null)} className="flex-1 px-4 py-2.5 text-sm border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-lg transition-colors">Cancel</button>
                  <button onClick={requestAccess} disabled={reqSending || !reqForm.patron_name.trim() || !reqForm.patron_email.trim()} className="flex-1 px-4 py-2.5 text-sm bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium disabled:opacity-50 transition-colors">
                    {reqSending ? 'Submitting…' : 'Submit Request'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
