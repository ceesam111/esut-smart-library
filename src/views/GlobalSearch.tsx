import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';

type TabType = 'all' | 'local' | 'openaccess' | 'pubmed' | 'ajol';

interface SearchResult {
  id: string;
  title: string;
  authors: string;
  year: number;
  type: string;
}

export default function GlobalSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setSearchParams({ q: searchQuery });

    setTimeout(() => {
      setResults([
        {
          id: '1',
          title: 'Sample Research Paper on ' + searchQuery,
          authors: 'Smith, J., Johnson, M., Williams, R.',
          year: 2024,
          type: 'Research Paper',
        },
        {
          id: '2',
          title: 'Thesis: Advanced Topics in ' + searchQuery,
          authors: 'Brown, A.',
          year: 2023,
          type: 'Thesis',
        },
        {
          id: '3',
          title: 'Review Article: Current Trends in ' + searchQuery,
          authors: 'Davis, K., Miller, L.',
          year: 2024,
          type: 'Review',
        },
      ]);
      setLoading(false);
    }, 800);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 600);
  };

  return (
    <div>
      <div className="page-header">
        <div className="section">
          <h1 className="text-4xl font-bold" style={{ color: 'var(--color-primary)' }}>
            Global Search
          </h1>
          <p className="text-gray-600 mt-2">
            Search across 250M+ academic works
          </p>
        </div>
      </div>

      <div className="section">
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder="Search journals, theses, open access materials, and more..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn-primary">
              Search
            </button>
          </div>
        </form>

        {hasSearched && (
          <div className="mb-8 p-6 rounded-lg" style={{ backgroundColor: 'var(--color-secondary)', color: 'white' }}>
            <h3 className="text-xl font-bold mb-2">AI Librarian Summary</h3>
            <p className="text-sm leading-relaxed">
              Found {results.length} results for "{searchQuery}" across selected sources.
              The results include peer-reviewed research papers, theses, and academic materials
              relevant to your query. Refine your search using the tabs below to find specific types of resources.
            </p>
          </div>
        )}

        {hasSearched && (
          <>
            <div className="border-b border-gray-200 mb-6 flex gap-6">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'local', label: 'Local' },
                  { id: 'openaccess', label: 'Open Access' },
                  { id: 'pubmed', label: 'PubMed' },
                  { id: 'ajol', label: 'AJOL' },
                ] as { id: TabType; label: string }[]
              ).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`pb-3 font-medium transition ${
                    activeTab === tab.id
                      ? 'border-b-2 text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  style={
                    activeTab === tab.id
                      ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }
                      : {}
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="card h-32 bg-gray-100 animate-pulse"></div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {results.length > 0 ? (
                  results.map(result => (
                    <div key={result.id} className="card hover:shadow-md transition p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-gray-900 mb-2">
                            {result.title}
                          </h3>
                          <p className="text-sm text-gray-600 mb-3">{result.authors}</p>
                          <div className="flex gap-2 items-center">
                            <span className="badge badge-primary text-xs">{result.type}</span>
                            <span className="text-xs text-gray-500">{result.year}</span>
                          </div>
                        </div>
                        <button
                          className="btn-ghost text-sm"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="card p-8 text-center text-gray-600">
                    No results found for "{searchQuery}" in {activeTab} sources
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!hasSearched && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg mb-4">
              Start searching to find resources across multiple academic databases
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
              {[
                { name: 'Local Repository', icon: '📦' },
                { name: 'Open Access', icon: '🔓' },
                { name: 'PubMed', icon: '⚕️' },
                { name: 'AJOL', icon: '🌍' },
                { name: 'Institutional', icon: '🏫' },
              ].map(source => (
                <div key={source.name} className="card p-4 text-center">
                  <div className="text-3xl mb-2">{source.icon}</div>
                  <p className="text-xs font-semibold text-gray-700">{source.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
