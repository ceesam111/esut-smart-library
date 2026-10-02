import type { AgentJobHandler } from '../types';
import { getSupabaseAdminClient } from '../../src/server/supabase/adminClient';
import { readStoredObject } from '../lib/objectStore';
import { extractText, extractWithOcr, resolveOcrEngine } from '../extraction';
import { DEFAULT_EXTRACTION_LIMITS } from '../extraction/types';
import { requireTenant, safeResult } from './utils';

export const extractRepositoryText: AgentJobHandler = async (job) => {
  requireTenant(job);
  const db = getSupabaseAdminClient();
  const fileId = typeof job.payload?.fileId === 'string' ? job.payload.fileId : null;

  if (!fileId) throw new Error('fileId is required in the job payload.');

  const { data: file, error } = await db
    .from('repository_files')
    .select('*')
    .eq('id', fileId)
    .maybeSingle();

  if (error || !file) throw new Error(error?.message ?? 'Repository file not found.');

  await db.from('repository_files').update({ extracted_text_status: 'PROCESSING' }).eq('id', fileId);

  const stored = await readStoredObject({
    provider: file.storage_provider,
    bucket: file.storage_bucket,
    key: file.storage_key,
  });

  if (stored.status !== 'ok' || !stored.bytes) {
    const message = stored.error ?? 'Stored object could not be read.';
    await db.from('repository_files').update({
      extracted_text_status: 'FAILED',
      extraction_error: message,
    }).eq('id', fileId);
    throw new Error(message);
  }

  const outcome = await extractText(stored.bytes, file.mime_type, { limits: DEFAULT_EXTRACTION_LIMITS });

  if (outcome.status === 'COMPLETE' && outcome.text) {
    await db.from('repository_files').update({
      extracted_text_status: 'COMPLETE',
      extracted_text: outcome.text,
      extracted_at: new Date().toISOString(),
      extraction_error: null,
      extraction_duration_ms: Math.round(outcome.durationMs),
    }).eq('id', fileId);
    return safeResult('Text extraction completed.', {
      fileId,
      status: 'COMPLETE',
      textLength: outcome.text.length,
      pageCount: outcome.pageCount ?? null,
      durationMs: Math.round(outcome.durationMs),
    });
  }

  if (outcome.status === 'NO_TEXT_LAYER') {
    const resolution = resolveOcrEngine();
    if (!resolution.engine) {
      await db.from('repository_files').update({
        extracted_text_status: 'BLOCKED_EXTERNAL',
        extraction_error: outcome.errorMessage ?? 'No text layer and no OCR engine configured.',
        ocr_status: 'NOT_CONFIGURED',
      }).eq('id', fileId);
      throw new Error(outcome.errorMessage ?? 'No text layer and no OCR engine configured.');
    }

    const ocrOutcome = await extractWithOcr(stored.bytes, file.mime_type, { limits: DEFAULT_EXTRACTION_LIMITS });
    if (ocrOutcome.status === 'COMPLETE' && ocrOutcome.text) {
      await db.from('repository_files').update({
        extracted_text_status: 'COMPLETE',
        extracted_text: ocrOutcome.text,
        extracted_at: new Date().toISOString(),
        extraction_error: null,
        extraction_duration_ms: Math.round(ocrOutcome.durationMs),
        ocr_status: 'APPLIED',
      }).eq('id', fileId);
      return safeResult('Text extraction completed with OCR.', {
        fileId,
        status: 'COMPLETE',
        textLength: ocrOutcome.text.length,
        ocrApplied: true,
        durationMs: Math.round(ocrOutcome.durationMs),
      });
    }

    await db.from('repository_files').update({
      extracted_text_status: 'FAILED',
      extraction_error: ocrOutcome.errorMessage ?? 'OCR failed.',
      ocr_status: 'FAILED',
    }).eq('id', fileId);
    throw new Error(ocrOutcome.errorMessage ?? 'OCR failed.');
  }

  await db.from('repository_files').update({
    extracted_text_status: outcome.status,
    extraction_error: outcome.errorMessage ?? null,
    extraction_duration_ms: Math.round(outcome.durationMs),
  }).eq('id', fileId);

  throw new Error(outcome.errorMessage ?? `Extraction returned ${outcome.status}.`);
};
