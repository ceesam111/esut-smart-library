import { z } from 'zod';

export const CATALOGUE_TEMPLATE_COLUMNS = [
  'isbn',
  'title',
  'authors',
  'publisher',
  'year',
  'edition',
  'language',
  'category',
  'subjects',
  'copies',
  'shelf_location',
  'item_type',
  'source_url',
  'notes',
] as const;

export type CatalogueTemplateColumn = typeof CATALOGUE_TEMPLATE_COLUMNS[number];
export type CatalogueConfidence = 'clean_match' | 'needs_review' | 'no_match' | 'conflict';

export interface NormalizedCatalogueRow {
  isbn: string | null;
  title: string | null;
  authors: string[];
  publisher: string | null;
  year: number | null;
  edition: string | null;
  language: string | null;
  category: string | null;
  subjects: string[];
  copies: number;
  shelf_location: string | null;
  item_type: 'book' | 'journal' | 'ebook' | 'database';
  source_url: string | null;
  notes: string | null;
  raw_row: Record<string, unknown>;
}

export interface RowValidationResult {
  row: NormalizedCatalogueRow;
  errors: string[];
  warnings: string[];
}

const itemTypeSchema = z.enum(['book', 'journal', 'ebook', 'database']);
const shelfLocationPattern = /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/;

function clean(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function splitList(value: unknown) {
  const text = clean(value);
  if (!text) return [];
  return text.split(',').map((part) => part.trim()).filter(Boolean);
}

export function normalizeIsbn(value: unknown) {
  const text = clean(value);
  if (!text) return null;
  return text.replace(/[^0-9Xx]/g, '').toUpperCase() || null;
}

export function normalizeCatalogueRow(input: Record<string, unknown>): NormalizedCatalogueRow {
  const yearText = clean(input.year);
  const copiesText = clean(input.copies);
  const itemTypeText = (clean(input.item_type) ?? 'book').toLowerCase();

  return {
    isbn: normalizeIsbn(input.isbn),
    title: clean(input.title),
    authors: splitList(input.authors),
    publisher: clean(input.publisher),
    year: yearText ? Number(yearText) : null,
    edition: clean(input.edition),
    language: clean(input.language),
    category: clean(input.category),
    subjects: splitList(input.subjects),
    copies: copiesText ? Number(copiesText) : 1,
    shelf_location: clean(input.shelf_location),
    item_type: itemTypeSchema.safeParse(itemTypeText).success ? itemTypeText as NormalizedCatalogueRow['item_type'] : 'book',
    source_url: clean(input.source_url),
    notes: clean(input.notes),
    raw_row: input,
  };
}

export function validateCatalogueRow(input: Record<string, unknown>, duplicateIsbnsInFile = new Set<string>()): RowValidationResult {
  const row = normalizeCatalogueRow(input);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!row.isbn && !row.title) errors.push('Either ISBN or title is required.');
  if (row.year !== null && (!Number.isInteger(row.year) || row.year < 1000 || row.year > new Date().getFullYear() + 2)) {
    errors.push('Year is invalid.');
  }
  if (row.shelf_location && !shelfLocationPattern.test(row.shelf_location)) {
    errors.push('Shelf location must match LIBRARY/FLOOR/BAY/SHELF.');
  }
  if (!itemTypeSchema.safeParse(clean(input.item_type)?.toLowerCase() ?? 'book').success) {
    errors.push('Item type must be one of: book, journal, ebook, database.');
  }
  if (row.source_url) {
    try { new URL(row.source_url); } catch { errors.push('Source URL is invalid.'); }
  }
  if (!Number.isInteger(row.copies) || row.copies < 1) errors.push('Copies must be a positive integer.');
  if (row.isbn && duplicateIsbnsInFile.has(row.isbn)) errors.push('Duplicate ISBN inside uploaded file.');

  if (!row.publisher) warnings.push('Publisher is missing.');
  if (!row.year) warnings.push('Year is missing.');
  if (!row.category) warnings.push('Category is missing.');
  if (row.subjects.length === 0) warnings.push('Subjects are missing.');

  return { row, errors, warnings };
}

export function findDuplicateIsbns(rows: Record<string, unknown>[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    const isbn = normalizeIsbn(row.isbn);
    if (!isbn) continue;
    if (seen.has(isbn)) duplicates.add(isbn);
    seen.add(isbn);
  }
  return duplicates;
}

export function toTemplateCsv() {
  return `${CATALOGUE_TEMPLATE_COLUMNS.join(',')}\n9780000000000,Sample Book,"Author One, Author Two",Sample Publisher,2024,1st,English,Education,"Teaching, Learning",3,MAIN/1/BAY-A/SHELF-2,book,https://example.com,Sample notes\n`;
}
