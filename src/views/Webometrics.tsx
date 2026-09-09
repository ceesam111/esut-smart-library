import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';

interface Statistic {
  label: string;
  value: number;
  change: number;
}

interface RankingInitiative {
  id: string;
  name: string;
  rank: number | null;
  description: string;
  url: string;
}

interface Researcher {
  id: string;
  name: string;
  citations: number;
  h_index: number;
  department: string;
}

interface ActionItem {
  id: string;
  task: string;
  status: 'pending' | 'in_progress' | 'completed';
  owner: string;
  priority: 'high' | 'medium' | 'low';
}

export default function Webometrics() {
  const [statistics, setStatistics] = useState<Statistic[]>([]);
  const [initiatives, setInitiatives] = useState<RankingInitiative[]>([]);
  const [researchers, setResearchers] = useState<Researcher[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'rankings' | 'researchers' | 'actions'>('stats');

  useEffect(() => {
    if (institutionConfig.features?.webometrics) {
      fetchData();
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, initRes, resRes, actRes] = await Promise.all([
        supabase.from('webometrics_statistics').select('*').order('updated_at', { ascending: false }).limit(1),
        supabase.from('ranking_initiatives').select('*').order('rank', { ascending: true, nullsFirst: false }),
        supabase.from('researchers').select('*').order('citations', { ascending: false }).limit(10),
        supabase.from('webometrics_actions').select('*')
      ]);

      if (statsRes.data?.[0]) {
        setStatistics([
          { label: 'Indexed Pages', value: statsRes.data[0].indexed_pages || 0, change: 5.2 },
          { label: 'Repository Downloads', value: statsRes.data[0].repository_downloads || 0, change: 8.1 },
          { label: 'OAI-PMH Records', value: statsRes.data[0].oai_pmh_records || 0, change: 3.4 },
          { label: 'DOIs Minted', value: statsRes.data[0].dois_minted || 0, change: 12.5 },
          { label: 'ORCID-Verified Researchers', value: statsRes.data[0].orcid_researchers || 0, change: 6.8 },
          { label: 'Total Citations', value: statsRes.data[0].total_citations || 0, change: 9.3 }
        ]);
      }

      if (initRes.data) {
        setInitiatives(initRes.data);
      }

      if (resRes.data) {
        setResearchers(resRes.data);
      }

      if (actRes.data) {
        setActions(actRes.data);
      }
    } catch (error) {
      console.error('Error fetching webometrics data:', error);
    }
    setLoading(false);
  };

  const StatCard = ({ stat }: { stat: Statistic }) => (
    <div className="card overflow-hidden">
      <div className="p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">{stat.label}</h3>
        <div className="text-4xl font-bold text-gray-900 mb-2">
          {stat.value.toLocaleString()}
        </div>
        <div className="text-sm text-green-600 font-medium">
          ↑ {stat.change.toFixed(1)}% from last month
        </div>
      </div>
    </div>
  );

  const RankingCard = ({ initiative }: { initiative: RankingInitiative }) => (
    <div className="card overflow-hidden hover:shadow-lg transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">{initiative.name}</h3>
          {initiative.rank && (
            <span className="badge badge-primary"># {initiative.rank}</span>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-4">{initiative.description}</p>
        <a
          href={initiative.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline text-sm font-medium"
        >
          View Rankings →
        </a>
      </div>
    </div>
  );

  if (!institutionConfig.features?.webometrics) {
    return (
      <div className="page">
        <div className="section text-center py-12">
          <p className="text-gray-600">Webometrics dashboard is not enabled.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Webometrics & Rankings</h1>
        <p className="text-gray-600">Monitor institutional visibility and research impact metrics</p>
      </div>

      <div className="section">
        <div className="flex gap-2 mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'stats'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Statistics
          </button>
          <button
            onClick={() => setActiveTab('rankings')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'rankings'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Rankings
          </button>
          <button
            onClick={() => setActiveTab('researchers')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'researchers'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Top Researchers
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'actions'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Action Plan
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin">Loading...</div>
          </div>
        ) : (
          <>
            {activeTab === 'stats' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {statistics.map((stat, idx) => (
                  <StatCard key={idx} stat={stat} />
                ))}
              </div>
            )}

            {activeTab === 'rankings' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {initiatives.map(initiative => (
                  <RankingCard key={initiative.id} initiative={initiative} />
                ))}
              </div>
            )}

            {activeTab === 'researchers' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Citations</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">H-Index</th>
                    </tr>
                  </thead>
                  <tbody>
                    {researchers.map((researcher, idx) => (
                      <tr key={researcher.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{researcher.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{researcher.department}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{researcher.citations}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{researcher.h_index}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'actions' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Task</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Owner</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actions.map((action, idx) => (
                      <tr key={action.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{action.task}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{action.owner}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`badge ${
                            action.status === 'completed' ? 'bg-green-100 text-green-800' :
                            action.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {action.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`badge ${
                            action.priority === 'high' ? 'bg-red-100 text-red-800' :
                            action.priority === 'medium' ? 'bg-orange-100 text-orange-800' :
                            'bg-primary-100 text-primary-800'
                          }`}>
                            {action.priority}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
