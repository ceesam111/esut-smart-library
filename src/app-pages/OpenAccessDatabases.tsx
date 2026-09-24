import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '@/components/BackButton';
import LibraryResourceCard from '@/components/LibraryResourceCard';
import { usePageTitle } from '@/hooks/usePageTitle';
import { OPEN_ACCESS_DATABASES } from '@/config/openAccessDatabases.data';
import { OPAC_URL } from '@/config/libraryResources.config';

export default function OpenAccessDatabases() {
  usePageTitle('Open Access Databases');

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [accessType, setAccessType] = useState('');

  const categories = useMemo(
    () => [...new Set(OPEN_ACCESS_DATABASES.map((r) => r.category).filter(Boolean))].sort(),
    [],
  );
  const accessTypes = useMemo(
    () => [...new Set(OPEN_ACCESS_DATABASES.map((r) => r.accessType).filter(Boolean))].sort(),
    [],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return OPEN_ACCESS_DATABASES.filter((r) => {
      const matchSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.provider.toLowerCase().includes(q) ||
        r.subjects.some((s) => s.toLowerCase().includes(q));
      const matchCategory = !category || r.category === category;
      const matchAccess = !accessType || r.accessType === accessType;
      return matchSearch && matchCategory && matchAccess;
    });
  }, [search, category, accessType]);

  const selectCls =
    'border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white';

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <BackButton />

      <div className="mb-8">
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-2"
          style={{ color: '#D4A017' }}
        >
          Library Resources
        </p>
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Open Access Databases</h1>
        <p className="text-neutral-500 max-w-2xl">
          {OPEN_ACCESS_DATABASES.length} free and open research resources — journals, repositories,
          discovery tools, data portals and directories. No subscription required.
        </p>
      </div>

      <div className="mb-8 flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, subject or provider…"
          className="flex-1 min-w-0 border border-neutral-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="Search open access databases"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={selectCls}
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={accessType}
          onChange={(e) => setAccessType(e.target.value)}
          className={selectCls}
          aria-label="Filter by access type"
        >
          <option value="">All Access Types</option>
          {accessTypes.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-neutral-400 mb-5" aria-live="polite">
        Showing {filtered.length} of {OPEN_ACCESS_DATABASES.length} resources
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-neutral-50 rounded-2xl border border-neutral-200">
          <p className="text-neutral-400">No resources match your filters.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCategory('');
              setAccessType('');
            }}
            className="mt-3 text-sm text-primary-700 font-medium hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((r) => (
            <LibraryResourceCard key={r.id} resource={r} ctaLabel="Visit Resource" />
          ))}
        </div>
      )}

      <div className="mt-10 rounded-xl border border-neutral-200 p-5 text-sm text-neutral-600 space-y-2">
        <p>
          Access labels follow the catalog policy: <em>Open Access</em>, <em>Open Data</em>,{' '}
          <em>Directory</em>, <em>Free Search</em> and <em>Free with Registration</em>. Full-text
          availability for individual items may still vary by licence.
        </p>
        <p>
          Also available:{' '}
          <Link to="/subscribed-databases" className="text-primary-700 font-medium hover:underline">
            Subscribed Databases
          </Link>
          ,{' '}
          <Link to="/databases" className="text-primary-700 font-medium hover:underline">
            Research Databases
          </Link>
          , or the{' '}
          <a
            href={OPAC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-700 font-medium hover:underline"
          >
            OPAC
          </a>
          .
        </p>
      </div>
    </div>
  );
}
