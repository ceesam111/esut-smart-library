import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface ThesisRecord {
  id: string;
  title: string;
  student_name: string;
  degree_programme: string;
  submission_date: string;
  copyleaks_score: number | null;
  status: 'Submitted' | 'Supervisor Review' | 'Faculty Committee' | 'Library Published';
  patron_id: string;
}

interface SelectedThesis extends ThesisRecord {
  supervisor_comments: string | null;
  plagiarism_report_url: string | null;
}

export default function Theses() {
  const navigate = useNavigate();
  const [theses, setTheses] = useState<ThesisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThesis, setSelectedThesis] = useState<SelectedThesis | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackAction, setFeedbackAction] = useState<'approve' | 'return'>('approve');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    const fetchTheses = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          navigate('/login');
          return;
        }

        const { data: thesesData, error } = await supabase
          .from('theses')
          .select('*')
          .eq('supervisor_email', userData.user.email)
          .order('submission_date', { ascending: false });

        if (error) throw error;

        setTheses(thesesData || []);
      } catch (error) {
        console.error('Error fetching theses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTheses();
  }, [navigate]);

  const handleSelectThesis = async (thesis: ThesisRecord) => {
    try {
      const { data: fullThesis, error } = await supabase
        .from('theses')
        .select('*')
        .eq('id', thesis.id)
        .single();

      if (error) throw error;

      setSelectedThesis(fullThesis);
    } catch (error) {
      console.error('Error fetching thesis details:', error);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!selectedThesis || !feedbackText.trim()) return;

    setSubmittingFeedback(true);
    try {
      const newStatus =
        feedbackAction === 'approve' ? 'Faculty Committee' : 'Submitted';

      const { error } = await supabase
        .from('theses')
        .update({
          status: newStatus,
          supervisor_comments: feedbackText,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedThesis.id);

      if (error) throw error;

      setTheses(
        theses.map((thesis) =>
          thesis.id === selectedThesis.id
            ? { ...thesis, status: newStatus as any }
            : thesis
        )
      );

      setSelectedThesis(null);
      setShowFeedbackModal(false);
      setFeedbackText('');
      setFeedbackAction('approve');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const getSimilarityBadgeColor = (score: number | null) => {
    if (!score) return 'bg-gray-100 text-gray-700';
    if (score < 10) return 'badge-success';
    if (score < 20) return 'badge-warning';
    return 'badge-error';
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Submitted':
        return 'badge-warning';
      case 'Supervisor Review':
        return 'badge-primary';
      case 'Faculty Committee':
        return 'badge-secondary';
      case 'Library Published':
        return 'badge-success';
      default:
        return 'badge-secondary';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading theses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">
            Thesis Review Portal
          </h1>
          <p className="text-gray-600 mt-2">
            Review and provide feedback on student theses
          </p>
        </div>

        {selectedThesis ? (
          <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto z-50">
            <div className="min-h-screen flex items-start justify-end">
              <div className="w-full max-w-2xl bg-white h-screen overflow-y-auto shadow-lg">
                <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedThesis.title}
                    </h2>
                    <p className="text-gray-600 mt-1">
                      by {selectedThesis.student_name}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedThesis(null)}
                    className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-primary-50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 font-medium mb-1">
                        Degree Programme
                      </div>
                      <div className="font-semibold text-gray-900">
                        {selectedThesis.degree_programme}
                      </div>
                    </div>

                    <div className="bg-purple-50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 font-medium mb-1">
                        Submission Date
                      </div>
                      <div className="font-semibold text-gray-900">
                        {new Date(
                          selectedThesis.submission_date
                        ).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 font-medium mb-1">
                        Current Status
                      </div>
                      <div>
                        <span
                          className={`badge ${getStatusBadgeColor(
                            selectedThesis.status
                          )} px-3 py-1 rounded-full text-xs font-semibold`}
                        >
                          {selectedThesis.status}
                        </span>
                      </div>
                    </div>

                    {selectedThesis.copyleaks_score !== null && (
                      <div className="bg-orange-50 rounded-lg p-4">
                        <div className="text-sm text-gray-600 font-medium mb-1">
                          Similarity Score
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold text-gray-900">
                            {selectedThesis.copyleaks_score}%
                          </span>
                          <span
                            className={`badge ${getSimilarityBadgeColor(
                              selectedThesis.copyleaks_score
                            )} px-2 py-1 rounded text-xs font-semibold`}
                          >
                            {selectedThesis.copyleaks_score < 10
                              ? 'Low'
                              : selectedThesis.copyleaks_score < 20
                                ? 'Moderate'
                                : 'High'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedThesis.supervisor_comments && (
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                      <h3 className="font-bold text-gray-900 mb-2">
                        Previous Feedback
                      </h3>
                      <p className="text-gray-700 text-sm">
                        {selectedThesis.supervisor_comments}
                      </p>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="font-bold text-gray-900 mb-4">
                      Plagiarism Report
                    </h3>
                    {selectedThesis.plagiarism_report_url ? (
                      <a
                        href={selectedThesis.plagiarism_report_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-outline block text-center px-4 py-2 rounded font-semibold"
                      >
                        View Full Copyleaks Report
                      </a>
                    ) : (
                      <p className="text-gray-600">
                        Plagiarism report not yet available
                      </p>
                    )}
                  </div>

                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="font-bold text-gray-900 mb-4">
                      Thesis Document
                    </h3>
                    <a
                      href={`/thesis/${selectedThesis.id}/download`}
                      className="btn-primary block text-center px-4 py-2 rounded font-semibold"
                    >
                      Download PDF
                    </a>
                  </div>

                  {selectedThesis.status === 'Supervisor Review' && (
                    <div className="border-t border-gray-200 pt-6 space-y-4">
                      <button
                        onClick={() => {
                          setShowFeedbackModal(true);
                          setFeedbackAction('approve');
                        }}
                        className="btn-primary w-full px-4 py-3 rounded font-semibold"
                      >
                        Approve Thesis
                      </button>
                      <button
                        onClick={() => {
                          setShowFeedbackModal(true);
                          setFeedbackAction('return');
                        }}
                        className="btn-outline w-full px-4 py-3 rounded font-semibold text-red-600 border-red-600"
                      >
                        Return for Revisions
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showFeedbackModal && selectedThesis && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
            <div className="card bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {feedbackAction === 'approve'
                  ? 'Approve Thesis'
                  : 'Return for Revisions'}
              </h2>

              <div className="mb-4">
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  Feedback (optional)
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder={
                    feedbackAction === 'approve'
                      ? 'Optional: Add approval notes'
                      : 'Required: Explain what needs revision'
                  }
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 resize-none"
                  rows={4}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowFeedbackModal(false);
                    setFeedbackText('');
                  }}
                  className="btn-outline flex-1 px-4 py-2 rounded font-semibold"
                  disabled={submittingFeedback}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitFeedback}
                  className={`flex-1 px-4 py-2 rounded font-semibold disabled:opacity-50 ${
                    feedbackAction === 'approve'
                      ? 'btn-primary'
                      : 'btn-outline text-red-600 border-red-600'
                  }`}
                  disabled={
                    submittingFeedback ||
                    (feedbackAction === 'return' && !feedbackText.trim())
                  }
                >
                  {submittingFeedback ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="card bg-white rounded-lg shadow overflow-hidden">
          {theses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Student
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Thesis Title
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Degree
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Submitted
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Similarity
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {theses.map((thesis) => (
                    <tr
                      key={thesis.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {thesis.student_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {thesis.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {thesis.degree_programme}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(thesis.submission_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {thesis.copyleaks_score !== null ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {thesis.copyleaks_score}%
                            </span>
                            <span
                              className={`badge ${getSimilarityBadgeColor(
                                thesis.copyleaks_score
                              )} px-2 py-1 rounded text-xs font-semibold`}
                            >
                              {thesis.copyleaks_score < 10
                                ? 'Low'
                                : thesis.copyleaks_score < 20
                                  ? 'Mod'
                                  : 'High'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`badge ${getStatusBadgeColor(
                            thesis.status
                          )} px-3 py-1 rounded-full text-xs font-semibold`}
                        >
                          {thesis.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleSelectThesis(thesis)}
                          className="btn-primary px-3 py-1 rounded text-sm font-semibold"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="mb-4 text-5xl">📚</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Theses to Review
              </h3>
              <p className="text-gray-600">
                You don't have any student theses assigned for review yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
