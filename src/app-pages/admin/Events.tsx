import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { loadLocalArray, makeId, saveLocalArray } from '@/lib/localStore';

const LOCAL_EVENTS_KEY = 'admin_events_fallback';

interface Event {
  id: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  image_url: string | null;
  start_at: string;
  end_at: string;
  venue: string;
  location: string | null;
  category: string;
  department: string;
  registration_required: boolean;
  max_attendees: number;
  registrations_count: number;
  is_virtual: boolean;
  virtual_url: string | null;
  status: string;
}

interface Registration {
  id: string;
  patron_name: string;
  patron_email: string;
  registered_at: string;
  attended: boolean;
}

const CATEGORIES = ['Seminar', 'Workshop', 'Conference', 'Training', 'Lecture', 'Exhibition', 'Book Club', 'Orientation', 'Other'];

const BLANK: Omit<Event, 'id' | 'registrations_count'> = {
  title: '',
  description: '',
  cover_image_url: null,
  image_url: null,
  start_at: '',
  end_at: '',
  venue: '',
  location: null,
  category: 'Seminar',
  department: '',
  registration_required: true,
  max_attendees: 0,
  is_virtual: false,
  virtual_url: null,
  status: 'upcoming',
};

export default function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form' | 'registrations'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof BLANK>({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [message, setMessage] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, description, cover_image_url, image_url, start_at, end_at, venue, location, category, department, registration_required, max_attendees, registrations_count, is_virtual, virtual_url, status')
        .order('start_at', { ascending: false });
      if (error) throw error;
      const merged = [...(data ?? []), ...loadLocalArray<Event>(LOCAL_EVENTS_KEY).filter((local) => !(data ?? []).some((remote) => remote.id === local.id))];
      setEvents(merged);
    } catch {
      setEvents(loadLocalArray<Event>(LOCAL_EVENTS_KEY));
    }
    setLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setForm({ ...BLANK });
    setView('form');
  }

  function openEdit(ev: Event) {
    setEditingId(ev.id);
    setForm({
      title: ev.title,
      description: ev.description,
      cover_image_url: ev.cover_image_url,
      image_url: ev.image_url,
      start_at: ev.start_at ? ev.start_at.slice(0, 16) : '',
      end_at: ev.end_at ? ev.end_at.slice(0, 16) : '',
      venue: ev.venue,
      location: ev.location,
      category: ev.category,
      department: ev.department,
      registration_required: ev.registration_required,
      max_attendees: ev.max_attendees,
      is_virtual: ev.is_virtual,
      virtual_url: ev.virtual_url,
      status: ev.status,
    });
    setView('form');
  }

  async function openRegistrations(ev: Event) {
    setSelectedEvent(ev);
    const { data } = await supabase
      .from('event_registrations')
      .select('id, patron_name, patron_email, registered_at, attended')
      .eq('event_id', ev.id)
      .order('registered_at');
    setRegistrations(data ?? []);
    setView('registrations');
  }

  async function save() {
    if (!form.title.trim() || !form.start_at) { setMessage('Title and start date are required.'); return; }
    setSaving(true);
    const eventRecord: Event = { id: editingId ?? makeId('event'), registrations_count: 0, ...form };
    const localEvents = loadLocalArray<Event>(LOCAL_EVENTS_KEY);
    const nextLocal = editingId ? localEvents.map((event) => event.id === editingId ? eventRecord : event) : [eventRecord, ...localEvents];
    saveLocalArray(LOCAL_EVENTS_KEY, nextLocal);
    setEvents((current) => editingId ? current.map((event) => event.id === editingId ? eventRecord : event) : [eventRecord, ...current]);
    const { error } = editingId ? await supabase.from('events').update(form).eq('id', editingId) : await supabase.from('events').insert(form);
    setMessage(error ? `Saved locally. Backend sync failed: ${error.message}` : 'Event saved.');
    setSaving(false);
    setView('list');
    if (!error) load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this event?')) return;
    const next = events.filter((event) => event.id !== id);
    setEvents(next);
    saveLocalArray(LOCAL_EVENTS_KEY, loadLocalArray<Event>(LOCAL_EVENTS_KEY).filter((event) => event.id !== id));
    await supabase.from('events').delete().eq('id', id);
    load();
  }

  async function toggleAttended(regId: string, current: boolean) {
    await supabase.from('event_registrations').update({ attended: !current }).eq('id', regId);
    setRegistrations(r => r.map(x => x.id === regId ? { ...x, attended: !current } : x));
  }

  const now = new Date().toISOString();
  const filtered = events.filter(e => {
    if (filter === 'upcoming') return e.start_at >= now;
    if (filter === 'past') return e.start_at < now;
    return true;
  });

  const statusColor = (s: string) => ({
    upcoming: 'bg-primary-100 text-primary-700',
    ongoing: 'bg-green-100 text-green-700',
    completed: 'bg-neutral-100 text-neutral-600',
    cancelled: 'bg-red-100 text-red-700',
  }[s] ?? 'bg-neutral-100 text-neutral-600');

  const coverOf = (e: Event) => e.cover_image_url || e.image_url;

  if (view === 'registrations' && selectedEvent) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('list')} className="text-sm text-neutral-500 hover:text-neutral-700">← Back</button>
          <h1 className="text-xl font-bold text-neutral-900">Registrations — {selectedEvent.title}</h1>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {registrations.length === 0 ? (
            <p className="text-center text-neutral-400 text-sm py-12">No registrations yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Registered</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Attended</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {registrations.map(r => (
                  <tr key={r.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-900">{r.patron_name || '—'}</td>
                    <td className="px-4 py-3 text-neutral-500">{r.patron_email || '—'}</td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">
                      {new Date(r.registered_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleAttended(r.id, r.attended)}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.attended ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}
                      >
                        {r.attended ? 'Yes' : 'No'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  if (view === 'form') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        {message && <div className="mb-4 rounded-lg border border-primary-200 bg-primary-50 text-primary-900 px-4 py-3 text-sm">{message}</div>}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('list')} className="text-sm text-neutral-500 hover:text-neutral-700">← Back</button>
          <h1 className="text-xl font-bold text-neutral-900">{editingId ? 'Edit Event' : 'New Event'}</h1>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Title *</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Event title"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {['upcoming', 'ongoing', 'completed', 'cancelled'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Start *</label>
              <input
                type="datetime-local"
                value={form.start_at}
                onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">End</label>
              <input
                type="datetime-local"
                value={form.end_at}
                onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Venue</label>
              <input
                value={form.venue}
                onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g. Main Library Hall"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Department</label>
              <input
                value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g. All / Sciences"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Cover Image URL</label>
            <input
              value={form.cover_image_url ?? ''}
              onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value || null }))}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="https://images.pexels.com/..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={5}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Event description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Max Attendees (0 = unlimited)</label>
              <input
                type="number"
                value={form.max_attendees}
                onChange={e => setForm(f => ({ ...f, max_attendees: parseInt(e.target.value) || 0 }))}
                min="0"
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.registration_required}
                  onChange={e => setForm(f => ({ ...f, registration_required: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-neutral-700">Registration required</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_virtual}
                  onChange={e => setForm(f => ({ ...f, is_virtual: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-neutral-700">Virtual event</span>
              </label>
            </div>
          </div>
          {form.is_virtual && (
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Virtual URL</label>
              <input
                value={form.virtual_url ?? ''}
                onChange={e => setForm(f => ({ ...f, virtual_url: e.target.value || null }))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="https://zoom.us/..."
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setView('list')}
              className="px-4 py-2 text-sm border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !form.title.trim() || !form.start_at}
              className="px-5 py-2 text-sm bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : editingId ? 'Update' : 'Create Event'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {message && <div className="mb-4 rounded-lg border border-primary-200 bg-primary-50 text-primary-900 px-4 py-3 text-sm">{message}</div>}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Events</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage library events and registrations.</p>
        </div>
        <button
          onClick={openNew}
          className="bg-primary-700 hover:bg-primary-800 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + New Event
        </button>
      </div>

      <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg mb-6 w-fit">
        {(['all', 'upcoming', 'past'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => <div key={i} className="h-64 bg-neutral-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center">
          <p className="text-neutral-400 text-sm">No events found.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(ev => (
            <div key={ev.id} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-40 bg-neutral-100 overflow-hidden">
                {coverOf(ev) ? (
                  <img src={coverOf(ev)!} alt={ev.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center text-3xl text-primary-200">📅</div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-neutral-900 text-sm line-clamp-2">{ev.title}</h3>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(ev.status)}`}>
                    {ev.status}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mb-1">
                  {ev.start_at ? new Date(ev.start_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </p>
                <p className="text-xs text-neutral-400 mb-3">{ev.venue || ev.location || '—'}</p>
                {ev.registration_required && (
                  <p className="text-xs text-neutral-500 mb-3">
                    Registrations: {ev.registrations_count ?? 0}{ev.max_attendees > 0 ? ` / ${ev.max_attendees}` : ''}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(ev)}
                    className="flex-1 text-xs border border-neutral-300 text-neutral-700 hover:bg-neutral-50 py-1.5 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  {ev.registration_required && (
                    <button
                      onClick={() => openRegistrations(ev)}
                      className="flex-1 text-xs border border-primary-300 text-primary-700 hover:bg-primary-50 py-1.5 rounded-lg transition-colors"
                    >
                      Attendees
                    </button>
                  )}
                  <button
                    onClick={() => remove(ev.id)}
                    className="text-xs border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
