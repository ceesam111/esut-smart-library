import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Link } from 'react-router-dom';
import ShareButtons from '@/components/ShareButtons';
import { useI18n, type TranslationKey } from '@/lib/i18n';

interface Event {
  id: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  image_url: string | null;
  start_at: string;
  end_at: string | null;
  venue: string;
  location: string | null;
  category: string;
  department: string | null;
  registration_required: boolean;
  max_attendees: number;
  registrations_count: number;
  is_virtual: boolean;
  virtual_url: string | null;
  status: string;
}

type ViewMode = 'month' | 'list';

const DAY_KEYS: TranslationKey[] = ['events.sun', 'events.mon', 'events.tue', 'events.wed', 'events.thu', 'events.fri', 'events.sat'];
const MONTH_KEYS: TranslationKey[] = [
  'events.months.january', 'events.months.february', 'events.months.march', 'events.months.april',
  'events.months.may', 'events.months.june', 'events.months.july', 'events.months.august',
  'events.months.september', 'events.months.october', 'events.months.november', 'events.months.december',
];

function buildCalendarGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const STATUS_COLOR: Record<string, string> = {
  upcoming: 'bg-primary-100 text-primary-700 border-primary-200',
  ongoing: 'bg-green-100 text-green-700 border-green-200',
  completed: 'bg-neutral-100 text-neutral-500 border-neutral-200',
  cancelled: 'bg-red-100 text-red-600 border-red-200',
};

const STATUS_KEYS: Record<string, TranslationKey> = {
  upcoming: 'events.statusUpcoming',
  ongoing: 'events.statusOngoing',
  completed: 'events.statusCompleted',
  cancelled: 'events.statusCancelled',
};

const HERO_IMAGE = '/nigerian-library-people.svg';

export default function Events() {
  const { t, formatDate, formatDateTime } = useI18n();
  usePageTitle(t('events.title'));
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<Event | null>(null);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [registering, setRegistering] = useState(false);
  const [regDone, setRegDone] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('events')
        .select('id, title, description, cover_image_url, image_url, start_at, end_at, venue, location, category, department, registration_required, max_attendees, registrations_count, is_virtual, virtual_url, status')
        .order('start_at', { ascending: true });
      const evts = (data ?? []) as Event[];
      setEvents(evts);
      const cats = [...new Set(evts.map(e => e.category).filter(Boolean))].sort();
      setCategories(cats);
      setLoading(false);
    };
    void load();
  }, []);

  const filtered = events.filter(e => !category || e.category === category);
  const coverOf = (e: Event) => e.cover_image_url || e.image_url;

  function eventsOnDay(day: number) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.start_at && e.start_at.slice(0, 10) === dateStr);
  }

  async function register() {
    if (!selected || !regName.trim() || !regEmail.trim()) return;
    setRegistering(true);
    await supabase.from('event_registrations').insert({
      event_id: selected.id,
      patron_name: regName.trim(),
      patron_email: regEmail.trim(),
    });
    await supabase.from('events').update({ registrations_count: (selected.registrations_count ?? 0) + 1 }).eq('id', selected.id);
    setRegistering(false);
    setRegDone(true);
  }

  function openEvent(ev: Event) {
    setSelected(ev);
    setRegName('');
    setRegEmail('');
    setRegDone(false);
  }

  const gridCells = buildCalendarGrid(calYear, calMonth);

  const upcomingCount = events.filter(e => e.status === 'upcoming').length;

  return (
    <div>
      {/* Hero banner */}
      <div className="relative overflow-hidden" style={{ minHeight: 300 }}>
        <img src={HERO_IMAGE} alt={t('nav.events')} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
        <div className="relative section py-14">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-white/60 text-sm mb-4 font-medium">
              <Link to="/" className="hover:text-white transition-colors">{t('nav.home')}</Link>
              <span>›</span>
              <span>{t('nav.events')}</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">{t('events.title')}</h1>
            <p className="text-white/80 text-lg">{t('events.subtitle')}</p>
            {upcomingCount > 0 && (
              <div className="mt-4 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-full">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                {t('events.upcomingCount', { count: upcomingCount })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="section py-10">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          {/* Category filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategory('')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !category ? 'bg-primary-700 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {t('events.all')}
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  category === cat ? 'bg-primary-700 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg">
            {(['list', 'month'] as ViewMode[]).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                  viewMode === m ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {m === 'month' ? t('events.calendar') : t('events.list')}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => <div key={i} className="h-56 bg-neutral-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : viewMode === 'list' ? (
          filtered.length === 0 ? (
            <div className="text-center py-24 bg-white border border-neutral-100 rounded-2xl">
              <div className="text-5xl mb-4">📅</div>
              <p className="text-neutral-500 font-medium">{t('events.noEventsFound')}</p>
              <p className="text-neutral-400 text-sm mt-1">{t('events.checkBackSoon')}</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => openEvent(ev)}
                  className="text-left bg-white rounded-2xl border border-neutral-200 overflow-hidden hover:shadow-lg transition-shadow group"
                >
                  <div className="h-44 overflow-hidden bg-neutral-100">
                    {coverOf(ev) ? (
                      <img src={coverOf(ev)!} alt={ev.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary-700 to-primary-900 flex flex-col items-center justify-center gap-2">
                        <span className="text-4xl text-white/30">📅</span>
                        <span className="text-xs text-white/50 font-medium">{ev.category || t('events.event')}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {ev.status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[ev.status] ?? 'bg-neutral-100 text-neutral-500 border-neutral-200'}`}>
                          {STATUS_KEYS[ev.status]
                            ? t(STATUS_KEYS[ev.status])
                            : ev.status.charAt(0).toUpperCase() + ev.status.slice(1)}
                        </span>
                      )}
                      {ev.category && (
                        <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{ev.category}</span>
                      )}
                      {ev.is_virtual && (
                        <span className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">{t('events.virtual')}</span>
                      )}
                    </div>
                    <h2 className="font-semibold text-neutral-900 group-hover:text-primary-700 transition-colors line-clamp-2">{ev.title}</h2>
                    <p className="text-xs text-neutral-500 mt-1.5">
                      {ev.start_at ? formatDateTime(ev.start_at) : '—'}
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5">{ev.venue || ev.location || t('events.tbc')}</p>
                    {ev.registration_required && (
                      <div className="mt-3">
                        <span className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-full font-medium">
                          {t('events.registrationOpen', { extra: ev.max_attendees > 0 ? ` · ${ev.registrations_count ?? 0}/${ev.max_attendees}` : '' })}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )
        ) : (
          /* Month Calendar view */
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <button
                onClick={() => {
                  if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                  else setCalMonth(m => m - 1);
                }}
                className="text-neutral-500 hover:text-neutral-800 px-3 py-1 rounded transition-colors text-lg"
              >
                ‹
              </button>
              <h2 className="font-bold text-neutral-900">{t(MONTH_KEYS[calMonth])} {calYear}</h2>
              <button
                onClick={() => {
                  if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                  else setCalMonth(m => m + 1);
                }}
                className="text-neutral-500 hover:text-neutral-800 px-3 py-1 rounded transition-colors text-lg"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 bg-neutral-50 border-b border-neutral-100">
              {DAY_KEYS.map(dk => (
                <div key={dk} className="text-center text-xs font-semibold text-neutral-400 py-2">{t(dk)}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {gridCells.map((cell, i) => {
                const dayEvents = cell ? eventsOnDay(cell) : [];
                const isToday = cell
                  ? new Date().toISOString().slice(0, 10) === `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(cell).padStart(2, '0')}`
                  : false;
                return (
                  <div
                    key={i}
                    className={`min-h-[80px] p-1 border-b border-r border-neutral-100 ${!cell ? 'bg-neutral-50/50' : 'hover:bg-neutral-50 transition-colors'}`}
                  >
                    {cell && (
                      <>
                        <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                          isToday ? 'bg-primary-700 text-white' : 'text-neutral-600'
                        }`}>
                          {cell}
                        </span>
                        {dayEvents.slice(0, 2).map(ev => (
                          <button
                            key={ev.id}
                            onClick={() => openEvent(ev)}
                            className="w-full text-left text-xs bg-primary-50 text-primary-700 rounded px-1 py-0.5 mb-0.5 truncate hover:bg-primary-100 transition-colors"
                          >
                            {ev.title}
                          </button>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-xs text-neutral-400">{t('events.moreEvents', { count: dayEvents.length - 2 })}</span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Event detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {coverOf(selected) && (
              <img src={coverOf(selected)!} alt={selected.title} className="w-full h-48 object-cover rounded-t-2xl" />
            )}
            <div className="p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold text-neutral-900">{selected.title}</h2>
                <button onClick={() => setSelected(null)} className="text-neutral-400 hover:text-neutral-600 text-2xl shrink-0 leading-none">×</button>
              </div>

              <div className="space-y-2 mb-4 text-sm text-neutral-600">
                <p>
                  <span className="font-medium text-neutral-800">{t('events.date')}</span>
                  {selected.start_at
                    ? formatDateTime(selected.start_at, 'long')
                    : '—'}
                </p>
                {(selected.venue || selected.location) && (
                  <p><span className="font-medium text-neutral-800">{t('events.venue')}</span>{selected.venue || selected.location}</p>
                )}
                {selected.department && (
                  <p><span className="font-medium text-neutral-800">{t('events.for')}</span>{selected.department}</p>
                )}
                {selected.is_virtual && selected.virtual_url && (
                  <p>
                    <span className="font-medium text-neutral-800">{t('events.joinOnline')}</span>
                    <a href={selected.virtual_url} target="_blank" rel="noopener noreferrer" className="text-primary-700 hover:underline">
                      {t('events.clickHere')}
                    </a>
                  </p>
                )}
              </div>

              {selected.description && (
                <p className="text-sm text-neutral-700 mb-4 leading-relaxed">{selected.description}</p>
              )}

              <div className="mb-5">
                <ShareButtons
                  title={selected.title}
                  text={`${selected.title} — ${selected.start_at ? formatDate(selected.start_at, 'long') : ''}`}
                />
              </div>

              {selected.registration_required && selected.status !== 'cancelled' && selected.status !== 'completed' && (
                <div className="border-t border-neutral-100 pt-5">
                  <h3 className="font-semibold text-neutral-900 mb-3 text-sm">{t('events.registerForEvent')}</h3>
                  {selected.max_attendees > 0 && (selected.registrations_count ?? 0) >= selected.max_attendees ? (
                    <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">{t('events.fullyBooked')}</p>
                  ) : regDone ? (
                    <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{t('events.registeredConfirmation')}</p>
                  ) : (
                    <div className="space-y-3">
                      <input
                        value={regName}
                        onChange={e => setRegName(e.target.value)}
                        placeholder={t('events.fullName')}
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={e => setRegEmail(e.target.value)}
                        placeholder={t('events.emailAddress')}
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button
                        onClick={register}
                        disabled={registering || !regName.trim() || !regEmail.trim()}
                        className="w-full bg-primary-700 hover:bg-primary-800 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                      >
                        {registering ? t('events.registering') : t('events.registerNow')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
