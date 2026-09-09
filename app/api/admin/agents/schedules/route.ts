import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES, LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

function parsePayload(value: unknown) {
  if (!value) return {};
  if (typeof value === 'string') return JSON.parse(value || '{}');
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  throw new Error('payload must be a JSON object.');
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from('agent_schedules').select('*').eq('tenant_id', tenant.tenantId).order('next_run_at');
    if (error) throw new Error(error.message);
    return NextResponse.json({ schedules: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(request, GLOBAL_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const body = await request.json().catch(() => ({}));
    const label = String(body.label ?? '').trim();
    const agentName = String(body.agentName ?? '').trim();
    const jobType = String(body.jobType ?? '').trim();
    if (!label || !agentName || !jobType) throw new Error('label, agentName, and jobType are required.');
    const intervalMinutes = Number.isFinite(Number(body.intervalMinutes)) ? Math.max(5, Number(body.intervalMinutes)) : 1440;
    const priority = Number.isFinite(Number(body.priority)) ? Math.max(1, Math.min(10, Number(body.priority))) : 5;
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from('agent_schedules').insert({
      tenant_id: tenant.tenantId,
      label,
      agent_name: agentName,
      job_type: jobType,
      payload: parsePayload(body.payload),
      priority,
      interval_minutes: intervalMinutes,
      enabled: body.enabled !== false,
      next_run_at: typeof body.nextRunAt === 'string' && body.nextRunAt ? body.nextRunAt : new Date().toISOString(),
      created_by: ctx.user.id,
    }).select('*').single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ schedule: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
