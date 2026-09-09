import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';

interface RepositoryItem {
  id: string;
  title: string;
  authors: string;
  type: string;
  faculty: string;
  downloads: number;
  doi?: string;
  thumbnail?: string;
  year: number;
}

interface TreeNode {
  id: string;
  name: string;
  type: 'community' | 'collection' | 'item';
  children?: TreeNode[];
}

export default function Repository() {
  const [items, setItems] = useState<RepositoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [expandedNode, setExpandedNode] = useState<string | null>('root');

  const treeStructure: TreeNode = {
    id: 'root',
    name: 'Communities',
    type: 'community',
    children: [
      {
        id: 'research',
        name: 'Research & Scholarship',
        type: 'community',
        children: [
          { id: 'theses', name: 'Theses & Dissertations', type: 'collection' },
          { id: 'papers', name: 'Research Papers', type: 'collection' },
          { id: 'reports', name: 'Technical Reports', type: 'collection' },
        ],
      },
      {
        id: 'data',
        name: 'Data & Datasets',
        type: 'community',
        children: [
          { id: 'datasets', name: 'Research Datasets', type: 'collection' },
          { id: 'archives', name: 'Historical Archives', type: 'collection' },
        ],
      },
      {
        id: 'learning',
        name: 'Learning Materials',
        type: 'community',
        children: [
          { id: 'courses', name: 'Course Materials', type: 'collection' },
          { id: 'ebooks', name: 'E-Books', type: 'collection' },
        ],
      },
    ],
  };

  const itemTypes = [
    'All Types',
    'Thesis',
    'Research Paper',
    'Dataset',
    'E-Book',
    'Technical Report',
  ];

  const years = [
    'All Years',
    '2024',
    '2023',
    '2022',
    '2021',
    '2020',
    'Before 2020',
  ];

  useEffect(() => {
    const fetchRepositoryItems = async () => {
      setLoading(true);
      try {
        let query = supabase.from('repository_items').select('*');

        if (selectedType && selectedType !== 'All Types') {
          query = query.eq('type', selectedType);
        }

        if (selectedFaculty) {
          query = query.eq('faculty', selectedFaculty);
        }

        if (selectedYear && selectedYear !== 'All Years') {
          if (selectedYear === 'Before 2020') {
            query = query.lt('year', 2020);
          } else {
            query = query.eq('year', parseInt(selectedYear));
          }
        }

        const { data, error } = await query.limit(20);

        if (error) throw error;

        const formattedItems = (data || []).map((item: any) => ({
          id: item.id,
          title: item.title,
          authors: item.authors || 'Unknown',
          type: item.type || 'Document',
          faculty: item.faculty || 'General',
          downloads: item.downloads || 0,
          doi: item.doi,
          thumbnail: item.thumbnail,
          year: item.year || new Date().getFullYear(),
        }));

        setItems(formattedItems);
      } catch (error) {
        console.error('Error fetching repository items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRepositoryItems();
  }, [selectedType, selectedFaculty, selectedYear]);

  const toggleNode = (nodeId: string) => {
    setExpandedNode(expandedNode === nodeId ? null : nodeId);
  };

  const TreeNodeComponent = ({ node, depth = 0 }: { node: TreeNode; depth?: number }) => {
    const isExpanded = expandedNode === node.id;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} style={{ marginLeft: `${depth * 16}px` }}>
        <button
          onClick={() => hasChildren && toggleNode(node.id)}
          className="flex items-center gap-2 py-2 px-3 rounded hover:bg-gray-100 w-full text-left transition"
        >
          {hasChildren && (
            <span className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          {!hasChildren && <span className="text-sm text-gray-400">•</span>}
          <span className={hasChildren ? 'font-semibold' : 'text-sm'}>{node.name}</span>
        </button>
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => (
              <TreeNodeComponent key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div className="section">
          <h1 className="text-4xl font-bold" style={{ color: 'var(--color-primary)' }}>
            Digital Repository
          </h1>
          <p className="text-gray-600 mt-2">
            Browse scholarly works, theses, and research data from {institutionConfig.name}
          </p>
        </div>
      </div>

      <div className="section">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div>
            <div className="card p-4">
              <h3 className="font-bold mb-4" style={{ color: 'var(--color-primary)' }}>
                Collections
              </h3>
              <TreeNodeComponent node={treeStructure} />
            </div>

            <div className="card p-4 mt-4">
              <h3 className="font-bold mb-3" style={{ color: 'var(--color-primary)' }}>
                Filters
              </h3>

              <div className="mb-4">
                <label className="label text-sm font-semibold mb-2 block">Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="input text-sm"
                >
                  {itemTypes.map(type => (
                    <option key={type} value={type === 'All Types' ? '' : type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="label text-sm font-semibold mb-2 block">Faculty</label>
                <select
                  value={selectedFaculty}
                  onChange={(e) => setSelectedFaculty(e.target.value)}
                  className="input text-sm"
                >
                  <option value="">All Faculties</option>
                  {institutionConfig.faculties.map(faculty => (
                    <option key={faculty.code} value={faculty.code}>
                      {faculty.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label text-sm font-semibold mb-2 block">Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="input text-sm"
                >
                  {years.map(year => (
                    <option key={year} value={year === 'All Years' ? '' : year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="card h-64 bg-gray-100 animate-pulse"></div>
                ))}
              </div>
            ) : items.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map(item => (
                  <Link
                    key={item.id}
                    to={`/repository/${item.id}`}
                    className="card hover:shadow-lg transition group"
                  >
                    <div className="h-40 bg-gray-200 rounded mb-3 group-hover:bg-gray-300 transition">
                      {item.thumbnail && (
                        <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover rounded" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-sm mb-2 line-clamp-2 group-hover:text-primary-700 transition">
                        {item.title}
                      </h3>
                      <p className="text-xs text-gray-600 mb-2 line-clamp-1">{item.authors}</p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        <span className="badge badge-primary text-xs">{item.type}</span>
                        <span className="badge badge-secondary text-xs">{item.faculty}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>{item.downloads} downloads</span>
                        {item.doi && (
                          <span className="badge text-xs" style={{ color: 'var(--color-primary)' }}>
                            DOI
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="card p-8 text-center text-gray-600">
                <p className="mb-4">No items found matching your filters</p>
                <button
                  onClick={() => {
                    setSelectedType('');
                    setSelectedFaculty('');
                    setSelectedYear('');
                  }}
                  className="btn-outline"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
