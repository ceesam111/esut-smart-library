import type { AccreditationProvider, HarvestQuery, ProviderHarvestResult } from '../types';
import { harvestErrorOutcome, providerFetchJson, queryUrl } from './http';
import { compactTextArray, identifierFromValue, resolveHarvestedItem } from './mapping';

const BASE = 'https://openlibrary.org/search.json';
const LIMIT = 25;
const MAX_OFFSET = 75;

interface OpenLibraryDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  publish_year?: number[];
  language?: string[];
  subject?: string[];
  isbn?: string[];
  publisher?: string[];
}

function parseOffset(cursor: string | null): number {
  const parsed = Number.parseInt(cursor ?? '0', 10);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, MAX_OFFSET) : 0;
}

function openLibraryYear(doc: OpenLibraryDoc): number | null {
  const candidates: number[] = [];
  const first = doc.first_publish_year;
  if (typeof first === 'number' && Number.isInteger(first) && first >= 1400 && first <= 2100) candidates.push(first);
  for (const year of doc.publish_year ?? []) {
    if (typeof year === 'number' && Number.isInteger(year) && year >= 1400 && year <= 2100) candidates.push(year);
  }
  candidates.sort((a, b) => b - a);
  return candidates.length > 0 ? candidates[0] : null;
}

export const openLibraryProvider: AccreditationProvider = {
  id: 'open-library',
  displayName: 'Open Library',
  homepageUrl: 'https://openlibrary.org',
  docsUrl: 'https://openlibrary.org/dev/docs/search',
  enabled: () => true,
  supportsServerYearFilter: false,
  async harvest(query: HarvestQuery): Promise<ProviderHarvestResult> {
    const offset = parseOffset(query.cursor);
    const outcome = await providerFetchJson(queryUrl(BASE, {
      q: query.searchTerms.join(' '),
      fields: 'key,title,author_name,first_publish_year,publish_year,language,subject,isbn,publisher',
      limit: LIMIT,
      offset,
    }));
    if (outcome.error) return harvestErrorOutcome(outcome);
    const payload = outcome.json as { docs?: OpenLibraryDoc[] } | null;
    const docs = payload?.docs ?? [];
    const items = docs
      .map((doc) => {
        const key = doc.key;
        if (!key || key === '') return null;
        const title = doc.title;
        if (!title) return null;
        const year = openLibraryYear(doc);
        if (year === null || year < query.yearFrom || year > query.yearTo) return null;
        const language = Array.isArray(doc.language) && doc.language.length > 0 ? String(doc.language[0]) : undefined;
        const landingKey = key.startsWith('/') ? key : `/${key}`;
        const landing = `https://openlibrary.org${landingKey}`;
        return resolveHarvestedItem({
          externalId: key,
          resourceType: 'ebook',
          title,
          creators: compactTextArray(doc.author_name, 8),
          landingPageUrl: landing,
          publicationYear: year ?? undefined,
          language,
          isbn: identifierFromValue(Array.isArray(doc.isbn) && doc.isbn.length > 0 ? doc.isbn[0] : null) ?? undefined,
          subjectHeadings: compactTextArray(doc.subject),
          publisher: Array.isArray(doc.publisher) && doc.publisher.length > 0 ? String(doc.publisher[0]) : undefined,
          fullTextUrl: landing,
          openAccess: true,
        });
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const nextOffset = offset + docs.length;
    const nextCursor = docs.length === LIMIT && nextOffset < MAX_OFFSET ? String(nextOffset) : null;
    return { items, nextCursor };
  },
};