import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const { transactions } = body as { transactions?: Array<Record<string, unknown>> };

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ success: false, error: 'transactions array required' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const results: Array<{ offline_id: string; status: string }> = [];

    for (const tx of transactions) {
      const { offline_id, action, item_id, patron_id, due_date, returned_date, fine_amount } = tx as {
        offline_id?: string;
        action?: string;
        item_id?: string;
        patron_id?: string;
        due_date?: string;
        returned_date?: string;
        fine_amount?: number;
      };

      if (!offline_id || !action) {
        results.push({ offline_id: offline_id || '', status: 'error' });
        continue;
      }

      const { error } = await supabase.from('circulation_transactions').insert({
        offline_id,
        action,
        item_id: item_id || null,
        patron_id: patron_id || null,
        due_date: due_date || null,
        returned_date: returned_date || null,
        fine_amount: fine_amount || 0,
        synced_at: new Date().toISOString(),
      });

      results.push({ offline_id, status: error ? 'error' : 'ok' });
    }

    const okCount = results.filter((r) => r.status === 'ok').length;
    return NextResponse.json({ success: true, synced: okCount, total: transactions.length, results });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
