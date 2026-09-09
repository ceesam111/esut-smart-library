import { describe, expect, it } from 'vitest';
import { normalizeCandidate, normalizeDoi, normalizeIdentifier, normalizeTitle } from './normalize';

describe('resource normalization', () => {
  it('normalizes identifiers and titles', () => {
    expect(normalizeIdentifier('ISBN 978-1-234 56789-0')).toBe('9781234567890');
    expect(normalizeDoi('https://doi.org/10.1000/ABC')).toBe('10.1000/abc');
    expect(normalizeTitle('  Teaching: Science! ')).toBe('teaching science');
  });

  it('classifies exact identifier metadata as clean match', () => {
    const candidate = normalizeCandidate({ source_name: 'CrossRef', title: 'A paper', doi: '10.1/ABC' }, 'paper');
    expect(candidate.confidence).toBe('clean_match');
    expect(candidate.doi).toBe('10.1/abc');
  });
});
