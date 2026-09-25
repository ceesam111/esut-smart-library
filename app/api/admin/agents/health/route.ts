import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireRole(request, GLOBAL_ADMIN_ROLES);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    if (message === 'Forbidden.') return NextResponse.json({ reachable: false, error: message }, { status: 403 });
    return NextResponse.json({ reachable: false, error: message }, { status: 401 });
  }
  void user;
  const url = process.env.WORKER_HEALTH_URL || `http://127.0.0.1:${process.env.WORKER_HEALTH_PORT || 8787}/health`;
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    const health = await response.json().catch(() => ({}));
    return NextResponse.json({ reachable: response.ok, health }, { status: response.ok ? 200 : 503 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ reachable: false, health: { error: message }, error: 'Worker not reachable' }, { status: 503 });
  }
}
