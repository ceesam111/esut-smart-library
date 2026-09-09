import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireRole(request, GLOBAL_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('agent_jobs')
      .update({ status: 'pending', error: null, run_after: new Date().toISOString(), locked_at: null, locked_by: null, finished_at: null })
      .eq('id', params.id)
      .eq('tenant_id', tenant.tenantId)
      .in('status', ['failed', 'cancelled'])
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ job: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
