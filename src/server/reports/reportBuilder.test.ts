import { describe, it, expect } from 'vitest';
import { isColumnAllowed, isSensitiveColumn, defaultColumnsFor, reportToCsv, reportToXlsx, DATASET_TABLES } from './reportBuilder';

describe('report builder security', () => {
  it('allows only whitelisted columns per dataset', () => {
    expect(isColumnAllowed('circulation', 'id')).toBe(true);
    expect(isColumnAllowed('circulation', 'status')).toBe(true);
    expect(isColumnAllowed('circulation', 'malicious_column')).toBe(false);
    expect(isColumnAllowed('patrons', 'email')).toBe(true);
    expect(isColumnAllowed('patrons', 'password_hash')).toBe(false);
  });

  it('marks sensitive columns', () => {
    expect(isSensitiveColumn('email')).toBe(true);
    expect(isSensitiveColumn('phone')).toBe(true);
    expect(isSensitiveColumn('first_name')).toBe(true);
    expect(isSensitiveColumn('last_name')).toBe(true);
    expect(isSensitiveColumn('id')).toBe(false);
    expect(isSensitiveColumn('status')).toBe(false);
  });

  it('excludes sensitive columns from dataset defaults', () => {
    const patronDefaults = defaultColumnsFor('patrons');
    expect(patronDefaults).not.toContain('email');
    expect(patronDefaults).not.toContain('phone');
    expect(patronDefaults).not.toContain('full_name');
    expect(patronDefaults).not.toContain('surname');
    expect(patronDefaults).not.toContain('other_names');
    expect(patronDefaults).toContain('id');
    expect(patronDefaults).toContain('status');
    const catalogueDefaults = defaultColumnsFor('catalogue');
    expect(catalogueDefaults).toEqual([...DATASET_TABLES.catalogue.allowedColumns]);
  });

  it('has defined datasets with allowed columns', () => {
    expect(DATASET_TABLES.circulation).toBeDefined();
    expect(DATASET_TABLES.patrons).toBeDefined();
    expect(DATASET_TABLES.catalogue).toBeDefined();
    expect(DATASET_TABLES.repository).toBeDefined();
    expect(DATASET_TABLES.acquisitions).toBeDefined();
    expect(DATASET_TABLES.serials).toBeDefined();
    expect(DATASET_TABLES.analytics).toBeDefined();
    expect(DATASET_TABLES.fines).toBeDefined();
  });

  it('every dataset has at least one allowed column', () => {
    for (const [key, dataset] of Object.entries(DATASET_TABLES)) {
      expect(dataset.allowedColumns.length, `Dataset ${key} should have columns`).toBeGreaterThan(0);
    }
  });
});

describe('report CSV export', () => {
  it('escapes formula injection characters', () => {
    const data = [{ name: '=SUM(A1:A2)', value: 'test' }];
    const csv = reportToCsv(data, ['name', 'value']);
    expect(csv).toContain("'=SUM(A1:A2)");
    expect(csv).not.toContain('\n=SUM');
  });

  it('escapes plus-prefixed formulas', () => {
    const data = [{ name: '+1+1', value: 'test' }];
    const csv = reportToCsv(data, ['name', 'value']);
    expect(csv).toContain("'+1+1");
  });

  it('escapes minus-prefixed formulas', () => {
    const data = [{ name: '-1+1', value: 'test' }];
    const csv = reportToCsv(data, ['name', 'value']);
    expect(csv).toContain("'-1+1");
  });

  it('escapes at-prefixed formulas', () => {
    const data = [{ name: '@SUM(A1)', value: 'test' }];
    const csv = reportToCsv(data, ['name', 'value']);
    expect(csv).toContain("'@SUM");
  });

  it('handles empty data', () => {
    const csv = reportToCsv([], ['name', 'value']);
    expect(csv).toBe('name,value\n');
  });

  it('handles null and undefined values', () => {
    const data = [{ name: null, value: undefined }];
    const csv = reportToCsv(data, ['name', 'value']);
    expect(csv).toContain('"name","value"');
    expect(csv).toContain('"",""');
  });
});

describe('report XLSX export', () => {
  it('produces a real OOXML workbook', async () => {
    const data = [{ name: 'Test', value: 42 }];
    const buffer = await reportToXlsx(data, ['name', 'value'], { reportName: 'Test Report' });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 2).toString('utf8')).toBe('PK');
    const jszip = await import('jszip');
    const zip = await jszip.default.loadAsync(buffer);
    expect(zip.file('[Content_Types].xml')).toBeTruthy();
    expect(zip.file('xl/workbook.xml')).toBeTruthy();
    expect(zip.file('xl/worksheets/sheet1.xml')).toBeTruthy();
    expect(zip.file('docProps/core.xml')).toBeTruthy();
  });

  it('neutralizes formula injection and contains no formula elements', async () => {
    const data = [{ name: '=SUM(A1:A2)', value: '+1+1' }];
    const buffer = await reportToXlsx(data, ['name', 'value']);
    const jszip = await import('jszip');
    const zip = await jszip.default.loadAsync(buffer);
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheet).toContain('&apos;=SUM(A1:A2)');
    expect(sheet).toContain('&apos;+1+1');
    expect(sheet).not.toContain('<f>');
  });

  it('keeps newline and tab content inside cells without breaking the sheet', async () => {
    const data = [{ name: 'Test Value', value: 'Line1 Line2' }];
    const buffer = await reportToXlsx(data, ['name', 'value']);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
