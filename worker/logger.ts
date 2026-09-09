import type { AgentJob } from './types';

export async function createAgentRun(supabase: any, job: AgentJob) {
  const { data, error } = await supabase.from('agent_runs').insert({
    tenant_id: job.tenant_id,
    agent_name: job.agent_name,
    job_type: job.job_type,
    status: 'running',
    input: job.payload ?? {},
    started_at: new Date().toISOString(),
    created_by: job.created_by,
  }).select('id').single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function finishAgentRun(supabase: any, runId: string, status: 'completed' | 'failed', output: unknown, error?: string | null) {
  await supabase.from('agent_runs').update({ status, output: output ?? {}, error: error ?? null, finished_at: new Date().toISOString() }).eq('id', runId);
}

export async function writeWorkerAudit(supabase: any, job: AgentJob, action: string, metadata: Record<string, unknown>) {
  await supabase.from('audit_logs').insert({
    tenant_id: job.tenant_id,
    actor_user_id: job.created_by,
    actor_role: 'worker',
    action,
    entity_type: 'agent_job',
    entity_id: job.id,
    metadata,
    user_agent: job.locked_by,
  });
}
