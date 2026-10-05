import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { routeError } from '@/server/http/routeError';
import {
  syncOfflineBatch,
  BatchValidationError,
  type OfflineBatchInput,
} from '@/server/circulation/offlineSync';
import { createSupabaseOfflineStore } from '@/server/circulation/supabaseOfflineStore';
import { createOfflineSyncHooks } from '@/server/circulation/offlineSyncHooks';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = (await request.json().catch(() => null)) as OfflineBatchInput | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'JSON body required' }, { status: 400 });
    }

    const summary = await syncOfflineBatch(
      body,
      { operatorId: ctx.user.id, roles: ctx.roles, hooks: createOfflineSyncHooks() },
      createSupabaseOfflineStore(),
    );

    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    if (error instanceof BatchValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return routeError(error);
  }
}
