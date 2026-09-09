import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface RankingInitiative {
  id: string;
  name: string;
  current_rank: number;
}

interface ActionItem {
  id: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  owner: string;
  deadline: string;
}

export default function Webometrics() {
  const [rankings, setRankings] = useState<RankingInitiative[]>([]);
  const [editingRankings, setEditingRankings] = useState<Record<string, number>>({});
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const rankingInitiatives = [
    { id: 'webometrics', name: 'Webometrics Ranking' },
    { id: 'the', name: 'Times Higher Education (THE)' },
    { id: 'qs', name: 'QS World Rankings' },
    { id: 'scimago', name: 'SCImago Ranking' },
    { id: 'google_scholar', name: 'Google Scholar Metrics' },
    { id: 'ui_green', name: 'UI GreenMetric' },
    { id: 'arwu', name: 'ARWU (Shanghai)' },
    { id: 'nirf', name: 'NIRF (India)' },
  ];

  useEffect(() => {
    fetchRankings();
  }, []);

  const fetchRankings = async () => {
    try {
      const mockRankings: RankingInitiative[] = rankingInitiatives.map((init) => ({
        id: init.id,
        name: init.name,
        current_rank: Math.floor(Math.random() * 500) + 50,
      }));

      setRankings(mockRankings);

      const initialEditingRankings: Record<string, number> = {};
      mockRankings.forEach((r) => {
        initialEditingRankings[r.id] = r.current_rank;
      });
      setEditingRankings(initialEditingRankings);

      const mockActions: ActionItem[] = [
        {
          id: '1',
          title: 'Increase international collaboration publications',
          status: 'in_progress',
          priority: 'high',
          owner: 'Research Office',
          deadline: '2024-12-31',
        },
        {
          id: '2',
          title: 'Enhance digital library infrastructure',
          status: 'in_progress',
          priority: 'high',
          owner: 'Library',
          deadline: '2024-09-30',
        },
        {
          id: '3',
          title: 'Improve citation impact metrics',
          status: 'not_started',
          priority: 'medium',
          owner: 'Faculty',
          deadline: '2025-03-31',
        },
        {
          id: '4',
          title: 'Strengthen institutional repository',
          status: 'in_progress',
          priority: 'high',
          owner: 'Library',
          deadline: '2024-08-31',
        },
        {
          id: '5',
          title: 'Increase online visibility and web presence',
          status: 'completed',
          priority: 'medium',
          owner: 'Communications',
          deadline: '2024-06-30',
        },
      ];

      setActions(mockActions);
    } catch (error) {
      console.error('Error fetching rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateRank = (id: string, newRank: number) => {
    setEditingRankings((prev) => ({
      ...prev,
      [id]: newRank,
    }));
  };

  const saveChanges = async () => {
    try {
      const updatedRankings = rankings.map((r) => ({
        ...r,
        current_rank: editingRankings[r.id] || r.current_rank,
      }));

      setRankings(updatedRankings);
      console.log('Changes saved');
    } catch (error) {
      console.error('Error saving changes:', error);
    }
  };

  const updateActionStatus = (id: string, newStatus: ActionItem['status']) => {
    setActions((prev) =>
      prev.map((action) =>
        action.id === id ? { ...action, status: newStatus } : action
      )
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'badge-success';
      case 'in_progress':
        return 'badge-warning';
      case 'not_started':
        return 'badge-secondary';
      default:
        return 'badge-secondary';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return <div className="p-8">Loading webometrics data...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ranking Management</h1>
        <p className="text-gray-600 mt-2">Monitor and manage institutional rankings</p>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-6">Current Rankings</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="text-left p-3 font-semibold">Initiative</th>
                <th className="text-left p-3 font-semibold">Current Rank</th>
                <th className="text-left p-3 font-semibold">Update Rank</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((ranking) => (
                <tr key={ranking.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{ranking.name}</td>
                  <td className="p-3">
                    <span className="badge badge-primary">#{ranking.current_rank}</span>
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      className="input w-24"
                      value={editingRankings[ranking.id] || ''}
                      onChange={(e) =>
                        updateRank(ranking.id, parseInt(e.target.value) || 0)
                      }
                      min="1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6">
          <button onClick={saveChanges} className="btn-primary">
            Save Changes
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-6">Action Checklist</h2>

        <div className="space-y-3">
          {actions.map((action) => (
            <div key={action.id} className="p-4 border rounded hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold">{action.title}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                    <span>Owner: {action.owner}</span>
                    <span>Deadline: {new Date(action.deadline).toLocaleDateString()}</span>
                    <span className={`font-semibold ${getPriorityColor(action.priority)}`}>
                      {action.priority.charAt(0).toUpperCase() + action.priority.slice(1)} Priority
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {(['not_started', 'in_progress', 'completed'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => updateActionStatus(action.id, status)}
                      className={`px-3 py-1 rounded text-xs font-medium transition ${
                        action.status === status
                          ? `badge ${getStatusColor(status)}`
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {status === 'not_started'
                        ? 'Not Started'
                        : status === 'in_progress'
                        ? 'In Progress'
                        : 'Completed'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex items-center">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      action.status === 'completed'
                        ? 'bg-green-600'
                        : action.status === 'in_progress'
                        ? 'bg-yellow-600'
                        : 'bg-gray-400'
                    }`}
                    style={{
                      width:
                        action.status === 'completed'
                          ? '100%'
                          : action.status === 'in_progress'
                          ? '50%'
                          : '0%',
                    }}
                  />
                </div>
                <span className="ml-2 text-xs font-semibold text-gray-600">
                  {action.status === 'completed'
                    ? '100%'
                    : action.status === 'in_progress'
                    ? '50%'
                    : '0%'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-green-50">
          <p className="text-sm text-gray-600">Completed Actions</p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {actions.filter((a) => a.status === 'completed').length}
          </p>
        </div>
        <div className="card bg-yellow-50">
          <p className="text-sm text-gray-600">In Progress</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">
            {actions.filter((a) => a.status === 'in_progress').length}
          </p>
        </div>
        <div className="card bg-gray-50">
          <p className="text-sm text-gray-600">Not Started</p>
          <p className="text-3xl font-bold text-gray-600 mt-2">
            {actions.filter((a) => a.status === 'not_started').length}
          </p>
        </div>
        <div className="card bg-primary-50">
          <p className="text-sm text-gray-600">High Priority</p>
          <p className="text-3xl font-bold text-primary-700 mt-2">
            {actions.filter((a) => a.priority === 'high').length}
          </p>
        </div>
      </div>
    </div>
  );
}
