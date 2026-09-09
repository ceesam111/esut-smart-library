import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES, LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from('agent_settings').select('*').eq('tenant_id', tenant.tenantId).order('agent_name');
    if (error) throw new Error(error.message);
    return NextResponse.json({ settings: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireRole(request, GLOBAL_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const body = await request.json().catch(() => ({}));
    const agentName = String(body.agentName ?? '');
    if (!agentName) throw new Error('agentName is required.');
    const patch = {
      tenant_id: tenant.tenantId,
      agent_name: agentName,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : true,
      risk_level: ['low', 'medium', 'high'].includes(body.riskLevel) ? body.riskLevel : 'medium',
      requires_approval: typeof body.requiresApproval === 'boolean' ? body.requiresApproval : true,
      max_daily_jobs: Number.isFinite(Number(body.maxDailyJobs)) ? Math.max(1, Math.min(1000, Number(body.maxDailyJobs))) : 50,
      notes: typeof body.notes === 'string' ? body.notes : null,
    };
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from('agent_settings').upsert(patch, { onConflict: 'tenant_id,agent_name' }).select('*').single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ setting: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
