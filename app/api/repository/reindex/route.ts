import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { enqueueReindex, reindexRepository } from '@/server/search/reindex';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const scope = typeof body.scope === 'string' ? body.scope : 'item';
    const targetId = typeof body.targetId === 'string' ? body.targetId : null;

    if (!['item', 'file', 'all'].includes(scope)) {
      return NextResponse.json({ success: false, error: 'scope must be item, file or all.' }, { status: 400 });
    }
    if (scope !== 'all' && !targetId) {
      return NextResponse.json({ success: false, error: 'targetId is required for item and file scope.' }, { status: 400 });
    }

    if (body.enqueueOnly === true) {
      const enqueued = await enqueueReindex(scope as 'item' | 'file' | 'all', targetId ?? undefined);
      return NextResponse.json({
        success: true,
        data: { scope, targetId, enqueued, note: 'Reindex runs in the worker queue.' },
      });
    }

    const result = await reindexRepository(scope as 'item' | 'file' | 'all', targetId ?? undefined);
    return NextResponse.json({
      success: result.errors.length === 0,
      data: { ...result, requestedBy: ctx.user.id },
      error: result.errors[0] ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reindex failed.';
    const status = message === 'Forbidden.' ? 403 : message === 'Authentication required.' ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
