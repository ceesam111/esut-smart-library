import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';

interface ResearcherProfile {
  id: string;
  slug: string;
  name: string;
  rank: string;
  faculty: string;
  photo_url: string;
  orcid: string | null;
  h_index: number;
  total_citations: number;
}

export default function Researchers() {
  const [researchers, setResearchers] = useState<ResearcherProfile[]>([]);
  const [filteredResearchers, setFilteredResearchers] = useState<ResearcherProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedRank, setSelectedRank] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResearchers();
  }, []);

  const fetchResearchers = async () => {
    try {
      const { data, error } = await supabase
        .from('researcher_profiles')
        .select('*')
        .eq('status', 'approved')
        .order('name');

      if (error) throw error;
      setResearchers(data || []);
      setFilteredResearchers(data || []);
    } catch (err) {
      console.error('Error fetching researchers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let results = researchers;

    if (searchTerm) {
      results = results.filter(
        (r) =>
          r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.faculty.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedFaculty) {
      results = results.filter((r) => r.faculty === selectedFaculty);
    }

    if (selectedRank) {
      results = results.filter((r) => r.rank === selectedRank);
    }

    setFilteredResearchers(results);
  }, [searchTerm, selectedFaculty, selectedRank, researchers]);

  const faculties = institutionConfig.faculties.map((f) => f.name);
  const ranks = [...new Set(researchers.map((r) => r.rank))];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Research Community</h1>
        <p>Explore the researchers and scholars at {institutionConfig.name}</p>
      </div>

      <section className="section">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div>
            <label className="label">Search</label>
            <input
              type="text"
              className="input"
              placeholder="Name or keyword"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Faculty</label>
            <select
              className="input"
              value={selectedFaculty}
              onChange={(e) => setSelectedFaculty(e.target.value)}
            >
              <option value="">All Faculties</option>
              {faculties.map((faculty) => (
                <option key={faculty} value={faculty}>
                  {faculty}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Rank</label>
            <select
              className="input"
              value={selectedRank}
              onChange={(e) => setSelectedRank(e.target.value)}
            >
              <option value="">All Ranks</option>
              {ranks.map((rank) => (
                <option key={rank} value={rank}>
                  {rank}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              className="btn-outline w-full"
              onClick={() => {
                setSearchTerm('');
                setSelectedFaculty('');
                setSelectedRank('');
              }}
            >
              Reset Filters
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading researchers...</div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-6">
              Showing {filteredResearchers.length} of {researchers.length} researchers
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredResearchers.map((researcher) => (
                <Link
                  key={researcher.id}
                  to={`/researchers/${researcher.slug}`}
                  className="card hover:shadow-lg transition-shadow"
                >
                  <div className="flex flex-col items-center text-center">
                    <img
                      src={researcher.photo_url}
                      alt={researcher.name}
                      className="w-24 h-24 rounded-full mb-4 object-cover"
                    />
                    <h3 className="text-lg font-semibold mb-2">{researcher.name}</h3>
                    <div className="badge badge-primary mb-3">{researcher.rank}</div>
                    <p className="text-sm text-gray-600 mb-3">{researcher.faculty}</p>

                    {researcher.orcid && (
                      <div className="badge badge-secondary mb-3">ORCID</div>
                    )}

                    <div className="w-full border-t pt-3 mt-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">H-Index</p>
                          <p className="font-semibold">{researcher.h_index}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Citations</p>
                          <p className="font-semibold">{researcher.total_citations}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {filteredResearchers.length === 0 && (
              <div className="text-center py-12 text-gray-600">
                No researchers found matching your criteria.
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
