import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface RepositoryItemData {
  id: string;
  title: string;
  authors: string;
  abstract: string;
  type: string;
  faculty: string;
  year: number;
  doi?: string;
  orcid?: string;
  downloads: number;
  views: number;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
}

type CitationStyle = 'apa' | 'harvard' | 'mla' | 'chicago';
type TabType = 'overview' | 'versions' | 'discussion';

export default function RepositoryItem() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<RepositoryItemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCitation, setActiveCitation] = useState<CitationStyle>('apa');
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchItem = async () => {
      if (!id) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('repository_items')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        setItem({
          id: data.id,
          title: data.title,
          authors: data.authors || 'Unknown',
          abstract: data.abstract || 'No abstract available',
          type: data.type || 'Document',
          faculty: data.faculty || 'General',
          year: data.year || new Date().getFullYear(),
          doi: data.doi,
          orcid: data.orcid,
          downloads: data.downloads || 0,
          views: data.views || 0,
          fileUrl: data.file_url,
          fileName: data.file_name,
          fileSize: data.file_size,
        });
      } catch (error) {
        console.error('Error fetching item:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [id]);

  const generateCitation = (style: CitationStyle): string => {
    if (!item) return '';

    const { authors, title, year, doi } = item;

    switch (style) {
      case 'apa':
        return `${authors} (${year}). ${title}. Retrieved from https://doi.org/${doi || 'unknown'}`;
      case 'harvard':
        return `${authors}, ${year}. ${title}. Available at: https://doi.org/${doi || 'unknown'}`;
      case 'mla':
        return `${authors}. "${title}." ${year}. https://doi.org/${doi || 'unknown'}`;
      case 'chicago':
        return `${authors}. "${title}." ${year}. Accessed from https://doi.org/${doi || 'unknown'}`;
      default:
        return '';
    }
  };

  const handleCopyCitation = () => {
    const citation = generateCitation(activeCitation);
    navigator.clipboard.writeText(citation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="section">
        <div className="card h-96 bg-gray-100 animate-pulse"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page-header">
        <div className="section">
          <p className="text-lg text-gray-600 mb-4">Item not found</p>
          <Link to="/repository" className="btn-primary">
            Back to Repository
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section mb-4">
        <button
          onClick={() => navigate('/repository')}
          className="btn-ghost text-sm"
          style={{ color: 'var(--color-primary)' }}
        >
          ← Back to Repository
        </button>
      </div>

      <div className="section">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h1 className="text-3xl font-bold mb-4 text-gray-900">{item.title}</h1>

            <p className="text-gray-700 mb-6">{item.authors}</p>

            <div className="flex flex-wrap gap-2 mb-6">
              <span className="badge badge-primary">{item.type}</span>
              <span className="badge badge-secondary">{item.faculty}</span>
              <span className="badge text-xs">{item.year}</span>
              {item.doi && (
                <span className="badge text-xs" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                  DOI: {item.doi}
                </span>
              )}
              {item.orcid && (
                <span className="badge text-xs" style={{ backgroundColor: 'var(--color-secondary)', color: 'white' }}>
                  ORCID
                </span>
              )}
            </div>

            <div className="card p-6 mb-6">
              <h3 className="font-bold mb-3" style={{ color: 'var(--color-primary)' }}>
                Abstract
              </h3>
              <p className="text-gray-700 leading-relaxed text-sm">{item.abstract}</p>
            </div>

            <div className="card p-6">
              <div className="border-b border-gray-200 mb-4 flex gap-4">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`pb-3 font-medium transition ${
                    activeTab === 'overview'
                      ? 'border-b-2'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  style={
                    activeTab === 'overview'
                      ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }
                      : {}
                  }
                >
                  Metadata
                </button>
                <button
                  onClick={() => setActiveTab('versions')}
                  className={`pb-3 font-medium transition ${
                    activeTab === 'versions'
                      ? 'border-b-2'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  style={
                    activeTab === 'versions'
                      ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }
                      : {}
                  }
                >
                  Version History
                </button>
                <button
                  onClick={() => setActiveTab('discussion')}
                  className={`pb-3 font-medium transition ${
                    activeTab === 'discussion'
                      ? 'border-b-2'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  style={
                    activeTab === 'discussion'
                      ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }
                      : {}
                  }
                >
                  Discussion
                </button>
              </div>

              {activeTab === 'overview' && (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Published:</span>
                    <span className="font-semibold">{item.year}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-semibold">{item.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Faculty:</span>
                    <span className="font-semibold">{item.faculty}</span>
                  </div>
                  {item.doi && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">DOI:</span>
                      <a href={`https://doi.org/${item.doi}`} className="text-primary-600 hover:underline">
                        {item.doi}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'versions' && (
                <div className="space-y-2 text-sm">
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="font-semibold">Version 1.0</p>
                    <p className="text-gray-600 text-xs">{item.year}</p>
                    <p className="text-gray-600 text-xs">Original publication</p>
                  </div>
                </div>
              )}

              {activeTab === 'discussion' && (
                <div className="text-sm text-gray-600">
                  <p className="mb-3">No discussions yet. Be the first to start a discussion about this work.</p>
                  <button className="btn-primary text-sm">Start Discussion</button>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="card p-6 mb-6">
              <div className="bg-gray-200 rounded h-48 mb-4 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-600 text-sm">PDF Preview</p>
                  <p className="text-xs text-gray-500 mt-1">{item.fileSize || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <button className="btn-primary w-full text-sm">
                  Download File
                </button>
                <button className="btn-outline w-full text-sm">
                  View Online
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">👁️ Views</span>
                  <span className="font-semibold">{item.views.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">⬇️ Downloads</span>
                  <span className="font-semibold">{item.downloads.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-bold mb-3" style={{ color: 'var(--color-primary)' }}>
                Citation
              </h3>

              <div className="space-y-2 mb-4">
                {(
                  [
                    { id: 'apa', label: 'APA' },
                    { id: 'harvard', label: 'Harvard' },
                    { id: 'mla', label: 'MLA' },
                    { id: 'chicago', label: 'Chicago' },
                  ] as { id: CitationStyle; label: string }[]
                ).map(style => (
                  <button
                    key={style.id}
                    onClick={() => setActiveCitation(style.id)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                      activeCitation === style.id
                        ? 'font-semibold text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    style={
                      activeCitation === style.id
                        ? { backgroundColor: 'var(--color-primary)' }
                        : {}
                    }
                  >
                    {style.label}
                  </button>
                ))}
              </div>

              <div className="bg-gray-50 p-3 rounded mb-3 text-xs leading-relaxed border border-gray-200">
                {generateCitation(activeCitation)}
              </div>

              <button
                onClick={handleCopyCitation}
                className="btn-ghost w-full text-sm"
                style={{ color: 'var(--color-primary)' }}
              >
                {copied ? '✓ Copied' : 'Copy Citation'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
