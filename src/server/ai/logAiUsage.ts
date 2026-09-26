import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { resolveTenant } from '@/server/tenant/resolveTenant';

export interface AiRunLogStart {
  tenantId?: string;
  actorUserId?: string | null;
  agentName: string;
  jobType: string;
  purpose: string;
  model: string;
  provider?: string;
  input: unknown;
}

export async function startAiRunLog(input: AiRunLogStart) {
  const tenant = input.tenantId ? { tenantId: input.tenantId } : await resolveTenant(input.actorUserId);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('agent_runs').insert({
    tenant_id: tenant.tenantId,
    agent_name: input.agentName,
    job_type: input.jobType,
    status: 'running',
    input: input.input ?? {},
    model: input.model,
    ai_provider: input.provider ?? 'vercel-ai-gateway',
    started_at: new Date().toISOString(),
    created_by: input.actorUserId ?? null,
  }).select('id, tenant_id').single();
  if (error) throw new Error(error.message);
  return data as { id: string; tenant_id: string };
}

export async function completeAiRunLog(input: { runId: string; tenantId: string; purpose: string; model: string; provider?: string; output: unknown; inputTokens?: number; outputTokens?: number; estimatedCost?: number }) {
  const supabase = getSupabaseAdminClient();
  await supabase.from('agent_runs').update({
    status: 'completed',
    output: input.output ?? {},
    input_tokens: input.inputTokens ?? 0,
    output_tokens: input.outputTokens ?? 0,
    estimated_cost: input.estimatedCost ?? 0,
    ...(input.provider ? { ai_provider: input.provider } : {}),
    finished_at: new Date().toISOString(),
  }).eq('id', input.runId);
  await supabase.from('tenant_ai_usage').insert({
    tenant_id: input.tenantId,
    agent_run_id: input.runId,
    provider: input.provider ?? 'vercel-ai-gateway',
    model: input.model,
    input_tokens: input.inputTokens ?? 0,
    output_tokens: input.outputTokens ?? 0,
    estimated_cost: input.estimatedCost ?? 0,
    purpose: input.purpose,
  });
}

export async function failAiRunLog(input: { runId: string; error: unknown }) {
  const supabase = getSupabaseAdminClient();
  await supabase.from('agent_runs').update({
    status: 'failed',
    error: input.error instanceof Error ? input.error.message : String(input.error),
    finished_at: new Date().toISOString(),
  }).eq('id', input.runId);
}
