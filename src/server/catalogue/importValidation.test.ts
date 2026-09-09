import { describe, expect, it } from 'vitest';
import { findDuplicateIsbns, validateCatalogueRow } from './importValidation';

describe('catalogue CSV validation', () => {
  it('requires ISBN or title', () => {
    const result = validateCatalogueRow({});
    expect(result.errors).toContain('Either ISBN or title is required.');
  });

  it('validates item type, copies, year, URL, and shelf location', () => {
    const result = validateCatalogueRow({
      title: 'Bad Row',
      item_type: 'dvd',
      copies: '0',
      year: '3020',
      source_url: 'not-a-url',
      shelf_location: 'MAIN-1-A',
    });
    expect(result.errors).toContain('Item type must be one of: book, journal, ebook, database.');
    expect(result.errors).toContain('Copies must be a positive integer.');
    expect(result.errors).toContain('Year is invalid.');
    expect(result.errors).toContain('Source URL is invalid.');
    expect(result.errors).toContain('Shelf location must match LIBRARY/FLOOR/BAY/SHELF.');
  });

  it('detects duplicate ISBNs in file', () => {
    const rows = [{ isbn: '978-1-23' }, { isbn: '978123' }];
    const duplicates = findDuplicateIsbns(rows);
    const result = validateCatalogueRow({ isbn: '978123', title: 'Duplicate' }, duplicates);
    expect(result.errors).toContain('Duplicate ISBN inside uploaded file.');
  });
});
