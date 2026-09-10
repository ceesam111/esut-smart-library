import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface Member {
  id: string;
  name: string;
  title: string;
  qual: string;
  bio: string;
  email: string;
  initials: string;
  photo_url: string | null;
  sort_order: number;
  is_published: boolean;
}

const BLANK: Omit<Member, 'id'> = {
  name: '', title: '', qual: '', bio: '', email: '', initials: '',
  photo_url: null, sort_order: 0, is_published: true,
};

function initialsFrom(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
}

/** Downscale an image file to a square-ish JPEG data URL (max 512px). */
function fileToResizedDataUrl(file: File, max = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > max) { height = Math.round((height * max) / width); width = max; }
        else if (height > max) { width = Math.round((width * max) / height); height = max; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdminTeam() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Member, 'id'>>({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .order('sort_order', { ascending: true });
    setMembers((data as Member[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startNew = () => {
    setEditingId(null);
    setForm({ ...BLANK, sort_order: (members[members.length - 1]?.sort_order ?? 0) + 1 });
    setError('');
    setView('editor');
  };

  const startEdit = (m: Member) => {
    setEditingId(m.id);
    const { id, ...rest } = m;
    setForm(rest);
    setError('');
    setView('editor');
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setError('Image must be under 8MB.'); return; }
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setForm(f => ({ ...f, photo_url: dataUrl }));
      setError('');
    } catch {
      setError('Could not process that image.');
    }
  };

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      initials: form.initials.trim() || initialsFrom(form.name),
    };
    const res = editingId
      ? await supabase.from('team_members').update(payload).eq('id', editingId)
      : await supabase.from('team_members').insert(payload);
    setSaving(false);
    if (res.error) { setError(res.error.message); return; }
    await load();
    setView('list');
  };

  const remove = async (m: Member) => {
    if (!confirm(`Remove ${m.name} from the team?`)) return;
    const { error } = await supabase.from('team_members').delete().eq('id', m.id);
    if (error) { alert(error.message); return; }
    await load();
  };

  const move = async (m: Member, dir: -1 | 1) => {
    const idx = members.findIndex(x => x.id === m.id);
    const swap = members[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from('team_members').update({ sort_order: swap.sort_order }).eq('id', m.id),
      supabase.from('team_members').update({ sort_order: m.sort_order }).eq('id', swap.id),
    ]);
    await load();
  };

  if (view === 'editor') {
    return (
      <div className="max-w-2xl">
        <button onClick={() => setView('list')} className="text-sm text-primary-700 hover:underline mb-4">← Back to team</button>
        <h1 className="text-2xl font-bold text-neutral-900 mb-6">{editingId ? 'Edit' : 'Add'} Team Member</h1>

        <div className="card p-6 space-y-4">
          {/* Photo */}
          <div className="flex items-center gap-4">
            {form.photo_url ? (
              <img src={form.photo_url} alt="" className="w-20 h-20 rounded-full object-cover border" />
            ) : (
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-lg font-bold" style={{ background: '#6B1D2A' }}>
                {form.initials || initialsFrom(form.name) || '?'}
              </div>
            )}
            <div className="space-y-1">
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-secondary text-sm">
                {form.photo_url ? 'Replace Photo' : 'Upload Photo'}
              </button>
              {form.photo_url && (
                <button type="button" onClick={() => setForm(f => ({ ...f, photo_url: null }))} className="block text-xs text-red-600 hover:underline">
                  Remove photo
                </button>
              )}
              <p className="text-xs text-neutral-400">JPG/PNG, auto-resized. Falls back to initials if empty.</p>
            </div>
          </div>

          <div>
            <label className="label text-xs">Full Name *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Dr. Jane Doe" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label text-xs">Title / Role</label>
              <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="University Librarian" />
            </div>
            <div>
              <label className="label text-xs">Initials (optional)</label>
              <input className="input" value={form.initials} onChange={e => setForm(f => ({ ...f, initials: e.target.value }))} placeholder="JD" />
            </div>
          </div>
          <div>
            <label className="label text-xs">Qualifications</label>
            <input className="input" value={form.qual} onChange={e => setForm(f => ({ ...f, qual: e.target.value }))} placeholder="PhD Library & Information Science" />
          </div>
          <div>
            <label className="label text-xs">Bio</label>
            <textarea className="input w-full resize-y" rows={4} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
          </div>
          <div>
            <label className="label text-xs">Email</label>
            <input className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@esut.edu.ng" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_published} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} />
            Show on public Team page
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={save} disabled={saving} className="btn btn-primary">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setView('list')} className="btn btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Team Members</h1>
          <p className="text-sm text-neutral-500">Manage the officials shown on the public Team page, including their photographs.</p>
        </div>
        <button onClick={startNew} className="btn btn-primary">+ Add Member</button>
      </div>

      {loading ? (
        <p className="text-neutral-400 text-sm">Loading…</p>
      ) : members.length === 0 ? (
        <div className="card p-8 text-center text-neutral-400 text-sm">No team members yet. Click “Add Member” to create one.</div>
      ) : (
        <div className="space-y-3">
          {members.map((m, i) => (
            <div key={m.id} className="card p-4 flex items-center gap-4">
              {m.photo_url ? (
                <img src={m.photo_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: '#6B1D2A' }}>
                  {m.initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-neutral-900 text-sm truncate">{m.name}</p>
                <p className="text-xs text-neutral-500 truncate">{m.title}</p>
              </div>
              {!m.is_published && <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">Hidden</span>}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => move(m, -1)} disabled={i === 0} className="px-2 py-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30" title="Move up">↑</button>
                <button onClick={() => move(m, 1)} disabled={i === members.length - 1} className="px-2 py-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30" title="Move down">↓</button>
                <button onClick={() => startEdit(m)} className="text-sm text-primary-700 hover:underline px-2">Edit</button>
                <button onClick={() => remove(m)} className="text-sm text-red-600 hover:underline px-2">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
