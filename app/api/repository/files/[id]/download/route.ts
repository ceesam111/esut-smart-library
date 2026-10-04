import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getUserRoles } from '@/server/auth/requireRole';
import { getFileDownload } from '@/server/repository/fileService';
import { trackRepositoryFileDownload } from '@/server/analytics/repositoryEvents';
import { loadPatronContext } from '@/server/analytics/patronContext';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireUser(request);
    const { id } = await params;
    const roles = await getUserRoles(ctx.user.id);
    const result = await getFileDownload(id, ctx.user.id, roles);

    if (result.reason) {
      const statusMap: Record<string, number> = {
        not_found: 404,
        embargoed: 403,
        forbidden: 403,
        storage_error: 500,
      };
      return NextResponse.json({ error: result.reason }, { status: statusMap[result.reason] || 400 });
    }

    if (result.itemId) {
      const patron = await loadPatronContext(ctx.user.id);
      await trackRepositoryFileDownload(result.itemId, result.fileId || id, null, {
        userId: ctx.user.id,
        userAgent: request.headers.get('user-agent') ?? undefined,
        referrer: request.headers.get('referer') ?? undefined,
        faculty: patron.faculty,
        department: patron.department,
        patronRole: patron.patronRole,
      });
    }

    return NextResponse.json({ downloadUrl: result.downloadUrl });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
