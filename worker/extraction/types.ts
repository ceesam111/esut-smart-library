export type ExtractionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETE'
  | 'FAILED'
  | 'NOT_SUPPORTED'
  | 'NO_TEXT_LAYER'
  | 'BLOCKED_EXTERNAL';

export type FailureKind =
  | 'TRANSIENT_ERROR'
  | 'PERMANENT_ERROR'
  | 'NOT_SUPPORTED'
  | 'NO_TEXT_LAYER'
  | 'BLOCKED_EXTERNAL';

export interface ExtractionLimits {
  maxFileBytes: number;
  maxPages: number;
  maxTextChars: number;
  timeoutMs: number;
}

export const DEFAULT_EXTRACTION_LIMITS: ExtractionLimits = {
  maxFileBytes: 50 * 1024 * 1024,
  maxPages: 500,
  maxTextChars: 2_000_000,
  timeoutMs: 120_000,
};

export interface ExtractionOutcome {
  status: ExtractionStatus;
  text?: string;
  pageCount?: number;
  confidence?: number;
  failureKind?: FailureKind;
  errorMessage?: string;
  durationMs: number;
  ocrApplied?: boolean;
}

export const MIME_PDF = 'application/pdf';
export const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MIME_ODT = 'application/vnd.oasis.opendocument.text';
export const MIME_TXT = 'text/plain';
export const MIME_CSV = 'text/csv';
export const MIME_JSON = 'application/json';
export const MIME_HTML = 'text/html';

export const SUPPORTED_MIME_TYPES: readonly string[] = [
  MIME_TXT,
  MIME_CSV,
  MIME_JSON,
  MIME_HTML,
  MIME_PDF,
  MIME_DOCX,
  MIME_ODT,
];

export function isSupportedMimeType(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  const normalized = mimeType.toLowerCase().split(';')[0]?.trim() ?? '';
  if (SUPPORTED_MIME_TYPES.includes(normalized)) return true;
  if (normalized === 'application/msword') return false;
  return false;
}

export function extensionForMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase().split(';')[0]?.trim() ?? '';
  const index = SUPPORTED_MIME_TYPES.indexOf(normalized);
  return ['txt', 'csv', 'json', 'html', 'pdf', 'docx', 'odt'][index] ?? 'bin';
}
