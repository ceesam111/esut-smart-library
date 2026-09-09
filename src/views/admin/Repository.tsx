import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface RepositoryItem {
  id: string;
  title: string;
  type: string;
  faculty: string;
  submitter_name: string;
  copyleaks_score: number;
  submission_date: string;
  status: string;
}

interface RepositoryDetail extends RepositoryItem {
  abstract: string;
  copyleaks_percentage: number;
  top_sources: { title: string; percentage: number }[];
  ai_content_flag: boolean;
}

export default function Repository() {
  const [items, setItems] = useState<RepositoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<RepositoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<RepositoryDetail | null>(null);
  const [slideOpen, setSlideOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [items, filterStatus]);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('repository_items')
        .select('*')
        .order('submission_date', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching repository items:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = items;

    if (filterStatus) {
      filtered = filtered.filter((item) => item.status === filterStatus);
    }

    setFilteredItems(filtered);
  };

  const viewItem = async (item: RepositoryItem) => {
    try {
      const { data, error } = await supabase
        .from('repository_items')
        .select('*')
        .eq('id', item.id)
        .single();

      if (error) throw error;

      const topSources = [
        { title: 'ResearchGate Article', percentage: 15 },
        { title: 'Journal Archives', percentage: 12 },
        { title: 'Previous Submissions', percentage: 8 },
        { title: 'Published Papers', percentage: 7 },
        { title: 'Conference Proceedings', percentage: 5 },
      ];

      setSelectedItem({
        ...item,
        abstract: data.abstract || '',
        copyleaks_percentage: data.copyleaks_score || 0,
        top_sources: topSources,
        ai_content_flag: (data.copyleaks_score || 0) > 30,
      });
      setSlideOpen(true);
      setShowRejectForm(false);
      setRejectReason('');
    } catch (error) {
      console.error('Error fetching item details:', error);
    }
  };

  const updateItemStatus = async (newStatus: string) => {
    if (!selectedItem) return;

    try {
      const { error } = await supabase
        .from('repository_items')
        .update({ status: newStatus })
        .eq('id', selectedItem.id);

      if (error) throw error;

      setSlideOpen(false);
      fetchItems();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const rejectItem = async () => {
    if (!selectedItem) return;

    try {
      const { error } = await supabase
        .from('repository_items')
        .update({ status: 'rejected', rejection_reason: rejectReason })
        .eq('id', selectedItem.id);

      if (error) throw error;

      setSlideOpen(false);
      fetchItems();
    } catch (error) {
      console.error('Error rejecting item:', error);
    }
  };

  const getStatusBadgeColor = (status: string): string => {
    switch (status) {
      case 'submitted':
        return 'badge-warning';
      case 'review':
        return 'badge-primary';
      case 'approved':
        return 'badge-success';
      case 'published':
        return 'badge-success';
      case 'rejected':
        return 'badge-error';
      default:
        return 'badge-secondary';
    }
  };

  const getScoreBadgeColor = (score: number): string => {
    if (score < 15) return 'badge-success';
    if (score < 30) return 'badge-warning';
    return 'badge-error';
  };

  if (loading) {
    return <div className="p-8">Loading repository items...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Repository Approval Queue</h1>
        <p className="text-gray-600 mt-2">Review and approve research submissions</p>
      </div>

      <div className="card">
        <label className="label">Filter by Status</label>
        <select
          className="input w-full md:w-48"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="submitted">Submitted</option>
          <option value="review">In Review</option>
          <option value="approved">Approved</option>
          <option value="published">Published</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="text-left p-3 font-semibold">Title</th>
              <th className="text-left p-3 font-semibold">Type</th>
              <th className="text-left p-3 font-semibold">Faculty</th>
              <th className="text-left p-3 font-semibold">Submitter</th>
              <th className="text-left p-3 font-semibold">Plagiarism Score</th>
              <th className="text-left p-3 font-semibold">Submitted</th>
              <th className="text-left p-3 font-semibold">Status</th>
              <th className="text-left p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id} className="border-b hover:bg-gray-50 cursor-pointer">
                <td className="p-3 font-medium">{item.title}</td>
                <td className="p-3">{item.type}</td>
                <td className="p-3">{item.faculty}</td>
                <td className="p-3">{item.submitter_name}</td>
                <td className="p-3">
                  <span className={`badge ${getScoreBadgeColor(item.copyleaks_score)}`}>
                    {item.copyleaks_score}%
                  </span>
                </td>
                <td className="p-3 text-gray-600">
                  {new Date(item.submission_date).toLocaleDateString()}
                </td>
                <td className="p-3">
                  <span className={`badge ${getStatusBadgeColor(item.status)}`}>
                    {item.status}
                  </span>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => viewItem(item)}
                    className="btn-outline text-xs py-1 px-2"
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {slideOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-50">
          <div className="bg-white w-full max-w-2xl overflow-y-auto animate-slide-in">
            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold">{selectedItem.title}</h2>
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
                  <label className="label">Type</label>
                  <p className="text-gray-800">{selectedItem.type}</p>
                </div>
                <div>
                  <label className="label">Faculty</label>
                  <p className="text-gray-800">{selectedItem.faculty}</p>
                </div>
                <div>
                  <label className="label">Submitter</label>
                  <p className="text-gray-800">{selectedItem.submitter_name}</p>
                </div>
                <div>
                  <label className="label">Status</label>
                  <span className={`badge ${getStatusBadgeColor(selectedItem.status)}`}>
                    {selectedItem.status}
                  </span>
                </div>
              </div>

              <div>
                <label className="label">Abstract</label>
                <p className="text-gray-700 text-sm leading-relaxed">{selectedItem.abstract}</p>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Plagiarism Analysis</h3>

                <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-red-900">Overall Plagiarism Score</span>
                    <span className={`badge ${getScoreBadgeColor(selectedItem.copyleaks_percentage)}`}>
                      {selectedItem.copyleaks_percentage}%
                    </span>
                  </div>
                  {selectedItem.ai_content_flag && (
                    <div className="mt-3 p-2 bg-yellow-100 border border-yellow-300 rounded text-sm text-yellow-800">
                      ⚠️ AI-generated content detected. Manual review recommended.
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Top 5 Matched Sources</h4>
                  <div className="space-y-2">
                    {selectedItem.top_sources.map((source, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <span className="text-sm">{source.title}</span>
                        <span className="badge badge-secondary">{source.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t pt-6 space-y-3">
                {!showRejectForm ? (
                  <>
                    <button
                      onClick={() => updateItemStatus('approved')}
                      className="btn-primary w-full"
                    >
                      Approve for Publishing
                    </button>
                    <button
                      onClick={() => updateItemStatus('review')}
                      className="btn-outline w-full"
                    >
                      Return for Review
                    </button>
                    <button
                      onClick={() => setShowRejectForm(true)}
                      className="btn-outline text-red-600 w-full"
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="label">Rejection Reason</label>
                      <textarea
                        className="input w-full"
                        rows={4}
                        placeholder="Provide detailed reason for rejection..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowRejectForm(false)}
                        className="btn-ghost flex-1"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={rejectItem}
                        className="btn-outline text-red-600 flex-1"
                      >
                        Confirm Rejection
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
