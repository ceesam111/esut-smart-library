import { describe, it, expect } from 'vitest';
import { parseMarcRecord } from './marcParse';
import type { YAZRecord } from './yazClient';

function makeRecord(fields: YAZRecord['fields']): YAZRecord {
  return { leader: '02392nkd a22004455a 4500', fields };
}

describe('parseMarcRecord', () => {
  it('parses a full MARC record', () => {
    const rec = makeRecord([
      { tag: '001', value: '19438698' },
      { tag: '035', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: '19438698' }] },
      { tag: '020', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: '978-0-13-468599-1' }] },
      { tag: '022', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: '0001-000X' }] },
      { tag: '100', ind1: '1', ind2: ' ', subfields: [{ code: 'a', value: 'Bailey, Charles P.' }] },
      { tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: 'Surgery of the heart' }] },
      { tag: '250', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: '1st ed.' }] },
      { tag: '260', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: 'Philadelphia' }, { code: 'b', value: 'Lea & Febiger' }, { code: 'c', value: '1955' }] },
      { tag: '300', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: '1062 p. : illus. ; 24 cm.' }] },
      { tag: '500', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: 'Includes bibliography.' }] },
      { tag: '520', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: 'A comprehensive text on cardiac surgery.' }] },
      { tag: '650', ind1: ' ', ind2: '0', subfields: [{ code: 'a', value: 'Heart' }, { code: 'x', value: 'Surgery' }] },
      { tag: '700', ind1: '1', ind2: ' ', subfields: [{ code: 'a', value: 'Smith, John' }] },
    ]);

    const parsed = parseMarcRecord(rec);

    expect(parsed.controlNumber).toBe('19438698');
    expect(parsed.title).toBe('Surgery of the heart');
    expect(parsed.authors).toEqual(['Bailey, Charles P.', 'Smith, John']);
    expect(parsed.isbn).toBe('9780134685991');
    expect(parsed.issn).toBe('0001000X');
    expect(parsed.publisher).toBe('Lea & Febiger');
    expect(parsed.placeOfPublication).toBe('Philadelphia');
    expect(parsed.year).toBe(1955);
    expect(parsed.edition).toBe('1st ed.');
    expect(parsed.subjects).toEqual(['Heart']);
    expect(parsed.abstract).toBe('A comprehensive text on cardiac surgery.');
    expect(parsed.physicalDescription).toBe('1062 p. : illus. ; 24 cm.');
    expect(parsed.notes).toEqual(['Includes bibliography.']);
  });

  it('handles record with no optional fields', () => {
    const rec = makeRecord([
      { tag: '001', value: '12345' },
      { tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: 'Simple title' }] },
    ]);

    const parsed = parseMarcRecord(rec);

    expect(parsed.title).toBe('Simple title');
    expect(parsed.isbn).toBeNull();
    expect(parsed.issn).toBeNull();
    expect(parsed.publisher).toBeNull();
    expect(parsed.year).toBeNull();
    expect(parsed.authors).toEqual([]);
  });

  it('strips trailing slash from title', () => {
    const rec = makeRecord([
      { tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: 'Title / statement of responsibility' }] },
    ]);

    expect(parseMarcRecord(rec).title).toBe('Title');
  });

  it('uses 264 when 260 is absent', () => {
    const rec = makeRecord([
      { tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: 'Title' }] },
      { tag: '264', ind1: ' ', ind2: '1', subfields: [{ code: 'a', value: 'New York' }, { code: 'b', value: 'Publisher' }, { code: 'c', value: '2020' }] },
    ]);

    const parsed = parseMarcRecord(rec);
    expect(parsed.publisher).toBe('Publisher');
    expect(parsed.placeOfPublication).toBe('New York');
    expect(parsed.year).toBe(2020);
  });

  it('extracts call number from 050', () => {
    const rec = makeRecord([
      { tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: 'Title' }] },
      { tag: '050', ind1: '0', ind2: '0', subfields: [{ code: 'a', value: 'RD598' }] },
    ]);

    expect(parseMarcRecord(rec).callNumber).toBe('RD598');
  });

  it('extracts language from 041', () => {
    const rec = makeRecord([
      { tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: 'Title' }] },
      { tag: '041', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: 'eng' }] },
    ]);

    expect(parseMarcRecord(rec).language).toBe('eng');
  });

  it('extracts series from 490', () => {
    const rec = makeRecord([
      { tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: 'Title' }] },
      { tag: '490', ind1: '0', ind2: ' ', subfields: [{ code: 'a', value: 'Series Title' }] },
    ]);

    expect(parseMarcRecord(rec).series).toBe('Series Title');
  });
});
