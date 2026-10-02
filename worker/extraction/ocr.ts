export interface OcrEngine {
  name: string;
  recognize(bytes: Buffer, mimeType: string): Promise<string>;
}

export interface OcrResolution {
  engine: OcrEngine | null;
  reason: string;
}

function env(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

export function resolveOcrEngine(): OcrResolution {
  const provider = env('OCR_PROVIDER')?.toLowerCase();

  if (!provider || provider === 'none' || provider === 'off') {
    return { engine: null, reason: 'OCR_PROVIDER is not set.' };
  }

  if (provider === 'tesseract') {
    const lang = env('OCR_TESSERACT_LANG') || 'eng';
    const binary = env('OCR_TESSERACT_CMD') || 'tesseract';
    return {
      engine: {
        name: `tesseract:${lang}`,
        async recognize(bytes, mimeType) {
          const { recognizeWithTesseract } = await import('./tesseractOcr');
          return recognizeWithTesseract(bytes, mimeType, { binary, lang });
        },
      },
      reason: '',
    };
  }

  if (provider === 'http') {
    const endpoint = env('OCR_HTTP_ENDPOINT');
    if (!endpoint) {
      return { engine: null, reason: 'OCR_PROVIDER=http requires OCR_HTTP_ENDPOINT.' };
    }
    const apiKey = env('OCR_HTTP_API_KEY') ?? '';
    return {
      engine: {
        name: `http:${new URL(endpoint).host}`,
        async recognize(bytes, mimeType) {
          const { recognizeWithHttp } = await import('./httpOcr');
          return recognizeWithHttp(bytes, mimeType, { endpoint, apiKey });
        },
      },
      reason: '',
    };
  }

  return { engine: null, reason: `Unsupported OCR_PROVIDER "${provider}".` };
}

export function ocrConfigured(): boolean {
  return resolveOcrEngine().engine !== null;
}
