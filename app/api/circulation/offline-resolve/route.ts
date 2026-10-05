import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES, GLOBAL_ADMIN_ROLES, hasAnyRole } from '@/server/auth/permissions';
import { routeError } from '@/server/http/routeError';
import {
  resolveOfflineTransaction,
  BatchValidationError,
  type ResolutionAction,
} from '@/server/circulation/offlineSync';
import { createSupabaseOfflineStore } from '@/server/circulation/supabaseOfflineStore';
import { createOfflineSyncHooks } from '@/server/circulation/offlineSyncHooks';

export const dynamic = 'force-dynamic';

/**
 * Resolve an offline-sync conflict:
 *  - retry         → put the ledger row back to PENDING (re-applies on next sync)
 *  - accept_server → keep server state, drop the queued transaction
 *  - cancel        → librarian cancels the queued transaction
 *  - override      → force-apply a soft business-rule conflict (note required,
 *                    restricted to GLOBAL_ADMIN_ROLES, audited)
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = (await request.json().catch(() => null)) as {
      client_txn_id?: string;
      action?: ResolutionAction;
      note?: string;
    } | null;

    if (!body?.client_txn_id || !body.action) {
      return NextResponse.json({ success: false, error: 'client_txn_id and action required' }, { status: 400 });
    }
    if (!['retry', 'accept_server', 'cancel', 'override'].includes(body.action)) {
      return NextResponse.json({ success: false, error: 'invalid action' }, { status: 400 });
    }
    if (body.action === 'override' && !hasAnyRole(ctx.roles, GLOBAL_ADMIN_ROLES)) {
      return NextResponse.json({ success: false, error: 'Override requires an administrator role' }, { status: 403 });
    }

    const outcome = await resolveOfflineTransaction(
      { client_txn_id: body.client_txn_id, action: body.action, note: body.note },
      { operatorId: ctx.user.id, roles: ctx.roles, hooks: createOfflineSyncHooks() },
      createSupabaseOfflineStore(),
    );

    if (!outcome.found) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...outcome });
  } catch (error) {
    if (error instanceof BatchValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return routeError(error);
  }
}
