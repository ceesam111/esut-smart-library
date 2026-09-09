import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';

interface CatalogueItem {
  id: string;
  title: string;
  authors: string;
  year: number;
  type: string;
  downloads: number;
}

export default function Faculty() {
  const { slug } = useParams<{ slug: string }>();
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, thesis: 0, papers: 0 });

  const faculty = institutionConfig.faculties.find(f => f.slug === slug);

  useEffect(() => {
    if (!faculty) return;

    const fetchFacultyData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('catalogue_items')
          .select('*')
          .eq('faculty_code', faculty.code)
          .limit(12);

        if (error) throw error;

        const catalogueItems = (data || []).map((item: any) => ({
          id: item.id,
          title: item.title,
          authors: item.authors || 'Unknown',
          year: item.year || new Date().getFullYear(),
          type: item.type || 'Document',
          downloads: item.downloads || 0,
        }));

        setItems(catalogueItems);
        setStats({
          total: data?.length || 0,
          thesis: data?.filter((d: any) => d.type === 'Thesis').length || 0,
          papers: data?.filter((d: any) => d.type === 'Research Paper').length || 0,
        });
      } catch (error) {
        console.error('Error fetching faculty data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFacultyData();
  }, [faculty]);

  if (!faculty) {
    return (
      <div className="page-header">
        <div className="section">
          <p className="text-lg text-gray-600">Faculty not found</p>
          <Link to="/faculty-libraries" className="btn-primary mt-4">
            Back to Faculties
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="section">
          <h1 className="text-4xl font-bold" style={{ color: 'var(--color-primary)' }}>
            {faculty.name}
          </h1>
          <p className="text-gray-600 mt-2">
            {institutionConfig.name} - {faculty.name} Library
          </p>
        </div>
      </div>

      <div className="section">
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="card">
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color: 'var(--color-secondary)' }}>
                {stats.total}
              </div>
              <p className="text-gray-600 text-sm mt-2">Total Items</p>
            </div>
          </div>
          <div className="card">
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color: 'var(--color-secondary)' }}>
                {stats.thesis}
              </div>
              <p className="text-gray-600 text-sm mt-2">Theses</p>
            </div>
          </div>
          <div className="card">
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color: 'var(--color-secondary)' }}>
                {stats.papers}
              </div>
              <p className="text-gray-600 text-sm mt-2">Research Papers</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Recent Additions</h2>
          <Link
            to={`/catalogue?faculty=${faculty.slug}`}
            className="btn-primary"
          >
            Browse All
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card h-64 bg-gray-100 animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(item => (
              <div key={item.id} className="card hover:shadow-lg transition">
                <div className="flex flex-col h-full">
                  <div className="h-32 bg-gray-200 rounded mb-3"></div>
                  <h3 className="font-bold text-sm line-clamp-2 mb-2">{item.title}</h3>
                  <p className="text-xs text-gray-600 mb-2">{item.authors}</p>
                  <div className="flex gap-2 mb-3">
                    <span className="badge badge-primary text-xs">{item.type}</span>
                    <span className="badge badge-secondary text-xs">{item.year}</span>
                  </div>
                  <div className="mt-auto text-xs text-gray-500">
                    {item.downloads} downloads
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
