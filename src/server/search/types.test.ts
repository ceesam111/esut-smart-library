import { describe, expect, it } from 'vitest';
import { normalizeSort, parseNumberArray, parseStringArray } from './types';

describe('normalizeSort', () => {
  it('defaults to relevance', () => {
    expect(normalizeSort(null)).toBe('relevance');
    expect(normalizeSort(undefined)).toBe('relevance');
    expect(normalizeSort('')).toBe('relevance');
  });

  it('accepts supported sorts', () => {
    expect(normalizeSort('newest')).toBe('newest');
    expect(normalizeSort('oldest')).toBe('oldest');
    expect(normalizeSort('title')).toBe('title');
  });

  it('falls back to relevance for unsupported values', () => {
    expect(normalizeSort('popularity')).toBe('relevance');
    expect(normalizeSort('DROP TABLE')).toBe('relevance');
  });

  it('is case-insensitive', () => {
    expect(normalizeSort('NEWEST')).toBe('newest');
  });
});

describe('parseStringArray', () => {
  it('returns null for empty input', () => {
    expect(parseStringArray(null)).toBeNull();
    expect(parseStringArray('')).toBeNull();
  });

  it('splits and trims comma-separated values', () => {
    expect(parseStringArray('a, b ,c')).toEqual(['a', 'b', 'c']);
  });

  it('drops blank entries', () => {
    expect(parseStringArray('a,,b, ,')).toEqual(['a', 'b']);
  });
});

describe('parseNumberArray', () => {
  it('returns null for empty input', () => {
    expect(parseNumberArray(null)).toBeNull();
  });

  it('keeps only integers', () => {
    expect(parseNumberArray('2024, 2025, abc, 3.5')).toEqual([2024, 2025]);
  });

  it('returns null when nothing valid remains', () => {
    expect(parseNumberArray('abc')).toBeNull();
  });
});
