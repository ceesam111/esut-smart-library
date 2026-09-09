import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Profile {
  id: string;
  slug: string;
  salutation: string | null;
  first_name: string;
  middle_name: string | null;
  surname: string;
  academic_rank: string | null;
  department: string | null;
  specialisations: string[];
  biography: string | null;
  orcid_id: string | null;
  orcid_verified: boolean;
  status: string;
  return_notes: string | null;
  visibility: string;
  last_updated_at: string | null;
  created_at: string;
  patron_id: string;
  patrons?: { full_name: string; email: string; patron_category: string } | null;
}

const STATUS_FILTERS = ['all', 'pending_review', 'published', 'returned', 'draft'];

export default function ResearcherProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending_review');
  const [selected, setSelected] = useState<Profile | null>(null);
  const [returnNotes, setReturnNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const load = async () => {
    setLoading(true);
    const query = supabase
      .from('researcher_profiles')
      .select('*, patrons(full_name, email, patron_category)')
      .order('created_at', { ascending: false });

    if (filter !== 'all') query.eq('status', filter);

    const { data } = await query;
    setProfiles((data as Profile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const counts = profiles.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  const approve = async (profile: Profile) => {
    setActionLoading(true);
    await supabase.from('researcher_profiles').update({
      status: 'published',
      return_notes: null,
      last_updated_at: new Date().toISOString(),
    }).eq('id', profile.id);

    // Log to admin_access_log
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('admin_access_log').insert({
        librarian_id: user.id,
        patron_id: profile.patron_id,
        action: 'researcher_profile_approved',
      });
    }

    // Send email notification
    if (profile.patrons?.email) {
      const fullName = [profile.salutation, profile.first_name, profile.surname].filter(Boolean).join(' ');
      await supabase.functions.invoke('send-email', {
        body: {
          to: profile.patrons.email,
          to_name: profile.patrons.full_name,
          subject: 'Your ESUT Research Profile is Now Published',
          html: `<p>Dear ${fullName},</p>
<p>Your research profile has been reviewed and <strong>approved</strong> by the Digital Resources Librarian. It is now publicly available on the ESUT Lecturer Directory.</p>
<p><a href="https://library.esut.edu.ng/lecturers/${profile.slug}">View your profile</a></p>
<p>Regards,<br/>ESUT Library</p>`,
        },
      });
    }

    setActionMsg('Profile approved and published.');
    setSelected(null);
    await load();
    setActionLoading(false);
    setTimeout(() => setActionMsg(''), 4000);
  };

  const returnProfile = async (profile: Profile) => {
    if (!returnNotes.trim()) return;
    setActionLoading(true);
    await supabase.from('researcher_profiles').update({
      status: 'returned',
      return_notes: returnNotes.trim(),
      last_updated_at: new Date().toISOString(),
    }).eq('id', profile.id);

    // Send email
    if (profile.patrons?.email) {
      const fullName = [profile.salutation, profile.first_name, profile.surname].filter(Boolean).join(' ');
      await supabase.functions.invoke('send-email', {
        body: {
          to: profile.patrons.email,
          to_name: profile.patrons.full_name,
          subject: 'Action Required: ESUT Research Profile — Revision Needed',
          html: `<p>Dear ${fullName},</p>
<p>Your research profile submission has been reviewed. The Digital Resources Librarian has requested some revisions before it can be published.</p>
<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0">
  <strong>Revision notes:</strong><br/>${returnNotes.replace(/\n/g, '<br/>')}
</div>
<p>Please log in to your dashboard, update your profile, and resubmit.</p>
<p>Regards,<br/>ESUT Library</p>`,
        },
      });
    }

    setActionMsg('Profile returned with revision notes.');
    setReturnNotes('');
    setSelected(null);
    await load();
    setActionLoading(false);
    setTimeout(() => setActionMsg(''), 4000);
  };

  const pendingCount = profiles.filter((p) => p.status === 'pending_review').length;

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Lecturer Profiles</h1>
          <p className="text-neutral-500 text-sm mt-1">Review and publish academic staff research profiles.</p>
        </div>
        {pendingCount > 0 && (
          <span className="inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
            {pendingCount} pending review
          </span>
        )}
      </div>

      {actionMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
          {actionMsg}
        </div>
      )}

      {/* Filter tabs */}
      <div className="border-b border-neutral-200 flex gap-1 overflow-x-auto">
        {STATUS_FILTERS.map((f) => {
          const count = f === 'all' ? profiles.length : (counts[f] ?? 0);
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                filter === f
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {f === 'all' ? 'All' :
               f === 'pending_review' ? 'Pending Review' :
               f === 'published' ? 'Published' :
               f === 'returned' ? 'Returned' : 'Drafts'}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  f === 'pending_review' ? 'bg-yellow-100 text-yellow-700' : 'bg-neutral-100 text-neutral-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Profile list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <div className="text-4xl mb-3">📋</div>
          <div className="font-medium text-neutral-600">No profiles in this category</div>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((profile) => {
            const fullName = [profile.salutation, profile.first_name, profile.middle_name, profile.surname].filter(Boolean).join(' ');
            return (
              <div
                key={profile.id}
                className="bg-white rounded-xl border border-neutral-200 shadow-sm hover:border-primary-200 transition-colors"
              >
                <div className="p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
                    {profile.first_name[0]}{profile.surname[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-neutral-900">{fullName}</div>
                    <div className="text-xs text-neutral-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {profile.academic_rank && <span>{profile.academic_rank}</span>}
                      {profile.department && <span>{profile.department}</span>}
                      {profile.patrons?.email && <span>{profile.patrons.email}</span>}
                    </div>
                    {profile.specialisations.length > 0 && (
                      <div className="text-xs text-neutral-400 mt-1">{profile.specialisations.slice(0, 2).join(' · ')}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      profile.status === 'published' ? 'bg-green-100 text-green-700' :
                      profile.status === 'pending_review' ? 'bg-yellow-100 text-yellow-700' :
                      profile.status === 'returned' ? 'bg-red-100 text-red-700' :
                      'bg-neutral-100 text-neutral-500'
                    }`}>
                      {profile.status === 'pending_review' ? 'Pending' :
                       profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {profile.last_updated_at
                        ? new Date(profile.last_updated_at).toLocaleDateString()
                        : new Date(profile.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => { setSelected(profile); setReturnNotes(profile.return_notes ?? ''); }}
                      className="btn-outline text-xs px-3 py-1.5"
                    >
                      Review
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">Profile Review</h2>
              <button onClick={() => { setSelected(null); setReturnNotes(''); }} className="text-neutral-400 hover:text-neutral-600 text-xl">✕</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Profile summary */}
              <div className="bg-neutral-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="font-semibold text-neutral-900 text-base">
                  {[selected.salutation, selected.first_name, selected.middle_name, selected.surname].filter(Boolean).join(' ')}
                </div>
                {selected.academic_rank && <div className="text-neutral-600">{selected.academic_rank} · {selected.department}</div>}
                {selected.patrons && <div className="text-neutral-500">{selected.patrons.email} · {selected.patrons.patron_category}</div>}
                {selected.orcid_id && (
                  <div className="text-xs">
                    ORCID: <a href={`https://orcid.org/${selected.orcid_id}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">{selected.orcid_id}</a>
                    {selected.orcid_verified && <span className="ml-1 text-green-600">✓ Verified</span>}
                  </div>
                )}
                {selected.specialisations.length > 0 && (
                  <div className="text-xs text-neutral-500">Specialisations: {selected.specialisations.join(', ')}</div>
                )}
              </div>

              {/* Biography preview */}
              {selected.biography && (
                <div>
                  <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Biography</div>
                  <p className="text-sm text-neutral-700 leading-relaxed line-clamp-6">{selected.biography}</p>
                </div>
              )}

              {/* View full profile link */}
              {selected.status === 'published' && selected.slug && (
                <a href={`/lecturers/${selected.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline">
                  View published profile →
                </a>
              )}

              <div className="border-t border-neutral-100 pt-5 space-y-4">
                <div>
                  <label className="label">Return Notes (required to return profile)</label>
                  <textarea
                    rows={4}
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    className="input resize-y"
                    placeholder="Describe what the lecturer needs to correct before resubmission…"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => returnProfile(selected)}
                    disabled={!returnNotes.trim() || actionLoading}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Sending…' : 'Return for Revision'}
                  </button>
                  <button
                    onClick={() => approve(selected)}
                    disabled={actionLoading}
                    className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Publishing…' : 'Approve & Publish'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
