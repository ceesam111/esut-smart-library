import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getUserRoles } from '@/server/auth/requireRole';
import { createSecureRepositoryDownload } from '@/server/storage/secureDownload';
import { trackRepositoryFileDownload } from '@/server/analytics/repositoryEvents';
import { loadPatronContext } from '@/server/analytics/patronContext';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireUser(request);
    const body = await request.json().catch(() => null);
    if (!body || typeof body.itemId !== 'string') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const roles = await getUserRoles(ctx.user.id);
    const result = await createSecureRepositoryDownload(body.itemId, ctx.user.id, roles);

    if (result.reason) {
      const statusMap: Record<string, number> = {
        not_found: 404,
        not_published: 403,
        embargoed: 403,
        forbidden: 403,
        no_file: 404,
        storage_error: 500,
      };
      return NextResponse.json({ error: result.reason }, { status: statusMap[result.reason] || 400 });
    }

    const patron = await loadPatronContext(ctx.user.id);
    await trackRepositoryFileDownload(body.itemId, null, null, {
      userId: ctx.user.id,
      userAgent: request.headers.get('user-agent') ?? undefined,
      referrer: request.headers.get('referer') ?? undefined,
      faculty: patron.faculty,
      department: patron.department,
      patronRole: patron.patronRole,
    });

    return NextResponse.json({ downloadUrl: result.downloadUrl });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
