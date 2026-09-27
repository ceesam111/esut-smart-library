import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getAnalyticsSummary } from '@/server/analytics/eventRecorder';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const days = Math.min(Number(new URL(request.url).searchParams.get('days') || 30), 365);
    const summary = await getAnalyticsSummary(days);
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed';
    if (msg === 'Forbidden.' || msg === 'Authentication required.') {
      return NextResponse.json({ success: false, error: msg }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
