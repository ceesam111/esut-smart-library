const HTTP_OCR_TIMEOUT_MS = 120_000;
const MAX_OCR_INPUT_BYTES = 25 * 1024 * 1024;

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
    signal: AbortSignal.timeout(HTTP_OCR_TIMEOUT_MS),
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
