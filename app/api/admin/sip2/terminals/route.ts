import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import {
  createSip2Terminal,
  deleteSip2Terminal,
  listSip2Audit,
  listSip2Terminals,
  resetSip2TerminalSecret,
  updateSip2Terminal,
} from '@/server/sip2/terminalsAdmin';

export const dynamic = 'force-dynamic';

function errorResponse(error: unknown, fallback: string) {
  const msg = error instanceof Error ? error.message : fallback;
  if (msg === 'Authentication required.') return NextResponse.json({ success: false, error: msg }, { status: 401 });
  if (msg === 'Forbidden.') return NextResponse.json({ success: false, error: msg }, { status: 403 });
  if (msg.startsWith('Invalid')) return NextResponse.json({ success: false, error: msg }, { status: 400 });
  return NextResponse.json({ success: false, error: msg }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const [terminals, audit] = await Promise.all([listSip2Terminals(), listSip2Audit()]);
    return NextResponse.json({ success: true, data: { terminals, audit } });
  } catch (error) {
    return errorResponse(error, 'Failed to load SIP2 terminals.');
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json().catch(() => null);
    if (!body) throw new Error('Invalid request body.');
    const created = await createSip2Terminal(body);
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    return errorResponse(error, 'Failed to create SIP2 terminal.');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json().catch(() => null);
    if (!body) throw new Error('Invalid request body.');
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) throw new Error('Invalid id.');
    if (body.action === 'reset-secret') {
      const result = await resetSip2TerminalSecret(id);
      return NextResponse.json({ success: true, data: result });
    }
    await updateSip2Terminal(id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Failed to update SIP2 terminal.');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new Error('Invalid id.');
    await deleteSip2Terminal(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Failed to delete SIP2 terminal.');
  }
}
