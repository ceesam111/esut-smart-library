import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES, canReadApprovalItem } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { approveItem } from '@/server/approvals/approveItem';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const supabase = getSupabaseAdminClient();
    const { data: item, error } = await supabase.from('approval_queue').select('content_type').eq('id', params.id).single();
    if (error) throw new Error(error.message);
    if (!canReadApprovalItem(ctx.roles, item.content_type)) throw new Error('Forbidden.');

    const body = await request.json().catch(() => ({}));
    const approval = await approveItem({
      id: params.id,
      actorUserId: ctx.user.id,
      actorRole: ctx.primaryRole,
      decisionNote: body.decisionNote ?? null,
    });
    return NextResponse.json({ approval });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
