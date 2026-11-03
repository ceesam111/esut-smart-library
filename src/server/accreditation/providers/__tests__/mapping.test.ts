import { describe, expect, it } from 'vitest';
import {
  resolveHarvestedItem,
  mapResearchType,
  yearFromIsoDate,
  doiFromValue,
  identifierFromValue,
  httpUrl,
  isHttpUrl,
  firstText,
  compactTextArray,
  yearFromValue,
} from '../mapping';

describe('resolveHarvestedItem (access honesty)', () => {
  const base = {
    externalId: 'test-1',
    resourceType: 'research_article' as const,
    title: 'A Test Paper',
    creators: ['Alice'],
    landingPageUrl: 'https://example.org/landing',
  };

  it('sets accessState full_text when fullTextUrl is present', () => {
    const item = resolveHarvestedItem({
      ...base,
      fullTextUrl: 'https://example.org/fulltext.pdf',
      abstractText: 'An abstract.',
    });
    expect(item.accessState).toBe('full_text');
    expect(item.fullTextUrl).toBe('https://example.org/fulltext.pdf');
  });

  it('sets accessState abstract_only when abstract present but no fullTextUrl', () => {
    const item = resolveHarvestedItem({
      ...base,
      abstractText: 'An abstract.',
    });
    expect(item.accessState).toBe('abstract_only');
    expect(item.fullTextUrl).toBeUndefined();
  });

  it('sets accessState metadata_only when neither fullTextUrl nor abstract', () => {
    const item = resolveHarvestedItem({ ...base });
    expect(item.accessState).toBe('metadata_only');
    expect(item.fullTextUrl).toBeUndefined();
    expect(item.abstractText).toBeUndefined();
  });

  it('trims whitespace-only fullTextUrl and falls back to abstract_only', () => {
    const item = resolveHarvestedItem({
      ...base,
      fullTextUrl: '   ',
      abstractText: 'An abstract.',
    });
    expect(item.accessState).toBe('abstract_only');
    expect(item.fullTextUrl).toBeUndefined();
  });

  it('trims whitespace-only abstract and falls back to metadata_only', () => {
    const item = resolveHarvestedItem({
      ...base,
      abstractText: '   ',
    });
    expect(item.accessState).toBe('metadata_only');
  });

  it('preserves explicit openAccess=false even when fullTextUrl is set', () => {
    const item = resolveHarvestedItem({
      ...base,
      fullTextUrl: 'https://example.org/fulltext.pdf',
      openAccess: false,
    });
    expect(item.accessState).toBe('full_text');
    expect(item.openAccess).toBe(false);
  });

  it('preserves explicit openAccess=true when no fullTextUrl', () => {
    const item = resolveHarvestedItem({
      ...base,
      openAccess: true,
    });
    expect(item.accessState).toBe('metadata_only');
    expect(item.openAccess).toBe(true);
  });

  it('defaults openAccess to true when unknownIsOpenAccess is set and no fullTextUrl', () => {
    const item = resolveHarvestedItem({
      ...base,
      unknownIsOpenAccess: true,
    });
    expect(item.accessState).toBe('metadata_only');
    expect(item.openAccess).toBe(true);
  });

  it('defaults openAccess to false when no explicit flag and no fullTextUrl', () => {
    const item = resolveHarvestedItem({ ...base });
    expect(item.openAccess).toBe(false);
  });

  it('never synthesises fullTextUrl from a DOI', () => {
    const item = resolveHarvestedItem({
      ...base,
      doi: '10.1000/xyz',
    });
    expect(item.fullTextUrl).toBeUndefined();
    expect(item.accessState).toBe('metadata_only');
  });

  it('never synthesises fullTextUrl from landingPageUrl', () => {
    const item = resolveHarvestedItem({
      ...base,
      landingPageUrl: 'https://example.org/full-text',
    });
    expect(item.fullTextUrl).toBeUndefined();
    expect(item.accessState).toBe('metadata_only');
  });

  it('preserves title and creators as passed (adapters trim via firstText)', () => {
    const item = resolveHarvestedItem({
      ...base,
      title: 'A Test Paper',
      creators: ['Alice', 'Bob'],
      publisher: '  Example Press  ',
      subjectHeadings: ['pharmacology', 'biology'],
    });
    expect(item.title).toBe('A Test Paper');
    expect(item.creators).toEqual(['Alice', 'Bob']);
    expect(item.publisher).toBe('Example Press');
    expect(item.subjectHeadings).toEqual(['pharmacology', 'biology']);
  });

  it('converts null-ish optional fields to undefined', () => {
    const item = resolveHarvestedItem({
      ...base,
      publisher: null,
      publicationDate: null,
      publicationYear: null,
      doi: null,
      isbn: null,
      issn: null,
      language: null,
      abstractText: null,
      fullTextUrl: null,
    });
    expect(item.publisher).toBeUndefined();
    expect(item.publicationDate).toBeUndefined();
    expect(item.publicationYear).toBeUndefined();
    expect(item.doi).toBeUndefined();
    expect(item.isbn).toBeUndefined();
    expect(item.issn).toBeUndefined();
    expect(item.language).toBeUndefined();
    expect(item.abstractText).toBeUndefined();
    expect(item.fullTextUrl).toBeUndefined();
    expect(item.accessState).toBe('metadata_only');
  });

  it('defaults subjectHeadings to empty array', () => {
    const item = resolveHarvestedItem({ ...base });
    expect(item.subjectHeadings).toEqual([]);
  });

  it('preserves publicationYear as-is (including 0)', () => {
    const item = resolveHarvestedItem({ ...base, publicationYear: 2024 });
    expect(item.publicationYear).toBe(2024);
  });
});

describe('mapResearchType', () => {
  it('maps preprint to research_article', () => {
    expect(mapResearchType('preprint')).toBe('research_article');
  });

  it('maps dataset to dataset', () => {
    expect(mapResearchType('dataset')).toBe('dataset');
  });

  it('maps thesis/dissertation to thesis', () => {
    expect(mapResearchType('thesis')).toBe('thesis');
    expect(mapResearchType('dissertation')).toBe('thesis');
  });

  it('maps standard/patent to standard', () => {
    expect(mapResearchType('standard')).toBe('standard');
    expect(mapResearchType('patent')).toBe('standard');
  });

  it('maps book/chapter to ebook', () => {
    expect(mapResearchType('book')).toBe('ebook');
    expect(mapResearchType('book-chapter')).toBe('ebook');
  });

  it('maps report to report', () => {
    expect(mapResearchType('report')).toBe('report');
    expect(mapResearchType('working paper')).toBe('report');
    expect(mapResearchType('technical report')).toBe('report');
  });

  it('maps journal/serial to ejournal', () => {
    expect(mapResearchType('journal')).toBe('ejournal');
    expect(mapResearchType('serial')).toBe('ejournal');
  });

  it('defaults to research_article', () => {
    expect(mapResearchType('unknown')).toBe('research_article');
    expect(mapResearchType(undefined)).toBe('research_article');
    expect(mapResearchType(null)).toBe('research_article');
    expect(mapResearchType('')).toBe('research_article');
  });
});

describe('yearFromIsoDate', () => {
  it('extracts year from ISO date string', () => {
    expect(yearFromIsoDate('2024-05-10')).toBe(2024);
    expect(yearFromIsoDate('2025-01-01T00:00:00Z')).toBe(2025);
  });

  it('returns null for null/undefined/empty', () => {
    expect(yearFromIsoDate(null)).toBeNull();
    expect(yearFromIsoDate(undefined)).toBeNull();
    expect(yearFromIsoDate('')).toBeNull();
  });

  it('returns null for non-date strings', () => {
    expect(yearFromIsoDate('not-a-date')).toBeNull();
  });

  it('returns null for years outside valid range', () => {
    expect(yearFromIsoDate('9999-01-01')).toBeNull();
    expect(yearFromIsoDate('1200-01-01')).toBeNull();
  });
});

describe('doiFromValue', () => {
  it('normalises DOI URLs to bare DOI', () => {
    expect(doiFromValue('https://doi.org/10.1000/ABC')).toBe('10.1000/abc');
    expect(doiFromValue('http://dx.doi.org/10.1000/ABC')).toBe('10.1000/abc');
    expect(doiFromValue('doi:10.1000/ABC')).toBe('10.1000/abc');
  });

  it('lowercases bare DOI', () => {
    expect(doiFromValue('10.1000/XYZ')).toBe('10.1000/xyz');
  });

  it('returns null for null/undefined/empty', () => {
    expect(doiFromValue(null)).toBeNull();
    expect(doiFromValue(undefined)).toBeNull();
    expect(doiFromValue('')).toBeNull();
  });
});

describe('identifierFromValue', () => {
  it('strips ISBN prefix and normalises', () => {
    expect(identifierFromValue('ISBN 978-1-234 56789-0')).toBe('9781234567890');
    expect(identifierFromValue('ISBN: 9780134685991')).toBe('9780134685991');
  });

  it('returns null for null/undefined/empty', () => {
    expect(identifierFromValue(null)).toBeNull();
    expect(identifierFromValue(undefined)).toBeNull();
    expect(identifierFromValue('')).toBeNull();
  });
});

describe('httpUrl / isHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isHttpUrl('http://example.org')).toBe(true);
    expect(isHttpUrl('https://example.org/path')).toBe(true);
  });

  it('rejects non-http protocols', () => {
    expect(isHttpUrl('ftp://example.org')).toBe(false);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/html,<script>')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(isHttpUrl('not-a-url')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
  });

  it('httpUrl returns null for invalid URLs', () => {
    expect(httpUrl('not-a-url')).toBeNull();
    expect(httpUrl('ftp://example.org')).toBeNull();
  });

  it('httpUrl returns the URL for valid http/https', () => {
    expect(httpUrl('https://example.org/pdf')).toBe('https://example.org/pdf');
  });
});

describe('firstText', () => {
  it('returns first element of array', () => {
    expect(firstText(['a', 'b'])).toBe('a');
  });

  it('returns the string itself', () => {
    expect(firstText('hello')).toBe('hello');
  });

  it('returns null for empty array', () => {
    expect(firstText([])).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(firstText(null)).toBeNull();
    expect(firstText(undefined)).toBeNull();
  });
});

describe('compactTextArray', () => {
  it('compacts and deduplicates', () => {
    expect(compactTextArray(['a', 'a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('respects cap', () => {
    expect(compactTextArray(['a', 'b', 'c', 'd', 'e'], 3)).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for non-arrays', () => {
    expect(compactTextArray(null)).toEqual([]);
    expect(compactTextArray(undefined)).toEqual([]);
    expect(compactTextArray('not-array')).toEqual([]);
  });
});

describe('yearFromValue', () => {
  it('accepts integer year in range', () => {
    expect(yearFromValue(2024)).toBe(2024);
  });

  it('rejects integer out of range', () => {
    expect(yearFromValue(1200)).toBeNull();
    expect(yearFromValue(9999)).toBeNull();
  });

  it('extracts year from string', () => {
    expect(yearFromValue('2024')).toBe(2024);
    expect(yearFromValue('Published in 2024')).toBe(2024);
  });

  it('returns null for null/undefined/empty', () => {
    expect(yearFromValue(null)).toBeNull();
    expect(yearFromValue(undefined)).toBeNull();
    expect(yearFromValue('')).toBeNull();
  });
});