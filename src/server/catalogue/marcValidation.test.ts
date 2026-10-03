import { describe, it, expect } from 'vitest';
import { validateMarcRecord, validateISBN, validateISSN, type MarcRecord } from './marcValidation';

function makeRecord(fields: MarcRecord['fields']): MarcRecord {
  return { leader: '02392nkd a22004455a 4500', fields };
}

describe('validateMarcRecord', () => {
  it('passes valid record', () => {
    const rec = makeRecord([
      { tag: '001', value: '12345' },
      { tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: 'Title' }] },
    ]);
    const result = validateMarcRecord(rec);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('errors on missing 245$a', () => {
    const rec = makeRecord([{ tag: '001', value: '12345' }]);
    const result = validateMarcRecord(rec);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.tag === '245')).toBe(true);
  });

  it('errors on invalid tag format', () => {
    const rec = makeRecord([
      { tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: 'Title' }] },
      { tag: 'ABC', ind1: ' ', ind2: ' ', subfields: [{ code: 'a', value: 'Bad' }] },
    ]);
    const result = validateMarcRecord(rec);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('Invalid tag'))).toBe(true);
  });

  it('errors on invalid indicator', () => {
    const rec = makeRecord([
      { tag: '245', ind1: '#', ind2: '0', subfields: [{ code: 'a', value: 'Title' }] },
    ]);
    const result = validateMarcRecord(rec);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('Invalid indicator'))).toBe(true);
  });

  it('errors on invalid subfield code', () => {
    const rec = makeRecord([
      { tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'A', value: 'Title' }] },
    ]);
    const result = validateMarcRecord(rec);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('Invalid subfield'))).toBe(true);
  });

  it('errors on missing required field', () => {
    const rec = makeRecord([
      { tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: 'Title' }] },
    ]);
    const result = validateMarcRecord(rec, [{ tag: '100', subfield: 'a' }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('Required field'))).toBe(true);
  });

  it('warns on missing 001', () => {
    const rec = makeRecord([
      { tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: 'Title' }] },
    ]);
    const result = validateMarcRecord(rec);
    expect(result.warnings.some(w => w.tag === '001')).toBe(true);
  });

  it('errors on short leader', () => {
    const rec = { leader: 'short', fields: [{ tag: '245', ind1: '1', ind2: '0', subfields: [{ code: 'a', value: 'Title' }] }] };
    const result = validateMarcRecord(rec);
    expect(result.errors.some(e => e.message.includes('Leader'))).toBe(true);
  });
});

describe('validateISBN', () => {
  it('passes valid ISBN-13', () => {
    expect(validateISBN('978-0-13-468599-1')).toBeNull();
  });

  it('passes valid ISBN-10', () => {
    expect(validateISBN('0-13-468599-7')).toBeNull();
  });

  it('warns on invalid ISBN-13 check digit', () => {
    const result = validateISBN('978-0-13-468599-2');
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('WARNING');
  });

  it('warns on invalid length', () => {
    const result = validateISBN('12345');
    expect(result).not.toBeNull();
  });
});

describe('validateISSN', () => {
  it('passes valid ISSN', () => {
    expect(validateISSN('0378-5955')).toBeNull();
  });

  it('warns on invalid ISSN check digit', () => {
    const result = validateISSN('0378-5956');
    expect(result).not.toBeNull();
  });

  it('warns on invalid length', () => {
    const result = validateISSN('12345');
    expect(result).not.toBeNull();
  });
});
