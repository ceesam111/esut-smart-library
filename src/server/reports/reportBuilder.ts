import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { escapeCsvValue } from '@/server/analytics/csv';
import { buildXlsx, type XlsxOptions } from './xlsx';

export type ReportDataset = 'circulation' | 'patrons' | 'catalogue' | 'repository' | 'acquisitions' | 'serials' | 'analytics' | 'fines';

export const MAX_PAGE_SIZE = 500;
export const EXPORT_MAX_ROWS = 5000;
export const MAX_FILTERS = 20;
export const REPORT_QUERY_TIMEOUT_MS = 15_000;

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
    allowedColumns: ['id', 'patron_id', 'catalogue_item_id', 'checkout_date', 'due_date', 'return_date', 'renewed_count', 'status', 'created_at'],
  },
  patrons: {
    table: 'patrons',
    allowedColumns: ['id', 'user_id', 'full_name', 'surname', 'other_names', 'email', 'phone', 'patron_category', 'faculty_code', 'faculty_name', 'department', 'programme', 'status', 'account_role', 'membership_expires_at', 'created_at'],
  },
  catalogue: {
    table: 'catalogue_items',
    allowedColumns: ['id', 'title', 'authors', 'isbn', 'publisher', 'year', 'faculty_code', 'call_number', 'format', 'language', 'status', 'item_type', 'total_copies', 'available_copies', 'created_at'],
  },
  repository: {
    table: 'repository_items',
    allowedColumns: ['id', 'title', 'authors', 'item_type', 'type', 'status', 'visibility', 'year', 'faculty_code', 'community_id', 'collection_id', 'submitter_id', 'created_at', 'updated_at'],
  },
  acquisitions: {
    table: 'purchase_orders',
    allowedColumns: ['id', 'po_number', 'supplier_id', 'status', 'currency', 'order_date', 'expected_date', 'faculty_code', 'created_at'],
  },
  serials: {
    table: 'serials_subscriptions',
    allowedColumns: ['id', 'title', 'issn', 'issn_online', 'publisher', 'frequency', 'start_date', 'renewal_date', 'cost_per_year', 'currency', 'supplier_id', 'status', 'created_at'],
  },
  analytics: {
    table: 'analytics_events',
    allowedColumns: ['id', 'event_type', 'user_id', 'entity_type', 'entity_id', 'search_query', 'bot_flag', 'event_category', 'faculty', 'created_at'],
  },
  fines: {
    table: 'fines',
    allowedColumns: ['id', 'patron_id', 'amount', 'reason', 'reference_type', 'reference_id', 'status', 'paid_at', 'created_at'],
  },
};

const SENSITIVE_COLUMNS = new Set(['email', 'phone', 'first_name', 'last_name', 'full_name', 'surname', 'other_names']);

export function isColumnAllowed(dataset: ReportDataset, field: string): boolean {
  return DATASET_TABLES[dataset]?.allowedColumns.includes(field) ?? false;
}

export function isSensitiveColumn(field: string): boolean {
  return SENSITIVE_COLUMNS.has(field);
}

/** Default columns for a dataset: every allowed column except sensitive PII. */
export function defaultColumnsFor(dataset: ReportDataset): string[] {
  return DATASET_TABLES[dataset].allowedColumns.filter((c) => !isSensitiveColumn(c));
}

export async function runReport(query: ReportQuery): Promise<ReportResult> {
  const supabase = getSupabaseAdminClient();
  const dataset = DATASET_TABLES[query.dataset];
  if (!dataset) throw new Error(`Unknown dataset: ${query.dataset}`);

  if (query.filters && query.filters.length > MAX_FILTERS) {
    throw new Error(`Too many filters: maximum ${MAX_FILTERS}`);
  }

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(Math.max(1, query.pageSize ?? 50), MAX_PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  const requestedColumns = query.columns?.length
    ? query.columns.map((c) => c.field)
    : defaultColumnsFor(query.dataset);
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REPORT_QUERY_TIMEOUT_MS);
  let data: unknown[] | null;
  let error: { message: string } | null;
  let count: number | null;
  try {
    const response = await supabaseQuery.abortSignal(controller.signal);
    data = response.data;
    error = response.error;
    count = response.count;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Report query timed out after ${REPORT_QUERY_TIMEOUT_MS}ms`, { cause: err });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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

export async function reportToXlsx(
  data: ReportRow[],
  columns: string[],
  options?: XlsxOptions,
): Promise<Buffer> {
  return buildXlsx(data, columns, options ?? {});
}

/** Fetches up to `maxRows` rows across pages (each page capped at MAX_PAGE_SIZE). */
export async function runReportPaged(
  query: ReportQuery,
  maxRows = EXPORT_MAX_ROWS,
): Promise<ReportResult> {
  const rows: ReportRow[] = [];
  let columns: string[] = [];
  let totalRows = 0;
  let page = 1;
  while (rows.length < maxRows) {
    const result = await runReport({ ...query, page });
    columns = result.columns;
    totalRows = result.totalRows;
    rows.push(...result.data);
    if (result.data.length === 0 || page >= result.totalPages) break;
    page += 1;
  }
  const data = rows.slice(0, maxRows);
  return {
    data,
    totalRows,
    page: 1,
    pageSize: data.length,
    totalPages: 1,
    columns,
    rowCountEstimate: totalRows,
  };
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

export async function listReportHistory(reportId: string | null, userId: string, limit = 50) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from('report_run_history')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (reportId) {
    query = query.eq('report_id', reportId);
  } else {
    const { data: owned } = await supabase
      .from('saved_reports')
      .select('id')
      .eq('owner_id', userId);
    const ownedIds = (owned ?? []).map((row: { id: string }) => row.id);
    query = ownedIds.length > 0
      ? query.or(`triggered_by.eq.${userId},report_id.in.(${ownedIds.join(',')})`)
      : query.eq('triggered_by', userId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list report history: ${error.message}`);
  return data ?? [];
}

export { DATASET_TABLES };