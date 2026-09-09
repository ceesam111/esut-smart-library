import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { institutionConfig } from '@config/institution.config';

interface Item {
  id: string;
  title: string;
  authors: any;
  isbn: string | null;
  publisher: string | null;
  year: number | null;
  call_number: string | null;
  format: string | null;
  branch_origin: string | null;
  library_code: string | null;
  total_copies: number | null;
}

interface Copy {
  id: string;
  branch: string | null;
  faculty_code: string | null;
  location: string | null;
  shelf_location: string | null;
  call_number: string | null;
  status: string | null;
}

const ALL_LIBRARIES = [
  { code: institutionConfig.mainLibrary.code, name: institutionConfig.mainLibrary.name },
  ...institutionConfig.branchLibraries.map(l => ({ code: l.code, name: l.name })),
  ...institutionConfig.facultyLibraries.map(l => ({ code: l.code, name: l.name })),
];

function authorList(authors: any): string {
  if (!authors) return '';
  if (Array.isArray(authors)) return authors.map((a: any) => typeof a === 'string' ? a : a?.name).filter(Boolean).join(', ');
  return String(authors);
}

export default function CatalogueAdopt() {
  const { hasRole } = useAuth();
  const canCatalogue = hasRole('librarian', 'faculty_librarian', 'super_admin');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [selected, setSelected] = useState<Item | null>(null);
  const [copies, setCopies] = useState<Copy[]>([]);
  const [holding, setHolding] = useState({ branch: ALL_LIBRARIES[0]?.code ?? '', location: '', shelf_location: '', call_number: '', barcode: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearched(true);
    const { data } = await supabase
      .from('catalogue_items')
      .select('id,title,authors,isbn,publisher,year,call_number,format,branch_origin,library_code,total_copies')
      .or(`title.ilike.%${q}%,isbn.ilike.%${q}%`)
      .order('title')
      .limit(25);
    setResults((data as Item[]) ?? []);
    setSearching(false);
  }, [query]);

  const openRecord = async (item: Item) => {
    setSelected(item);
    setMsg('');
    setHolding({ branch: ALL_LIBRARIES[0]?.code ?? '', location: '', shelf_location: '', call_number: item.call_number ?? '', barcode: '' });
    const { data } = await supabase
      .from('catalogue_copies')
      .select('id,branch,faculty_code,location,shelf_location,call_number,status')
      .eq('item_id', item.id);
    setCopies((data as Copy[]) ?? []);
  };

  const adopt = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from('catalogue_copies').insert({
      item_id: selected.id,
      branch: holding.branch || null,
      faculty_code: holding.branch || null,
      location: holding.location.trim() || null,
      shelf_location: holding.shelf_location.trim() || null,
      call_number: holding.call_number.trim() || selected.call_number || null,
      barcode: holding.barcode.trim() || null,
      status: 'available',
    });
    if (!error) {
      await supabase
        .from('catalogue_items')
        .update({ total_copies: (selected.total_copies ?? 0) + 1 })
        .eq('id', selected.id);
    }
    setSaving(false);
    if (error) { setMsg(`Error: ${error.message}`); return; }
    setMsg('Local holding added — this branch now holds a copy of the shared record.');
    setHolding(h => ({ ...h, location: '', shelf_location: '', barcode: '' }));
    openRecord({ ...selected, total_copies: (selected.total_copies ?? 0) + 1 });
  };

  if (!canCatalogue) {
    return (
      <div className="p-8 max-w-xl">
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="text-xl font-bold text-neutral-900 mb-2">Librarians Only</h1>
          <p className="text-neutral-500 text-sm">Union Catalogue adoption is available to librarians and Super Admins.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Union Catalogue — Adopt a Record</h1>
        <p className="text-neutral-500 text-sm mt-1 max-w-2xl">
          Before creating a new record, search the shared union catalogue. If {institutionConfig.libraryMode === 'multi' ? 'another branch has already' : 'the library has already'} catalogued the item,
          adopt the existing record and add only your local holding (location, shelf, copy) — no duplicate bibliographic record.
        </p>
      </div>

      <div className="card p-4 mb-5">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Search shared catalogue by title or ISBN…"
            className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
          />
          <button onClick={search} disabled={searching || !query.trim()} className="btn-primary px-5 py-2 text-sm disabled:opacity-40">
            {searching ? 'Searching…' : 'Search'}
          </button>
          <Link to="/admin/catalogue/new" className="px-4 py-2 text-sm rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 flex items-center">
            New record
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Results */}
        <div>
          <h2 className="font-semibold text-neutral-800 text-sm mb-2">
            {searched ? `Existing records (${results.length})` : 'Search results'}
          </h2>
          {searched && results.length === 0 && !searching ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-neutral-500 mb-3">No matching record in the union catalogue.</p>
              <Link to="/admin/catalogue/new" className="btn-primary inline-flex px-4 py-2 text-sm">Create a new record</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map(item => (
                <button
                  key={item.id}
                  onClick={() => openRecord(item)}
                  className={`w-full text-left card p-4 hover:shadow-card-hover transition-shadow ${selected?.id === item.id ? 'ring-2 ring-primary-500' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-900 truncate">{item.title}</p>
                      <p className="text-xs text-neutral-500 truncate">{authorList(item.authors)}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {[item.publisher, item.year, item.call_number].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {item.branch_origin && <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">Origin: {item.branch_origin}</span>}
                      <p className="text-xs text-neutral-400 mt-1">{item.total_copies ?? 0} cop{(item.total_copies ?? 0) === 1 ? 'y' : 'ies'}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Adopt panel */}
        <div>
          <h2 className="font-semibold text-neutral-800 text-sm mb-2">Add local holding</h2>
          {!selected ? (
            <div className="card p-6 text-sm text-neutral-400">Select a record on the left to adopt it for your branch.</div>
          ) : (
            <div className="card p-5">
              <p className="font-medium text-neutral-900">{selected.title}</p>
              <p className="text-xs text-neutral-500 mb-3">{authorList(selected.authors)}</p>

              {copies.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1">Existing holdings</p>
                  <div className="space-y-1">
                    {copies.map(c => (
                      <div key={c.id} className="text-xs text-neutral-500 bg-neutral-50 rounded px-2 py-1">
                        <span className="font-medium text-neutral-700">{c.branch ?? '—'}</span>
                        {c.location && ` · ${c.location}`}{c.shelf_location && ` · ${c.shelf_location}`}{c.call_number && ` · ${c.call_number}`}
                        {c.status && <span className="ml-1 text-neutral-400">({c.status})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {institutionConfig.libraryMode === 'multi' && ALL_LIBRARIES.length > 1 && (
                  <label className="block">
                    <span className="block text-xs font-medium text-neutral-600 mb-1">Branch / Library</span>
                    <select
                      value={holding.branch}
                      onChange={e => setHolding(h => ({ ...h, branch: e.target.value }))}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                    >
                      {ALL_LIBRARIES.map(l => <option key={l.code} value={l.code}>{l.name} ({l.code})</option>)}
                    </select>
                  </label>
                )}
                <HoldingField label="Location" value={holding.location} onChange={v => setHolding(h => ({ ...h, location: v }))} placeholder="e.g. Reference Section" />
                <HoldingField label="Shelf location" value={holding.shelf_location} onChange={v => setHolding(h => ({ ...h, shelf_location: v }))} placeholder="e.g. R-12-B" />
                <HoldingField label="Call number" value={holding.call_number} onChange={v => setHolding(h => ({ ...h, call_number: v }))} />
                <HoldingField label="Barcode / copy number" value={holding.barcode} onChange={v => setHolding(h => ({ ...h, barcode: v }))} />
              </div>

              {msg && <p className="text-xs mt-3 text-primary-700">{msg}</p>}

              <button onClick={adopt} disabled={saving} className="btn-primary w-full mt-4 py-2 text-sm disabled:opacity-40">
                {saving ? 'Adding…' : 'Adopt record & add holding'}
              </button>
              <Link to={`/catalogue/${selected.id}`} className="block text-center text-xs text-primary-700 hover:underline mt-2">
                View full record
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HoldingField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-neutral-600 mb-1">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
      />
    </label>
  );
}
