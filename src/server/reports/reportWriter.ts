import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface ReportConfig {
  type: 'circulation' | 'acquisitions' | 'repository' | 'serials' | 'fines';
  startDate: string;
  endDate: string;
  format: 'csv' | 'json';
}

export interface ReportResult {
  type: string;
  generatedAt: string;
  rowCount: number;
  data: Array<Record<string, unknown>>;
}

export async function generateReport(config: ReportConfig): Promise<ReportResult> {
  const supabase = getSupabaseAdminClient();
  let data: Array<Record<string, unknown>> = [];

  switch (config.type) {
    case 'circulation': {
      const { data: loans } = await supabase
        .from('loans')
        .select('id, item_id, patron_id, checkout_date, due_date, returned_date, status, fine_amount')
        .gte('checkout_date', config.startDate)
        .lte('checkout_date', config.endDate)
        .limit(1000);
      data = loans ?? [];
      break;
    }
    case 'acquisitions': {
      const { data: pos } = await supabase
        .from('purchase_orders')
        .select('id, po_number, supplier_id, status, total_amount, currency, order_date')
        .gte('order_date', config.startDate)
        .lte('order_date', config.endDate)
        .limit(1000);
      data = pos ?? [];
      break;
    }
    case 'repository': {
      const { data: items } = await supabase
        .from('repository_items')
        .select('id, title, authors, item_type, status, visibility, created_at')
        .gte('created_at', config.startDate)
        .lte('created_at', config.endDate)
        .limit(1000);
      data = items ?? [];
      break;
    }
    case 'serials': {
      const { data: serials } = await supabase
        .from('serials_subscriptions')
        .select('id, title, issn, publisher, status, start_date, renewal_date')
        .limit(1000);
      data = serials ?? [];
      break;
    }
    case 'fines': {
      const { data: fines } = await supabase
        .from('fines')
        .select('id, loan_id, patron_id, amount, status, created_at')
        .gte('created_at', config.startDate)
        .lte('created_at', config.endDate)
        .limit(1000);
      data = fines ?? [];
      break;
    }
  }

  return {
    type: config.type,
    generatedAt: new Date().toISOString(),
    rowCount: data.length,
    data,
  };
}

export function reportToCsv(data: Array<Record<string, unknown>>): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}
