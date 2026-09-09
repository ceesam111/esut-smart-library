import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireRole(request, GLOBAL_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [jobs, failedJobs, runningJobs, runs, usage] = await Promise.all([
      supabase.from('agent_jobs').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.tenantId).gte('created_at', since),
      supabase.from('agent_jobs').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.tenantId).eq('status', 'failed'),
      supabase.from('agent_jobs').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.tenantId).eq('status', 'running'),
      supabase.from('agent_runs').select('id,status,agent_name,job_type,created_at').eq('tenant_id', tenant.tenantId).gte('created_at', since).limit(500),
      supabase.from('tenant_ai_usage').select('agent_name,input_tokens,output_tokens,estimated_cost,created_at').eq('tenant_id', tenant.tenantId).gte('created_at', since).limit(500),
    ]);
    for (const result of [jobs, failedJobs, runningJobs, runs, usage]) if (result.error) throw new Error(result.error.message);
    const usageRows = usage.data ?? [];
    return NextResponse.json({
      metrics: {
        jobs24h: jobs.count ?? 0,
        failedOpen: failedJobs.count ?? 0,
        running: runningJobs.count ?? 0,
        runs24h: runs.data ?? [],
        aiUsage24h: {
          calls: usageRows.length,
          inputTokens: usageRows.reduce((sum: number, row: { input_tokens: number | null }) => sum + (row.input_tokens ?? 0), 0),
          outputTokens: usageRows.reduce((sum: number, row: { output_tokens: number | null }) => sum + (row.output_tokens ?? 0), 0),
          estimatedCost: usageRows.reduce((sum: number, row: { estimated_cost: number | null }) => sum + Number(row.estimated_cost ?? 0), 0),
          byAgent: usageRows.reduce<Record<string, number>>((acc, row: { agent_name: string | null }) => {
            const key = row.agent_name ?? 'unknown';
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
          }, {}),
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
