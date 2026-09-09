import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES, canReadApprovalItem } from '@/server/auth/permissions';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { createApprovalItem } from '@/server/approvals/createApprovalItem';

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const status = request.nextUrl.searchParams.get('status') || 'pending';
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('approval_queue')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      approvals: (data ?? []).filter((item: { content_type: string }) => canReadApprovalItem(ctx.roles, item.content_type)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json();
    const item = await createApprovalItem({ ...body, submittedBy: body.submittedBy ?? ctx.user.id });
    return NextResponse.json({ approval: item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
