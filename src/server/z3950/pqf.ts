export const BIB1_ATTRIBUTES = {
  title: 4,
  author: 1003,
  subject: 21,
  isbn: 7,
  issn: 8,
  keyword: 1016,
  controlNumber: 12,
  publisher: 1018,
  pubDate: 31,
} as const;

export type IndexKey = 'keyword' | 'title' | 'author' | 'subject' | 'isbn' | 'issn' | 'control' | 'publisher' | 'year';

export const INDEX_TO_BIB1: Record<IndexKey, number> = {
  keyword: 1016,
  title: 4,
  author: 1003,
  subject: 21,
  isbn: 7,
  issn: 8,
  control: 12,
  publisher: 1018,
  year: 31,
};

export function buildPQF(index: IndexKey, term: string, overrides?: Record<string, number>): string {
  const attr = overrides?.[index] ?? INDEX_TO_BIB1[index];
  const escaped = term.replace(/"/g, '');
  return `@attr 1=${attr} @attr 2=3 @attr 3=3 @attr 4=2 @attr 5=1 "${escaped}"`;
}
