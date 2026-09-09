import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { rejectStagedCatalogueRow } from '@/server/catalogue/approveStagedRow';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json();
    const row = await rejectStagedCatalogueRow({ id: params.id, actorUserId: ctx.user.id, actorRole: ctx.primaryRole, reason: body.reason ?? '' });
    return NextResponse.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
