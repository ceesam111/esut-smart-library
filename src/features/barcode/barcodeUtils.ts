export type InternalBarcodeKind = 'PAT' | 'COPY' | 'THS' | 'SHF' | 'EQP' | 'unknown';

export function classifyBarcode(value: string): InternalBarcodeKind {
  if (/^PAT-/i.test(value)) return 'PAT';
  if (/^COPY-/i.test(value)) return 'COPY';
  if (/^THS-/i.test(value)) return 'THS';
  if (/^SHF-/i.test(value)) return 'SHF';
  if (/^EQP-/i.test(value)) return 'EQP';
  return 'unknown';
}

export function isResourceBarcode(value: string) {
  const numeric = value.replace(/[^0-9Xx]/g, '');
  return /^\d{8}$/.test(numeric) || /^\d{13}$/.test(numeric);
}
