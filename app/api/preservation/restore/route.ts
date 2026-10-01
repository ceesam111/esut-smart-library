import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { listRestoreRuns, runRestore, RESTORE_TARGETS } from '@/server/preservation/restore';
import { preservationErrorResponse } from '@/server/preservation/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const runs = await listRestoreRuns({ limit: 50 });
    return NextResponse.json({ success: true, data: runs });
  } catch (error) {
    return preservationErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const aipPath = typeof body.aipPath === 'string' ? body.aipPath.trim() : '';
    if (!aipPath) {
      return NextResponse.json({ success: false, error: 'aipPath is required.' }, { status: 400 });
    }
    if (body.target === undefined || body.target === null || body.target === '') {
      return NextResponse.json(
        { success: false, error: `target is required. Permitted targets: ${RESTORE_TARGETS.join(', ')}.` },
        { status: 400 },
      );
    }

    const result = await runRestore({ aipPath, target: body.target, actorId: ctx.user.id });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, runId: result.runId, status: result.status, errors: result.errors, warnings: result.warnings, error: result.error },
        { status: 422 },
      );
    }
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return preservationErrorResponse(error);
  }
}
