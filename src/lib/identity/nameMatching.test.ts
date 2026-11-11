import { describe, expect, it } from 'vitest';
import { nameMatchKey, nameSimilarity, namesMatch, normalizePersonName, personNameTokens, significantNameTokens } from './nameMatching';

describe('normalizePersonName', () => {
  it('lowercases, strips punctuation and removes diacritics', () => {
    expect(normalizePersonName('José Okafor-Idika')).toBe('jose okafor idika');
    expect(normalizePersonName('Okafor, Chinedu')).toBe('okafor chinedu');
    expect(normalizePersonName('  Ngozi   A.  Okonkwo ')).toBe('ngozi a okonkwo');
  });
});

describe('personNameTokens and significantNameTokens', () => {
  it('splits names into tokens and drops single-character initials from significant tokens', () => {
    expect(personNameTokens('Ngozi A. Okonkwo')).toEqual(['ngozi', 'a', 'okonkwo']);
    expect(significantNameTokens('Ngozi A. Okonkwo')).toEqual(['ngozi', 'okonkwo']);
  });
});

describe('namesMatch', () => {
  it('matches identical names regardless of case and punctuation', () => {
    expect(namesMatch('Okafor, Chinedu', 'chinedu okafor')).toBe(true);
  });

  it('matches when token order is swapped', () => {
    expect(namesMatch('Chinedu Okafor', 'Okafor, Chinedu')).toBe(true);
  });

  it('matches when one side drops a middle initial but keeps two significant tokens', () => {
    expect(namesMatch('Ngozi A. Okonkwo', 'Ngozi Okonkwo')).toBe(true);
  });

  it('matches diacritic variants of the same name', () => {
    expect(namesMatch('José María', 'Jose Maria')).toBe(true);
  });

  it('rejects a bare surname against a full name instead of guessing', () => {
    expect(namesMatch('Okafor', 'Chinedu Okafor')).toBe(false);
  });

  it('rejects different people', () => {
    expect(namesMatch('Chinedu Okafor', 'Chidi Eze')).toBe(false);
  });

  it('rejects empty or whitespace-only input', () => {
    expect(namesMatch('', '')).toBe(false);
    expect(namesMatch('   ', 'Chinedu Okafor')).toBe(false);
  });
});

describe('nameSimilarity', () => {
  it('returns 1 for identical significant token sets', () => {
    expect(nameSimilarity('Chinedu Okafor', 'Okafor, Chinedu')).toBe(1);
  });

  it('returns 0 for disjoint names', () => {
    expect(nameSimilarity('Chinedu Okafor', 'Binta Ade')).toBe(0);
  });

  it('returns the Jaccard ratio for partially overlapping names', () => {
    expect(nameSimilarity('Chinedu Okafor', 'Chinedu Eze')).toBe(0.33);
  });
});

describe('nameMatchKey', () => {
  it('produces the same key for name-order variants', () => {
    expect(nameMatchKey('Okafor, Chinedu')).toBe(nameMatchKey('Chinedu Okafor'));
  });

  it('falls back to the normalized name for single-token names', () => {
    expect(nameMatchKey('Okafor')).toBe('okafor');
  });

  it('keeps different people under different keys', () => {
    expect(nameMatchKey('Chinedu Okafor')).not.toBe(nameMatchKey('Chidi Eze'));
  });
});
