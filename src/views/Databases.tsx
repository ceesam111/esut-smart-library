import React, { useState, useEffect } from 'react';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';

interface Database {
  id: string;
  name: string;
  publisher: string;
  description: string;
  content_type: string;
  subject_coverage: string[];
  faculties: string[];
  access_url: string | null;
}

export default function Databases() {
  const [databases, setDatabases] = useState<Database[]>([]);
  const [filteredDatabases, setFilteredDatabases] = useState<Database[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState<Database | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    faculty: '',
    department: '',
    purpose: '',
  });

  useEffect(() => {
    fetchDatabases();
  }, []);

  const fetchDatabases = async () => {
    try {
      const { data, error } = await supabase
        .from('licensed_databases')
        .select('*')
        .order('name');

      if (error) throw error;
      setDatabases(data || []);
      setFilteredDatabases(data || []);
    } catch (err) {
      console.error('Error fetching databases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let results = databases;

    if (searchTerm) {
      results = results.filter(
        (db) =>
          db.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          db.publisher.toLowerCase().includes(searchTerm.toLowerCase()) ||
          db.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedSubject) {
      results = results.filter((db) =>
        db.subject_coverage.includes(selectedSubject)
      );
    }

    if (selectedFaculty) {
      results = results.filter((db) => db.faculties.includes(selectedFaculty));
    }

    setFilteredDatabases(results);
  }, [searchTerm, selectedSubject, selectedFaculty, databases]);

  const allSubjects = Array.from(
    new Set(databases.flatMap((db) => db.subject_coverage))
  ).sort();

  const faculties = institutionConfig.faculties.map((f) => f.name);

  const handleRequestAccess = (database: Database) => {
    setSelectedDatabase(database);
    setShowRequestModal(true);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('database_access_requests')
        .insert([
          {
            database_id: selectedDatabase?.id,
            patron_name: formData.name,
            patron_email: formData.email,
            faculty: formData.faculty,
            department: formData.department,
            purpose: formData.purpose,
            status: 'pending',
          },
        ]);

      if (error) throw error;

      setFormData({ name: '', email: '', faculty: '', department: '', purpose: '' });
      setShowRequestModal(false);
      alert('Request submitted successfully!');
    } catch (err) {
      console.error('Error submitting request:', err);
      alert('Error submitting request. Please try again.');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Licensed Databases</h1>
        <p>Access scholarly databases and research resources</p>
      </div>

      <section className="section">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div>
            <label className="label">Search</label>
            <input
              type="text"
              className="input"
              placeholder="Database name or publisher"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Subject Area</label>
            <select
              className="input"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              <option value="">All Subjects</option>
              {allSubjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
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
        </div>

        {loading ? (
          <div className="text-center py-8">Loading databases...</div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-6">
              Showing {filteredDatabases.length} of {databases.length} databases
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredDatabases.map((database) => (
                <div key={database.id} className="card">
                  <h3 className="text-lg font-semibold mb-2">{database.name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{database.publisher}</p>

                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">
                      Content Type
                    </p>
                    <span className="badge badge-secondary">{database.content_type}</span>
                  </div>

                  <p className="text-sm text-gray-700 mb-4">{database.description}</p>

                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 mb-2">
                      Subject Coverage
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {database.subject_coverage.map((subject) => (
                        <span key={subject} className="badge text-xs">
                          {subject}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4 pb-4 border-t">
                    <p className="text-xs font-semibold text-gray-500 mb-2">
                      For Faculties
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {database.faculties.map((faculty) => (
                        <span key={faculty} className="badge badge-primary text-xs">
                          {faculty}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {database.access_url && (
                      <a
                        href={database.access_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary flex-1"
                      >
                        Access
                      </a>
                    )}
                    <button
                      onClick={() => handleRequestAccess(database)}
                      className="btn-outline flex-1"
                    >
                      Request Access
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredDatabases.length === 0 && (
              <div className="text-center py-12 text-gray-600">
                No databases found matching your criteria.
              </div>
            )}
          </>
        )}
      </section>

      {showRequestModal && selectedDatabase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-semibold mb-4">
              Request Access: {selectedDatabase.name}
            </h2>

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="label">Faculty</label>
                <select
                  className="input"
                  required
                  value={formData.faculty}
                  onChange={(e) =>
                    setFormData({ ...formData, faculty: e.target.value })
                  }
                >
                  <option value="">Select Faculty</option>
                  {faculties.map((faculty) => (
                    <option key={faculty} value={faculty}>
                      {faculty}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Department</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="label">Purpose of Access</label>
                <textarea
                  className="input"
                  required
                  rows={4}
                  value={formData.purpose}
                  onChange={(e) =>
                    setFormData({ ...formData, purpose: e.target.value })
                  }
                />
              </div>

              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">
                  Submit Request
                </button>
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
