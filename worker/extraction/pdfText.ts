import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { PDFParse, VerbosityLevel } from 'pdf-parse';
import type { ExtractionLimits, ExtractionOutcome } from './types';

let workerReady = false;

function ensureWorker(): void {
  if (workerReady) return;
  const require = createRequire(import.meta.url);
  const workerPath = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
  PDFParse.setWorker(pathToFileURL(workerPath).href);
  workerReady = true;
}

const MIN_TEXT_LAYER_CHARS = 20;

export async function extractPdfText(
  bytes: Buffer,
  limits: ExtractionLimits,
): Promise<ExtractionOutcome> {
  ensureWorker();
  const parser = new PDFParse({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useSystemFonts: true,
    verbosity: VerbosityLevel.ERRORS,
    stopAtErrors: false,
  });

  try {
    const info = await parser.getInfo();
    const pageCount = info?.total ?? 0;

    if (pageCount <= 0) {
      return {
        status: 'FAILED',
        failureKind: 'PERMANENT_ERROR',
        errorMessage: 'PDF reports no pages.',
        durationMs: 0,
      };
    }

    if (pageCount > limits.maxPages) {
      return {
        status: 'FAILED',
        failureKind: 'PERMANENT_ERROR',
        errorMessage: `PDF has ${pageCount} pages; the extraction limit is ${limits.maxPages}.`,
        pageCount,
        durationMs: 0,
      };
    }

    const extracted = await parser.getText({ pageJoiner: '', lineEnforce: true });
    const text = normalize(extracted.text);

    if (text.length < MIN_TEXT_LAYER_CHARS) {
      return {
        status: 'NO_TEXT_LAYER',
        pageCount,
        confidence: 0,
        durationMs: 0,
      };
    }

    return {
      status: 'COMPLETE',
      text: text.slice(0, limits.maxTextChars),
      pageCount,
      confidence: Math.min(1, text.length / 500),
      durationMs: 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/encrypt|password|owner password/i.test(message)) {
      return {
        status: 'FAILED',
        failureKind: 'PERMANENT_ERROR',
        errorMessage: 'PDF is password protected or encrypted.',
        durationMs: 0,
      };
    }
    return {
      status: 'FAILED',
      failureKind: 'PERMANENT_ERROR',
      errorMessage: `PDF parsing failed: ${message.slice(0, 300)}`,
      durationMs: 0,
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

function stripControlChars(input: string): string {
  let output = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    const isControl = (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
    output += isControl ? ' ' : ch;
  }
  return output;
}

export function normalize(input: string): string {
  return stripControlChars(input)
    .replace(/[ \t]+/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
