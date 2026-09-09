import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';

interface ResearcherProfile {
  id: string;
  slug: string;
  name: string;
  rank: string;
  faculty: string;
  department: string;
  photo_url: string;
  email: string;
  bio: string;
  orcid: string | null;
  scholar_id: string | null;
  scopus_id: string | null;
  h_index: number;
  total_citations: number;
  publications: Array<{
    id: string;
    title: string;
    authors: string;
    year: number;
    journal: string;
    doi: string | null;
  }>;
  grants: Array<{
    id: string;
    title: string;
    amount: number;
    year_start: number;
    year_end: number;
  }>;
  teaching: Array<{
    id: string;
    course_name: string;
    code: string;
    semester: string;
    level: string;
  }>;
}

export default function ResearcherProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [researcher, setResearcher] = useState<ResearcherProfile | null>(null);
  const [activeTab, setActiveTab] = useState('biography');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResearcher();
  }, [slug]);

  const fetchResearcher = async () => {
    try {
      const { data: profileData, error } = await supabase
        .from('researcher_profiles')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'approved')
        .single();

      if (error) throw error;

      const { data: pubData } = await supabase
        .from('researcher_publications')
        .select('*')
        .eq('researcher_id', profileData.id)
        .order('year', { ascending: false });

      const { data: grantData } = await supabase
        .from('researcher_grants')
        .select('*')
        .eq('researcher_id', profileData.id)
        .order('year_start', { ascending: false });

      const { data: teachData } = await supabase
        .from('researcher_teaching')
        .select('*')
        .eq('researcher_id', profileData.id);

      setResearcher({
        ...profileData,
        publications: pubData || [],
        grants: grantData || [],
        teaching: teachData || [],
      });
    } catch (err) {
      console.error('Error fetching researcher:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="page"><div className="text-center py-8">Loading profile...</div></div>;
  }

  if (!researcher) {
    return <div className="page"><div className="text-center py-8">Researcher not found.</div></div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>{researcher.name}</h1>
        <p>{researcher.rank} | {researcher.department}</p>
      </div>

      <section className="section">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="card">
              <div className="flex flex-col items-center text-center">
                <img
                  src={researcher.photo_url}
                  alt={researcher.name}
                  className="w-32 h-32 rounded-full mb-4 object-cover"
                />
                <h2 className="text-xl font-semibold mb-2">{researcher.name}</h2>
                <div className="badge badge-primary mb-3">{researcher.rank}</div>
                <p className="text-sm text-gray-600 mb-1">{researcher.department}</p>
                <p className="text-sm text-gray-600 mb-4">{researcher.faculty}</p>
                <p className="text-sm text-gray-600 mb-4">{institutionConfig.name}</p>

                <a
                  href={`mailto:${researcher.email}`}
                  className="btn-primary w-full mb-3"
                >
                  Contact
                </a>

                <div className="w-full border-t pt-4 mt-4">
                  <h4 className="font-semibold text-sm mb-3">Research Identifiers</h4>
                  <div className="space-y-2">
                    {researcher.orcid && (
                      <a
                        href={`https://orcid.org/${researcher.orcid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-sm text-primary-600 hover:underline"
                      >
                        <span className="badge badge-secondary mr-2">ORCID</span>
                        {researcher.orcid}
                      </a>
                    )}
                    {researcher.scholar_id && (
                      <a
                        href={`https://scholar.google.com/citations?user=${researcher.scholar_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-sm text-primary-600 hover:underline"
                      >
                        <span className="badge badge-secondary mr-2">Google Scholar</span>
                      </a>
                    )}
                    {researcher.scopus_id && (
                      <a
                        href={`https://www.scopus.com/authid/detail.uri?authorId=${researcher.scopus_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-sm text-primary-600 hover:underline"
                      >
                        <span className="badge badge-secondary mr-2">Scopus</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="w-full border-t pt-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-500 text-xs mb-1">H-Index</p>
                      <p className="text-2xl font-bold">{researcher.h_index}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs mb-1">Citations</p>
                      <p className="text-2xl font-bold">{researcher.total_citations}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="tabs mb-6 flex border-b gap-4">
              {['biography', 'publications', 'grants', 'teaching'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-2 px-1 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {activeTab === 'biography' && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">About</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{researcher.bio}</p>
              </div>
            )}

            {activeTab === 'publications' && (
              <div className="space-y-4">
                {researcher.publications.length === 0 ? (
                  <p className="text-gray-600">No publications listed.</p>
                ) : (
                  researcher.publications.map((pub) => (
                    <div key={pub.id} className="card">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h4 className="font-semibold mb-2">{pub.title}</h4>
                          <p className="text-sm text-gray-600 mb-2">{pub.authors}</p>
                          <p className="text-sm text-gray-600">
                            <span className="italic">{pub.journal}</span> ({pub.year})
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="badge">{pub.year}</span>
                          {pub.doi && (
                            <a
                              href={`https://doi.org/${pub.doi}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-outline text-xs"
                            >
                              DOI
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'grants' && (
              <div className="space-y-4">
                {researcher.grants.length === 0 ? (
                  <p className="text-gray-600">No grants listed.</p>
                ) : (
                  researcher.grants.map((grant) => (
                    <div key={grant.id} className="card">
                      <h4 className="font-semibold mb-2">{grant.title}</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Amount</p>
                          <p className="font-semibold">${grant.amount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Start Year</p>
                          <p className="font-semibold">{grant.year_start}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">End Year</p>
                          <p className="font-semibold">{grant.year_end}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'teaching' && (
              <div className="space-y-4">
                {researcher.teaching.length === 0 ? (
                  <p className="text-gray-600">No teaching assignments listed.</p>
                ) : (
                  researcher.teaching.map((course) => (
                    <div key={course.id} className="card">
                      <h4 className="font-semibold mb-2">{course.course_name}</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Code</p>
                          <p className="font-semibold">{course.code}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Level</p>
                          <p className="font-semibold">{course.level}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Semester</p>
                          <p className="font-semibold">{course.semester}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
