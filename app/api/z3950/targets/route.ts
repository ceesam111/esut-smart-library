import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { listTargets, createTarget } from '@/server/z3950/targets';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const targets = await listTargets();
    return NextResponse.json({ targets });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json();
    if (!body.name || !body.host || !body.database) {
      return NextResponse.json({ error: 'name, host, and database are required' }, { status: 400 });
    }
    const target = await createTarget({
      name: body.name,
      host: body.host,
      port: body.port ?? 210,
      database: body.database,
      description: body.description ?? null,
      enabled: body.enabled ?? true,
      trusted: body.trusted ?? false,
      default_index: body.default_index ?? 'keyword',
      use_attribute_overrides: body.use_attribute_overrides ?? {},
    });
    return NextResponse.json({ target }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
