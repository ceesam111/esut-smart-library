import type { AgentJob } from '../types';

export function requireTenant(job: AgentJob) {
  if (!job.tenant_id) throw new Error('tenant_id is required.');
}

export function textPayload(job: AgentJob, key: string, fallback = '') {
  const value = job.payload?.[key];
  return typeof value === 'string' ? value : fallback;
}

export async function createApproval(supabase: any, job: AgentJob, contentType: string, title: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase.from('approval_queue').insert({
    tenant_id: job.tenant_id,
    content_type: contentType,
    action_type: 'worker_action',
    risk_tier: 'human',
    title,
    payload,
    status: 'pending',
    submitted_by: job.created_by,
  }).select('id').single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export function safeResult(message: string, extra: Record<string, unknown> = {}) {
  return { ok: true as const, data: { message, ...extra } };
}
