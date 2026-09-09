import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const lineData = [
  { date: 'Mon', visits: 2400 },
  { date: 'Tue', visits: 2210 },
  { date: 'Wed', visits: 2290 },
  { date: 'Thu', visits: 2000 },
  { date: 'Fri', visits: 2181 },
  { date: 'Sat', visits: 2500 },
  { date: 'Sun', visits: 2100 },
];

const donutData = [
  { name: 'Book Loans', value: 35 },
  { name: 'E-resource Access', value: 28 },
  { name: 'Renewals', value: 20 },
  { name: 'Database Queries', value: 17 },
];

const searchData = [
  { rank: 1, query: 'nursing research', count: 1250 },
  { rank: 2, query: 'organic chemistry', count: 890 },
  { rank: 3, query: 'financial management', count: 756 },
  { rank: 4, query: 'psychology journals', count: 634 },
  { rank: 5, query: 'computer networks', count: 521 },
  { rank: 6, query: 'literature review', count: 445 },
  { rank: 7, query: 'statistics methods', count: 398 },
  { rank: 8, query: 'medical databases', count: 367 },
  { rank: 9, query: 'law reports', count: 312 },
  { rank: 10, query: 'thesis samples', count: 287 },
];

const COLORS = ['#1A5C32', '#2D9756', '#6FC08A', '#A8D8B9'];

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<'network' | 'branch' | 'resources'>('network');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'year'>('7d');
  const [searchTerm, setSearchTerm] = useState('');

  const getVisitsData = () => {
    switch (dateRange) {
      case '7d':
        return { today: 542, week: 18450, month: 76230, year: 450120 };
      case '30d':
        return { today: 542, week: 18450, month: 76230, year: 450120 };
      case '90d':
        return { today: 542, week: 18450, month: 180560, year: 450120 };
      case 'year':
        return { today: 542, week: 18450, month: 76230, year: 450120 };
    }
  };

  const visitsData = getVisitsData();
  const newRegistrations = [
    { date: 'Mon', count: 12 },
    { date: 'Tue', count: 19 },
    { date: 'Wed', count: 15 },
    { date: 'Thu', count: 22 },
    { date: 'Fri', count: 18 },
    { date: 'Sat', count: 8 },
    { date: 'Sun', count: 5 },
  ];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Analytics</h1>
        <p className="text-gray-600 mt-2">Monitor platform usage and resource performance</p>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('network')}
              className={`px-4 py-2 rounded font-medium ${
                activeTab === 'network'
                  ? 'bg-primary-700 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Network Overview
            </button>
            <button
              onClick={() => setActiveTab('branch')}
              className={`px-4 py-2 rounded font-medium ${
                activeTab === 'branch'
                  ? 'bg-primary-700 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              This Branch
            </button>
            <button
              onClick={() => setActiveTab('resources')}
              className={`px-4 py-2 rounded font-medium ${
                activeTab === 'resources'
                  ? 'bg-primary-700 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Resource Performance
            </button>
          </div>

          <div className="flex gap-2">
            {(['7d', '30d', '90d', 'year'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  dateRange === range
                    ? 'bg-primary-700 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range === '7d' ? '7 days' : range === '30d' ? '30 days' : range === '90d' ? '90 days' : 'Year'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'network' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="text-sm font-medium text-gray-600">Visits Today</div>
              <div className="text-3xl font-bold mt-2">{visitsData.today}</div>
              <div className="text-xs text-green-600 mt-2">↑ 12% from yesterday</div>
            </div>

            <div className="stat-card">
              <div className="text-sm font-medium text-gray-600">This Week</div>
              <div className="text-3xl font-bold mt-2">{visitsData.week.toLocaleString()}</div>
              <div className="text-xs text-green-600 mt-2">↑ 8% from last week</div>
            </div>

            <div className="stat-card">
              <div className="text-sm font-medium text-gray-600">This Month</div>
              <div className="text-3xl font-bold mt-2">{visitsData.month.toLocaleString()}</div>
              <div className="text-xs text-gray-600 mt-2">Current period</div>
            </div>

            <div className="stat-card">
              <div className="text-sm font-medium text-gray-600">This Year</div>
              <div className="text-3xl font-bold mt-2">{visitsData.year.toLocaleString()}</div>
              <div className="text-xs text-green-600 mt-2">↑ 15% from last year</div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Visits Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="visits"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--color-primary)', r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Top 10 Searches</h3>
            <div className="space-y-2">
              {searchData.map((item) => (
                <div key={item.rank} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-gray-500 w-8">#{item.rank}</span>
                    <span className="font-medium">{item.query}</span>
                  </div>
                  <span className="badge badge-primary">{item.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'branch' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Patron Activity Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {donutData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      {item.name}
                    </span>
                    <span className="font-semibold">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold mb-4">New Registrations</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={newRegistrations}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Branch Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-primary-50 rounded">
                <p className="text-sm text-gray-600">Total Patrons</p>
                <p className="text-2xl font-bold mt-2">2,847</p>
              </div>
              <div className="p-4 bg-green-50 rounded">
                <p className="text-sm text-gray-600">Active Loans</p>
                <p className="text-2xl font-bold mt-2">1,234</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded">
                <p className="text-sm text-gray-600">Overdue Items</p>
                <p className="text-2xl font-bold mt-2">47</p>
              </div>
              <div className="p-4 bg-purple-50 rounded">
                <p className="text-sm text-gray-600">Renewals Today</p>
                <p className="text-2xl font-bold mt-2">156</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'resources' && (
        <div className="space-y-6">
          <div className="card">
            <label className="label">Search Resource</label>
            <input
              type="text"
              placeholder="Enter resource title..."
              className="input w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="card overflow-x-auto">
            <h3 className="text-lg font-semibold mb-4">Resource Performance Metrics</h3>
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-semibold">Resource Title</th>
                  <th className="text-left p-3 font-semibold">Views</th>
                  <th className="text-left p-3 font-semibold">Downloads</th>
                  <th className="text-left p-3 font-semibold">Avg Session Duration</th>
                  <th className="text-left p-3 font-semibold">Bounce Rate</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    title: 'JSTOR Database',
                    views: 5240,
                    downloads: 1240,
                    duration: '4m 32s',
                    bounce: '12%',
                  },
                  {
                    title: 'Project MUSE',
                    views: 3890,
                    downloads: 856,
                    duration: '3m 18s',
                    bounce: '18%',
                  },
                  {
                    title: 'IEEE Xplore',
                    views: 2156,
                    downloads: 445,
                    duration: '5m 12s',
                    bounce: '8%',
                  },
                  {
                    title: 'ProQuest Dissertations',
                    views: 1847,
                    downloads: 367,
                    duration: '6m 45s',
                    bounce: '5%',
                  },
                  {
                    title: 'Scopus Database',
                    views: 4523,
                    downloads: 1089,
                    duration: '4m 8s',
                    bounce: '14%',
                  },
                ].map((resource, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{resource.title}</td>
                    <td className="p-3">{resource.views.toLocaleString()}</td>
                    <td className="p-3">{resource.downloads.toLocaleString()}</td>
                    <td className="p-3">{resource.duration}</td>
                    <td className="p-3">{resource.bounce}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
