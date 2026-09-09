import type { AgentJobHandler } from '../types';
import { createApproval, requireTenant, safeResult } from './utils';
import { workerJsonCompletion } from '../ai';

export const weeklyTenantReport: AgentJobHandler = async (job, { supabase }) => {
  requireTenant(job);
  const [{ count: jobs }, { count: candidates }, { count: requests }] = await Promise.all([
    supabase.from('agent_jobs').select('id', { count: 'exact', head: true }).eq('tenant_id', job.tenant_id),
    supabase.from('resource_candidates').select('id', { count: 'exact', head: true }).eq('tenant_id', job.tenant_id),
    supabase.from('resource_requests').select('id', { count: 'exact', head: true }).eq('tenant_id', job.tenant_id),
  ]);
  const fallback = { summary: 'Weekly operations summary prepared for review.', highlights: [`${jobs ?? 0} agent jobs`, `${candidates ?? 0} resource candidates`, `${requests ?? 0} resource requests`], risks: [], recommendedActions: ['Review failed jobs and pending approvals.'] };
  const ai = await workerJsonCompletion({
    agentName: 'Sysa',
    jobType: job.job_type,
    fallback,
    systemPrompt: 'Create a concise library operations report from metrics. Return summary, highlights array, risks array, recommendedActions array.',
    userPrompt: JSON.stringify({ jobs, candidates, requests, tenantId: job.tenant_id }),
  });
  const approvalId = await createApproval(supabase, job, 'weekly_tenant_report', 'Weekly tenant report draft', { jobs, candidates, requests, report: ai.data, source: 'Sysa', usedAi: ai.usedAi });
  return safeResult('Weekly tenant report staged for review.', { approvalId, jobs, candidates, requests, report: ai.data, usedAi: ai.usedAi });
};

export const systemHealthCheck: AgentJobHandler = async (job, { supabase }) => {
  requireTenant(job);
  const { error } = await supabase.from('agent_jobs').select('id', { head: true, count: 'exact' }).limit(1);
  if (error) throw new Error(error.message);
  return safeResult('Worker database health check passed.', { supabase: 'ok', worker: 'ok' });
};
