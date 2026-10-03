import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { listOverlayRules, createOverlayRule } from '@/server/catalogue/overlay';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const rules = await listOverlayRules();
    return NextResponse.json({ rules });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json();
    if (!body.name || !body.tag || !body.action) {
      return NextResponse.json({ error: 'name, tag, and action are required' }, { status: 400 });
    }
    const rule = await createOverlayRule(body);
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
