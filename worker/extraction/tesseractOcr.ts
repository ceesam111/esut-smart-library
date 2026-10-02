import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TESSERACT_TIMEOUT_MS = 120_000;
const MAX_OCR_INPUT_BYTES = 25 * 1024 * 1024;

interface TesseractOptions {
  binary: string;
  lang: string;
}

export async function recognizeWithTesseract(
  bytes: Buffer,
  mimeType: string,
  options: TesseractOptions,
): Promise<string> {
  if (bytes.length > MAX_OCR_INPUT_BYTES) {
    throw new Error(`OCR input is ${bytes.length} bytes; the limit is ${MAX_OCR_INPUT_BYTES}.`);
  }

  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/jpeg' ? 'jpg' : 'bin';
  const directory = await mkdtemp(join(tmpdir(), 'esut-ocr-'));
  const inputPath = join(directory, `input-${randomUUID()}.${extension}`);
  const outputBase = join(directory, `output-${randomUUID()}`);

  try {
    await writeFile(inputPath, bytes);
    await runTesseract(options.binary, inputPath, outputBase, options.lang);
    const { readFile } = await import('node:fs/promises');
    return await readFile(`${outputBase}.txt`, 'utf8');
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

function runTesseract(binary: string, inputPath: string, outputBase: string, lang: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, [inputPath, outputBase, '-l', lang, '--psm', '3'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`OCR timed out after ${TESSERACT_TIMEOUT_MS}ms.`));
    }, TESSERACT_TIMEOUT_MS);

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`OCR binary could not be started: ${error.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve();
      reject(new Error(`OCR exited with code ${code}: ${stderr.slice(0, 300)}`));
    });
  });
}

interface HttpOcrOptions {
  endpoint: string;
  apiKey: string;
}

export async function recognizeWithHttp(
  bytes: Buffer,
  mimeType: string,
  options: HttpOcrOptions,
): Promise<string> {
  if (bytes.length > MAX_OCR_INPUT_BYTES) {
    throw new Error(`OCR input is ${bytes.length} bytes; the limit is ${MAX_OCR_INPUT_BYTES}.`);
  }

  const response = await fetch(options.endpoint, {
    method: 'POST',
    headers: {
      'content-type': mimeType,
      ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}),
    },
    body: new Uint8Array(bytes),
    signal: AbortSignal.timeout(TESSERACT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`OCR service returned HTTP ${response.status}.`);
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error('OCR service returned an empty result.');
  }
  return text;
}

export function describeEngine(engine: { name: string } | null): string {
  return engine ? engine.name : 'unconfigured';
}
