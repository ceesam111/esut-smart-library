import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getUserRoles } from '@/server/auth/requireRole';
import { createThesisDownload } from '@/server/thesis/secureThesisDownload';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireUser(request);
    const body = await request.json().catch(() => null);
    if (!body || typeof body.thesisId !== 'string') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const roles = await getUserRoles(ctx.user.id);
    const result = await createThesisDownload(body.thesisId, ctx.user.id, ctx.user.email ?? null, roles);

    if (result.reason) {
      const statusMap: Record<string, number> = {
        not_found: 404,
        no_file: 404,
        forbidden: 403,
        storage_error: 500,
      };
      return NextResponse.json({ error: result.reason }, { status: statusMap[result.reason] || 400 });
    }

    return NextResponse.json({ downloadUrl: result.downloadUrl });
  } catch (error) {
    if (error instanceof Error && /Authentication required|Invalid or expired session/.test(error.message)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
