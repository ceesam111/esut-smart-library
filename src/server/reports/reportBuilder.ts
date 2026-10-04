import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { escapeCsvValue } from '@/server/analytics/csv';

export type ReportDataset = 'circulation' | 'patrons' | 'catalogue' | 'repository' | 'acquisitions' | 'serials' | 'analytics' | 'fines';

export interface ReportFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'between';
  value: unknown;
  valueTo?: unknown;
}

export interface ReportColumn {
  field: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  sensitive?: boolean;
}

export interface ReportSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ReportGroup {
  field: string;
  aggregations?: Array<{ function: 'count' | 'sum' | 'avg' | 'min' | 'max'; field: string; alias: string }>;
}

export interface ReportQuery {
  dataset: ReportDataset;
  filters?: ReportFilter[];
  columns?: ReportColumn[];
  sorting?: ReportSort[];
  grouping?: ReportGroup[];
  page?: number;
  pageSize?: number;
}

export interface ReportRow {
  [key: string]: unknown;
}

export interface ReportResult {
  data: ReportRow[];
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
  columns: string[];
  rowCountEstimate: number;
}

const DATASET_TABLES: Record<ReportDataset, { table: string; allowedColumns: string[] }> = {
  circulation: {
    table: 'loans',
    allowedColumns: ['id', 'item_id', 'patron_id', 'checkout_date', 'due_date', 'returned_date', 'status', 'fine_amount', 'created_at'],
  },
  patrons: {
    table: 'patrons',
    allowedColumns: ['id', 'user_id', 'first_name', 'last_name', 'email', 'phone', 'faculty', 'department', 'patron_role', 'status', 'account_expiry', 'created_at'],
  },
  catalogue: {
    table: 'catalogue_items',
    allowedColumns: ['id', 'title', 'author', 'isbn', 'faculty_code', 'department', 'status', 'collection', 'location', 'created_at'],
  },
  repository: {
    table: 'repository_items',
    allowedColumns: ['id', 'title', 'authors', 'item_type', 'status', 'visibility', 'created_at', 'updated_at'],
  },
  acquisitions: {
    table: 'purchase_orders',
    allowedColumns: ['id', 'po_number', 'supplier_id', 'status', 'total_amount', 'currency', 'order_date', 'created_at'],
  },
  serials: {
    table: 'serials_subscriptions',
    allowedColumns: ['id', 'title', 'issn', 'publisher', 'status', 'start_date', 'renewal_date', 'created_at'],
  },
  analytics: {
    table: 'analytics_events',
    allowedColumns: ['id', 'event_type', 'patron_id', 'entity_id', 'search_query', 'bot_flag', 'created_at'],
  },
  fines: {
    table: 'fines',
    allowedColumns: ['id', 'loan_id', 'patron_id', 'amount', 'status', 'created_at'],
  },
};

const SENSITIVE_COLUMNS = new Set(['email', 'phone', 'first_name', 'last_name']);

export function isColumnAllowed(dataset: ReportDataset, field: string): boolean {
  return DATASET_TABLES[dataset]?.allowedColumns.includes(field) ?? false;
}

export function isSensitiveColumn(field: string): boolean {
  return SENSITIVE_COLUMNS.has(field);
}

export async function runReport(query: ReportQuery): Promise<ReportResult> {
  const supabase = getSupabaseAdminClient();
  const dataset = DATASET_TABLES[query.dataset];
  if (!dataset) throw new Error(`Unknown dataset: ${query.dataset}`);

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(Math.max(1, query.pageSize ?? 50), 500);
  const offset = (page - 1) * pageSize;

  const requestedColumns = query.columns?.map((c) => c.field) ?? dataset.allowedColumns;
  const safeColumns = requestedColumns.filter((c) => isColumnAllowed(query.dataset, c));
  if (safeColumns.length === 0) throw new Error('No valid columns selected');

  let supabaseQuery = supabase
    .from(dataset.table)
    .select(safeColumns.join(', '), { count: 'exact' });

  if (query.filters) {
    for (const filter of query.filters) {
      if (!isColumnAllowed(query.dataset, filter.field)) continue;
      switch (filter.operator) {
        case 'eq': supabaseQuery = supabaseQuery.eq(filter.field, filter.value); break;
        case 'neq': supabaseQuery = supabaseQuery.neq(filter.field, filter.value); break;
        case 'gt': supabaseQuery = supabaseQuery.gt(filter.field, filter.value); break;
        case 'gte': supabaseQuery = supabaseQuery.gte(filter.field, filter.value); break;
        case 'lt': supabaseQuery = supabaseQuery.lt(filter.field, filter.value); break;
        case 'lte': supabaseQuery = supabaseQuery.lte(filter.field, filter.value); break;
        case 'like': supabaseQuery = supabaseQuery.like(filter.field, String(filter.value)); break;
        case 'in': supabaseQuery = supabaseQuery.in(filter.field, filter.value as unknown[]); break;
        case 'between': supabaseQuery = supabaseQuery.gte(filter.field, filter.value).lte(filter.field, filter.valueTo); break;
      }
    }
  }

  if (query.sorting) {
    for (const sort of query.sorting) {
      if (isColumnAllowed(query.dataset, sort.field)) {
        supabaseQuery = supabaseQuery.order(sort.field, { ascending: sort.direction === 'asc' });
      }
    }
  }

  supabaseQuery = supabaseQuery.range(offset, offset + pageSize - 1);

  const { data, error, count } = await supabaseQuery;
  if (error) throw new Error(`Report query failed: ${error.message}`);

  const totalRows = count ?? 0;
  const totalPages = Math.ceil(totalRows / pageSize);

  return {
    data: (data ?? []) as unknown as ReportRow[],
    totalRows,
    page,
    pageSize,
    totalPages,
    columns: safeColumns,
    rowCountEstimate: totalRows,
  };
}

export function reportToCsv(data: ReportRow[], columns: string[]): string {
  if (data.length === 0) return columns.join(',') + '\n';
  const header = columns.map(escapeCsvValue).join(',');
  const rows = data.map((row) =>
    columns.map((col) => escapeCsvValue(row[col])).join(',')
  );
  return [header, ...rows].join('\n') + '\n';
}

export function reportToXlsx(data: ReportRow[], columns: string[]): Buffer {
  const header = columns.join('\t');
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = row[col];
      if (val === null || val === undefined) return '';
      return String(val).replace(/[\t\n\r]/g, ' ');
    }).join('\t')
  );
  const tsv = [header, ...rows].join('\n');
  return Buffer.from(tsv, 'utf8');
}

export async function saveReportDefinition(userId: string, definition: {
  name: string;
  description?: string;
  reportType: ReportDataset;
  dataset: ReportDataset;
  filters?: ReportFilter[];
  columns?: ReportColumn[];
  grouping?: ReportGroup[];
  sorting?: ReportSort[];
  visibility?: 'private' | 'shared' | 'public';
}): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('saved_reports')
    .insert({
      name: definition.name,
      description: definition.description,
      report_type: definition.reportType,
      dataset: definition.dataset,
      filters: definition.filters ?? [],
      columns: definition.columns ?? [],
      grouping: definition.grouping ?? [],
      sorting: definition.sorting ?? [],
      owner_id: userId,
      visibility: definition.visibility ?? 'private',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to save report: ${error.message}`);
  return data.id;
}

export async function listSavedReports(userId: string, options?: { visibility?: string; limit?: number }) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from('saved_reports')
    .select('*')
    .or(`owner_id.eq.${userId},visibility.in.(shared,public)`)
    .order('created_at', { ascending: false });

  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list saved reports: ${error.message}`);
  return data ?? [];
}

export async function getSavedReport(reportId: string, userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('saved_reports')
    .select('*')
    .eq('id', reportId)
    .or(`owner_id.eq.${userId},visibility.in.(shared,public)`)
    .maybeSingle();

  if (error) throw new Error(`Failed to get saved report: ${error.message}`);
  return data;
}

export async function deleteSavedReport(reportId: string, userId: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('saved_reports')
    .delete()
    .eq('id', reportId)
    .eq('owner_id', userId);

  if (error) throw new Error(`Failed to delete saved report: ${error.message}`);
  return true;
}

export async function logReportRun(reportId: string | null, reportType: string, userId: string, status: string, details: {
  rowCount?: number;
  filters?: ReportFilter[];
  columns?: string[];
  outputFormat?: string;
  outputPath?: string;
  deliveryStatus?: string;
  deliveryChannel?: string;
  errorMessage?: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('report_run_history').insert({
    report_id: reportId,
    report_type: reportType,
    triggered_by: userId,
    status,
    row_count: details.rowCount,
    filters: details.filters ?? [],
    columns: details.columns ?? [],
    output_format: details.outputFormat,
    output_path: details.outputPath,
    delivery_status: details.deliveryStatus,
    delivery_channel: details.deliveryChannel,
    error_message: details.errorMessage,
    completed_at: status === 'completed' ? new Date().toISOString() : null,
  });

  if (error) throw new Error(`Failed to log report run: ${error.message}`);
  return true;
}

export async function listReportHistory(reportId: string, userId: string, limit = 50) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('report_run_history')
    .select('*')
    .eq('report_id', reportId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list report history: ${error.message}`);
  return data ?? [];
}

export { DATASET_TABLES };