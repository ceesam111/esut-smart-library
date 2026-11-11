import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { exportItemAIP } from '@/server/preservation/aipExport';
import { preservationErrorResponse } from '@/server/preservation/http';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const itemId = typeof body.itemId === 'string' ? body.itemId.trim() : '';
    if (!itemId) {
      return NextResponse.json({ success: false, error: 'itemId is required.' }, { status: 400 });
    }
    const versionId = typeof body.versionId === 'string' && body.versionId.trim() ? body.versionId.trim() : null;
    const bagName = typeof body.bagName === 'string' && body.bagName.trim() ? body.bagName.trim() : undefined;

    const result = await exportItemAIP(itemId, ctx.user.id, { versionId, bagName });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error, warnings: result.warnings ?? [] }, { status: 422 });
    }
    return NextResponse.json({
      success: true,
      data: {
        aipPath: result.aipPath,
        checksum: result.checksum,
        fileCount: result.fileCount,
        validation: result.validation,
        warnings: result.warnings ?? [],
      },
    });
  } catch (error) {
    return preservationErrorResponse(error);
  }
}
