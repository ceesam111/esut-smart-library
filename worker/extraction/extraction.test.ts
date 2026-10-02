import { describe, expect, it } from 'vitest';
import {
  corruptPdfFixture,
  csvFixture,
  docxFixture,
  htmlFixture,
  jsonFixture,
  odtFixture,
  pdfWithTextFixture,
  pdfWithoutTextFixture,
  txtFixture,
  unsupportedFixture,
} from './fixtures';
import { extractText, stripHtml } from './engine';
import { DEFAULT_EXTRACTION_LIMITS } from './types';

const TINY_TIMEOUT = { ...DEFAULT_EXTRACTION_LIMITS, timeoutMs: 1 };

describe('text formats', { timeout: 60000 }, () => {
  it('extracts TXT', async () => {
    const result = await extractText(txtFixture(), 'text/plain');
    expect(result.status).toBe('COMPLETE');
    expect(result.text).toContain('lithium-ion battery degradation');
  });

  it('extracts CSV', async () => {
    const result = await extractText(csvFixture(), 'text/csv');
    expect(result.status).toBe('COMPLETE');
    expect(result.text).toContain('Grid Storage');
  });

  it('extracts JSON values', async () => {
    const result = await extractText(jsonFixture(), 'application/json');
    expect(result.status).toBe('COMPLETE');
    expect(result.text).toContain('library circulation records');
    expect(result.text).toContain('checkout');
  });

  it('extracts HTML without markup or script bodies', async () => {
    const result = await extractText(htmlFixture(), 'text/html');
    expect(result.status).toBe('COMPLETE');
    expect(result.text).toContain('Using the Library');
    expect(result.text).not.toContain('<script>');
    expect(result.text).not.toContain('ignore this');
  });
});

describe('pdf extraction', { timeout: 60000 }, () => {
  it('extracts the embedded text layer', async () => {
    const result = await extractText(pdfWithTextFixture(), 'application/pdf');
    expect(result.status).toBe('COMPLETE');
    expect(result.pageCount).toBeGreaterThan(0);
    expect(result.text).toContain('Renewable Energy Storage for Grid Stability');
  });

  it('reports NO_TEXT_LAYER for an image-only PDF', async () => {
    const result = await extractText(pdfWithoutTextFixture(), 'application/pdf');
    expect(result.status).toBe('NO_TEXT_LAYER');
    expect(result.text ?? '').toBe('');
  });

  it('fails safely on a corrupt PDF', async () => {
    const result = await extractText(corruptPdfFixture(), 'application/pdf');
    expect(result.status).toBe('FAILED');
    expect(result.failureKind).toBe('PERMANENT_ERROR');
    expect(result.errorMessage).toBeTruthy();
  });

  it('rejects a PDF beyond the page limit', async () => {
    const result = await extractText(pdfWithTextFixture(), 'application/pdf', {
      limits: { ...DEFAULT_EXTRACTION_LIMITS, maxPages: 0 },
    });
    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toContain('pages');
  });
});

describe('docx extraction', { timeout: 60000 }, () => {
  it('extracts paragraphs, headings and table cells', async () => {
    const result = await extractText(await docxFixture(), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(result.status).toBe('COMPLETE');
    expect(result.text).toContain('## Renewable Energy Storage');
    expect(result.text).toContain('lithium-ion battery degradation');
    expect(result.text).toContain('Year | 2026');
  });

  it('extracts ODT text', async () => {
    const result = await extractText(await odtFixture(), 'application/vnd.oasis.opendocument.text');
    expect(result.status).toBe('COMPLETE');
    expect(result.text).toContain('## Renewable Energy Storage');
  });
});

describe('unsupported and hostile input', { timeout: 60000 }, () => {
  it('reports NOT_SUPPORTED for an unsupported format', async () => {
    const result = await extractText(unsupportedFixture(), 'image/png');
    expect(result.status).toBe('NOT_SUPPORTED');
    expect(result.failureKind).toBe('NOT_SUPPORTED');
  });

  it('reports NOT_SUPPORTED for legacy DOC', async () => {
    const result = await extractText(txtFixture(), 'application/msword');
    expect(result.status).toBe('NOT_SUPPORTED');
  });

  it('rejects files over the size limit', async () => {
    const result = await extractText(txtFixture(), 'text/plain', {
      limits: { ...DEFAULT_EXTRACTION_LIMITS, maxFileBytes: 4 },
    });
    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toContain('extraction limit');
  });

  it('times out instead of hanging', async () => {
    const result = await extractText(pdfWithTextFixture(), 'application/pdf', { limits: TINY_TIMEOUT });
    expect(result.status).toBe('FAILED');
    expect(result.failureKind).toBe('TRANSIENT_ERROR');
    expect(result.errorMessage).toContain('timed out');
  });

  it('normalizes control characters and whitespace', () => {
    expect(stripHtml('<p>a &amp; b</p>')).toBe('a & b');
  });
});
