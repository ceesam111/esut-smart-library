import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { buildSegments, SMALL_GROUP_THRESHOLD } from '@/server/analytics/segmentation';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') ?? '30', 10), 365);
    const groupByParam = searchParams.get('group_by') ?? 'faculty';
    if (!['faculty', 'department', 'patron_role'].includes(groupByParam)) {
      return NextResponse.json({ error: 'group_by must be faculty, department, or patron_role' }, { status: 400 });
    }
    const groupBy = groupByParam as 'faculty' | 'department' | 'patron_role';

    const supabase = getSupabaseAdminClient();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: events, error } = await supabase
      .from('analytics_events')
      .select('faculty, department, patron_role, event_type, entity_id')
      .gte('created_at', since)
      .limit(50000);
    if (error) throw new Error(error.message);

    const result = buildSegments(events ?? [], groupBy);

    return NextResponse.json({
      success: true,
      data: {
        group_by: groupBy,
        threshold: SMALL_GROUP_THRESHOLD,
        segments: result,
        limitations: 'Segments with fewer than the threshold number of events are suppressed to protect privacy.',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
