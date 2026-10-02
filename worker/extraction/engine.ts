import { extractPdfText, normalize } from './pdfText';
import { extractDocxText, extractOdtText } from './docxText';
import { resolveOcrEngine } from './ocr';
import { runSandboxed } from './sandbox';
import {
  DEFAULT_EXTRACTION_LIMITS,
  MIME_CSV,
  MIME_DOCX,
  MIME_HTML,
  MIME_JSON,
  MIME_ODT,
  MIME_PDF,
  MIME_TXT,
  isSupportedMimeType,
  type ExtractionLimits,
  type ExtractionOutcome,
} from './types';

export interface EngineOptions {
  limits?: ExtractionLimits;
  mimeType?: string | null;
}

export async function extractText(
  bytes: Buffer,
  mimeType: string | null | undefined,
  options: EngineOptions = {},
): Promise<ExtractionOutcome> {
  const limits = options.limits ?? DEFAULT_EXTRACTION_LIMITS;
  const started = Date.now();

  if (bytes.length > limits.maxFileBytes) {
    return {
      status: 'FAILED',
      failureKind: 'PERMANENT_ERROR',
      errorMessage: `File is ${bytes.length} bytes; the extraction limit is ${limits.maxFileBytes} bytes.`,
      durationMs: Date.now() - started,
    };
  }

  const normalizedMime = (mimeType ?? '').toLowerCase().split(';')[0]?.trim() ?? '';

  if (!isSupportedMimeType(normalizedMime)) {
    return {
      status: 'NOT_SUPPORTED',
      failureKind: 'NOT_SUPPORTED',
      errorMessage: `MIME type "${mimeType ?? 'unknown'}" is not supported for text extraction.`,
      durationMs: Date.now() - started,
    };
  }

  const outcome = await runSandboxed(
    { bytes: new Uint8Array(bytes), mimeType: normalizedMime, limits },
    limits.timeoutMs,
  );

  return { ...outcome, durationMs: Date.now() - started };
}

export async function runExtraction(
  bytes: Buffer,
  mimeType: string,
  limits: ExtractionLimits,
): Promise<ExtractionOutcome> {
  const started = Date.now();
  const outcome = await dispatch(bytes, mimeType, limits);
  return { ...outcome, durationMs: Date.now() - started };
}

async function dispatch(
  bytes: Buffer,
  mimeType: string,
  limits: ExtractionLimits,
): Promise<ExtractionOutcome> {
  switch (mimeType) {
    case MIME_TXT:
    case MIME_CSV:
      return textOutcome(bytes, limits);
    case MIME_JSON:
      return jsonOutcome(bytes, limits);
    case MIME_HTML:
      return htmlOutcome(bytes, limits);
    case MIME_PDF:
      return extractPdfText(bytes, limits);
    case MIME_DOCX:
      return extractDocxText(bytes, limits);
    case MIME_ODT:
      return extractOdtText(bytes, limits);
    default:
      return {
        status: 'NOT_SUPPORTED',
        failureKind: 'NOT_SUPPORTED',
        errorMessage: `MIME type "${mimeType}" is not supported for text extraction.`,
        durationMs: 0,
      };
  }
}

export async function extractWithOcr(
  bytes: Buffer,
  mimeType: string,
  options: EngineOptions = {},
): Promise<ExtractionOutcome> {
  const limits = options.limits ?? DEFAULT_EXTRACTION_LIMITS;
  const started = Date.now();
  const resolution = resolveOcrEngine();

  if (!resolution.engine) {
    return {
      status: 'BLOCKED_EXTERNAL',
      failureKind: 'BLOCKED_EXTERNAL',
      errorMessage: `OCR is required for this document but no OCR engine is configured. ${resolution.reason}`,
      durationMs: Date.now() - started,
    };
  }

  try {
    const text = normalize(await resolution.engine.recognize(bytes, mimeType));
    if (!text) {
      return {
        status: 'FAILED',
        failureKind: 'PERMANENT_ERROR',
        errorMessage: 'OCR produced no text.',
        durationMs: Date.now() - started,
      };
    }
    return {
      status: 'COMPLETE',
      text: text.slice(0, limits.maxTextChars),
      confidence: 0.6,
      ocrApplied: true,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      status: 'FAILED',
      failureKind: 'TRANSIENT_ERROR',
      errorMessage: `OCR failed: ${error instanceof Error ? error.message : String(error)}`,
      durationMs: Date.now() - started,
    };
  }
}

function textOutcome(bytes: Buffer, limits: ExtractionLimits): ExtractionOutcome {
  const text = normalize(bytes.toString('utf8'));
  if (!text) {
    return { status: 'NO_TEXT_LAYER', confidence: 0, durationMs: 0 };
  }
  return {
    status: 'COMPLETE',
    text: text.slice(0, limits.maxTextChars),
    confidence: 1,
    durationMs: 0,
  };
}

function jsonOutcome(bytes: Buffer, limits: ExtractionLimits): ExtractionOutcome {
  const raw = bytes.toString('utf8');
  let parts: string[] = [];
  try {
    collectJsonStrings(JSON.parse(raw), parts);
  } catch {
    parts = [raw];
  }
  const text = normalize(parts.join('\n'));
  if (!text) {
    return { status: 'NO_TEXT_LAYER', confidence: 0, durationMs: 0 };
  }
  return {
    status: 'COMPLETE',
    text: text.slice(0, limits.maxTextChars),
    confidence: 1,
    durationMs: 0,
  };
}

function collectJsonStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectJsonStrings(entry, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) collectJsonStrings(entry, out);
  }
}

function htmlOutcome(bytes: Buffer, limits: ExtractionLimits): ExtractionOutcome {
  const text = normalize(stripHtml(bytes.toString('utf8')));
  if (!text) {
    return { status: 'NO_TEXT_LAYER', confidence: 0, durationMs: 0 };
  }
  return {
    status: 'COMPLETE',
    text: text.slice(0, limits.maxTextChars),
    confidence: 1,
    durationMs: 0,
  };
}

export function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .trim();
}

