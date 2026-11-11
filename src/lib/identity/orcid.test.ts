import { describe, expect, it } from 'vitest';
import { normalizeOrcidId, orcidChecksumDigit, orcidProfileUrl, validateOrcidId } from './orcid';

describe('normalizeOrcidId', () => {
  it('keeps an already formatted id unchanged', () => {
    expect(normalizeOrcidId('0000-0002-1825-0097')).toBe('0000-0002-1825-0097');
  });

  it('accepts full URLs, orcid.org prefixes and compact forms', () => {
    expect(normalizeOrcidId('https://orcid.org/0000-0002-1825-0097')).toBe('0000-0002-1825-0097');
    expect(normalizeOrcidId('http://orcid.org/0000-0002-1825-0097')).toBe('0000-0002-1825-0097');
    expect(normalizeOrcidId('orcid.org/0000-0002-1825-0097')).toBe('0000-0002-1825-0097');
    expect(normalizeOrcidId('0000000218250097')).toBe('0000-0002-1825-0097');
    expect(normalizeOrcidId('  0000-0002-1825-0097  ')).toBe('0000-0002-1825-0097');
  });

  it('uppercases an X check digit', () => {
    expect(normalizeOrcidId('0000-0000-0000-001x')).toBe('0000-0000-0000-001X');
  });

  it('rejects malformed inputs', () => {
    expect(normalizeOrcidId('')).toBeNull();
    expect(normalizeOrcidId('abc')).toBeNull();
    expect(normalizeOrcidId('0000-0002-1825-009')).toBeNull();
    expect(normalizeOrcidId('10.1000/xyz')).toBeNull();
    expect(normalizeOrcidId('0000-0002-1825-00A7')).toBeNull();
  });
});

describe('orcidChecksumDigit', () => {
  it('computes the ISO 7064 MOD 11-2 check digit for a known valid ORCID base', () => {
    expect(orcidChecksumDigit('000000021825009')).toBe('7');
  });

  it('returns X when the remainder requires the X digit', () => {
    expect(orcidChecksumDigit('000000000000001')).toBe('X');
  });

  it('returns empty for non-15-digit input', () => {
    expect(orcidChecksumDigit('123')).toBe('');
    expect(orcidChecksumDigit('00000002182500a')).toBe('');
  });
});

describe('validateOrcidId', () => {
  it('accepts a real registered ORCID verified against the live registry', () => {
    expect(validateOrcidId('0000-0002-1825-0097')).toBe('0000-0002-1825-0097');
  });

  it('rejects the wrong check digit even when the format looks perfect', () => {
    expect(validateOrcidId('0000-0002-1825-0094')).toBeNull();
    expect(validateOrcidId('0000-0002-1825-0090')).toBeNull();
  });

  it('accepts the computed X check digit case', () => {
    expect(validateOrcidId('0000-0000-0000-001X')).toBe('0000-0000-0000-001X');
    expect(validateOrcidId('0000-0000-0000-0010')).toBeNull();
  });

  it('accepts URL input and normalizes it', () => {
    expect(validateOrcidId('https://orcid.org/0000-0002-1825-0097')).toBe('0000-0002-1825-0097');
  });

  it('rejects structurally invalid input', () => {
    expect(validateOrcidId('not-an-orcid')).toBeNull();
    expect(validateOrcidId('0000-0002-1825-009')).toBeNull();
  });
});

describe('orcidProfileUrl', () => {
  it('builds the canonical profile URL for a valid id', () => {
    expect(orcidProfileUrl('0000-0002-1825-0097')).toBe('https://orcid.org/0000-0002-1825-0097');
  });

  it('returns null for invalid ids instead of linking somewhere broken', () => {
    expect(orcidProfileUrl('0000-0002-1825-0094')).toBeNull();
  });
});
