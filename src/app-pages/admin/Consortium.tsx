import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Member {
  id: string;
  institution_name: string;
  short_code: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  country: string | null;
  status: string;
  is_founding_member: boolean;
  notes: string | null;
  created_at: string;
  contact_librarian_name?: string | null;
  contact_librarian_phone?: string | null;
  contact_librarian_email?: string | null;
}

interface ConsortiumDb {
  id: string;
  member_id: string | null;
  name: string;
  provider: string | null;
  description: string | null;
  access_url: string | null;
  subjects: string[] | null;
  access_type: string | null;
  is_active: boolean;
  username?: string | null;
  password?: string | null;
}

const EMPTY_MEMBER = {
  institution_name: '', short_code: '', contact_person: '', email: '',
  phone: '', website: '', city: '', country: 'Nigeria', notes: '',
  contact_librarian_name: '', contact_librarian_phone: '', contact_librarian_email: '',
};

const EMPTY_DB = { name: '', provider: '', description: '', access_url: '', username: '', password: '', subjects: '' };

export default function AdminConsortium() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const isSuperAdmin = hasRole('super_admin');

  const [members, setMembers] = useState<Member[]>([]);
  const [databases, setDatabases] = useState<ConsortiumDb[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showMemberForm, setShowMemberForm] = useState(false);
  const [memberForm, setMemberForm] = useState({ ...EMPTY_MEMBER });
  const [savingMember, setSavingMember] = useState(false);

  const [dbFormFor, setDbFormFor] = useState<string | null>(null);
  const [dbForm, setDbForm] = useState({ ...EMPTY_DB });
  const [savingDb, setSavingDb] = useState(false);

  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const [{ data: m }, { data: d }, { data: l }] = await Promise.all([
      supabase.from('consortium_members').select('*').order('is_founding_member', { ascending: false }).order('institution_name'),
      supabase.from('consortium_databases').select('*').order('name'),
      supabase.from('consortium_access_logs').select('*').order('accessed_at', { ascending: false }).limit(30),
    ]);
    setMembers((m as Member[]) ?? []);
    setDatabases((d as ConsortiumDb[]) ?? []);
    setLogs(l ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 3500); };

  const saveMember = async () => {
    if (!memberForm.institution_name.trim()) return;
    setSavingMember(true);
    const { error } = await supabase.from('consortium_members').insert({
      institution_name: memberForm.institution_name.trim(),
      short_code: memberForm.short_code.trim() || null,
      contact_person: memberForm.contact_person.trim() || null,
      email: memberForm.email.trim() || null,
      phone: memberForm.phone.trim() || null,
      website: memberForm.website.trim() || null,
      city: memberForm.city.trim() || null,
      country: memberForm.country.trim() || null,
      notes: memberForm.notes.trim() || null,
      contact_librarian_name: memberForm.contact_librarian_name.trim() || null,
      contact_librarian_phone: memberForm.contact_librarian_phone.trim() || null,
      contact_librarian_email: memberForm.contact_librarian_email.trim() || null,
      onboarded_by: user?.id ?? null,
    });
    setSavingMember(false);
    if (error) { flash(`Error: ${error.message}`); return; }
    setMemberForm({ ...EMPTY_MEMBER });
    setShowMemberForm(false);
    flash('Partner institution onboarded.');
    load();
  };

  const toggleMemberStatus = async (m: Member) => {
    const next = m.status === 'active' ? 'suspended' : 'active';
    await supabase.from('consortium_members').update({ status: next }).eq('id', m.id);
    load();
  };

  const removeMember = async (m: Member) => {
    if (m.is_founding_member) { flash('The founding member cannot be removed.'); return; }
    if (!window.confirm(`Remove ${m.institution_name} and its contributed databases?`)) return;
    await supabase.from('consortium_members').delete().eq('id', m.id);
    load();
  };

  const saveDb = async (memberId: string) => {
    if (!dbForm.name.trim()) return;
    setSavingDb(true);
    const { error } = await supabase.from('consortium_databases').insert({
      member_id: memberId,
      name: dbForm.name.trim(),
      provider: dbForm.provider.trim() || null,
      description: dbForm.description.trim() || null,
      access_url: dbForm.access_url.trim() || null,
      username: dbForm.username.trim() || null,
      password: dbForm.password.trim() || null,
      subjects: dbForm.subjects ? dbForm.subjects.split(',').map(s => s.trim()).filter(Boolean) : null,
    });
    setSavingDb(false);
    if (error) { flash(`Error: ${error.message}`); return; }
    setDbForm({ ...EMPTY_DB });
    setDbFormFor(null);
    flash('Contributed database added.');
    load();
  };

  const removeDb = async (id: string) => {
    if (!window.confirm('Remove this contributed database?')) return;
    await supabase.from('consortium_databases').delete().eq('id', id);
    load();
  };

  if (authLoading) return <div className="p-8 text-neutral-500">Loading…</div>;

  if (!isSuperAdmin) {
    return (
      <div className="p-8 max-w-xl">
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="text-xl font-bold text-neutral-900 mb-2">Super Admin Only</h1>
          <p className="text-neutral-500 text-sm">
            Consortium onboarding is restricted to Super Administrators (TBS &amp; University Librarian).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Library Consortium</h1>
        <p className="text-neutral-500 text-sm mt-1">
          Onboard partner institutions and manage the databases they share with the consortium.
        </p>
      </div>

      {msg && (
        <div className="mb-4 rounded-lg bg-primary-50 border border-primary-200 text-primary-800 text-sm px-4 py-2.5">{msg}</div>
      )}

      {/* Members */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-neutral-800">Partner Institutions ({members.length})</h2>
        <button onClick={() => setShowMemberForm(v => !v)} className="btn-primary px-4 py-1.5 text-sm">
          {showMemberForm ? 'Cancel' : '+ Onboard Partner'}
        </button>
      </div>

      {showMemberForm && (
        <div className="card p-5 mb-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Institution name *" value={memberForm.institution_name} onChange={v => setMemberForm(p => ({ ...p, institution_name: v }))} />
          <Field label="Short code" value={memberForm.short_code} onChange={v => setMemberForm(p => ({ ...p, short_code: v }))} placeholder="e.g. UNILAG" />
          <Field label="Contact person" value={memberForm.contact_person} onChange={v => setMemberForm(p => ({ ...p, contact_person: v }))} />
          <Field label="Email" value={memberForm.email} onChange={v => setMemberForm(p => ({ ...p, email: v }))} type="email" />
          <Field label="Phone" value={memberForm.phone} onChange={v => setMemberForm(p => ({ ...p, phone: v }))} />
          <Field label="Website" value={memberForm.website} onChange={v => setMemberForm(p => ({ ...p, website: v }))} placeholder="https://" />
          <Field label="Contact librarian name" value={memberForm.contact_librarian_name} onChange={v => setMemberForm(p => ({ ...p, contact_librarian_name: v }))} />
          <Field label="Contact librarian phone" value={memberForm.contact_librarian_phone} onChange={v => setMemberForm(p => ({ ...p, contact_librarian_phone: v }))} />
          <Field label="Contact librarian email" value={memberForm.contact_librarian_email} onChange={v => setMemberForm(p => ({ ...p, contact_librarian_email: v }))} type="email" />
          <Field label="City" value={memberForm.city} onChange={v => setMemberForm(p => ({ ...p, city: v }))} />
          <Field label="Country" value={memberForm.country} onChange={v => setMemberForm(p => ({ ...p, country: v }))} />
          <div className="md:col-span-2">
            <Field label="Notes" value={memberForm.notes} onChange={v => setMemberForm(p => ({ ...p, notes: v }))} />
          </div>
          <div className="md:col-span-2">
            <button onClick={saveMember} disabled={savingMember || !memberForm.institution_name.trim()} className="btn-primary px-5 py-2 text-sm disabled:opacity-40">
              {savingMember ? 'Saving…' : 'Onboard Institution'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-neutral-400 text-sm">Loading consortium…</div>
      ) : (
        <div className="space-y-4">
          {members.map(m => {
            const memberDbs = databases.filter(d => d.member_id === m.id);
            return (
              <div key={m.id} className="card p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-neutral-900">{m.institution_name}</h3>
                      {m.short_code && <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{m.short_code}</span>}
                      {m.is_founding_member && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">Founding member</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.status}</span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      {[m.contact_person, m.email, m.city, m.country].filter(Boolean).join(' · ')}
                    </p>
                    {(m.contact_librarian_name || m.contact_librarian_email || m.contact_librarian_phone) && <p className="text-xs text-neutral-500 mt-1">Contact librarian: {[m.contact_librarian_name, m.contact_librarian_phone, m.contact_librarian_email].filter(Boolean).join(' · ')}</p>}
                    {m.website && <a href={m.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-700 hover:underline">{m.website}</a>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleMemberStatus(m)} className="text-xs font-medium text-neutral-500 hover:text-neutral-800">
                      {m.status === 'active' ? 'Suspend' : 'Reactivate'}
                    </button>
                    {!m.is_founding_member && (
                      <button onClick={() => removeMember(m)} className="text-xs font-medium text-red-500 hover:underline">Remove</button>
                    )}
                  </div>
                </div>

                {/* Contributed databases */}
                <div className="mt-4 border-t border-neutral-100 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">Contributed Databases ({memberDbs.length})</p>
                    <button onClick={() => { setDbFormFor(dbFormFor === m.id ? null : m.id); setDbForm({ ...EMPTY_DB }); }} className="text-xs font-medium text-primary-700 hover:underline">
                      {dbFormFor === m.id ? 'Cancel' : '+ Add database'}
                    </button>
                  </div>

                  {dbFormFor === m.id && (
                    <div className="bg-neutral-50 rounded-lg p-3 mb-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Field label="Database name *" value={dbForm.name} onChange={v => setDbForm(p => ({ ...p, name: v }))} small />
                      <Field label="Provider" value={dbForm.provider} onChange={v => setDbForm(p => ({ ...p, provider: v }))} small />
                      <Field label="Access URL" value={dbForm.access_url} onChange={v => setDbForm(p => ({ ...p, access_url: v }))} placeholder="https://" small />
                      <Field label="Username" value={dbForm.username} onChange={v => setDbForm(p => ({ ...p, username: v }))} small />
                      <Field label="Password" value={dbForm.password} onChange={v => setDbForm(p => ({ ...p, password: v }))} type="password" small />
                      <Field label="Subjects (comma-separated)" value={dbForm.subjects} onChange={v => setDbForm(p => ({ ...p, subjects: v }))} small />
                      <div className="md:col-span-2">
                        <Field label="Description" value={dbForm.description} onChange={v => setDbForm(p => ({ ...p, description: v }))} small />
                      </div>
                      <div className="md:col-span-2">
                        <button onClick={() => saveDb(m.id)} disabled={savingDb || !dbForm.name.trim()} className="btn-primary px-4 py-1.5 text-xs disabled:opacity-40">
                          {savingDb ? 'Saving…' : 'Add Database'}
                        </button>
                      </div>
                    </div>
                  )}

                  {memberDbs.length === 0 ? (
                    <p className="text-xs text-neutral-400">No databases contributed yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {memberDbs.map(d => (
                        <div key={d.id} className="flex items-center justify-between gap-3 text-sm bg-neutral-50 rounded-lg px-3 py-2">
                          <div className="min-w-0">
                            <span className="font-medium text-neutral-800">{d.name}</span>
                            {d.provider && <span className="text-neutral-400"> · {d.provider}</span>}
                            {d.subjects && d.subjects.length > 0 && (
                              <span className="text-xs text-neutral-400 block truncate">{d.subjects.join(', ')}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {d.access_url && <a href={d.access_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-700 hover:underline">Open</a>}
                            <button onClick={() => removeDb(d.id)} className="text-xs text-red-500 hover:underline">Remove</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Access logs */}
      <div className="mt-8">
        <h2 className="font-semibold text-neutral-800 mb-3">Recent Consortium Access ({logs.length})</h2>
        {logs.length === 0 ? (
          <div className="card p-6 text-sm text-neutral-400">No consortium database access recorded yet.</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">User</th>
                  <th className="text-left px-4 py-2 font-medium">Database</th>
                  <th className="text-left px-4 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => {
                  const db = databases.find(d => d.id === l.database_id);
                  return (
                    <tr key={l.id} className="border-t border-neutral-50">
                      <td className="px-4 py-2 text-neutral-700">{l.user_name ?? '—'}</td>
                      <td className="px-4 py-2 text-neutral-700">{db?.name ?? '—'}</td>
                      <td className="px-4 py-2 text-neutral-400">{new Date(l.accessed_at).toLocaleString('en-GB')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, small }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; small?: boolean;
}) {
  return (
    <label className="block">
      <span className={`block font-medium text-neutral-600 mb-1 ${small ? 'text-xs' : 'text-sm'}`}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
      />
    </label>
  );
}
