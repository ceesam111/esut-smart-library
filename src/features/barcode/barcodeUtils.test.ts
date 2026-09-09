import { describe, expect, it } from 'vitest';
import { classifyBarcode, isResourceBarcode } from './barcodeUtils';

describe('barcode utilities', () => {
  it('classifies internal Code-128 prefixes', () => {
    expect(classifyBarcode('PAT-2026-0001')).toBe('PAT');
    expect(classifyBarcode('COPY-0001')).toBe('COPY');
    expect(classifyBarcode('THS-abc')).toBe('THS');
    expect(classifyBarcode('SHF-MAIN-1')).toBe('SHF');
    expect(classifyBarcode('EQP-1')).toBe('EQP');
  });

  it('recognizes ISBN/EAN-13 and ISSN-like resource barcodes', () => {
    expect(isResourceBarcode('9780306406157')).toBe(true);
    expect(isResourceBarcode('12345678')).toBe(true);
    expect(isResourceBarcode('COPY-0001')).toBe(false);
  });
});
