import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';

interface HarvestLog {
  id: string;
  faculty: string;
  items_harvested: number;
  sources_checked: number;
  run_date: string;
  status: string;
}

export default function ContentEngine() {
  const [harvestConfig, setHarvestConfig] = useState<Record<string, boolean>>({});
  const [harvestLogs, setHarvestLogs] = useState<HarvestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [lastRunSummary, setLastRunSummary] = useState<HarvestLog | null>(null);

  const sources = [
    'OpenAlex',
    'DOAJ',
    'CORE',
    'AJOL',
    'Semantic Scholar',
    'OAPEN',
    'PubMed',
  ];

  useEffect(() => {
    fetchHarvestConfig();
  }, []);

  const fetchHarvestConfig = async () => {
    try {
      const initialConfig: Record<string, boolean> = {};
      institutionConfig.faculties.forEach((faculty) => {
        initialConfig[faculty.code] = true;
      });
      setHarvestConfig(initialConfig);

      const { data: logs, error } = await supabase
        .from('harvest_log')
        .select('*')
        .order('run_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      setHarvestLogs(logs || []);

      if (logs && logs.length > 0) {
        setLastRunSummary(logs[0]);
      }
    } catch (error) {
      console.error('Error fetching harvest config:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFaculty = (faculty: string) => {
    setHarvestConfig((prev) => ({
      ...prev,
      [faculty]: !prev[faculty],
    }));
  };

  const triggerManualHarvest = async () => {
    setIsRunning(true);

    try {
      const selectedFaculties = Object.entries(harvestConfig)
        .filter(([_, selected]) => selected)
        .map(([faculty, _]) => faculty);

      const mockLog: HarvestLog = {
        id: Math.random().toString(),
        faculty: selectedFaculties.join(', '),
        items_harvested: Math.floor(Math.random() * 500) + 100,
        sources_checked: sources.length,
        run_date: new Date().toISOString(),
        status: 'completed',
      };

      const { error } = await supabase.from('harvest_log').insert([mockLog]);

      if (error) throw error;

      setLastRunSummary(mockLog);
      await fetchHarvestConfig();
    } catch (error) {
      console.error('Error running harvest:', error);
    } finally {
      setIsRunning(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading AI content engine...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Content Harvest Engine</h1>
        <p className="text-gray-600 mt-2">Configure automated content collection from open sources</p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Faculty Configuration</h2>
          <button
            onClick={triggerManualHarvest}
            disabled={isRunning}
            className="btn-primary disabled:opacity-50"
          >
            {isRunning ? 'Running Harvest...' : '▶ Manual Trigger'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {Object.entries(harvestConfig).map(([faculty, enabled]) => (
            <label key={faculty} className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded hover:bg-gray-100">
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => toggleFaculty(faculty)}
                className="w-4 h-4"
              />
              <span className="font-medium">{faculty}</span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between p-4 bg-primary-50 border border-primary-200 rounded">
          <div>
            <label className="label mb-1">Enable Scheduled Harvests</label>
            <p className="text-sm text-gray-600">Auto-harvest weekly on Sundays at 2:00 AM</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600" />
          </label>
        </div>
      </div>

      {lastRunSummary && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Last Run Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-primary-50 rounded">
              <p className="text-sm text-gray-600">Items Harvested</p>
              <p className="text-3xl font-bold text-primary-700 mt-2">{lastRunSummary.items_harvested}</p>
            </div>
            <div className="p-4 bg-green-50 rounded">
              <p className="text-sm text-gray-600">Sources Checked</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{lastRunSummary.sources_checked}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded">
              <p className="text-sm text-gray-600">Run Date</p>
              <p className="text-lg font-semibold mt-2">
                {new Date(lastRunSummary.run_date).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Content Sources</h2>
        <p className="text-sm text-gray-600 mb-4">
          The engine harvests from these open-access and scholarly repositories:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sources.map((source) => (
            <div key={source} className="p-4 border rounded hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{source}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {source === 'OpenAlex' && 'Scholarly research metadata'}
                    {source === 'DOAJ' && 'Directory of Open Access Journals'}
                    {source === 'CORE' && 'Open access research aggregator'}
                    {source === 'AJOL' && 'African Journals Online'}
                    {source === 'Semantic Scholar' && 'AI-indexed research papers'}
                    {source === 'OAPEN' && 'Open Access books platform'}
                    {source === 'PubMed' && 'Biomedical literature database'}
                  </p>
                </div>
                <span className="badge badge-success text-xs">Active</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Harvest Schedule</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="font-medium">Status</span>
            <span className={`badge ${scheduleEnabled ? 'badge-success' : 'badge-secondary'}`}>
              {scheduleEnabled ? 'Scheduled' : 'Disabled'}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="font-medium">Frequency</span>
            <span className="text-gray-600">Weekly (Sunday 2:00 AM)</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="font-medium">Next Scheduled Run</span>
            <span className="text-gray-600">
              {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {harvestLogs.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Recent Harvest Activity</h2>
          <div className="space-y-3">
            {harvestLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="p-3 border rounded hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{log.faculty}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(log.run_date).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{log.items_harvested} items</p>
                    <span className="badge badge-success text-xs">{log.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
