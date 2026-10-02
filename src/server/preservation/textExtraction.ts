import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { readStoredObject } from '@/server/preservation/objectStore';
import { DEFAULT_EXTRACTION_LIMITS, type ExtractionLimits, type ExtractionOutcome } from '../../../worker/extraction/types';

export interface ExtractionResult {
  text: string;
  pageCount?: number;
  confidence?: number;
}

export type { ExtractionOutcome, ExtractionLimits };

async function importEngine(): Promise<typeof import('../../../worker/extraction/engine')> {
  return import(/* webpackIgnore: true */ '../../../worker/extraction/engine');
}

export async function extractText(
  file: Buffer,
  mimeType: string,
  limits: ExtractionLimits = DEFAULT_EXTRACTION_LIMITS,
): Promise<ExtractionResult | null> {
  const engine = await importEngine();
  const outcome = await engine.runExtraction(file, mimeType, limits);
  if (outcome.status !== 'COMPLETE' || !outcome.text) return null;
  return { text: outcome.text, pageCount: outcome.pageCount, confidence: outcome.confidence };
}

function statusFromOutcome(outcome: ExtractionOutcome): string {
  switch (outcome.status) {
    case 'COMPLETE':
      return 'COMPLETE';
    case 'NO_TEXT_LAYER':
      return 'NO_TEXT_LAYER';
    case 'NOT_SUPPORTED':
      return 'NOT_SUPPORTED';
    case 'BLOCKED_EXTERNAL':
      return 'BLOCKED_EXTERNAL';
    case 'FAILED':
      return outcome.failureKind === 'TRANSIENT_ERROR' ? 'FAILED' : 'FAILED';
    default:
      return 'FAILED';
  }
}

export interface ExtractFileTextResult {
  success: boolean;
  status: string;
  text?: string;
  error?: string;
  durationMs?: number;
  pageCount?: number;
  ocrApplied?: boolean;
}

export async function extractFileText(fileId: string): Promise<ExtractFileTextResult> {
  const supabase = getSupabaseAdminClient();

  const { data: file, error } = await supabase
    .from('repository_files')
    .select('*')
    .eq('id', fileId)
    .maybeSingle();

  if (error || !file) return { success: false, status: 'FAILED', error: 'File not found' };

  await supabase.from('repository_files').update({ extracted_text_status: 'PROCESSING' }).eq('id', fileId);

  try {
    const stored = await readStoredObject({
      provider: file.storage_provider,
      bucket: file.storage_bucket,
      key: file.storage_key,
    });

    if (stored.status !== 'ok' || !stored.bytes) {
      const message = stored.error ?? 'Stored object could not be read.';
      await supabase.from('repository_files').update({
        extracted_text_status: 'FAILED',
        extraction_error: message,
      }).eq('id', fileId);
      return { success: false, status: 'FAILED', error: message };
    }

    const engine = await importEngine();
    const outcome = await engine.runExtraction(stored.bytes, file.mime_type, DEFAULT_EXTRACTION_LIMITS);

    if (outcome.status === 'COMPLETE' && outcome.text) {
      await supabase.from('repository_files').update({
        extracted_text_status: 'COMPLETE',
        extracted_text: outcome.text,
        extracted_at: new Date().toISOString(),
        extraction_error: null,
        extraction_duration_ms: Math.round(outcome.durationMs),
      }).eq('id', fileId);
      return {
        success: true,
        status: 'COMPLETE',
        text: outcome.text,
        durationMs: Math.round(outcome.durationMs),
        pageCount: outcome.pageCount,
      };
    }

    const status = statusFromOutcome(outcome);
    await supabase.from('repository_files').update({
      extracted_text_status: status,
      extraction_error: outcome.errorMessage ?? null,
      extraction_duration_ms: Math.round(outcome.durationMs),
      ocr_status: outcome.ocrApplied ? 'APPLIED' : null,
    }).eq('id', fileId);

    return {
      success: false,
      status,
      error: outcome.errorMessage ?? `Extraction returned ${outcome.status}.`,
      durationMs: Math.round(outcome.durationMs),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed';
    await supabase.from('repository_files').update({
      extracted_text_status: 'FAILED',
      extraction_error: message,
    }).eq('id', fileId);
    return { success: false, status: 'FAILED', error: message };
  }
}
