import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES, GLOBAL_ADMIN_ROLES, hasAnyRole } from '@/server/auth/permissions';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { isMissingSchemaError } from '@/server/supabase/schemaErrors';

const JOBS = {
  'system.healthCheck': { agent: 'Sysa', globalOnly: false },
  'reports.weeklyTenantReport': { agent: 'Sysa', globalOnly: false },
  'resources.harvest': { agent: 'Hari', globalOnly: false },
  'catalogue.enrich': { agent: 'Cardo', globalOnly: false },
  'resources.downloadToB2': { agent: 'Hari', globalOnly: true },
  'repository.extractMetadata': { agent: 'Thesia', globalOnly: false },
  'communications.draftNewsletter': { agent: 'Penna', globalOnly: false },
  'circulation.overdueReminders': { agent: 'Cizo', globalOnly: false },
} as const;

function parsePayload(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const status = request.nextUrl.searchParams.get('status');
    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from('agent_jobs')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ jobs: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const body = await request.json().catch(() => ({}));
    const jobType = String(body.jobType ?? '');
    const job = JOBS[jobType as keyof typeof JOBS];
    if (!job) throw new Error('Unsupported agent job type.');
    if (job.globalOnly && !hasAnyRole(ctx.roles, GLOBAL_ADMIN_ROLES)) throw new Error('Forbidden.');

    const priority = Number.isFinite(Number(body.priority)) ? Math.max(1, Math.min(10, Number(body.priority))) : 5;
    const runAfter = typeof body.runAfter === 'string' && body.runAfter ? body.runAfter : new Date().toISOString();
    const payload = parsePayload(body.payload);

    const supabase = getSupabaseAdminClient();
    const { data: setting, error: settingError } = await supabase
      .from('agent_settings')
      .select('enabled,max_daily_jobs,requires_approval,risk_level')
      .eq('tenant_id', tenant.tenantId)
      .eq('agent_name', job.agent)
      .maybeSingle();
    if (settingError && !isMissingSchemaError(settingError)) throw new Error(settingError.message);
    if (!setting && !settingError) {
      await supabase.from('agent_settings').upsert({
        tenant_id: tenant.tenantId,
        agent_name: job.agent,
        enabled: true,
        risk_level: 'medium',
        requires_approval: true,
        max_daily_jobs: 25,
      }, { onConflict: 'tenant_id,agent_name' });
    }
    if (setting && !setting.enabled) throw new Error(`${job.agent} is disabled for this tenant.`);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from('agent_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.tenantId)
      .eq('agent_name', job.agent)
      .gte('created_at', since);
    if (countError) throw new Error(countError.message);
    if (setting?.max_daily_jobs && (count ?? 0) >= setting.max_daily_jobs) throw new Error(`${job.agent} reached its daily job limit.`);

    const { data, error } = await supabase.from('agent_jobs').insert({
      tenant_id: tenant.tenantId,
      job_type: jobType,
      agent_name: job.agent,
      payload: {
        ...payload,
        agent_control: {
          requiresApproval: setting?.requires_approval ?? true,
          riskLevel: setting?.risk_level ?? 'medium',
          templateId: typeof body.templateId === 'string' ? body.templateId : null,
        },
      },
      priority,
      run_after: runAfter,
      created_by: ctx.user.id,
    }).select('*').single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ job: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
