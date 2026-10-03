import { describe, expect, it, vi, beforeEach } from 'vitest';
import { parseCQL, cqlToSupabaseFilter, isSupportedIndex, isSupportedRelation } from '@/server/interoperability/cqlParser';
import { toDublinCore, toMARCXML, serializeRecord, type SRURecord } from '@/server/interoperability/sru/serializers';
import { errorResponse, SRU_DIAGNOSTICS } from '@/server/interoperability/sru/diagnostics';

const SAMPLE_RECORD: SRURecord = {
  id: 'test-id-123',
  title: 'Test Book',
  authors: ['John Smith', 'Jane Doe'],
  isbn: '978-3-16-148410-0',
  issn: '1234-5678',
  publisher: 'Test Publisher',
  year: 2024,
  format: 'Book',
  abstract: 'A test abstract',
  subjects: ['Computer Science', 'Testing'],
  callNumber: 'QA76.5 .S65',
  language: 'English',
  doi: '10.1234/test',
  placeOfPublication: 'Test City',
  physicalDescription: '100 pages',
  series: 'Test Series',
  edition: '1st',
};

describe('CQL Parser', () => {
  it('parses a simple term', () => {
    const result = parseCQL('dc.title = "test"');
    expect(result.valid).toBe(true);
    expect(result.terms).toHaveLength(1);
    expect(result.terms[0]).toMatchObject({ field: 'dc.title', value: 'test', relation: '=' });
  });

  it('parses AND boolean', () => {
    const result = parseCQL('dc.title = "test" AND dc.creator = "author"');
    expect(result.valid).toBe(true);
    expect(result.terms).toHaveLength(2);
  });

  it('parses OR boolean', () => {
    const result = parseCQL('dc.title = "test" OR dc.creator = "author"');
    expect(result.valid).toBe(true);
    expect(result.terms).toHaveLength(2);
  });

  it('parses NOT boolean', () => {
    const result = parseCQL('dc.title = "test" NOT dc.creator = "author"');
    expect(result.valid).toBe(true);
    expect(result.terms).toHaveLength(2);
    expect(result.terms[1].boolean).toBe('NOT');
  });

  it('parses parentheses', () => {
    const result = parseCQL('(dc.title = "a" OR dc.title = "b") AND dc.creator = "c"');
    expect(result.valid).toBe(true);
    expect(result.terms).toHaveLength(3);
  });

  it('parses any operator', () => {
    const result = parseCQL('dc.title any "hello world"');
    expect(result.valid).toBe(true);
    expect(result.terms[0].relation).toBe('any');
  });

  it('parses all operator', () => {
    const result = parseCQL('dc.title all "hello world"');
    expect(result.valid).toBe(true);
    expect(result.terms[0].relation).toBe('all');
  });

  it('parses exact relation', () => {
    const result = parseCQL('dc.title exact "test"');
    expect(result.valid).toBe(true);
    expect(result.terms[0].relation).toBe('exact');
  });

  it('parses cql.serverChoice', () => {
    const result = parseCQL('cql.serverChoice = "test"');
    expect(result.valid).toBe(true);
    expect(result.terms[0].field).toBe('cql.serverchoice');
  });

  it('parses bath.isbn', () => {
    const result = parseCQL('bath.isbn = "978-3-16-148410-0"');
    expect(result.valid).toBe(true);
    expect(result.terms[0].field).toBe('bath.isbn');
  });

  it('parses bath.issn', () => {
    const result = parseCQL('bath.issn = "1234-5678"');
    expect(result.valid).toBe(true);
    expect(result.terms[0].field).toBe('bath.issn');
  });

  it('parses rec.identifier', () => {
    const result = parseCQL('rec.identifier = "test-id"');
    expect(result.valid).toBe(true);
    expect(result.terms[0].field).toBe('rec.identifier');
  });

  it('rejects malformed query', () => {
    const result = parseCQL('dc.title = ');
    expect(result.valid).toBe(false);
  });

  it('rejects empty query', () => {
    const result = parseCQL('');
    expect(result.valid).toBe(false);
  });

  it('rejects unclosed quote', () => {
    const result = parseCQL('dc.title = "test');
    expect(result.valid).toBe(false);
  });
});

describe('CQL Index Support', () => {
  it('supports all required indexes', () => {
    const indexes = ['cql.serverChoice', 'dc.title', 'dc.creator', 'dc.subject', 'dc.identifier', 'bath.isbn', 'bath.issn', 'bath.name', 'rec.identifier'];
    for (const index of indexes) {
      expect(isSupportedIndex(index)).toBe(true);
    }
  });

  it('rejects unsupported index', () => {
    expect(isSupportedIndex('dc.language')).toBe(false);
  });

  it('supports all required relations', () => {
    const relations = ['=', 'exact', 'any', 'all'];
    for (const relation of relations) {
      expect(isSupportedRelation(relation)).toBe(true);
    }
  });
});

describe('CQL to Supabase Mapping', () => {
  it('maps dc.title = to ilike filter', () => {
    const parsed = parseCQL('dc.title = "test"');
    const { filter } = cqlToSupabaseFilter(parsed.terms);
    expect(filter).toContain('title.ilike.%test%');
  });

  it('maps bath.isbn to normalized isbn filter', () => {
    const parsed = parseCQL('bath.isbn = "978-3-16-148410-0"');
    const { filter } = cqlToSupabaseFilter(parsed.terms);
    expect(filter).toContain('isbn.eq.9783161484100');
  });

  it('maps bath.issn to normalized issn filter', () => {
    const parsed = parseCQL('bath.issn = "1234-5678"');
    const { filter } = cqlToSupabaseFilter(parsed.terms);
    expect(filter).toContain('issn.eq.12345678');
  });

  it('maps any to OR filter', () => {
    const parsed = parseCQL('dc.title any "hello world"');
    const { filter } = cqlToSupabaseFilter(parsed.terms);
    expect(filter).toContain('or');
  });

  it('maps all to AND filter', () => {
    const parsed = parseCQL('dc.title all "hello world"');
    const { filter } = cqlToSupabaseFilter(parsed.terms);
    expect(filter).toContain('and');
  });

  it('maps NOT to not filter', () => {
    const parsed = parseCQL('dc.title = "test" NOT dc.creator = "author"');
    const { filter } = cqlToSupabaseFilter(parsed.terms);
    expect(filter).toContain('not.');
  });
});

describe('Dublin Core Serializer', () => {
  it('serializes a complete record', () => {
    const xml = toDublinCore(SAMPLE_RECORD);
    expect(xml).toContain('<title>Test Book</title>');
    expect(xml).toContain('<creator>John Smith</creator>');
    expect(xml).toContain('<creator>Jane Doe</creator>');
    expect(xml).toContain('<identifier>ISBN:978-3-16-148410-0</identifier>');
    expect(xml).toContain('<identifier>ISSN:1234-5678</identifier>');
    expect(xml).toContain('<identifier>DOI:10.1234/test</identifier>');
    expect(xml).toContain('<publisher>Test Publisher</publisher>');
    expect(xml).toContain('<date>2024</date>');
    expect(xml).toContain('<subject>Computer Science</subject>');
  });

  it('escapes XML special characters', () => {
    const record = { ...SAMPLE_RECORD, title: 'Test <Book> & "Authors"' };
    const xml = toDublinCore(record);
    expect(xml).toContain('&lt;Book&gt;');
    expect(xml).toContain('&amp;');
  });
});

describe('MARCXML Serializer', () => {
  it('serializes a complete record', () => {
    const xml = toMARCXML(SAMPLE_RECORD);
    expect(xml).toContain('<leader>');
    expect(xml).toContain('<controlfield tag="001">test-id-123</controlfield>');
    expect(xml).toContain('<datafield tag="020"');
    expect(xml).toContain('<subfield code="a">978-3-16-148410-0</subfield>');
    expect(xml).toContain('<datafield tag="245"');
    expect(xml).toContain('<subfield code="a">Test Book</subfield>');
    expect(xml).toContain('<datafield tag="100"');
    expect(xml).toContain('<subfield code="a">John Smith</subfield>');
  });

  it('escapes XML special characters', () => {
    const record = { ...SAMPLE_RECORD, title: 'Test <Book>' };
    const xml = toMARCXML(record);
    expect(xml).toContain('&lt;Book&gt;');
  });
});

describe('Schema Selection', () => {
  it('serializes to MARCXML when requested', () => {
    const xml = serializeRecord(SAMPLE_RECORD, 'info:srw/schema/1/marcxml');
    expect(xml).toContain('<record xmlns="http://www.loc.gov/MARC21/slim">');
  });

  it('serializes to Dublin Core when requested', () => {
    const xml = serializeRecord(SAMPLE_RECORD, 'info:srw/schema/1/dc');
    expect(xml).toContain('<dc xmlns="http://purl.org/dc/elements/1.1/"');
  });

  it('defaults to Dublin Core for unknown schema', () => {
    const xml = serializeRecord(SAMPLE_RECORD, 'unknown');
    expect(xml).toContain('<dc xmlns="http://purl.org/dc/elements/1.1/"');
  });
});

describe('SRU Diagnostics', () => {
  it('produces valid XML for unknown operation', () => {
    const xml = errorResponse(SRU_DIAGNOSTICS.UNKNOWN_OPERATION('badOp'));
    expect(xml).toContain('<searchRetrieveResponse');
    expect(xml).toContain('<uri>info:srw/diagnostic/1/1</uri>');
    expect(xml).toContain('Unknown operation: badOp');
  });

  it('produces valid XML for missing query', () => {
    const xml = errorResponse(SRU_DIAGNOSTICS.MISSING_QUERY());
    expect(xml).toContain('<uri>info:srw/diagnostic/1/7</uri>');
  });

  it('produces valid XML for malformed CQL', () => {
    const xml = errorResponse(SRU_DIAGNOSTICS.MALFORMED_CQL('Unexpected token'));
    expect(xml).toContain('<uri>info:srw/diagnostic/1/10</uri>');
    expect(xml).toContain('Unexpected token');
  });

  it('produces valid XML for unsupported index', () => {
    const xml = errorResponse(SRU_DIAGNOSTICS.UNSUPPORTED_INDEX('dc.language'));
    expect(xml).toContain('<uri>info:srw/diagnostic/1/11</uri>');
  });

  it('produces valid XML for invalid startRecord', () => {
    const xml = errorResponse(SRU_DIAGNOSTICS.INVALID_START_RECORD('abc'));
    expect(xml).toContain('<uri>info:srw/diagnostic/1/14</uri>');
  });
});
