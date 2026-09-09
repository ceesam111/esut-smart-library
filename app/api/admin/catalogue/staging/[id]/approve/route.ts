import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { approveStagedCatalogueRow } from '@/server/catalogue/approveStagedRow';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const result = await approveStagedCatalogueRow({ id: params.id, actorUserId: ctx.user.id, actorRole: ctx.primaryRole });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
