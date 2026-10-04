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
import { Loader2, Play, Download, Save, History, Plus, Trash2 } from 'lucide-react';
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
}

interface ReportRun {
  id: string;
  status: string;
  row_count: number;
  started_at: string;
  completed_at?: string;
  error_message?: string;
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
  const [datasets, setDatasets] = useState<Dataset[]>([]);
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
  const [page, setPage] = useState(1);

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
    } catch (err) {
      toast.error('Failed to load saved reports');
    }
  }, []);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
        fetchDatasets();
      } else {
        toast.error(data.error || 'Save failed');
      }
    } catch (err) {
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
        fetchDatasets();
      }
    } catch (err) {
      toast.error('Delete failed');
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
                  <Select value={selectedDataset} onValueChange={handleDatasetChange}>
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
                    <Button onClick={handleRun} disabled={loading || !selectedDataset}>
                      {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                      Run Report
                    </Button>
                    <Button variant="outline" onClick={() => handleExport('csv')} disabled={!reportResult}>
                      <Download className="h-4 w-4 mr-1" /> CSV
                    </Button>
                    <Button variant="outline" onClick={() => handleExport('xlsx')} disabled={!reportResult}>
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
                        <Button onClick={handleSave} disabled={saving || !reportName}>
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
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(report.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
                        <p className="text-sm font-medium">{run.status}</p>
                        <p className="text-xs text-muted-foreground">{new Date(run.started_at).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
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

interface Dataset {
  value: string;
  label: string;
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
