import { describe, it, expect } from 'vitest';
import { generateKbart, KBART_COLUMNS, type KbartSerial } from '@/server/interoperability/kbart';

describe('kbart', () => {
  it('generates KBART with header row', () => {
    const kbart = generateKbart([]);
    expect(kbart).toContain('publication_title');
    expect(kbart).toContain('print_identifier');
    expect(kbart).toContain('online_identifier');
  });

  it('generates KBART with serial data', () => {
    const serials = [
      { title: 'Test Journal', print_issn: '1234-5678', publisher: 'Test Publisher' },
    ];
    const kbart = generateKbart(serials);
    const lines = kbart.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Test Journal');
    expect(lines[1]).toContain('1234-5678');
  });

  it('handles empty optional fields', () => {
    const serials = [{ title: 'Minimal' }];
    const kbart = generateKbart(serials);
    expect(kbart).toContain('Minimal');
  });

  it('returns exactly the header line for an empty dataset', () => {
    expect(generateKbart([])).toBe([...KBART_COLUMNS].join('\t'));
  });

  it('produces exactly 9 tab-separated columns on every line', () => {
    const serials: KbartSerial[] = [
      { title: 'Full Record', print_issn: '1111-2222', online_issn: '3333-4444', publisher: 'Pub', start_year: '2020', end_year: '2024', frequency: 'Monthly', url: 'https://example.com', subject: 'Science' },
      { title: 'Sparse Record' },
    ];
    const lines = generateKbart(serials).split('\n');
    for (const line of lines) {
      expect(line.split('\t')).toHaveLength(KBART_COLUMNS.length);
    }
  });

  it('neutralises tabs and newlines inside field values', () => {
    const serials = [{ title: 'Bad\tTitle\nWith\r\nBreaks' }];
    const kbart = generateKbart(serials);
    const lines = kbart.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1].split('\t')).toHaveLength(KBART_COLUMNS.length);
    expect(lines[1]).not.toContain('\n');
    expect(lines[1]).toContain('Bad Title With Breaks');
  });

  it('skips rows whose title is empty after sanitisation', () => {
    const kbart = generateKbart([{ title: '' }, { title: '   ' }, { title: '\t\n' }, { title: 'Kept' }]);
    const lines = kbart.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Kept');
  });

  it('handles null-ish optional values without leaking "null" text', () => {
    const kbart = generateKbart([{ title: 'Nulls', publisher: undefined }]);
    expect(kbart).not.toContain('null');
    expect(kbart.split('\n')[1].split('\t')).toHaveLength(KBART_COLUMNS.length);
  });

  it('keeps the header aligned with the KBART core field order', () => {
    expect([...KBART_COLUMNS]).toEqual([
      'publication_title',
      'print_identifier',
      'online_identifier',
      'publisher',
      'start_year',
      'end_year',
      'frequency',
      'url',
      'subject',
    ]);
  });
});
