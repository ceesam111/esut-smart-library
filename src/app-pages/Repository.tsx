import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { Resource3DBookCard, Resource3DBookCardSkeleton, Resource3DBookGrid } from '@/components/resource/Resource3DBookCard';

interface Community { id: string; name: string; slug: string; faculty_code: string | null; parent_id: string | null; }
interface Collection { id: string; community_id: string; name: string; slug: string; }
type AuthorEntry = string | { name?: string | null };

interface RepoItem {
  id: string;
  title: string;
  authors: AuthorEntry[];
  subjects: string[];
  keywords: string[];
  abstract: string | null;
  year: number | null;
  resourceType: string;
  facultyCode: string | null;
  department: string | null;
  doi: string | null;
  createdAt: string;
  score: number;
  matchedIn: string[] | null;
  snippet: string | null;
  file: { name: string; accessLevel: string; extractionStatus: string } | null;
}

interface FacetBucket { value: string; count: number; }
interface SearchFacets {
  resourceType: FacetBucket[];
  year: FacetBucket[];
  faculty: FacetBucket[];
  department: FacetBucket[];
  author: FacetBucket[];
  subject: FacetBucket[];
  accessLevel: FacetBucket[];
}

const ITEM_TYPES = [
  'Undergraduate Long Essay', 'Final Year Project', 'Research Paper', 'Conference Paper',
  'Book Chapter', 'Government Publication', 'Learning Material', 'Historical Document',
];

const ITEM_TYPE_KEYS: TranslationKey[] = [
  'repository.ugLongEssay', 'repository.finalYearProject', 'repository.researchPaper', 'repository.conferencePaper',
  'repository.bookChapter', 'repository.governmentPublication', 'repository.learningMaterial', 'repository.historicalDocument',
];

export default function Repository() {
  const { t } = useI18n();
  usePageTitle(t('repository.title'));
  const [searchParams] = useSearchParams();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [items, setItems] = useState<RepoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [facets, setFacets] = useState<SearchFacets | null>(null);
  const [sort] = useState('newest');

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
    void load();
  }, []);

  const fetchItems = useCallback(async (pg: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pg + 1));
      params.set('pageSize', String(PAGE_SIZE));
      params.set('sort', sort);
      if (search) params.set('q', search);
      if (filterType) params.set('resourceType', filterType);
      if (filterDept) params.set('department', filterDept);
      if (filterYear) {
        params.set('years', filterYear === 'before2020' ? '0' : filterYear);
        if (filterYear === 'before2020') params.delete('years');
      }
      if (filterAccess) params.set('accessLevel', filterAccess);
      if (selectedCollection) {
        const coll = collections.find(c => c.id === selectedCollection);
        if (coll?.name) params.set('subject', coll.name);
      } else if (selectedCommunity) {
        const comm = communities.find(c => c.id === selectedCommunity);
        if (comm?.faculty_code) params.set('faculty', comm.faculty_code);
      }

      const response = await fetch(`/api/repository?${params.toString()}`);
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error ?? t('repository.failedToLoad'));

      const data = json.data;
      setItems((data.items ?? []) as RepoItem[]);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
      setFacets(data.facets ?? null);
    } finally {
      setLoading(false);
    }
  }, [selectedCommunity, selectedCollection, filterType, filterDept, filterYear, filterAccess, communities, collections, search, sort, t]);

  useEffect(() => { setPage(0); }, [selectedCommunity, selectedCollection, filterType, filterDept, filterYear, filterLang, filterAccess]);
  useEffect(() => { void fetchItems(page); }, [fetchItems, page]);

  const roots = communities.filter(c => !c.parent_id);
  const subOf = (parentId: string) => communities.filter(c => c.parent_id === parentId);
  const collsOf = (commId: string) => collections.filter(c => c.community_id === commId);

  const toggle = (id: string) => setExpanded(prev => {
    const s = new Set(prev);
    if (s.has(id)) { s.delete(id); } else { s.add(id); }
    return s;
  });

  const yearOptions = Array.from({ length: new Date().getFullYear() - 1999 }, (_, i) => String(new Date().getFullYear() - i));

  const facetCount = (bucket: FacetBucket[] | undefined, value: string) =>
    bucket?.find(entry => entry.value === value)?.count ?? 0;

  const authorDisplay = (authors: AuthorEntry[]) =>
    (Array.isArray(authors) ? authors : [])
      .map((a: AuthorEntry) => (typeof a === 'string' ? a : (a.name ?? ''))).slice(0, 2).join(', ')
      + (authors.length > 2 ? t('repository.etAl') : '');

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
              {t('repository.title')}
            </h1>
            <p className="text-lg mt-2 opacity-100" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
              {t('repository.subtitle', { name: institutionConfig.name ?? 'ESUT' })}
            </p>
            {search && <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,.82)' }}>{t('repository.searchResultsFor', { query: search })}</p>}
          </div>
          <div className="flex flex-wrap gap-2 self-start md:self-auto">
            <Link to="/repository/stats" className="btn-outline text-white border-white hover:bg-white/10 text-sm" style={{ color: 'white', borderColor: 'white' }}>
              {t('repository.viewStatistics')}
            </Link>
            <Link to="/repository/submit" className="btn-primary">
              {t('repository.submitWork')}
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
                {t('repository.collections')}
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
                  {t('repository.filters')}
                </h3>
                {hasFilters && (
                  <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700">
                    {t('repository.clearAll')}
                  </button>
                )}
              </div>

              <div>
                <label className="label text-xs mb-1 block">{t('repository.itemType')}</label>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input text-sm">
                  <option value="">{t('repository.allTypes')}</option>
                  {(facets?.resourceType?.length ? facets.resourceType.map(f => f.value) : ITEM_TYPES).map((typeValue, idx) => (
                    <option key={typeValue} value={typeValue}>
                      {facets?.resourceType?.length ? typeValue : t(ITEM_TYPE_KEYS[idx])} {facetCount(facets?.resourceType, typeValue) > 0 ? `(${facetCount(facets?.resourceType, typeValue)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label text-xs mb-1 block">{t('repository.department')}</label>
                <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="input text-sm">
                  <option value="">{t('repository.allDepartments')}</option>
                  {institutionConfig.faculties.map(f => (
                    <option key={f.code} value={f.slug}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label text-xs mb-1 block">{t('repository.year')}</label>
                <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="input text-sm">
                  <option value="">{t('repository.allYears')}</option>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  <option value="before2020">{t('repository.before2020')}</option>
                </select>
              </div>

              <div>
                <label className="label text-xs mb-1 block">{t('repository.language')}</label>
                <select value={filterLang} onChange={e => setFilterLang(e.target.value)} className="input text-sm">
                  <option value="">{t('repository.allLanguages')}</option>
                  <option value="English">{t('repository.english')}</option>
                  <option value="Yoruba">{t('repository.yoruba')}</option>
                  <option value="French">{t('repository.french')}</option>
                  <option value="Other">{t('repository.other')}</option>
                </select>
              </div>

              <div>
                <label className="label text-xs mb-1 block">{t('repository.access')}</label>
                <select value={filterAccess} onChange={e => setFilterAccess(e.target.value)} className="input text-sm">
                  <option value="">{t('repository.allAccessLevels')}</option>
                  <option value="global">{t('repository.openAccess')}</option>
                  <option value="faculty">{t('repository.membersOnly')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-neutral-500">
                {loading ? t('common.loading') : t('repository.itemsFound', { count: total })}
              </p>
            </div>

            {loading ? (
              <Resource3DBookGrid className="lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(8)].map((_, i) => <Resource3DBookCardSkeleton key={i} />)}
              </Resource3DBookGrid>
            ) : items.length === 0 ? (
              <div className="card p-12 text-center text-neutral-500">
                <p className="text-4xl mb-3">📂</p>
                <p className="font-semibold mb-2">{t('repository.noItemsFound')}</p>
                <p className="text-sm mb-4">{t('repository.tryAdjustingFilters')}</p>
                {hasFilters && (
                  <button onClick={clearFilters} className="btn-outline">{t('repository.clearFilters')}</button>
                )}
              </div>
            ) : (
              <>
                <Resource3DBookGrid className="lg:grid-cols-3 xl:grid-cols-4">
                  {items.map(item => {
                    const typeLabel = item.resourceType || t('repository.document');
                    const authors = Array.isArray(item.authors) ? item.authors : [];

                    return (
                      <Resource3DBookCard
                        key={item.id}
                        id={item.id}
                        title={item.title}
                        authors={authorDisplay(authors)}
                        resourceType={typeLabel}
                        year={item.year}
                        category={item.facultyCode}
                        subjects={Array.isArray(item.subjects) ? item.subjects : []}
                        spineText={item.doi || typeLabel}
                        href={`/repository/${item.id}`}
                        status={item.file?.accessLevel === 'PUBLIC' ? t('repository.openAccess') : t('repository.membersOnly')}
                        actions={(
                          <>
                            <span className="badge badge-primary text-xs">{typeLabel}</span>
                            {item.facultyCode && <span className="badge badge-secondary text-xs">{item.facultyCode}</span>}
                            {item.doi && (
                              <span className="badge text-xs" style={{ background: '#fef3c7', color: '#92400e' }}>{t('repository.doi')}</span>
                            )}
                            {item.file?.accessLevel === 'PUBLIC' && (
                              <span className="badge text-xs" style={{ background: '#d1fae5', color: '#065f46' }}>{t('repository.open')}</span>
                            )}
                            {item.snippet && (
                              <span className="text-xs text-neutral-500 line-clamp-2">{item.snippet}</span>
                            )}
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
                      {t('repository.previous')}
                    </button>
                    <span className="text-sm text-neutral-600">
                      {t('repository.pageOf', { current: page + 1, total: totalPages || 1 })}
                    </span>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={(page + 1) * PAGE_SIZE >= total}
                      className="btn-outline text-sm disabled:opacity-40"
                    >
                      {t('repository.next')}
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
