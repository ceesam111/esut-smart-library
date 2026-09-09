import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';

interface CatalogueItem {
  id: string;
  title: string;
  authors: string;
  isbn: string;
  format: string;
  year: number;
  faculty_code: string;
  subjects: string;
  available_copies: number;
  total_copies: number;
  status: string;
  call_number: string;
}

interface CatalogueCopy {
  id: string;
  item_id: string;
  barcode: string;
  call_number: string;
  branch: string;
  location: string;
  shelf_location: string;
  status: string;
  due_date: string | null;
}

// ── Shelf Location Helpers ────────────────────────────────────────────────────

const ALL_LIBRARIES = [
  { code: institutionConfig.mainLibrary.code, name: institutionConfig.mainLibrary.name },
  ...institutionConfig.branchLibraries.map(l => ({ code: l.code, name: l.name })),
  ...institutionConfig.facultyLibraries.map(l => ({ code: l.code, name: l.name })),
];

const FLOORS = [
  { value: 'GF', label: 'Ground Floor (GF)' },
  { value: 'F1', label: 'Floor 1 (F1)' },
  { value: 'F2', label: 'Floor 2 (F2)' },
  { value: 'F3', label: 'Floor 3 (F3)' },
  { value: 'B',  label: 'Basement (B)' },
  { value: 'M',  label: 'Mezzanine (M)' },
];

function formatShelfLocation(lib: string, floor: string, bay: string, shelf: string) {
  if (!lib || !floor || !bay || !shelf) return '';
  const bayN  = bay.replace(/\D/g, '').padStart(2, '0');
  const shelfN = shelf.replace(/\D/g, '').padStart(2, '0');
  return `${lib}/${floor}/B${bayN}/SH${shelfN}`;
}

function parseShelfLocation(loc: string) {
  if (!loc) return { lib: '', floor: '', bay: '', shelf: '' };
  const parts = loc.split('/');
  return {
    lib:   parts[0] ?? '',
    floor: parts[1] ?? '',
    bay:   parts[2]?.replace(/^B0*/, '') ?? '',
    shelf: parts[3]?.replace(/^SH0*/, '') ?? '',
  };
}

// ── Copy Management Modal ─────────────────────────────────────────────────────

function CopyModal({ item, onClose, onSaved }: { item: CatalogueItem; onClose: () => void; onSaved: () => void }) {
  const [copies, setCopies]           = useState<CatalogueCopy[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [editId, setEditId]           = useState<string | null>(null);

  // new copy form
  const [newBarcode, setNewBarcode]   = useState('');
  const [newStatus, setNewStatus]     = useState('available');
  const [newLib,   setNewLib]         = useState(institutionConfig.mainLibrary.code);
  const [newFloor, setNewFloor]       = useState('F1');
  const [newBay,   setNewBay]         = useState('');
  const [newShelf, setNewShelf]       = useState('');
  const [addingNew, setAddingNew]     = useState(false);

  // edit form
  const [editLib,   setEditLib]       = useState('');
  const [editFloor, setEditFloor]     = useState('');
  const [editBay,   setEditBay]       = useState('');
  const [editShelf, setEditShelf]     = useState('');
  const [editStatus, setEditStatus]   = useState('available');

  useEffect(() => { loadCopies(); }, []);

  async function loadCopies() {
    setLoading(true);
    const { data } = await supabase.from('catalogue_copies').select('*').eq('item_id', item.id).order('created_at');
    setCopies((data ?? []) as CatalogueCopy[]);
    setLoading(false);
  }

  function startEdit(copy: CatalogueCopy) {
    const parsed = parseShelfLocation(copy.shelf_location);
    setEditId(copy.id);
    setEditLib(parsed.lib || institutionConfig.mainLibrary.code);
    setEditFloor(parsed.floor || 'F1');
    setEditBay(parsed.bay);
    setEditShelf(parsed.shelf);
    setEditStatus(copy.status);
  }

  async function saveEdit(copy: CatalogueCopy) {
    setSaving(true);
    const shelf_location = formatShelfLocation(editLib, editFloor, editBay, editShelf);
    await supabase.from('catalogue_copies').update({
      shelf_location,
      branch: editLib,
      status: editStatus,
    }).eq('id', copy.id);
    // keep catalogue_items counts in sync
    const allCopies = copies.map(c => c.id === copy.id ? { ...c, shelf_location, status: editStatus } : c);
    const avail = allCopies.filter(c => c.status === 'available').length;
    await supabase.from('catalogue_items').update({ available_copies: avail, total_copies: allCopies.length }).eq('id', item.id);
    setEditId(null);
    setSaving(false);
    loadCopies();
  }

  async function deleteCopy(copyId: string) {
    if (!confirm('Remove this copy from the catalogue?')) return;
    await supabase.from('catalogue_copies').delete().eq('id', copyId);
    const remaining = copies.filter(c => c.id !== copyId);
    const avail = remaining.filter(c => c.status === 'available').length;
    await supabase.from('catalogue_items').update({ available_copies: avail, total_copies: remaining.length }).eq('id', item.id);
    loadCopies();
    onSaved();
  }

  async function addCopy() {
    if (!newBarcode.trim()) return;
    setAddingNew(true);
    const shelf_location = formatShelfLocation(newLib, newFloor, newBay, newShelf);
    await supabase.from('catalogue_copies').insert({
      item_id: item.id,
      barcode: newBarcode.trim(),
      call_number: item.call_number,
      branch: newLib,
      shelf_location,
      status: newStatus,
    });
    const newTotal = copies.length + 1;
    const newAvail = copies.filter(c => c.status === 'available').length + (newStatus === 'available' ? 1 : 0);
    await supabase.from('catalogue_items').update({ total_copies: newTotal, available_copies: newAvail }).eq('id', item.id);
    setNewBarcode('');
    setNewBay('');
    setNewShelf('');
    setNewStatus('available');
    setAddingNew(false);
    loadCopies();
    onSaved();
  }

  const newShelfPreview = formatShelfLocation(newLib, newFloor, newBay, newShelf);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-bold text-neutral-900">Manage Copies</h2>
            <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{item.title}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Add new copy */}
          <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm text-neutral-800">Add New Copy</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Barcode *</label>
                <input value={newBarcode} onChange={e => setNewBarcode(e.target.value)}
                  placeholder="e.g. BFL-2026-001" className="input w-full text-sm" />
              </div>
              <div>
                <label className="label text-xs">Status</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="input w-full text-sm">
                  <option value="available">Available</option>
                  <option value="on_loan">On Loan</option>
                  <option value="reserved">Reserved</option>
                  <option value="lost">Lost</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>
            </div>

            {/* Shelf location builder */}
            <div className="border border-neutral-200 rounded-lg p-3 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-600">Shelf Location</span>
                {newShelfPreview && (
                  <span className="font-mono text-xs font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">{newShelfPreview}</span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="label text-xs">Library</label>
                  <select value={newLib} onChange={e => setNewLib(e.target.value)} className="input w-full text-sm">
                    {ALL_LIBRARIES.map(l => <option key={l.code} value={l.code}>{l.code} — {l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Floor / Room</label>
                  <select value={newFloor} onChange={e => setNewFloor(e.target.value)} className="input w-full text-sm">
                    {FLOORS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Bay</label>
                  <input value={newBay} onChange={e => setNewBay(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 3" maxLength={2} className="input w-full text-sm" />
                </div>
                <div>
                  <label className="label text-xs">Shelf</label>
                  <input value={newShelf} onChange={e => setNewShelf(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 7" maxLength={2} className="input w-full text-sm" />
                </div>
              </div>
              <p className="text-xs text-neutral-400">Format: {institutionConfig.mainLibrary.code}/F1/B03/SH07 (Library / Floor / Bay / Shelf)</p>
            </div>

            <button onClick={addCopy} disabled={!newBarcode.trim() || addingNew}
              className="btn-primary text-sm px-4 py-2 disabled:opacity-50">
              {addingNew ? 'Adding…' : 'Add Copy'}
            </button>
          </div>

          {/* Existing copies */}
          <div>
            <h3 className="font-semibold text-sm text-neutral-800 mb-3">
              Existing Copies <span className="text-neutral-400 font-normal">({copies.length})</span>
            </h3>
            {loading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-neutral-100 rounded-lg animate-pulse" />)}</div>
            ) : copies.length === 0 ? (
              <p className="text-sm text-neutral-400 py-4 text-center">No copies registered yet.</p>
            ) : (
              <div className="space-y-2">
                {copies.map(copy => (
                  <div key={copy.id} className="border border-neutral-200 rounded-xl overflow-hidden">
                    {editId === copy.id ? (
                      <div className="p-4 bg-neutral-50 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="label text-xs">Barcode</label>
                            <input value={copy.barcode} disabled className="input w-full text-sm bg-neutral-100" />
                          </div>
                          <div>
                            <label className="label text-xs">Status</label>
                            <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="input w-full text-sm">
                              <option value="available">Available</option>
                              <option value="on_loan">On Loan</option>
                              <option value="reserved">Reserved</option>
                              <option value="lost">Lost</option>
                              <option value="withdrawn">Withdrawn</option>
                            </select>
                          </div>
                        </div>
                        <div className="border border-neutral-200 rounded-lg p-3 bg-white space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-neutral-600">Shelf Location</span>
                            {formatShelfLocation(editLib, editFloor, editBay, editShelf) && (
                              <span className="font-mono text-xs font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                                {formatShelfLocation(editLib, editFloor, editBay, editShelf)}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <label className="label text-xs">Library</label>
                              <select value={editLib} onChange={e => setEditLib(e.target.value)} className="input w-full text-sm">
                                {ALL_LIBRARIES.map(l => <option key={l.code} value={l.code}>{l.code} — {l.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="label text-xs">Floor</label>
                              <select value={editFloor} onChange={e => setEditFloor(e.target.value)} className="input w-full text-sm">
                                {FLOORS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="label text-xs">Bay</label>
                              <input value={editBay} onChange={e => setEditBay(e.target.value.replace(/\D/g, ''))}
                                placeholder="e.g. 3" maxLength={2} className="input w-full text-sm" />
                            </div>
                            <div>
                              <label className="label text-xs">Shelf</label>
                              <input value={editShelf} onChange={e => setEditShelf(e.target.value.replace(/\D/g, ''))}
                                placeholder="e.g. 7" maxLength={2} className="input w-full text-sm" />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(copy)} disabled={saving}
                            className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
                          <button onClick={() => setEditId(null)}
                            className="btn-outline text-xs px-3 py-1.5">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-semibold text-neutral-800">{copy.barcode || '—'}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              copy.status === 'available' ? 'bg-green-50 text-green-700' :
                              copy.status === 'on_loan'   ? 'bg-amber-50 text-amber-700' :
                              'bg-neutral-100 text-neutral-500'
                            }`}>{copy.status?.replace('_', ' ')}</span>
                            {copy.shelf_location && (
                              <span className="font-mono text-xs text-primary-700 bg-primary-50 px-2 py-0.5 rounded font-semibold">
                                📍 {copy.shelf_location}
                              </span>
                            )}
                          </div>
                          {copy.due_date && copy.status === 'on_loan' && (
                            <p className="text-xs text-neutral-400 mt-0.5">Due: {new Date(copy.due_date).toLocaleDateString('en-GB')}</p>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => startEdit(copy)} className="btn-outline text-xs py-1 px-2">Edit</button>
                          <button onClick={() => deleteCopy(copy.id)} className="text-xs text-red-500 hover:text-red-700 transition-colors px-2">Remove</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function downloadCSV(items: CatalogueItem[]) {
  const header = ['Title', 'Authors', 'ISBN', 'Format', 'Year', 'Call Number', 'Faculty', 'Subjects', 'Available', 'Total', 'Status'];
  const rows = items.map((i) => [
    `"${(i.title || '').replace(/"/g, '""')}"`,
    `"${(i.authors || '').replace(/"/g, '""')}"`,
    i.isbn || '',
    i.format || '',
    i.year || '',
    i.call_number || '',
    i.faculty_code || '',
    `"${(i.subjects || '').replace(/"/g, '""')}"`,
    i.available_copies ?? '',
    i.total_copies ?? '',
    i.status || '',
  ].join(','));
  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `catalogue-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadMARCXML(items: CatalogueItem[]) {
  const records = items.map((item) => `
  <record>
    <leader>00000nam a2200000 i 4500</leader>
    <datafield tag="020" ind1=" " ind2=" ">
      <subfield code="a">${item.isbn || ''}</subfield>
    </datafield>
    <datafield tag="100" ind1="1" ind2=" ">
      <subfield code="a">${(item.authors || '').split(',')[0]}</subfield>
    </datafield>
    <datafield tag="245" ind1="1" ind2="0">
      <subfield code="a">${item.title || ''}</subfield>
    </datafield>
    <datafield tag="264" ind1=" " ind2="1">
      <subfield code="c">${item.year || ''}</subfield>
    </datafield>
    <datafield tag="050" ind1=" " ind2="4">
      <subfield code="a">${item.call_number || ''}</subfield>
    </datafield>
    <datafield tag="650" ind1=" " ind2="7">
      <subfield code="a">${item.subjects || ''}</subfield>
    </datafield>
  </record>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<collection xmlns="http://www.loc.gov/MARC21/slim">${records}
</collection>`;
  const blob = new Blob([xml], { type: 'application/xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `catalogue-marc21-${new Date().toISOString().slice(0, 10)}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Catalogue() {
  const [items, setItems]             = useState<CatalogueItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<CatalogueItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState('');
  const [filterFormat, setFilterFormat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [exporting, setExporting]     = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copyModalItem, setCopyModalItem] = useState<CatalogueItem | null>(null);
  const pageSize = 25;

  useEffect(() => { fetchItems(); }, []);
  useEffect(() => { applyFilters(); }, [items, searchTerm, filterFormat, filterStatus]);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('catalogue_items')
        .select('id, title, authors, isbn, format, year, faculty_code, subjects, available_copies, total_copies, status, call_number')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching catalogue:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = items;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) => item.title?.toLowerCase().includes(term) || item.authors?.toLowerCase().includes(term)
      );
    }
    if (filterFormat) filtered = filtered.filter((item) => item.format === filterFormat);
    if (filterStatus) filtered = filtered.filter((item) => item.status === filterStatus);
    setFilteredItems(filtered);
    setCurrentPage(1);
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const { error } = await supabase.from('catalogue_items').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      fetchItems();
    } catch (error) {
      console.error('Error updating item status:', error);
    }
  };

  const handleExport = async (type: 'csv' | 'xml') => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      const { data } = await supabase
        .from('catalogue_items')
        .select('id, title, authors, isbn, format, year, faculty_code, subjects, available_copies, total_copies, status, call_number')
        .order('title');
      const all = (data ?? []) as CatalogueItem[];
      const target = filteredItems.length < items.length ? filteredItems : all;
      if (type === 'csv') downloadCSV(target);
      else downloadMARCXML(target);
    } finally {
      setExporting(false);
    }
  };

  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredItems.length / pageSize);

  if (loading) return <div className="p-8">Loading catalogue…</div>;

  return (
    <div className="p-8 space-y-6">
      {copyModalItem && (
        <CopyModal
          item={copyModalItem}
          onClose={() => setCopyModalItem(null)}
          onSaved={fetchItems}
        />
      )}
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Catalogue Management</h1>
          <p className="text-gray-600 mt-2">Manage library catalogue items</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/catalogue/authorities" className="btn-outline text-sm">
            Authorities
          </Link>
          <Link to="/admin/catalogue/stats" className="btn-outline text-sm">
            Statistics
          </Link>
          <Link to="/admin/circulation" className="btn-outline text-sm">
            Circulation
          </Link>
          <Link to="/admin/catalogue/scan" className="btn-outline text-sm">
            📱 Scan Items
          </Link>
          {/* Export dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              className="btn-outline text-sm"
              disabled={exporting}
            >
              {exporting ? 'Exporting…' : 'Export ▾'}
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-xl z-20 w-44">
                <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b">
                  CSV (.csv)
                </button>
                <button onClick={() => handleExport('xml')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50">
                  MARC21 XML (.xml)
                </button>
              </div>
            )}
          </div>
          <Link to="/admin/catalogue/new" className="btn-primary text-sm">
            + Add New Item
          </Link>
        </div>
      </div>

      {/* Quick nav cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Authority Control', desc: 'Controlled vocabulary', href: '/admin/catalogue/authorities', icon: '🏷️' },
          { label: 'Statistics',        desc: 'Usage analytics',       href: '/admin/catalogue/stats',       icon: '📊' },
          { label: 'Circulation',       desc: 'Check out / check in',  href: '/admin/circulation',           icon: '🔄' },
          { label: 'Barcode Scan',      desc: 'Add via camera',        href: '/admin/catalogue/scan',        icon: '📱' },
        ].map((c) => (
          <Link key={c.href} to={c.href} className="card hover:shadow-md transition-shadow flex items-center gap-3 no-underline">
            <span className="text-2xl">{c.icon}</span>
            <div>
              <div className="text-sm font-semibold text-gray-800">{c.label}</div>
              <div className="text-xs text-gray-500">{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Filters */}
      <div className="card space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="label">Search</label>
            <input
              type="text"
              placeholder="Search by title or author…"
              className="input w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-40">
            <label className="label">Format</label>
            <select className="input w-full" value={filterFormat} onChange={(e) => setFilterFormat(e.target.value)}>
              <option value="">All Formats</option>
              {['book', 'journal', 'ebook', 'media', 'thesis', 'dvd', 'map', 'manuscript', 'digital'].map((f) => (
                <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-40">
            <label className="label">Status</label>
            <select className="input w-full" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {filteredItems.length} of {items.length} items
          {(searchTerm || filterFormat || filterStatus) && ' (filtered)'}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr>
              <th className="text-left p-3 font-semibold">Title</th>
              <th className="text-left p-3 font-semibold">Authors</th>
              <th className="text-left p-3 font-semibold">Format</th>
              <th className="text-left p-3 font-semibold">Year</th>
              <th className="text-left p-3 font-semibold">Faculty</th>
              <th className="text-left p-3 font-semibold">Copies</th>
              <th className="text-left p-3 font-semibold">Status</th>
              <th className="text-left p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-400">
                  {searchTerm || filterFormat || filterStatus ? 'No items match your filters.' : 'No catalogue items yet.'}
                </td>
              </tr>
            ) : paginatedItems.map((item) => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium max-w-xs">
                  <Link to={`/catalogue/${item.id}`} className="text-primary-700 hover:underline line-clamp-2">
                    {item.title}
                  </Link>
                </td>
                <td className="p-3 text-gray-600 max-w-xs truncate">{item.authors}</td>
                <td className="p-3">
                  <span className="badge badge-secondary">{item.format}</span>
                </td>
                <td className="p-3">{item.year}</td>
                <td className="p-3 text-gray-600">{item.faculty_code || '—'}</td>
                <td className="p-3">
                  <span className="font-semibold">
                    {item.available_copies ?? 0}/{item.total_copies ?? 0}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`badge ${item.status === 'active' ? 'badge-success' : 'badge-error'}`}>
                    {item.status}
                  </span>
                </td>
                <td className="p-3 space-y-1">
                  <Link
                    to={`/catalogue/${item.id}`}
                    className="btn-outline text-xs py-1 px-2 block text-center"
                  >
                    View/Edit
                  </Link>
                  <button
                    onClick={() => setCopyModalItem(item)}
                    className="btn-outline text-xs py-1 px-2 w-full"
                  >
                    Copies / Shelving
                  </button>
                  <button
                    onClick={() => toggleStatus(item.id, item.status)}
                    className="btn-outline text-xs py-1 px-2 w-full"
                  >
                    {item.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
        <div className="text-sm text-gray-600">
          Showing {paginatedItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
          {Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="btn-outline disabled:opacity-50">
            Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const page = Math.max(1, currentPage - 2) + i;
              if (page > totalPages) return null;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 rounded ${page === currentPage ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {page}
                </button>
              );
            })}
          </div>
          <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} className="btn-outline disabled:opacity-50">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
