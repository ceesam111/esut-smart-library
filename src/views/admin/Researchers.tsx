import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ResearcherProfile {
  id: string;
  name: string;
  faculty: string;
  orcid: string;
  h_index: number;
  status: string;
  submission_date: string;
  bio: string;
  research_areas: string;
}

export default function Researchers() {
  const [researchers, setResearchers] = useState<ResearcherProfile[]>([]);
  const [filteredResearchers, setFilteredResearchers] = useState<ResearcherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResearcher, setSelectedResearcher] = useState<ResearcherProfile | null>(null);
  const [slideOpen, setSlideOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);

  useEffect(() => {
    fetchResearchers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [researchers, filterStatus]);

  const fetchResearchers = async () => {
    try {
      const { data, error } = await supabase
        .from('researcher_profiles')
        .select('*')
        .order('submission_date', { ascending: false });

      if (error) throw error;
      setResearchers(data || []);
    } catch (error) {
      console.error('Error fetching researchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = researchers;

    if (filterStatus) {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }

    setFilteredResearchers(filtered);
  };

  const viewResearcher = (researcher: ResearcherProfile) => {
    setSelectedResearcher(researcher);
    setSlideOpen(true);
    setShowReturnForm(false);
    setReturnNotes('');
  };

  const approveResearcher = async () => {
    if (!selectedResearcher) return;

    try {
      const { error } = await supabase
        .from('researcher_profiles')
        .update({ status: 'approved' })
        .eq('id', selectedResearcher.id);

      if (error) throw error;

      setSlideOpen(false);
      fetchResearchers();
    } catch (error) {
      console.error('Error approving researcher:', error);
    }
  };

  const returnResearcher = async () => {
    if (!selectedResearcher) return;

    try {
      const { error } = await supabase
        .from('researcher_profiles')
        .update({ status: 'revision_requested', revision_notes: returnNotes })
        .eq('id', selectedResearcher.id);

      if (error) throw error;

      setSlideOpen(false);
      fetchResearchers();
    } catch (error) {
      console.error('Error returning researcher profile:', error);
    }
  };

  if (loading) {
    return <div className="p-8">Loading researcher profiles...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Researcher Profile Review</h1>
        <p className="text-gray-600 mt-2">Approve and manage researcher profiles</p>
      </div>

      <div className="card">
        <label className="label">Filter by Status</label>
        <select
          className="input w-full md:w-48"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="pending">Pending Review</option>
          <option value="revision_requested">Revision Requested</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="text-left p-3 font-semibold">Name</th>
              <th className="text-left p-3 font-semibold">Faculty</th>
              <th className="text-left p-3 font-semibold">ORCID</th>
              <th className="text-left p-3 font-semibold">H-Index</th>
              <th className="text-left p-3 font-semibold">Submitted</th>
              <th className="text-left p-3 font-semibold">Status</th>
              <th className="text-left p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredResearchers.map((researcher) => (
              <tr key={researcher.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{researcher.name}</td>
                <td className="p-3">{researcher.faculty}</td>
                <td className="p-3">
                  {researcher.orcid ? (
                    <a
                      href={`https://orcid.org/${researcher.orcid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="badge badge-secondary"
                    >
                      {researcher.orcid}
                    </a>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </td>
                <td className="p-3">{researcher.h_index || '—'}</td>
                <td className="p-3">{new Date(researcher.submission_date).toLocaleDateString()}</td>
                <td className="p-3">
                  <span
                    className={`badge ${
                      researcher.status === 'pending'
                        ? 'badge-warning'
                        : researcher.status === 'revision_requested'
                        ? 'badge-primary'
                        : researcher.status === 'approved'
                        ? 'badge-success'
                        : 'badge-error'
                    }`}
                  >
                    {researcher.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => viewResearcher(researcher)}
                    className="btn-outline text-xs py-1 px-2"
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredResearchers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No researcher profiles found</p>
          </div>
        )}
      </div>

      {slideOpen && selectedResearcher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-50">
          <div className="bg-white w-full max-w-2xl overflow-y-auto animate-slide-in">
            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold">{selectedResearcher.name}</h2>
              <button
                onClick={() => setSlideOpen(false)}
                className="text-2xl font-light hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Faculty</label>
                  <p className="text-gray-800">{selectedResearcher.faculty}</p>
                </div>
                <div>
                  <label className="label">Status</label>
                  <span
                    className={`badge ${
                      selectedResearcher.status === 'pending'
                        ? 'badge-warning'
                        : selectedResearcher.status === 'revision_requested'
                        ? 'badge-primary'
                        : selectedResearcher.status === 'approved'
                        ? 'badge-success'
                        : 'badge-error'
                    }`}
                  >
                    {selectedResearcher.status.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <label className="label">ORCID</label>
                  <p className="text-gray-800">{selectedResearcher.orcid || '—'}</p>
                </div>
                <div>
                  <label className="label">H-Index</label>
                  <p className="text-gray-800">{selectedResearcher.h_index || '—'}</p>
                </div>
              </div>

              <div>
                <label className="label">Research Areas</label>
                <p className="text-gray-700">{selectedResearcher.research_areas}</p>
              </div>

              <div>
                <label className="label">Biography</label>
                <p className="text-gray-700 leading-relaxed">{selectedResearcher.bio}</p>
              </div>

              <div className="border-t pt-6">
                <label className="label">Submission Date</label>
                <p className="text-gray-700">
                  {new Date(selectedResearcher.submission_date).toLocaleString()}
                </p>
              </div>

              <div className="border-t pt-6 space-y-3">
                {!showReturnForm ? (
                  <>
                    <button
                      onClick={approveResearcher}
                      className="btn-primary w-full"
                    >
                      Approve Profile
                    </button>
                    <button
                      onClick={() => setShowReturnForm(true)}
                      className="btn-outline w-full"
                    >
                      Return for Revision
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="label">Revision Notes</label>
                      <textarea
                        className="input w-full"
                        rows={4}
                        placeholder="Provide feedback for the researcher..."
                        value={returnNotes}
                        onChange={(e) => setReturnNotes(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowReturnForm(false)}
                        className="btn-ghost flex-1"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={returnResearcher}
                        className="btn-outline flex-1"
                      >
                        Send Feedback
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
