import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface Thesis {
  id: string;
  title: string;
  degree_programme: string;
  submission_date: string;
  status: 'Submitted' | 'Supervisor Review' | 'Faculty Committee' | 'Library Published';
  copyleaks_score: number | null;
  supervisor_comments: string | null;
  current_stage: number;
}

const stages = [
  { stage: 1, label: 'Submitted', icon: '📝' },
  { stage: 2, label: 'Supervisor Review', icon: '👁' },
  { stage: 3, label: 'Faculty Committee', icon: '🏛' },
  { stage: 4, label: 'Library Published', icon: '📚' },
];

export default function DashboardThesis() {
  const navigate = useNavigate();
  const [thesis, setThesis] = useState<Thesis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchThesis = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          navigate('/login');
          return;
        }

        const { data: patronData, error: patronError } = await supabase
          .from('patrons')
          .select('id')
          .eq('user_id', userData.user.id)
          .single();

        if (patronError) throw patronError;

        const { data: thesisData, error: thesisError } = await supabase
          .from('theses')
          .select('*')
          .eq('patron_id', patronData.id)
          .order('submission_date', { ascending: false })
          .limit(1)
          .single();

        if (thesisError && thesisError.code !== 'PGRST116') throw thesisError;

        if (thesisData) {
          setThesis(thesisData);
        }
      } catch (error) {
        console.error('Error fetching thesis:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchThesis();
  }, [navigate]);

  const getSimilarityBadgeColor = (score: number | null) => {
    if (!score) return 'bg-gray-100 text-gray-700';
    if (score < 10) return 'bg-green-100 text-green-700';
    if (score < 20) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading thesis information...</p>
        </div>
      </div>
    );
  }

  if (!thesis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Thesis Status</h1>

          <div className="card bg-white rounded-lg shadow p-12 text-center">
            <div className="mb-4 text-5xl">📚</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Thesis Submitted Yet
            </h3>
            <p className="text-gray-600 mb-6">
              Once you submit your thesis, you can track its progress through
              each stage of the review process.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <a
                href="/thesis/submit"
                className="btn-primary px-6 py-2 rounded font-semibold"
              >
                Submit Thesis
              </a>
              <a
                href="/dashboard"
                className="btn-outline px-6 py-2 rounded font-semibold"
              >
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const progressPercentage = (thesis.current_stage / 4) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <a href="/dashboard" className="text-primary-700 hover:underline font-semibold mb-6 block">
          ← Back to Dashboard
        </a>

        <div className="card bg-white rounded-lg shadow p-8 mb-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {thesis.title}
            </h1>
            <p className="text-gray-600">
              {thesis.degree_programme} — Submitted{' '}
              {new Date(thesis.submission_date).toLocaleDateString()}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-8 pb-8 border-b border-gray-200">
            <div className="bg-primary-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 font-medium mb-1">
                Submission Date
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {new Date(thesis.submission_date).toLocaleDateString()}
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 font-medium mb-1">
                Current Status
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {thesis.status}
              </div>
            </div>

            {thesis.copyleaks_score !== null && (
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 font-medium mb-1">
                  Similarity Score
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-900">
                    {thesis.copyleaks_score}%
                  </span>
                  <span
                    className={`badge px-2 py-1 rounded text-xs font-semibold ${getSimilarityBadgeColor(
                      thesis.copyleaks_score
                    )}`}
                  >
                    {thesis.copyleaks_score < 10
                      ? 'Low'
                      : thesis.copyleaks_score < 20
                        ? 'Moderate'
                        : 'High'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Review Progress
            </h2>

            <div className="mb-6">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Stage {thesis.current_stage} of 4
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-3">
              {stages.map((stage) => (
                <div
                  key={stage.stage}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    thesis.current_stage > stage.stage
                      ? 'bg-green-50 border-green-300'
                      : thesis.current_stage === stage.stage
                        ? 'bg-primary-50 border-primary-500'
                        : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="text-2xl mb-2">{stage.icon}</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {stage.label}
                  </div>
                  {thesis.current_stage >= stage.stage && (
                    <div className="text-xs text-green-600 font-semibold mt-2">
                      {thesis.current_stage > stage.stage ? '✓ Complete' : '• In Progress'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {thesis.supervisor_comments && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="text-xl">💬</span> Supervisor Comments
              </h3>
              <p className="text-gray-700 leading-relaxed">
                {thesis.supervisor_comments}
              </p>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="card bg-white rounded-lg shadow p-6">
            <h3 className="font-bold text-gray-900 mb-4">Plagiarism Check</h3>
            {thesis.copyleaks_score !== null ? (
              <div>
                <div className="mb-4">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-bold text-gray-900">
                      {thesis.copyleaks_score}%
                    </span>
                    <span className="text-sm text-gray-600">similarity detected</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    via Copyleaks plagiarism detection
                  </p>
                </div>
                <a
                  href="/thesis/plagiarism-report"
                  className="btn-outline block text-center px-4 py-2 rounded font-semibold"
                >
                  View Full Report
                </a>
              </div>
            ) : (
              <p className="text-gray-600">
                Plagiarism check pending. It will be checked at the Library
                Published stage.
              </p>
            )}
          </div>

          <div className="card bg-white rounded-lg shadow p-6">
            <h3 className="font-bold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <a
                href={`/thesis/${thesis.id}/view`}
                className="btn-outline block text-center px-4 py-2 rounded font-semibold"
              >
                View Submission
              </a>
              <a
                href={`/thesis/${thesis.id}/edit`}
                className="btn-ghost block text-center px-4 py-2 rounded font-semibold"
              >
                Update Metadata
              </a>
              {thesis.status === 'Library Published' && (
                <a
                  href={`/thesis/${thesis.id}/publish`}
                  className="btn-primary block text-center px-4 py-2 rounded font-semibold"
                >
                  View Published
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 card bg-primary-50 rounded-lg p-6 border border-primary-200">
          <h3 className="font-semibold text-gray-900 mb-3">Thesis Timeline</h3>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex gap-3">
              <span className="text-2xl">📝</span>
              <div>
                <div className="font-semibold">Submission Received</div>
                <div className="text-gray-600">
                  {new Date(thesis.submission_date).toLocaleDateString()}
                </div>
              </div>
            </div>
            {thesis.current_stage >= 2 && (
              <div className="flex gap-3">
                <span className="text-2xl">👁</span>
                <div>
                  <div className="font-semibold">Supervisor Review In Progress</div>
                  <div className="text-gray-600">
                    Your supervisor is reviewing your thesis
                  </div>
                </div>
              </div>
            )}
            {thesis.current_stage >= 3 && (
              <div className="flex gap-3">
                <span className="text-2xl">🏛</span>
                <div>
                  <div className="font-semibold">Faculty Committee Review</div>
                  <div className="text-gray-600">
                    Undergoing committee evaluation
                  </div>
                </div>
              </div>
            )}
            {thesis.current_stage >= 4 && (
              <div className="flex gap-3">
                <span className="text-2xl">📚</span>
                <div>
                  <div className="font-semibold">Published in Smart Library</div>
                  <div className="text-gray-600">
                    Your thesis is now publicly available
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
