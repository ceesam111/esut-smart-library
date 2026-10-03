import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { listFrameworks, getFrameworkFields, createFramework } from '@/server/catalogue/frameworks';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const frameworks = await listFrameworks();
    const result = await Promise.all(frameworks.map(async (f) => ({
      ...f,
      fields: await getFrameworkFields(f.id),
    })));
    return NextResponse.json({ frameworks: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json();
    if (!body.code || !body.name) {
      return NextResponse.json({ error: 'code and name are required' }, { status: 400 });
    }
    const framework = await createFramework(body);
    return NextResponse.json({ framework }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
