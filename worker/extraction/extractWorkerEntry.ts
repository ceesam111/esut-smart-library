import { parentPort } from 'node:worker_threads';
import type { ExtractionLimits, ExtractionOutcome } from './types';

interface SandboxRequest {
  kind: 'extract';
  bytes: Uint8Array;
  mimeType: string;
  limits: ExtractionLimits;
}

parentPort?.on('message', (message: SandboxRequest) => {
  void run(message);
});

async function run(message: SandboxRequest): Promise<void> {
  if (!message || message.kind !== 'extract') return;

  let outcome: ExtractionOutcome;
  try {
    const { runExtraction } = await import('./engine');
    outcome = await runExtraction(Buffer.from(message.bytes), message.mimeType, message.limits);
  } catch (error) {
    outcome = {
      status: 'FAILED',
      failureKind: 'TRANSIENT_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Extraction failed.',
      durationMs: 0,
    };
  }

  parentPort?.postMessage({ kind: 'outcome', outcome });
}
