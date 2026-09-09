import type { AgentJobHandler } from '../types';
import { createApproval, requireTenant, safeResult, textPayload } from './utils';
import { workerJsonCompletion } from '../ai';

export const draftNewsletter: AgentJobHandler = async (job, { supabase }) => {
  requireTenant(job);
  const topic = textPayload(job, 'topic', 'Library update');
  const fallback = { subject: topic, headline: topic, body: job.payload.draft ?? `Library update: ${topic}`, callToAction: 'Visit the library website for details.', warnings: ['Review tone, dates, names, and links before sending.'] };
  const ai = await workerJsonCompletion({
    agentName: 'Penna',
    jobType: job.job_type,
    fallback,
    systemPrompt: 'Draft concise Nigerian university library communications. Keep it factual, warm, and approval-ready. Return subject, headline, body, callToAction, warnings.',
    userPrompt: JSON.stringify({ topic, audience: job.payload.audience ?? 'library users', notes: job.payload.notes ?? null, draft: job.payload.draft ?? null }),
  });
  const approvalId = await createApproval(supabase, job, 'newsletter_draft', `Newsletter draft: ${topic}`, { topic, audience: job.payload.audience ?? 'library users', draft: ai.data, source: 'Penna', requiresHumanReview: true, usedAi: ai.usedAi });
  return safeResult('Newsletter draft staged for approval.', { approvalId, draft: ai.data, usedAi: ai.usedAi });
};

export const overdueReminders: AgentJobHandler = async (job, { supabase }) => {
  requireTenant(job);
  const { count, error } = await supabase.from('loans').select('id', { count: 'exact', head: true }).lt('due_date', new Date().toISOString()).eq('status', 'active');
  if (error) throw new Error(error.message);
  const approvalId = await createApproval(supabase, job, 'overdue_reminder_summary', 'Overdue circulation reminder summary', { overdueCount: count ?? 0, source: 'Cizo', resendConfigured: Boolean(process.env.RESEND_API_KEY), recommendation: 'Review overdue accounts before sending reminders.' });
  return safeResult('Overdue reminder summary staged for staff review.', { overdueCount: count ?? 0, approvalId, resendConfigured: Boolean(process.env.RESEND_API_KEY) });
};
