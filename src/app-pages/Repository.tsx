import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Resource3DBookCard, Resource3DBookCardSkeleton, Resource3DBookGrid } from '@/components/resource/Resource3DBookCard';

interface Community { id: string; name: string; slug: string; faculty_code: string | null; parent_id: string | null; }
interface Collection { id: string; community_id: string; name: string; slug: string; }
interface RepoItem {
  id: string; title: string; authors: any[]; item_type: string | null; type: string;
  faculty_code: string | null; department: string | null; download_count: number;
  doi: string | null; year: number | null; language: string; visibility: string;
  subjects: string[]; keywords: string[];
}

const ITEM_TYPES = [
  'Undergraduate Long Essay', 'Final Year Project', 'Research Paper', 'Conference Paper',
  'Book Chapter', 'Government Publication', 'Learning Material', 'Historical Document',
];

export default function Repository() {
  usePageTitle('Repository');
  const [searchParams] = useSearchParams();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [items, setItems] = useState<RepoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['root']));

  const [filterType, setFilterType] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterLang, setFilterLang] = useState('');
  const [filterAccess, setFilterAccess] = useState('');
  const search = searchParams.get('q')?.trim() ?? '';

  const PAGE_SIZE = 20;

  useEffect(() => {
    const load = async () => {
      const [{ data: comms }, { data: colls }] = await Promise.all([
        supabase.from('repository_communities').select('*').order('name'),
        supabase.from('repository_collections').select('*').order('name'),
      ]);
      setCommunities(comms ?? []);
      setCollections(colls ?? []);
    };
    load();
  }, []);

  const fetchItems = useCallback(async (pg: number) => {
    setLoading(true);
    try {
      let q = supabase
        .from('repository_items')
        .select('id,title,authors,item_type,type,faculty_code,department,download_count,doi,year,language,visibility,subjects,keywords', { count: 'exact' })
        .eq('status', 'published')
        .range(pg * PAGE_SIZE, pg * PAGE_SIZE + PAGE_SIZE - 1)
        .order('created_at', { ascending: false });

      if (selectedCollection) q = q.eq('collection_id', selectedCollection);
      else if (selectedCommunity) {
        const comm = communities.find(c => c.id === selectedCommunity);
        if (comm?.faculty_code) q = q.eq('faculty_code', comm.faculty_code);
      }
      if (filterType) q = q.or(`item_type.eq.${filterType},type.eq.${filterType}`);
      if (filterDept) q = q.eq('department', filterDept);
      if (filterYear) {
        if (filterYear === 'before2020') q = q.lt('year', 2020);
        else q = q.eq('year', parseInt(filterYear));
      }
      if (filterLang) q = q.eq('language', filterLang);
      if (filterAccess) q = q.eq('visibility', filterAccess);
      if (search) q = q.or(`title.ilike.%${search}%,abstract.ilike.%${search}%,department.ilike.%${search}%`);

      const { data, count, error } = await q;
      if (error) throw error;
      setItems(data ?? []);
      setTotal(count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [selectedCommunity, selectedCollection, filterType, filterDept, filterYear, filterLang, filterAccess, communities, search]);

  useEffect(() => { setPage(0); }, [selectedCommunity, selectedCollection, filterType, filterDept, filterYear, filterLang, filterAccess]);
  useEffect(() => { fetchItems(page); }, [fetchItems, page]);

  const roots = communities.filter(c => !c.parent_id);
  const subOf = (parentId: string) => communities.filter(c => c.parent_id === parentId);
  const collsOf = (commId: string) => collections.filter(c => c.community_id === commId);

  const toggle = (id: string) => setExpanded(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const yearOptions = Array.from({ length: new Date().getFullYear() - 1999 }, (_, i) => String(new Date().getFullYear() - i));

  const authorDisplay = (authors: any[]) =>
    (Array.isArray(authors) ? authors : [])
      .map((a: any) => (typeof a === 'string' ? a : (a.name ?? ''))).slice(0, 2).join(', ')
      + (authors.length > 2 ? ' et al.' : '');

  const clearFilters = () => {
    setFilterType(''); setFilterDept(''); setFilterYear('');
    setFilterLang(''); setFilterAccess('');
    setSelectedCommunity(null); setSelectedCollection(null);
  };

  const hasFilters = filterType || filterDept || filterYear || filterLang || filterAccess || selectedCommunity || selectedCollection;

  return (
    <div className="bg-neutral-50 min-h-screen">
      <div className="page-header bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700">
        <div className="section flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white opacity-100" style={{ color: 'white' }}>
              Digital Repository
            </h1>
            <p className="text-lg mt-2 opacity-100" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
              Browse scholarly works from {institutionConfig.name ?? 'ESUT'}
            </p>
            {search && <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,.82)' }}>Search results for “{search}”</p>}
          </div>
          <div className="flex flex-wrap gap-2 self-start md:self-auto">
            <Link to="/repository/stats" className="btn-outline text-white border-white hover:bg-white/10 text-sm" style={{ color: 'white', borderColor: 'white' }}>
              View Statistics
            </Link>
            <Link to="/repository/submit" className="btn-primary">
              Submit Work
            </Link>
          </div>
        </div>
      </div>

      <div className="section py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Tree */}
            <div className="card p-4">
              <h3 className="font-bold text-sm uppercase tracking-wide mb-3" style={{ color: 'var(--color-primary)' }}>
                Collections
              </h3>

              {/* ESUT root */}
              <button
                onClick={() => { setSelectedCommunity(null); setSelectedCollection(null); }}
                className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm font-semibold transition-colors ${!selectedCommunity && !selectedCollection ? 'bg-primary-100 text-primary-800' : 'hover:bg-neutral-100'}`}
              >
                <span style={{ color: 'var(--color-primary)' }}>▾</span>
                {institutionConfig.name ?? 'ESUT'}
              </button>

              <div className="ml-3 mt-1 space-y-0.5">
                {roots.map(root => {
                  const subs = subOf(root.id);
                  const colls = collsOf(root.id);
                  const hasChildren = subs.length > 0 || colls.length > 0;
                  const isOpen = expanded.has(root.id);
                  const isSelected = selectedCommunity === root.id;

                  return (
                    <div key={root.id}>
                      <div className="flex items-center gap-1">
                        {hasChildren && (
                          <button onClick={() => toggle(root.id)} className="text-neutral-400 hover:text-neutral-600 p-0.5">
                            <span className="text-xs">{isOpen ? '▾' : '▸'}</span>
                          </button>
                        )}
                        <button
                          onClick={() => { setSelectedCommunity(root.id); setSelectedCollection(null); }}
                          className={`flex-1 text-left px-2 py-1 rounded text-sm transition-colors ${isSelected ? 'bg-primary-100 text-primary-800 font-medium' : 'hover:bg-neutral-100'}`}
                        >
                          {root.name}
                        </button>
                      </div>

                      {isOpen && hasChildren && (
                        <div className="ml-4 mt-0.5 space-y-0.5">
                          {colls.map(coll => (
                            <button
                              key={coll.id}
                              onClick={() => { setSelectedCollection(coll.id); setSelectedCommunity(root.id); }}
                              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${selectedCollection === coll.id ? 'bg-primary-100 text-primary-800 font-medium' : 'text-neutral-600 hover:bg-neutral-100'}`}
                            >
                              • {coll.name}
                            </button>
                          ))}
                          {subs.map(sub => (
                            <button
                              key={sub.id}
                              onClick={() => { setSelectedCommunity(sub.id); setSelectedCollection(null); }}
                              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${selectedCommunity === sub.id ? 'bg-primary-100 text-primary-800 font-medium' : 'text-neutral-600 hover:bg-neutral-100'}`}
                            >
                              ↳ {sub.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Filters */}
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm uppercase tracking-wide" style={{ color: 'var(--color-primary)' }}>
                  Filters
                </h3>
                {hasFilters && (
                  <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700">
                    Clear all
                  </button>
                )}
              </div>

              <div>
                <label className="label text-xs mb-1 block">Item Type</label>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input text-sm">
                  <option value="">All Types</option>
                  {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="label text-xs mb-1 block">Department</label>
                <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="input text-sm">
                  <option value="">All Departments</option>
                  {institutionConfig.faculties.map(f => (
                    <option key={f.code} value={f.slug}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label text-xs mb-1 block">Year</label>
                <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="input text-sm">
                  <option value="">All Years</option>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  <option value="before2020">Before 2020</option>
                </select>
              </div>

              <div>
                <label className="label text-xs mb-1 block">Language</label>
                <select value={filterLang} onChange={e => setFilterLang(e.target.value)} className="input text-sm">
                  <option value="">All Languages</option>
                  <option value="English">English</option>
                  <option value="Yoruba">Yoruba</option>
                  <option value="French">French</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="label text-xs mb-1 block">Access</label>
                <select value={filterAccess} onChange={e => setFilterAccess(e.target.value)} className="input text-sm">
                  <option value="">All Access Levels</option>
                  <option value="global">Open Access</option>
                  <option value="faculty">ESUT Members Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-neutral-500">
                {loading ? 'Loading…' : `${total.toLocaleString()} item${total !== 1 ? 's' : ''} found`}
              </p>
            </div>

            {loading ? (
              <Resource3DBookGrid className="lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(8)].map((_, i) => <Resource3DBookCardSkeleton key={i} />)}
              </Resource3DBookGrid>
            ) : items.length === 0 ? (
              <div className="card p-12 text-center text-neutral-500">
                <p className="text-4xl mb-3">📂</p>
                <p className="font-semibold mb-2">No items found</p>
                <p className="text-sm mb-4">Try adjusting your filters or browsing a different collection.</p>
                {hasFilters && (
                  <button onClick={clearFilters} className="btn-outline">Clear Filters</button>
                )}
              </div>
            ) : (
              <>
                <Resource3DBookGrid className="lg:grid-cols-3 xl:grid-cols-4">
                  {items.map(item => {
                    const typeLabel = item.item_type || item.type || 'Document';
                    const authors = Array.isArray(item.authors) ? item.authors : [];

                    return (
                      <Resource3DBookCard
                        key={item.id}
                        id={item.id}
                        title={item.title}
                        authors={authorDisplay(authors)}
                        resourceType={typeLabel}
                        year={item.year}
                        category={item.faculty_code}
                        subjects={Array.isArray(item.subjects) ? item.subjects : []}
                        spineText={item.doi || typeLabel}
                        href={`/repository/${item.id}`}
                        status={item.visibility === 'global' ? 'Open access' : 'Members only'}
                        actions={(
                          <>
                            <span className="badge badge-primary text-xs">{typeLabel}</span>
                            {item.faculty_code && <span className="badge badge-secondary text-xs">{item.faculty_code}</span>}
                            {item.doi && (
                              <span className="badge text-xs" style={{ background: '#fef3c7', color: '#92400e' }}>DOI</span>
                            )}
                            {item.visibility === 'global' && (
                              <span className="badge text-xs" style={{ background: '#d1fae5', color: '#065f46' }}>Open</span>
                            )}
                            <span className="text-xs text-neutral-400">{(item.download_count ?? 0).toLocaleString()} downloads</span>
                          </>
                        )}
                      />
                    );
                  })}
                </Resource3DBookGrid>

                {/* Pagination */}
                {total > PAGE_SIZE && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="btn-outline text-sm disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-neutral-600">
                      Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
                    </span>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={(page + 1) * PAGE_SIZE >= total}
                      className="btn-outline text-sm disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
