import type { AccreditationProvider, HarvestQuery, ProviderHarvestResult } from '../types';
import { harvestErrorOutcome, providerFetchJson, queryUrl } from './http';
import { compactTextArray, firstText, identifierFromValue, resolveHarvestedItem } from './mapping';

const BASE = 'https://archive.org/advancedsearch.php';
const ROWS = 25;
const MAX_PAGES = 4;

interface ArchiveDoc {
  identifier?: string;
  title?: unknown;
  creator?: unknown;
  year?: unknown;
  language?: unknown;
  subject?: unknown;
  mediatype?: string;
}

function parseCursor(cursor: string | null): number {
  const parsed = Number.parseInt(cursor ?? '1', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function archiveYear(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value >= 1400 && value <= 2100 ? value : null;
  if (typeof value === 'string') {
    const match = value.match(/(\d{4})/);
    const year = match ? Number.parseInt(match[1], 10) : null;
    return year !== null && year >= 1400 && year <= 2100 ? year : null;
  }
  return null;
}

function authorFrom(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string');
  return [];
}

function subjectFrom(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry : (entry as { title?: string })?.title ?? ''))
      .filter(Boolean);
  }
  return [];
}

export const internetArchiveProvider: AccreditationProvider = {
  id: 'internet-archive',
  displayName: 'Internet Archive',
  homepageUrl: 'https://archive.org',
  docsUrl: 'https://archive.org/help/acknowledgment',
  enabled: () => true,
  supportsServerYearFilter: true,
  async harvest(query: HarvestQuery): Promise<ProviderHarvestResult> {
    const page = Math.min(parseCursor(query.cursor), MAX_PAGES);
    const subjectClause = query.searchTerms.map((term) => `(${term})`).join(' OR ');
    const q = `(collection:(texts OR books) AND mediatype:texts) AND (${subjectClause}) AND year:[${query.yearFrom} TO ${query.yearTo}]`;
    const outcome = await providerFetchJson(queryUrl(BASE, {
      q,
      output: 'json',
      rows: ROWS,
      page,
      fl: 'identifier,title,creator,year,language,subject',
      sort: 'downloads desc',
    }));
    if (outcome.error) return harvestErrorOutcome(outcome);
    const payload = outcome.json as { response?: { docs?: ArchiveDoc[]; numFound?: number } } | null;
    const docs = payload?.response?.docs ?? [];
    const items = docs
      .map((doc) => {
        const identifier = doc.identifier;
        if (!identifier) return null;
        const title = firstText(doc.title);
        if (!title) return null;
        const year = archiveYear(doc.year);
        if (year === null || year < query.yearFrom || year > query.yearTo) return null;
        const language = typeof doc.language === 'string' ? doc.language : Array.isArray(doc.language) && doc.language.length > 0 ? String(doc.language[0]) : undefined;
        const landing = `https://archive.org/details/${identifier}`;
        return resolveHarvestedItem({
          externalId: identifier,
          resourceType: 'ebook',
          title,
          creators: authorFrom(doc.creator),
          landingPageUrl: landing,
          publicationYear: year ?? undefined,
          language: language ?? undefined,
          isbn: identifierFromValue(null) ?? undefined,
          subjectHeadings: compactTextArray(subjectFrom(doc.subject)),
          fullTextUrl: landing,
          openAccess: true,
        });
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const nextCursor = docs.length === ROWS ? String(page + 1) : null;
    return { items, nextCursor };
  },
};