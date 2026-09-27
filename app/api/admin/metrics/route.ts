import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getPlatformMetrics } from '@/server/observability/metrics';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireRole(new Request('http://localhost'), GLOBAL_ADMIN_ROLES);
    const metrics = await getPlatformMetrics();
    return NextResponse.json({ success: true, data: metrics });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
