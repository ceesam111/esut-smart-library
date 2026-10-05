import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { routeError } from '@/server/http/routeError';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export const dynamic = 'force-dynamic';

/**
 * Admin monitoring for offline circulation: workstation registry, ledger
 * status counts and the most recent transactions/conflicts. Read-only.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const supabase = getSupabaseAdminClient();

    const [workstations, recent, statusCounts] = await Promise.all([
      supabase
        .from('offline_workstations')
        .select('device_id, label, branch, registered_by, registered_at, last_seen_at, last_sync_at, last_seq')
        .order('last_seen_at', { ascending: false })
        .limit(50),
      supabase
        .from('offline_transactions')
        .select(
          'client_txn_id, device_id, operator_id, queued_by, operation, local_seq, status, conflict_code, message, resolution, resolution_note, attempts, created_at, updated_at, applied_at',
        )
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('offline_transactions').select('status', { count: 'exact', head: false }).limit(1000),
    ]);

    if (workstations.error) throw new Error(workstations.error.message);
    if (recent.error) throw new Error(recent.error.message);
    if (statusCounts.error) throw new Error(statusCounts.error.message);

    const counts: Record<string, number> = {};
    for (const row of (statusCounts.data ?? []) as Array<{ status: string }>) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }

    return NextResponse.json({
      success: true,
      workstations: workstations.data ?? [],
      recent: recent.data ?? [],
      counts,
    });
  } catch (error) {
    return routeError(error);
  }
}
