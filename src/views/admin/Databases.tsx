import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';

interface Database {
  id: string;
  name: string;
  publisher: string;
  url: string;
  description: string;
  logo_url: string;
  subject_tags: string;
  is_active: boolean;
  faculty_access: string[];
}

interface AccessRequest {
  id: string;
  database_id: string;
  patron_name: string;
  status: string;
  request_date: string;
}

export default function Databases() {
  const [databases, setDatabases] = useState<Database[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | null>(null);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [formData, setFormData] = useState<Database>({
    id: '',
    name: '',
    publisher: '',
    url: '',
    description: '',
    logo_url: '',
    subject_tags: '',
    is_active: true,
    faculty_access: [],
  });

  useEffect(() => {
    fetchDatabases();
  }, []);

  useEffect(() => {
    if (selectedDatabaseId) {
      fetchAccessRequests(selectedDatabaseId);
    }
  }, [selectedDatabaseId]);

  const fetchDatabases = async () => {
    try {
      const { data, error } = await supabase
        .from('licensed_databases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDatabases(data || []);
    } catch (error) {
      console.error('Error fetching databases:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccessRequests = async (databaseId: string) => {
    try {
      const { data, error } = await supabase
        .from('database_access_requests')
        .select('*')
        .eq('database_id', databaseId)
        .order('request_date', { ascending: false });

      if (error) throw error;
      setAccessRequests(data || []);
    } catch (error) {
      console.error('Error fetching access requests:', error);
    }
  };

  const handleInputChange = (field: keyof Database, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const toggleFacultyAccess = (facultyCode: string) => {
    setFormData((prev) => ({
      ...prev,
      faculty_access: prev.faculty_access.includes(facultyCode)
        ? prev.faculty_access.filter((f) => f !== facultyCode)
        : [...prev.faculty_access, facultyCode],
    }));
  };

  const saveDatabase = async () => {
    if (!formData.name.trim() || !formData.publisher.trim()) {
      alert('Name and publisher are required');
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('licensed_databases')
          .update(formData)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('licensed_databases').insert([formData]);
        if (error) throw error;
      }

      resetForm();
      fetchDatabases();
    } catch (error) {
      console.error('Error saving database:', error);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('licensed_databases')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      fetchDatabases();
    } catch (error) {
      console.error('Error updating database:', error);
    }
  };

  const deleteDatabase = async (id: string) => {
    if (!confirm('Are you sure you want to delete this database?')) return;

    try {
      const { error } = await supabase.from('licensed_databases').delete().eq('id', id);
      if (error) throw error;
      fetchDatabases();
    } catch (error) {
      console.error('Error deleting database:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      publisher: '',
      url: '',
      description: '',
      logo_url: '',
      subject_tags: '',
      is_active: true,
      faculty_access: [],
    });
    setEditingId(null);
    setShowForm(false);
  };

  const editDatabase = (db: Database) => {
    setFormData(db);
    setEditingId(db.id);
    setShowForm(true);
  };

  if (loading) {
    return <div className="p-8">Loading databases...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Licensed Databases</h1>
          <p className="text-gray-600 mt-2">Manage subscriptions and access</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          Add Database
        </button>
      </div>

      {!showForm && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="text-left p-3 font-semibold">Name</th>
                <th className="text-left p-3 font-semibold">Publisher</th>
                <th className="text-left p-3 font-semibold">Subject Tags</th>
                <th className="text-left p-3 font-semibold">Faculties</th>
                <th className="text-left p-3 font-semibold">Status</th>
                <th className="text-left p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {databases.map((db) => (
                <tr key={db.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{db.name}</td>
                  <td className="p-3">{db.publisher}</td>
                  <td className="p-3">
                    <div className="flex gap-1 flex-wrap">
                      {db.subject_tags.split(',').slice(0, 2).map((tag, idx) => (
                        <span key={idx} className="badge badge-secondary text-xs">
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-xs">{db.faculty_access.length} faculties</td>
                  <td className="p-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={db.is_active}
                        onChange={() => toggleActive(db.id, db.is_active)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600" />
                    </label>
                  </td>
                  <td className="p-3 space-y-1">
                    <button
                      onClick={() => {
                        editDatabase(db);
                        setSelectedDatabaseId(null);
                      }}
                      className="btn-outline text-xs py-1 px-2 block"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setSelectedDatabaseId(db.id)}
                      className="btn-outline text-xs py-1 px-2 block"
                    >
                      Requests
                    </button>
                    <button
                      onClick={() => deleteDatabase(db.id)}
                      className="btn-outline text-red-600 text-xs py-1 px-2 block"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {databases.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>No databases registered yet</p>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="card">
          <h2 className="text-2xl font-semibold mb-6">
            {editingId ? 'Edit Database' : 'Add New Database'}
          </h2>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label">Name</label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Database name"
                />
              </div>

              <div>
                <label className="label">Publisher</label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.publisher}
                  onChange={(e) => handleInputChange('publisher', e.target.value)}
                  placeholder="Publisher name"
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">URL</label>
                <input
                  type="url"
                  className="input w-full"
                  value={formData.url}
                  onChange={(e) => handleInputChange('url', e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Description</label>
                <textarea
                  className="input w-full"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Database description and features"
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Logo URL</label>
                <input
                  type="url"
                  className="input w-full"
                  value={formData.logo_url}
                  onChange={(e) => handleInputChange('logo_url', e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Subject Tags (comma-separated)</label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.subject_tags}
                  onChange={(e) => handleInputChange('subject_tags', e.target.value)}
                  placeholder="e.g., Engineering, Science, Arts"
                />
              </div>

              <div className="md:col-span-2">
                <label className="label mb-3 block">Faculty Access</label>
                <div className="space-y-2">
                  {institutionConfig.faculties.map((faculty) => (
                    <label key={faculty.code} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.faculty_access.includes(faculty.code)}
                        onChange={() => toggleFacultyAccess(faculty.code)}
                      />
                      <span className="text-sm">{faculty.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t">
              <button onClick={resetForm} className="btn-ghost flex-1">
                Cancel
              </button>
              <button onClick={saveDatabase} className="btn-primary flex-1">
                {editingId ? 'Update Database' : 'Add Database'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedDatabaseId && !showForm && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Access Requests</h2>
            <button
              onClick={() => setSelectedDatabaseId(null)}
              className="text-2xl font-light hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-semibold">Patron Name</th>
                  <th className="text-left p-3 font-semibold">Request Date</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {accessRequests.map((request) => (
                  <tr key={request.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">{request.patron_name}</td>
                    <td className="p-3">{new Date(request.request_date).toLocaleDateString()}</td>
                    <td className="p-3">
                      <span
                        className={`badge ${
                          request.status === 'approved'
                            ? 'badge-success'
                            : request.status === 'pending'
                            ? 'badge-warning'
                            : 'badge-error'
                        }`}
                      >
                        {request.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {accessRequests.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>No access requests for this database</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
