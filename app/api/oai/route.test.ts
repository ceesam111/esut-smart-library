import { describe, it, expect } from 'vitest';
import { xmlEscape, oaiIdentifier, utcDatestamp, dateDatestamp, granularityValid, toUtcDate } from '@/server/oai/oaiXml';

describe('oaiXml helpers', () => {
  it('escapes XML special characters', () => {
    expect(xmlEscape('<a>&"\'')).toBe('&lt;a&gt;&amp;&quot;&apos;');
  });
  it('builds an oai:authority:id identifier', () => {
    expect(oaiIdentifier('abc-123', 'esutlibrary.edu.ng')).toBe('oai:esutlibrary.edu.ng:abc-123');
  });
  it('produces a full UTC datestamp', () => {
    expect(utcDatestamp('2024-03-15T10:30:00.000Z')).toBe('2024-03-15T10:30:00Z');
  });
  it('produces a date-only datestamp', () => {
    expect(dateDatestamp('2024-03-15T10:30:00.000Z')).toBe('2024-03-15');
  });
  it('validates datestamp granularity', () => {
    expect(granularityValid('2024-01-01')).toBe(true);
    expect(granularityValid('2024-01-01T00:00:00Z')).toBe(true);
    expect(granularityValid('not-a-date')).toBe(false);
  });
  it('toUtcDate handles date-only and endOfDay', () => {
    expect(toUtcDate('2024-01-01')).toBe('2024-01-01T00:00:00Z');
    expect(toUtcDate('2024-01-01', true)).toBe('2024-01-01T23:59:59Z');
    expect(toUtcDate('2024-01-01T00:00:00Z')).toBe('2024-01-01T00:00:00Z');
  });
});
