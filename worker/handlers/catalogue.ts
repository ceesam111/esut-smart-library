import type { AgentJobHandler } from '../types';
import { requireTenant, safeResult } from './utils';
import { workerJsonCompletion } from '../ai';

export const enrichCatalogue: AgentJobHandler = async (job, { supabase }) => {
  requireTenant(job);
  const rowId = typeof job.payload.stagingId === 'string' ? job.payload.stagingId : null;
  if (!rowId) return safeResult('No stagingId supplied; nothing changed.', { skipped: true });
  const { data: row, error } = await supabase.from('catalogue_staging').select('*').eq('tenant_id', job.tenant_id).eq('id', rowId).single();
  if (error) throw new Error(error.message);
  const fallback = {
    subjects: row.subjects ?? [],
    summary: 'Cardo prepared this row for librarian review.',
    warnings: ['Review title, author, ISBN, subject headings, and call number before approval.'],
    confidence: 'needs_review',
  };
  const ai = await workerJsonCompletion({
    agentName: 'Cardo',
    jobType: job.job_type,
    fallback,
    systemPrompt: 'Suggest catalogue metadata improvements only. Do not invent facts. Use null or warnings when unsure.',
    userPrompt: JSON.stringify({ title: row.title, author: row.author, isbn: row.isbn, publisher: row.publisher, year: row.publication_year, subjects: row.subjects, raw: row.raw_data ?? row }),
  });
  const warnings = [
    ...(row.validation_warnings ?? []),
    { code: 'worker_review', message: ai.data.summary ?? fallback.summary, suggestions: ai.data, used_ai: ai.usedAi },
  ];
  const { error: updateError } = await supabase.from('catalogue_staging').update({ validation_warnings: warnings, confidence: ai.data.confidence || row.confidence || 'needs_review' }).eq('id', rowId);
  if (updateError) throw new Error(updateError.message);
  return safeResult('Catalogue staging row enriched for review.', { stagingId: rowId, suggestions: ai.data, usedAi: ai.usedAi });
};
