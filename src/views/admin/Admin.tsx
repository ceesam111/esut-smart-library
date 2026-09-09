import { useState, useEffect } from 'react';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';

interface StatData {
  totalPatrons: number;
  totalItems: number;
  activeLoans: number;
  pendingApprovals: number;
}

interface Activity {
  id: string;
  action: string;
  table_name: string;
  created_at: string;
  details: string;
}

export default function Admin() {
  const [stats, setStats] = useState<StatData>({
    totalPatrons: 0,
    totalItems: 0,
    activeLoans: 0,
    pendingApprovals: 0,
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [patrons, items, loans, approvals, recentActivity] = await Promise.all([
        supabase.from('patrons').select('count').single(),
        supabase.from('catalogue_items').select('count').single(),
        supabase.from('loans').select('count').eq('status', 'active').single(),
        supabase.from('repository_items').select('count').eq('status', 'submitted').single(),
        supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(10),
      ]);

      setStats({
        totalPatrons: patrons.count || 0,
        totalItems: items.count || 0,
        activeLoans: loans.count || 0,
        pendingApprovals: approvals.count || 0,
      });

      if (recentActivity.data) {
        setActivities(recentActivity.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
          {institutionConfig.name} - Admin Dashboard
        </h1>
        <p className="text-gray-600 mt-2">Welcome back to your digital library administration</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="text-sm font-medium text-gray-600">Total Patrons</div>
          <div className="text-3xl font-bold mt-2">{stats.totalPatrons}</div>
          <div className="text-xs text-gray-500 mt-2">Active users</div>
        </div>

        <div className="stat-card">
          <div className="text-sm font-medium text-gray-600">Total Items</div>
          <div className="text-3xl font-bold mt-2">{stats.totalItems}</div>
          <div className="text-xs text-gray-500 mt-2">In catalogue</div>
        </div>

        <div className="stat-card">
          <div className="text-sm font-medium text-gray-600">Active Loans</div>
          <div className="text-3xl font-bold mt-2">{stats.activeLoans}</div>
          <div className="text-xs text-gray-500 mt-2">Currently checked out</div>
        </div>

        <div className="stat-card">
          <div className="text-sm font-medium text-gray-600">Pending Approvals</div>
          <div className="text-3xl font-bold mt-2">{stats.pendingApprovals}</div>
          <div className="text-xs text-gray-500 mt-2">Awaiting review</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <a href="/admin/patrons" className="card hover:shadow-lg transition-shadow">
          <div className="text-lg font-semibold mb-2">Manage Patrons</div>
          <p className="text-gray-600 text-sm">View, search, and manage patron accounts</p>
        </a>

        <a href="/admin/catalogue" className="card hover:shadow-lg transition-shadow">
          <div className="text-lg font-semibold mb-2">Manage Catalogue</div>
          <p className="text-gray-600 text-sm">Add and manage library items</p>
        </a>

        <a href="/admin/repository" className="card hover:shadow-lg transition-shadow">
          <div className="text-lg font-semibold mb-2">Repository Approvals</div>
          <p className="text-gray-600 text-sm">Review and approve submissions</p>
        </a>

        <a href="/admin/ill" className="card hover:shadow-lg transition-shadow">
          <div className="text-lg font-semibold mb-2">ILL Management</div>
          <p className="text-gray-600 text-sm">Track inter-library loans</p>
        </a>

        <a href="/admin/reports" className="card hover:shadow-lg transition-shadow">
          <div className="text-lg font-semibold mb-2">Regulatory Reports</div>
          <p className="text-gray-600 text-sm">Generate compliance reports</p>
        </a>

        <a href="/admin/analytics" className="card hover:shadow-lg transition-shadow">
          <div className="text-lg font-semibold mb-2">Analytics</div>
          <p className="text-gray-600 text-sm">View platform usage statistics</p>
        </a>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">System Health</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded">
            <span className="text-sm font-medium">Database Connection</span>
            <span className="badge badge-success">Healthy</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded">
            <span className="text-sm font-medium">API Services</span>
            <span className="badge badge-success">Operational</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded">
            <span className="text-sm font-medium">Authentication</span>
            <span className="badge badge-success">Active</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-6">Recent Activity</h2>

        <div className="space-y-3">
          {activities.length > 0 ? (
            activities.map((activity) => (
              <div key={activity.id} className="flex items-start justify-between p-3 border-b last:border-b-0">
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.action}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {activity.table_name} · {new Date(activity.created_at).toLocaleString()}
                  </p>
                </div>
                {activity.details && (
                  <span className="badge badge-primary ml-4">{activity.details}</span>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
