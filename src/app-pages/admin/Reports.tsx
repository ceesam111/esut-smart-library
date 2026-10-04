'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Play, Download, Save, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ReportDefinition {
  id: string;
  name: string;
  description?: string;
  report_type: string;
  dataset: string;
  filters: unknown[];
  columns: unknown[];
  visibility: string;
  created_at: string;
  schedule_enabled?: boolean;
  schedule_frequency?: string | null;
  schedule_time?: string | null;
  schedule_day?: number | null;
  schedule_delivery?: string | null;
  schedule_next_run_at?: string | null;
  schedule_last_run_at?: string | null;
  schedule_last_status?: string | null;
}

interface ReportRun {
  id: string;
  status: string;
  row_count: number | null;
  started_at: string;
  completed_at?: string | null;
  error_message?: string | null;
  report_type?: string;
  output_format?: string | null;
  schedule_period_key?: string | null;
  delivery_status?: string | null;
}

interface ReportResult {
  data: Record<string, unknown>[];
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
  columns: string[];
}

const DATASETS = [
  { value: 'circulation', label: 'Circulation' },
  { value: 'patrons', label: 'Patrons' },
  { value: 'catalogue', label: 'Catalogue' },
  { value: 'repository', label: 'Repository' },
  { value: 'acquisitions', label: 'Acquisitions' },
  { value: 'serials', label: 'Serials' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'fines', label: 'Fines' },
];

const BUILT_IN_REPORTS = [
  { name: 'Current Loans', dataset: 'circulation', description: 'All active loans' },
  { name: 'Overdue Loans', dataset: 'circulation', description: 'Loans past due date' },
  { name: 'Checkouts by Period', dataset: 'circulation', description: 'Checkouts in date range' },
  { name: 'Most Borrowed Titles', dataset: 'circulation', description: 'Top borrowed items' },
  { name: 'Patrons by Category', dataset: 'patrons', description: 'Patrons grouped by role' },
  { name: 'Expiring Accounts', dataset: 'patrons', description: 'Accounts expiring soon' },
  { name: 'Items by Status', dataset: 'catalogue', description: 'Catalogue items by status' },
  { name: 'Recently Added', dataset: 'catalogue', description: 'New catalogue items' },
  { name: 'Submissions by Status', dataset: 'repository', description: 'Repository submissions' },
  { name: 'Publications by Period', dataset: 'repository', description: 'Published items in range' },
  { name: 'Orders by Status', dataset: 'acquisitions', description: 'Purchase orders' },
  { name: 'Active Subscriptions', dataset: 'serials', description: 'Serial subscriptions' },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('builder');
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [sorting, setSorting] = useState<ReportSort[]>([]);
  const [reportResult, setReportResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reportName, setReportName] = useState('');
  const [savedReports, setSavedReports] = useState<ReportDefinition[]>([]);
  const [reportHistory, setReportHistory] = useState<ReportRun[]>([]);
  const [page] = useState(1);

  const fetchDatasets = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reports/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' }),
      });
      const data = await res.json();
      if (data.success) {
        setSavedReports(data.reports);
      }
    } catch {
      toast.error('Failed to load saved reports');
    }
  }, []);

  useEffect(() => {
    void fetchDatasets();
  }, [fetchDatasets]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reports/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'history' }),
      });
      const data = await res.json();
      if (data.success) setReportHistory(data.history);
    } catch {
      toast.error('Failed to load run history');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') void loadHistory();
  }, [activeTab, loadHistory]);

  const handleDatasetChange = async (dataset: string) => {
    setSelectedDataset(dataset);
    setColumns([]);
    setSelectedColumns([]);
    setFilters([]);
    setSorting([]);
    setReportResult(null);

    try {
      const res = await fetch('/api/admin/reports/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run',
          query: { dataset, pageSize: 1 },
        }),
      });
      const data = await res.json();
      if (data.success && data.result.columns) {
        setColumns(data.result.columns);
        setSelectedColumns(data.result.columns);
      }
    } catch {
      toast.error('Failed to load dataset columns');
    }
  };

  const handleRun = async () => {
    if (!selectedDataset) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reports/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run',
          logRun: true,
          query: {
            dataset: selectedDataset,
            columns: selectedColumns.map((c) => ({ field: c, label: c, type: 'string' })),
            filters,
            sorting,
            page,
            pageSize: 50,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReportResult(data.result);
      } else {
        toast.error(data.error || 'Report failed');
      }
    } catch {
      toast.error('Report failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (!selectedDataset) return;
    try {
      const res = await fetch('/api/admin/reports/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export',
          query: {
            dataset: selectedDataset,
            columns: selectedColumns.map((c) => ({ field: c, label: c, type: 'string' })),
            filters,
            sorting,
            page: 1,
            pageSize: 500,
          },
          format,
        }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${selectedDataset}_${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Export failed');
    }
  };

  const handleSave = async () => {
    if (!reportName || !selectedDataset) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/reports/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          definition: {
            name: reportName,
            dataset: selectedDataset,
            reportType: selectedDataset,
            columns: selectedColumns.map((c) => ({ field: c, label: c, type: 'string' })),
            filters,
            sorting,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Report saved');
        setReportName('');
        void fetchDatasets();
      } else {
        toast.error(data.error || 'Save failed');
      }
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (reportId: string) => {
    try {
      const res = await fetch('/api/admin/reports/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', reportId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Report deleted');
        void fetchDatasets();
      }
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleSchedule = async (
    reportId: string,
    schedule: { enabled: boolean; frequency?: string | null; time?: string | null; day?: number | null; delivery?: string | null },
  ) => {
    try {
      const res = await fetch('/api/admin/reports/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'schedule', reportId, schedule }),
      });
      const data = await res.json();
      if (data.success) {
        setSavedReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, ...data.schedule } : r)));
        toast.success(schedule.enabled ? 'Schedule saved' : 'Schedule disabled');
      } else {
        toast.error(data.error || 'Schedule save failed');
      }
    } catch {
      toast.error('Schedule save failed');
    }
  };

  const addFilter = () => {
    setFilters([...filters, { field: columns[0] ?? '', operator: 'eq', value: '' }]);
  };

  const updateFilter = (index: number, key: string, value: unknown) => {
    const updated = [...filters];
    updated[index] = { ...updated[index], [key]: value };
    setFilters(updated);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Report Builder</h1>
        <p className="text-sm text-muted-foreground">Build, run, and export reports from approved datasets</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="saved">Saved Reports</TabsTrigger>
          <TabsTrigger value="history">Run History</TabsTrigger>
          <TabsTrigger value="built-in">Built-in Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Dataset</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedDataset} onValueChange={(value) => void handleDatasetChange(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select dataset" />
                    </SelectTrigger>
                    <SelectContent>
                      {DATASETS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {columns.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Columns</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-64 overflow-auto">
                    {columns.map((col) => (
                      <label key={col} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedColumns.includes(col)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedColumns([...selectedColumns, col]);
                            } else {
                              setSelectedColumns(selectedColumns.filter((c) => c !== col));
                            }
                          }}
                        />
                        {col}
                      </label>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {filters.map((filter, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Select value={filter.field} onValueChange={(v) => updateFilter(i, 'field', v)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {columns.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={filter.operator} onValueChange={(v) => updateFilter(i, 'operator', v)}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="eq">=</SelectItem>
                          <SelectItem value="neq">!=</SelectItem>
                          <SelectItem value="gt">&gt;</SelectItem>
                          <SelectItem value="gte">&ge;</SelectItem>
                          <SelectItem value="lt">&lt;</SelectItem>
                          <SelectItem value="lte">&le;</SelectItem>
                          <SelectItem value="like">LIKE</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Value"
                        value={String(filter.value ?? '')}
                        onChange={(e) => updateFilter(i, 'value', e.target.value)}
                        className="flex-1"
                      />
                      <Button variant="ghost" size="sm" onClick={() => removeFilter(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addFilter}>
                    <Plus className="h-4 w-4 mr-1" /> Add Filter
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <Button onClick={() => void handleRun()} disabled={loading || !selectedDataset}>
                      {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                      Run Report
                    </Button>
                    <Button variant="outline" onClick={() => void handleExport('csv')} disabled={!reportResult}>
                      <Download className="h-4 w-4 mr-1" /> CSV
                    </Button>
                    <Button variant="outline" onClick={() => void handleExport('xlsx')} disabled={!reportResult}>
                      <Download className="h-4 w-4 mr-1" /> XLSX
                    </Button>
                  </div>

                  {reportResult && (
                    <>
                      <Alert className="mb-4">
                        <AlertDescription>
                          {reportResult.totalRows} total rows | Page {reportResult.page} of {reportResult.totalPages} | Showing {reportResult.data.length} rows
                        </AlertDescription>
                      </Alert>

                      <div className="overflow-auto max-h-96 border rounded-md">
                        <table className="w-full text-sm">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              {reportResult.columns.map((col) => (
                                <th key={col} className="p-2 text-left font-medium">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {reportResult.data.map((row, i) => (
                              <tr key={i} className="border-t">
                                {reportResult.columns.map((col) => (
                                  <td key={col} className="p-2">{String(row[col] ?? '')}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex items-center gap-2 mt-4">
                        <Input
                          placeholder="Report name"
                          value={reportName}
                          onChange={(e) => setReportName(e.target.value)}
                          className="max-w-xs"
                        />
                        <Button onClick={() => void handleSave()} disabled={saving || !reportName}>
                          <Save className="h-4 w-4 mr-1" /> Save
                        </Button>
                      </div>
                    </>
                  )}

                  {!reportResult && !loading && (
                    <div className="text-center text-muted-foreground py-12">
                      Select a dataset and run a report to see results
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="saved">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedReports.map((report) => (
              <Card key={report.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{report.name}</p>
                      <p className="text-xs text-muted-foreground">{report.description}</p>
                      <Badge variant="outline" className="mt-1">{report.dataset}</Badge>
                      {report.schedule_enabled && (
                        <Badge className="ml-1 mt-1">
                          {report.schedule_frequency} {report.schedule_time}
                        </Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => void handleDelete(report.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <ScheduleEditor report={report} onSave={handleSchedule} />
                </CardContent>
              </Card>
            ))}
            {savedReports.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-12">
                No saved reports yet
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Run History</CardTitle>
            </CardHeader>
            <CardContent>
              {reportHistory.length > 0 ? (
                <div className="space-y-2">
                  {reportHistory.map((run) => (
                    <div key={run.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
                      <div>
                        <p className="text-sm font-medium">
                          {run.report_type ?? 'report'}
                          {run.schedule_period_key ? ` · ${run.schedule_period_key}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">{new Date(run.started_at).toLocaleString()}</p>
                        {run.error_message && (
                          <p className="text-xs text-red-600 mt-1">{run.error_message}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {run.output_format && <Badge variant="outline">{run.output_format}</Badge>}
                        {run.delivery_status && <Badge variant="outline">{run.delivery_status}</Badge>}
                        <Badge variant={run.status === 'completed' ? 'default' : 'destructive'}>{run.status}</Badge>
                        {run.row_count !== null && <span className="text-xs">{run.row_count} rows</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  No run history yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="built-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {BUILT_IN_REPORTS.map((report) => (
              <Card key={report.name}>
                <CardContent className="p-4">
                  <p className="font-medium">{report.name}</p>
                  <p className="text-xs text-muted-foreground">{report.description}</p>
                  <Badge variant="outline" className="mt-2">{report.dataset}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type ScheduleSave = (
  reportId: string,
  schedule: { enabled: boolean; frequency?: string | null; time?: string | null; day?: number | null; delivery?: string | null },
) => Promise<void>;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ScheduleEditor({ report, onSave }: { report: ReportDefinition; onSave: ScheduleSave }) {
  const [freq, setFreq] = useState<string>(report.schedule_enabled && report.schedule_frequency ? report.schedule_frequency : 'off');
  const [time, setTime] = useState(report.schedule_time ?? '08:00');
  const [day, setDay] = useState<number>(report.schedule_day ?? 1);
  const [delivery, setDelivery] = useState(report.schedule_delivery ?? 'in_app');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(report.id, {
      enabled: freq !== 'off',
      frequency: freq === 'off' ? null : freq,
      time,
      day: freq === 'daily' ? null : day,
      delivery,
    });
    setSaving(false);
  };

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <Label className="text-xs text-muted-foreground">Schedule</Label>
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={freq} onValueChange={setFreq}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Off</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
        {freq !== 'off' && (
          <>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-28 h-8 text-xs" />
            {freq === 'weekly' && (
              <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d, i) => (
                    <SelectItem key={d} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {freq === 'monthly' && (
              <Input
                type="number"
                min={1}
                max={31}
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="w-20 h-8 text-xs"
                title="Day of month"
              />
            )}
            <Select value={delivery} onValueChange={setDelivery}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in_app">In-App</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
          Save Schedule
        </Button>
      </div>
      {report.schedule_enabled && report.schedule_next_run_at && (
        <p className="text-xs text-muted-foreground">
          Next run: {new Date(report.schedule_next_run_at).toLocaleString()}
          {report.schedule_last_status ? ` · Last: ${report.schedule_last_status}` : ''}
        </p>
      )}
    </div>
  );
}

interface ReportFilter {
  field: string;
  operator: string;
  value: unknown;
}

interface ReportSort {
  field: string;
  direction: 'asc' | 'desc';
}
