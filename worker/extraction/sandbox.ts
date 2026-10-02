import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import type { ExtractionLimits, ExtractionOutcome } from './types';

const ENTRY = new URL('./extractWorkerEntry.ts', import.meta.url);

export interface SandboxRequest {
  bytes: Uint8Array;
  mimeType: string;
  limits: ExtractionLimits;
}

function workerExecArgv(): string[] {
  try {
    const require = createRequire(import.meta.url);
    return ['--import', pathToFileURL(require.resolve('tsx')).href];
  } catch {
    return ['--import', 'tsx'];
  }
}

export function runSandboxed(
  request: SandboxRequest,
  timeoutMs: number,
): Promise<ExtractionOutcome> {
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(ENTRY, { execArgv: workerExecArgv() });
    } catch (error) {
      resolve({
        status: 'FAILED',
        failureKind: 'TRANSIENT_ERROR',
        errorMessage: `Extraction sandbox could not start: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: 0,
      });
      return;
    }

    let settled = false;
    const finish = (outcome: ExtractionOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => undefined);
      resolve(outcome);
    };

    const timer = setTimeout(() => {
      finish({
        status: 'FAILED',
        failureKind: 'TRANSIENT_ERROR',
        errorMessage: `Extraction timed out after ${timeoutMs}ms.`,
        durationMs: timeoutMs,
      });
    }, timeoutMs);

    worker.on('message', (message) => {
      if (message?.kind === 'outcome') finish(message.outcome as ExtractionOutcome);
    });
    worker.on('error', (error) => {
      finish({
        status: 'FAILED',
        failureKind: 'TRANSIENT_ERROR',
        errorMessage: `Extraction worker error: ${error.message}`,
        durationMs: 0,
      });
    });
    worker.on('exit', (code) => {
      if (!settled) {
        finish({
          status: 'FAILED',
          failureKind: 'TRANSIENT_ERROR',
          errorMessage: `Extraction worker exited with code ${code}.`,
          durationMs: 0,
        });
      }
    });

    worker.postMessage({ kind: 'extract', ...request });
  });
}
