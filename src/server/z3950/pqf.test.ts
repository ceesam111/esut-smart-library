import { describe, it, expect } from 'vitest';
import { buildPQF, INDEX_TO_BIB1 } from './pqf';

describe('buildPQF', () => {
  it('builds keyword query with BIB-1 use 1016', () => {
    expect(buildPQF('keyword', 'heart surgery')).toBe('@attr 1=1016 @attr 2=3 @attr 3=3 @attr 4=2 @attr 5=1 "heart surgery"');
  });

  it('builds title query with BIB-1 use 4', () => {
    expect(buildPQF('title', 'Surgery of the heart')).toBe('@attr 1=4 @attr 2=3 @attr 3=3 @attr 4=2 @attr 5=1 "Surgery of the heart"');
  });

  it('builds author query with BIB-1 use 1003', () => {
    expect(buildPQF('author', 'Bailey, Charles P.')).toBe('@attr 1=1003 @attr 2=3 @attr 3=3 @attr 4=2 @attr 5=1 "Bailey, Charles P."');
  });

  it('builds ISBN query with BIB-1 use 7', () => {
    expect(buildPQF('isbn', '9780134685991')).toBe('@attr 1=7 @attr 2=3 @attr 3=3 @attr 4=2 @attr 5=1 "9780134685991"');
  });

  it('builds ISSN query with BIB-1 use 8', () => {
    expect(buildPQF('issn', '0001-000X')).toBe('@attr 1=8 @attr 2=3 @attr 3=3 @attr 4=2 @attr 5=1 "0001-000X"');
  });

  it('builds subject query with BIB-1 use 21', () => {
    expect(buildPQF('subject', 'Heart Surgery')).toBe('@attr 1=21 @attr 2=3 @attr 3=3 @attr 4=2 @attr 5=1 "Heart Surgery"');
  });

  it('builds control number query with BIB-1 use 12', () => {
    expect(buildPQF('control', '19438698')).toBe('@attr 1=12 @attr 2=3 @attr 3=3 @attr 4=2 @attr 5=1 "19438698"');
  });

  it('builds publisher query with BIB-1 use 1018', () => {
    expect(buildPQF('publisher', 'Lea & Febiger')).toBe('@attr 1=1018 @attr 2=3 @attr 3=3 @attr 4=2 @attr 5=1 "Lea & Febiger"');
  });

  it('builds year query with BIB-1 use 31', () => {
    expect(buildPQF('year', '1955')).toBe('@attr 1=31 @attr 2=3 @attr 3=3 @attr 4=2 @attr 5=1 "1955"');
  });

  it('strips double quotes from term', () => {
    expect(buildPQF('title', 'The "Great" Gatsby')).toBe('@attr 1=4 @attr 2=3 @attr 3=3 @attr 4=2 @attr 5=1 "The Great Gatsby"');
  });

  it('applies per-target attribute overrides', () => {
    expect(buildPQF('title', 'heart', { title: 6 })).toBe('@attr 1=6 @attr 2=3 @attr 3=3 @attr 4=2 @attr 5=1 "heart"');
  });

  it('uses standard attribute when override not present for index', () => {
    expect(buildPQF('author', 'smith', { title: 6 })).toBe('@attr 1=1003 @attr 2=3 @attr 3=3 @attr 4=2 @attr 5=1 "smith"');
  });
});

describe('INDEX_TO_BIB1', () => {
  it('maps all supported indexes', () => {
    expect(Object.keys(INDEX_TO_BIB1).sort()).toEqual(['author', 'control', 'isbn', 'issn', 'keyword', 'publisher', 'subject', 'title', 'year']);
  });
});
