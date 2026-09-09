import type { AgentJobHandler } from '../types';
import { createApproval, requireTenant, safeResult, textPayload } from './utils';
import { workerJsonCompletion } from '../ai';

export const extractRepositoryMetadata: AgentJobHandler = async (job, { supabase }) => {
  requireTenant(job);
  const repositoryItemId = textPayload(job, 'repositoryItemId');
  if (!repositoryItemId) throw new Error('repository.extractMetadata requires payload.repositoryItemId.');
  const { data: item, error } = await supabase.from('repository_items').select('*').eq('tenant_id', job.tenant_id).eq('id', repositoryItemId).single();
  if (error) throw new Error(error.message);
  const fallback = { title: item.title, abstract: item.abstract ?? null, keywords: item.keywords ?? [], warnings: ['Human review required before metadata changes.'] };
  const ai = await workerJsonCompletion({
    agentName: 'Thesia',
    jobType: job.job_type,
    fallback,
    systemPrompt: 'Extract and improve repository metadata. Return title, abstract, keywords array, department/faculty suggestions, and warnings. Do not fabricate missing facts.',
    userPrompt: JSON.stringify({ title: item.title, abstract: item.abstract, authors: item.authors, department: item.department, faculty: item.faculty, year: item.year, payload: job.payload }),
  });
  const approvalId = await createApproval(supabase, job, 'repository_metadata_cleanup', 'Repository metadata cleanup requires review', { repositoryItemId, proposed: ai.data, source: 'Thesia', usedAi: ai.usedAi });
  return safeResult('Repository metadata cleanup staged for approval.', { approvalId, repositoryItemId, suggestions: ai.data, usedAi: ai.usedAi });
};
