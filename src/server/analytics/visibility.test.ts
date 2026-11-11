import { describe, it, expect } from 'vitest';
import {
  classifyReferrer,
  duplicateTitleGroups,
  metadataCompleteness,
  monthlyDepositBuckets,
  normalizeTitle,
  toCsvCell,
  buildResearchCsv,
} from './visibility';

describe('classifyReferrer', () => {
  it('classifies empty referrers as direct', () => {
    expect(classifyReferrer(null)).toBe('direct');
    expect(classifyReferrer(undefined)).toBe('direct');
    expect(classifyReferrer('')).toBe('direct');
    expect(classifyReferrer('   ')).toBe('direct');
  });

  it('classifies search engines', () => {
    expect(classifyReferrer('https://www.google.com/search?q=esut')).toBe('search_engine');
    expect(classifyReferrer('https://www.bing.com/search?q=thesis')).toBe('search_engine');
    expect(classifyReferrer('https://duckduckgo.com/?q=library')).toBe('search_engine');
  });

  it('classifies social networks', () => {
    expect(classifyReferrer('https://www.facebook.com/share/x')).toBe('social');
    expect(classifyReferrer('https://x.com/status/1')).toBe('social');
    expect(classifyReferrer('https://www.linkedin.com/feed/')).toBe('social');
  });

  it('classifies AI assistants', () => {
    expect(classifyReferrer('https://chatgpt.com/c/123')).toBe('ai_agent');
    expect(classifyReferrer('https://www.perplexity.ai/search/q')).toBe('ai_agent');
  });

  it('prefers internal classification for matching hosts', () => {
    expect(classifyReferrer('https://virtuallibrary.esut.edu.ng/repository', ['virtuallibrary.esut.edu.ng'])).toBe('internal');
    expect(classifyReferrer('https://sub.esut.edu.ng/page', ['esut.edu.ng'])).toBe('internal');
  });

  it('falls back to other for unclassifiable hosts', () => {
    expect(classifyReferrer('https://example.org/ref')).toBe('other');
    expect(classifyReferrer('not a url')).toBe('other');
  });
});

describe('metadataCompleteness', () => {
  const fullItem = {
    title: 'Power Systems Stability',
    authors: [{ name: 'A. Okonkwo' }],
    abstract: 'A study of grid stability.',
    year: 2024,
    subjects: ['Engineering'],
    keywords: ['grid'],
    doi: '10.1234/abcd',
    faculty_code: 'ENG',
    department: 'Electrical',
    language: 'English',
    file_url: 'b2://bucket/file.pdf',
  };

  it('scores a complete record at 100', () => {
    const result = metadataCompleteness(fullItem);
    expect(result.score).toBe(100);
    expect(result.missingFields).toEqual([]);
  });

  it('scores an empty record at 0 and lists every field', () => {
    const result = metadataCompleteness({});
    expect(result.score).toBe(0);
    expect(result.missingFields).toContain('title');
    expect(result.missingFields).toContain('doi');
    expect(result.missingFields.length).toBe(10);
  });

  it('accepts plain-string authors', () => {
    const result = metadataCompleteness({ ...fullItem, authors: ['A. Okonkwo'] });
    expect(result.fields.find((f) => f.field === 'authors')?.filled).toBe(true);
  });

  it('treats blank-string authors as missing', () => {
    const result = metadataCompleteness({ ...fullItem, authors: ['  '] });
    expect(result.fields.find((f) => f.field === 'authors')?.filled).toBe(false);
  });

  it('counts keywords as satisfying the subjects field', () => {
    const result = metadataCompleteness({ ...fullItem, subjects: null, keywords: ['grid'] });
    expect(result.fields.find((f) => f.field === 'subjects')?.filled).toBe(true);
  });

  it('rejects non-numeric years', () => {
    const result = metadataCompleteness({ ...fullItem, year: Number.NaN });
    expect(result.fields.find((f) => f.field === 'year')?.filled).toBe(false);
  });
});

describe('normalizeTitle', () => {
  it('lowercases, strips punctuation, and collapses whitespace', () => {
    expect(normalizeTitle('  Power  Systems, Stability! ')).toBe('power systems stability');
  });

  it('keeps letters with diacritics', () => {
    expect(normalizeTitle('École Study')).toBe('école study');
  });
});

describe('duplicateTitleGroups', () => {
  it('groups titles that normalize identically', () => {
    const groups = duplicateTitleGroups([
      { id: '1', title: 'Power Systems: Stability' },
      { id: '2', title: 'power systems stability' },
      { id: '3', title: 'Other Title' },
    ]);
    expect(groups.length).toBe(1);
    expect(groups[0].count).toBe(2);
    expect(groups[0].items.map((i) => i.id)).toEqual(['1', '2']);
  });

  it('ignores empty titles and singleton groups', () => {
    const groups = duplicateTitleGroups([
      { id: '1', title: '' },
      { id: '2', title: 'Solo' },
    ]);
    expect(groups).toEqual([]);
  });

  it('sorts by count descending', () => {
    const groups = duplicateTitleGroups([
      { id: 'a', title: 'One' },
      { id: 'b', title: 'Two' },
      { id: 'c', title: 'Two' },
      { id: 'd', title: 'Three' },
      { id: 'e', title: 'Three' },
      { id: 'f', title: 'Three' },
    ]);
    expect(groups[0].count).toBe(3);
    expect(groups[1].count).toBe(2);
  });
});

describe('monthlyDepositBuckets', () => {
  it('buckets deposits by month and status', () => {
    const buckets = monthlyDepositBuckets([
      { created_at: '2026-08-14T10:00:00Z', status: 'published' },
      { created_at: '2026-08-30T10:00:00Z', status: 'submitted' },
      { created_at: '2026-09-01T10:00:00Z', status: 'published' },
      { created_at: 'not-a-date', status: 'published' },
    ]);
    expect(buckets.map((b) => b.month)).toEqual(['2026-08', '2026-09']);
    expect(buckets[0].total).toBe(2);
    expect(buckets[0].byStatus.published).toBe(1);
    expect(buckets[0].byStatus.submitted).toBe(1);
    expect(buckets[1].total).toBe(1);
  });

  it('returns an empty list for no deposits', () => {
    expect(monthlyDepositBuckets([])).toEqual([]);
  });
});

describe('csv helpers', () => {
  it('escapes cells containing commas, quotes, and newlines', () => {
    expect(toCsvCell('plain')).toBe('plain');
    expect(toCsvCell('a,b')).toBe('"a,b"');
    expect(toCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(toCsvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(toCsvCell(null)).toBe('');
    expect(toCsvCell(42)).toBe('42');
  });

  it('builds sections with headers and blank separators', () => {
    const csv = buildResearchCsv([
      { name: 'summary', header: ['metric', 'value'], rows: [['views', 12]] },
      { name: 'faculties', header: ['faculty', 'count'], rows: [['ENG', 3], ['SCI, Computing', 2]] },
    ]);
    expect(csv).toContain('# summary');
    expect(csv).toContain('metric,value');
    expect(csv).toContain('views,12');
    expect(csv).toContain('# faculties');
    expect(csv).toContain('"SCI, Computing",2');
    expect(csv.endsWith('\n')).toBe(true);
  });
});
