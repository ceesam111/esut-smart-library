import React, { useState } from 'react';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';

interface ThesisRecord {
  id: string;
  title: string;
  status: string;
  created_at: string;
  supervisor_notes: string | null;
  committee_notes: string | null;
}

export default function ThesisStatusPublic() {
  const [searchType, setSearchType] = useState<'id' | 'email'>('id');
  const [searchValue, setSearchValue] = useState('');
  const [thesis, setThesis] = useState<ThesisRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchValue.trim()) {
      setError('Please enter a search value.');
      return;
    }

    setLoading(true);
    setError('');
    setThesis(null);

    try {
      let query = supabase.from('theses').select('*');

      if (searchType === 'id') {
        query = query.eq('id', searchValue);
      } else {
        query = query.eq('submitted_email', searchValue);
      }

      const { data, error: queryError } = await query.single();

      if (queryError) {
        if (queryError.code === 'PGRST116') {
          setError('No thesis found with the provided information.');
        } else {
          throw queryError;
        }
      } else {
        setThesis(data);
      }
    } catch (err) {
      console.error('Error searching for thesis:', err);
      setError('Error searching for thesis. Please try again.');
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-yellow-100 text-yellow-800';
      case 'supervisor_review':
        return 'bg-primary-100 text-primary-800';
      case 'faculty_committee':
        return 'bg-purple-100 text-purple-800';
      case 'published':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'Submitted';
      case 'supervisor_review':
        return 'Supervisor Review';
      case 'faculty_committee':
        return 'Faculty Committee';
      case 'published':
        return 'Published';
      default:
        return 'Unknown';
    }
  };

  const stages = [
    { id: 'submitted', label: 'Submitted', description: 'Initial submission received' },
    {
      id: 'supervisor_review',
      label: 'Supervisor Review',
      description: 'Under supervisor review',
    },
    {
      id: 'faculty_committee',
      label: 'Faculty Committee',
      description: 'Faculty committee review',
    },
    { id: 'published', label: 'Published', description: 'Thesis published' },
  ];

  const currentStageIndex = thesis ? stages.findIndex((s) => s.id === thesis.status) : -1;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Thesis Status Tracker</h1>
        <p>Check the status of your submitted thesis</p>
      </div>

      <section className="section max-w-2xl mx-auto">
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-6">Search for Your Thesis</h2>

          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="label">Search By</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="id"
                    checked={searchType === 'id'}
                    onChange={(e) => setSearchType(e.target.value as 'id' | 'email')}
                  />
                  <span>Thesis ID</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="email"
                    checked={searchType === 'email'}
                    onChange={(e) => setSearchType(e.target.value as 'id' | 'email')}
                  />
                  <span>Email Address</span>
                </label>
              </div>
            </div>

            <div>
              <label className="label">
                {searchType === 'id' ? 'Thesis ID' : 'Email Address'}
              </label>
              <input
                type={searchType === 'id' ? 'text' : 'email'}
                className="input"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={
                  searchType === 'id' ? 'Enter thesis ID' : 'Enter your email address'
                }
              />
            </div>

            {error && (
              <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        {searched && !thesis && !loading && !error && (
          <div className="text-center py-8 text-gray-600">
            No thesis found. Please check your details and try again.
          </div>
        )}

        {thesis && (
          <div className="space-y-8">
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">{thesis.title}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Thesis ID</p>
                  <p className="font-semibold">{thesis.id}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Submission Date</p>
                  <p className="font-semibold">
                    {new Date(thesis.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-gray-500 mb-1">Current Status</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(
                      thesis.status
                    )}`}
                  >
                    {getStatusLabel(thesis.status)}
                  </span>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold mb-6">Submission Timeline</h3>

              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-300" />

                <div className="space-y-8">
                  {stages.map((stage, index) => {
                    const isActive = index === currentStageIndex;
                    const isCompleted = index < currentStageIndex;
                    const isFuture = index > currentStageIndex;

                    return (
                      <div key={stage.id} className="relative pl-16">
                        <div
                          className={`absolute left-0 top-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                            isCompleted
                              ? 'bg-green-500'
                              : isActive
                                ? 'bg-primary-600'
                                : 'bg-gray-300'
                          }`}
                        >
                          {isCompleted ? '✓' : index + 1}
                        </div>

                        <div className={isFuture ? 'opacity-50' : ''}>
                          <h4 className="font-semibold">{stage.label}</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {stage.description}
                          </p>

                          {isActive && (
                            <div className="mt-3 p-3 bg-primary-50 border border-primary-200 rounded text-sm">
                              <p className="font-semibold text-primary-900 mb-2">
                                Currently at this stage
                              </p>
                              {stage.id === 'supervisor_review' && thesis.supervisor_notes && (
                                <p className="text-primary-800">
                                  Supervisor notes: {thesis.supervisor_notes}
                                </p>
                              )}
                              {stage.id === 'faculty_committee' && thesis.committee_notes && (
                                <p className="text-primary-800">
                                  Committee notes: {thesis.committee_notes}
                                </p>
                              )}
                              {!thesis.supervisor_notes && !thesis.committee_notes && (
                                <p className="text-primary-800">
                                  Your submission is being processed. You will be notified
                                  when it moves to the next stage.
                                </p>
                              )}
                            </div>
                          )}

                          {isCompleted && (
                            <div className="mt-3 text-sm text-green-700">
                              ✓ Completed
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {thesis.status === 'published' && (
              <div className="card bg-green-50 border border-green-200">
                <h3 className="text-lg font-semibold text-green-900 mb-3">
                  Congratulations!
                </h3>
                <p className="text-green-800 mb-4">
                  Your thesis has been successfully published in the institutional
                  repository. It is now accessible to researchers worldwide.
                </p>
                <a
                  href={`/thesis/${thesis.id}`}
                  className="btn-primary inline-block"
                >
                  View Published Thesis
                </a>
              </div>
            )}

            {thesis.status !== 'published' && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-3">Next Steps</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  {thesis.status === 'submitted' && (
                    <>
                      <li>✓ Your thesis has been received</li>
                      <li>→ Awaiting supervisor review (typically 1-2 weeks)</li>
                      <li>→ You will be notified via email when status changes</li>
                    </>
                  )}
                  {thesis.status === 'supervisor_review' && (
                    <>
                      <li>✓ Under supervisor review</li>
                      <li>→ Awaiting faculty committee review</li>
                      <li>→ You may receive feedback from your supervisor</li>
                    </>
                  )}
                  {thesis.status === 'faculty_committee' && (
                    <>
                      <li>✓ Under faculty committee review</li>
                      <li>→ Final approval stage (typically 2-3 weeks)</li>
                      <li>→ Thesis will be published upon approval</li>
                    </>
                  )}
                </ul>

                <div className="mt-4 p-3 bg-primary-50 rounded text-sm">
                  <p className="text-primary-900">
                    For inquiries, contact the library at{' '}
                    <a
                      href={`mailto:library@${institutionConfig.shortName}.edu`}
                      className="font-semibold hover:underline"
                    >
                      library@{institutionConfig.shortName}.edu
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
