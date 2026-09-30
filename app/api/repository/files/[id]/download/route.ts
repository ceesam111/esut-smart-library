import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getUserRoles } from '@/server/auth/requireRole';
import { getFileDownload } from '@/server/repository/fileService';

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

    return NextResponse.json({ downloadUrl: result.downloadUrl });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required.') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
