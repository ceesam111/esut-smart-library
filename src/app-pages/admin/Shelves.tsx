import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_LIBRARIES = [
  { code: institutionConfig.mainLibrary.code,    name: institutionConfig.mainLibrary.name,    slug: institutionConfig.mainLibrary.slug },
  ...institutionConfig.branchLibraries.map(l  => ({ code: l.code, name: l.name, slug: l.slug })),
  ...institutionConfig.facultyLibraries.map(l => ({ code: l.code, name: l.name, slug: l.slug })),
];

const DEWEY_RANGES = [
  '000–099 — General Works', '100–199 — Philosophy & Psychology',
  '200–299 — Religion', '300–399 — Social Sciences',
  '400–499 — Language', '500–599 — Pure Sciences',
  '600–699 — Technology', '700–799 — Arts & Recreation',
  '800–899 — Literature', '900–999 — History & Geography',
];

function pad2(n: string) { return n.replace(/\D/g, '').padStart(2, '0'); }

function buildCode(libCode: string, floor: string, bay: string, shelf: string): string {
  if (!libCode || !floor.trim() || !bay.trim() || !shelf.trim()) return '';
  return `${libCode}/${floor.trim().toUpperCase()}/B${pad2(bay)}/SH${pad2(shelf)}`;
}

function OccupancyBar({ pct }: { pct: number }) {
  const color = pct < 50 ? '#16a34a' : pct < 80 ? '#d97706' : '#dc2626';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-neutral-100 rounded-full h-2 overflow-hidden w-20">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold w-10 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

interface Shelf {
  id: string;
  shelf_code: string;
  library_code: string;
  library_name: string;
  library_slug: string;
  floor_room: string;
  bay: string;
  shelf_number: string;
  description: string;
  subject_range: string;
  capacity: number;
  status: 'active' | 'inactive';
  created_at: string;
  items_held?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Shelves() {
  const [shelves, setShelves]         = useState<Shelf[]>([]);
  const [itemCounts, setItemCounts]   = useState<Record<string, number>>({});
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);

  // filters
  const [filterLib, setFilterLib]     = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [search, setSearch]           = useState('');

  // new shelf form
  const [newLib,   setNewLib]         = useState(institutionConfig.mainLibrary.code);
  const [newFloor, setNewFloor]       = useState('');
  const [newBay,   setNewBay]         = useState('');
  const [newShelf, setNewShelf]       = useState('');
  const [newDesc,  setNewDesc]        = useState('');
  const [newSubj,  setNewSubj]        = useState('');
  const [newCap,   setNewCap]         = useState(50);

  // inline edit
  const [editId,       setEditId]     = useState<string | null>(null);
  const [editDesc,     setEditDesc]   = useState('');
  const [editSubj,     setEditSubj]   = useState('');
  const [editCap,      setEditCap]    = useState(50);
  const [editStatus,   setEditStatus] = useState<'active'|'inactive'>('active');

  const newCode = buildCode(newLib, newFloor, newBay, newShelf);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [shelvesRes, itemsRes] = await Promise.all([
      supabase.from('library_shelves').select('*').order('library_code').order('shelf_code'),
      supabase.from('catalogue_items').select('shelf_code').not('shelf_code', 'is', null),
    ]);
    const rows = (shelvesRes.data ?? []) as Shelf[];
    setShelves(rows);
    const counts: Record<string, number> = {};
    (itemsRes.data ?? []).forEach((r: any) => {
      if (r.shelf_code) counts[r.shelf_code] = (counts[r.shelf_code] ?? 0) + 1;
    });
    setItemCounts(counts);
    setLoading(false);
  }

  const filtered = shelves.filter(s => {
    if (filterLib    && s.library_code !== filterLib) return false;
    if (filterStatus && s.status !== filterStatus)    return false;
    if (search) {
      const q = search.toLowerCase();
      return s.shelf_code.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  async function addShelf() {
    if (!newCode) return;
    setSaving(true);
    const lib = ALL_LIBRARIES.find(l => l.code === newLib)!;
    const { error } = await supabase.from('library_shelves').insert({
      shelf_code:   newCode,
      library_code: newLib,
      library_name: lib.name,
      library_slug: lib.slug,
      floor_room:   newFloor.trim().toUpperCase(),
      bay:          `B${pad2(newBay)}`,
      shelf_number: `SH${pad2(newShelf)}`,
      description:  newDesc.trim() || null,
      subject_range: newSubj || null,
      capacity:     newCap,
      status:       'active',
    });
    if (!error) {
      setNewFloor(''); setNewBay(''); setNewShelf('');
      setNewDesc(''); setNewSubj(''); setNewCap(50);
      await loadAll();
    }
    setSaving(false);
  }

  function startEdit(s: Shelf) {
    setEditId(s.id);
    setEditDesc(s.description ?? '');
    setEditSubj(s.subject_range ?? '');
    setEditCap(s.capacity);
    setEditStatus(s.status);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    await supabase.from('library_shelves').update({
      description:  editDesc.trim() || null,
      subject_range: editSubj || null,
      capacity:     editCap,
      status:       editStatus,
      updated_at:   new Date().toISOString(),
    }).eq('id', id);
    setEditId(null);
    setSaving(false);
    await loadAll();
  }

  async function deleteShelf(id: string, code: string) {
    if ((itemCounts[code] ?? 0) > 0) return;
    if (!confirm(`Delete shelf ${code}?`)) return;
    await supabase.from('library_shelves').delete().eq('id', id);
    await loadAll();
  }

  function exportCSV() {
    const header = ['shelf_code','library','floor','bay','shelf_number','description','subject','capacity','items_held','occupancy_pct','status'];
    const rows = filtered.map(s => {
      const held = itemCounts[s.shelf_code] ?? 0;
      const occ  = s.capacity > 0 ? Math.round((held / s.capacity) * 100) : 0;
      return [s.shelf_code, s.library_name, s.floor_room, s.bay, s.shelf_number,
        `"${(s.description??'').replace(/"/g,'""')}"`,
        `"${(s.subject_range??'').replace(/"/g,'""')}"`,
        s.capacity, held, occ, s.status].join(',');
    });
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `shelf-registry-${new Date().toISOString().slice(0,10)}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Shelf Registry</h1>
          <p className="text-gray-600 mt-1">Register and manage all physical shelf locations across {institutionConfig.libraryMode === 'multi' ? 'all ESUT library branches and faculty libraries' : 'the ESUT library and faculty libraries'}.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-outline text-sm">Export CSV</button>
          <Link to="/admin/catalogue" className="btn-outline text-sm">← Catalogue</Link>
        </div>
      </div>

      {/* ── Add Shelf Form ─────────────────────────────────────────────────── */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-neutral-800">Register New Shelf</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Library</label>
            <select className="input" value={newLib} onChange={e => setNewLib(e.target.value)}>
              {ALL_LIBRARIES.map(l => (
                <option key={l.code} value={l.code}>{l.code} — {l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Floor / Room</label>
            <input className="input font-mono" placeholder="e.g. GF, F1, F2" value={newFloor}
              onChange={e => setNewFloor(e.target.value)} maxLength={10} />
          </div>
          <div>
            <label className="label">Bay Number</label>
            <input className="input font-mono" placeholder="e.g. 1, 2" value={newBay}
              onChange={e => setNewBay(e.target.value.replace(/\D/g,''))} maxLength={2} />
          </div>
          <div>
            <label className="label">Shelf Number</label>
            <input className="input font-mono" placeholder="e.g. 1, 7" value={newShelf}
              onChange={e => setNewShelf(e.target.value.replace(/\D/g,''))} maxLength={2} />
          </div>
          <div>
            <label className="label">Capacity (items)</label>
            <input type="number" className="input" value={newCap} min={1} max={999}
              onChange={e => setNewCap(+e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <input className="input" placeholder="e.g. Sciences — Biology and Chemistry" value={newDesc}
              onChange={e => setNewDesc(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Subject / Dewey Range</label>
            <select className="input" value={newSubj} onChange={e => setNewSubj(e.target.value)}>
              <option value="">— Select range (optional) —</option>
              {DEWEY_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {/* Code preview */}
        <div className="flex items-center gap-4 p-3 rounded-xl bg-neutral-50 border border-neutral-200">
          <span className="text-sm text-neutral-500">Generated shelf code:</span>
          {newCode
            ? <span className="font-mono font-bold text-primary-700 text-lg tracking-wider">{newCode}</span>
            : <span className="text-neutral-300 text-sm">Fill all four fields above to generate</span>
          }
        </div>

        <button onClick={addShelf} disabled={!newCode || saving}
          className="btn-primary disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Shelf'}
        </button>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-44">
            <label className="label">Search</label>
            <input className="input w-full" placeholder="Code or description…" value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="min-w-52">
            <label className="label">Library</label>
            <select className="input w-full" value={filterLib} onChange={e => setFilterLib(e.target.value)}>
              <option value="">All Libraries</option>
              {ALL_LIBRARIES.map(l => <option key={l.code} value={l.code}>{l.code} — {l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="text-xs text-neutral-400 self-center ml-auto">
            {filtered.length} shelf{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* ── Shelf Table ─────────────────────────────────────────────────────── */}
      <div className="card overflow-x-auto">
        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-primary-700 border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-neutral-400">
            <p className="text-4xl mb-2">🗄️</p>
            <p>No shelves found. Register your first shelf above.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th className="text-left p-3 font-semibold">Shelf Code</th>
                <th className="text-left p-3 font-semibold">Library</th>
                <th className="text-left p-3 font-semibold">Description</th>
                <th className="text-left p-3 font-semibold">Subject</th>
                <th className="text-right p-3 font-semibold">Capacity</th>
                <th className="text-right p-3 font-semibold">Items</th>
                <th className="text-left p-3 font-semibold w-32">Occupancy</th>
                <th className="text-left p-3 font-semibold">Status</th>
                <th className="text-left p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(shelf => {
                const held = itemCounts[shelf.shelf_code] ?? 0;
                const occ  = shelf.capacity > 0 ? Math.round((held / shelf.capacity) * 100) : 0;
                const isEditing = editId === shelf.id;
                return (
                  <tr key={shelf.id} className={`border-b ${isEditing ? 'bg-primary-50' : 'hover:bg-neutral-50'}`}>
                    <td className="p-3 font-mono font-semibold text-primary-700">{shelf.shelf_code}</td>
                    <td className="p-3 text-neutral-600 text-xs">
                      <div className="font-medium text-neutral-800">{shelf.library_code}</div>
                      <div className="text-neutral-400 truncate max-w-32">{shelf.library_name}</div>
                    </td>
                    <td className="p-3">
                      {isEditing
                        ? <input className="input text-sm w-full" value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                        : <span className="text-neutral-700">{shelf.description || '—'}</span>
                      }
                    </td>
                    <td className="p-3">
                      {isEditing
                        ? (
                          <select className="input text-sm w-full" value={editSubj} onChange={e => setEditSubj(e.target.value)}>
                            <option value="">—</option>
                            {DEWEY_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        )
                        : <span className="text-xs text-neutral-500">{shelf.subject_range || '—'}</span>
                      }
                    </td>
                    <td className="p-3 text-right">
                      {isEditing
                        ? <input type="number" className="input text-sm w-20 text-right" value={editCap} min={1} onChange={e => setEditCap(+e.target.value)} />
                        : shelf.capacity
                      }
                    </td>
                    <td className="p-3 text-right font-semibold">{held}</td>
                    <td className="p-3"><OccupancyBar pct={occ} /></td>
                    <td className="p-3">
                      {isEditing
                        ? (
                          <select className="input text-sm w-24" value={editStatus} onChange={e => setEditStatus(e.target.value as 'active'|'inactive')}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        )
                        : (
                          <span className={`badge text-xs ${shelf.status === 'active' ? 'badge-success' : 'badge-secondary'}`}>
                            {shelf.status}
                          </span>
                        )
                      }
                    </td>
                    <td className="p-3 space-y-1">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit(shelf.id)} disabled={saving}
                            className="btn-primary text-xs px-2 py-1 disabled:opacity-50">Save</button>
                          <button onClick={() => setEditId(null)}
                            className="btn-outline text-xs px-2 py-1">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(shelf)} className="btn-outline text-xs px-2 py-1">Edit</button>
                          <button
                            onClick={() => deleteShelf(shelf.id, shelf.shelf_code)}
                            disabled={held > 0}
                            title={held > 0 ? 'Cannot delete — shelf has items assigned' : 'Delete shelf'}
                            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed px-1"
                          >
                            Del
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
