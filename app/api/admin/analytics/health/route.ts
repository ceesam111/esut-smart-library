import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getAnalyticsMetrics } from '@/server/analytics/eventCapture';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const metrics = getAnalyticsMetrics();
    return NextResponse.json({
      success: true,
      data: {
        ...metrics,
        healthy: metrics.writeFailures === 0 || (metrics.eventsPersisted > 0 && metrics.eventsPersisted > metrics.writeFailures),
        limitations: 'In-memory counters reset on server restart; they cover this process only.',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
