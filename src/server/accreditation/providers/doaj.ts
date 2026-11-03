import type { AccreditationProvider, HarvestQuery, ProviderHarvestResult } from '../types';
import { harvestErrorOutcome, providerFetchJson } from './http';
import { compactTextArray, doiFromValue, firstText, httpUrl, resolveHarvestedItem } from './mapping';

const BASE = 'https://doaj.org/api/v4/search/articles';
const PAGE_SIZE = 25;
const MAX_PAGES = 4;

interface DoajLink {
  url?: string;
  'content-type'?: string;
  language?: string;
}

interface DoajDocument {
  id?: string;
  bibjson?: {
    title?: string;
    author?: Array<{ name?: string }>;
    year?: string;
    month?: string;
    publisher?: string;
    doi?: string;
    issn?: string[];
    abstract?: string;
    subject?: Array<{ taxonomies?: Array<{ term?: Array<unknown> }>; term?: string }>;
    'issue-date'?: unknown;
    link?: DoajLink[];
  };
}

function parseCursor(cursor: string | null): number {
  const parsed = Number.parseInt(cursor ?? '1', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function doajYear(bib: NonNullable<DoajDocument['bibjson']>): number | null {
  const value = Number.parseInt(bib.year ?? '', 10);
  return Number.isInteger(value) && value >= 1400 && value <= 2100 ? value : null;
}

function doajFullText(links: DoajLink[] | undefined): string | null {
  if (!links) return null;
  for (const link of links) {
    const type = (link['content-type'] ?? '').toLowerCase();
    const url = httpUrl(link.url);
    if (!url) continue;
    if (type === 'application/pdf' || /pdf/i.test(url)) return url;
  }
  return null;
}

function doajSubjects(bib: NonNullable<DoajDocument['bibjson']>): string[] {
  if (!Array.isArray(bib.subject)) return [];
  const terms: string[] = [];
  for (const subject of bib.subject) {
    if (Array.isArray(subject.term)) {
      for (const term of subject.term) if (typeof term === 'string' && term.trim()) terms.push(term.trim());
    }
    const taxonomies = subject.taxonomies;
    if (Array.isArray(taxonomies)) {
      for (const taxonomy of taxonomies) {
        if (Array.isArray(taxonomy.term)) {
          for (const term of taxonomy.term) if (typeof term === 'string' && term.trim()) terms.push(term.trim());
        }
      }
    }
  }
  return compactTextArray(terms, 10);
}

export const doajProvider: AccreditationProvider = {
  id: 'doaj',
  displayName: 'DOAJ',
  homepageUrl: 'https://doaj.org',
  docsUrl: 'https://doaj.org/faq/search-api',
  enabled: () => true,
  supportsServerYearFilter: false,
  async harvest(query: HarvestQuery): Promise<ProviderHarvestResult> {
    const page = Math.min(parseCursor(query.cursor), MAX_PAGES);
    const url = `${BASE}/${encodeURIComponent(query.searchTerms.join(' '))}?page=${page}&pageSize=${PAGE_SIZE}`;
    const outcome = await providerFetchJson(url);
    if (outcome.error) return harvestErrorOutcome(outcome);
    const payload = outcome.json as { results?: DoajDocument[] } | null;
    const docs = payload?.results ?? [];
    const items: ReturnType<typeof resolveHarvestedItem>[] = [];
    for (const doc of docs) {
      const bib = doc.bibjson;
      if (!bib) continue;
      const title = firstText(bib.title);
      if (!title) continue;
      const year = doajYear(bib);
      if (year === null || year < query.yearFrom || year > query.yearTo) continue;
      const authors: string[] = [];
      for (const author of bib.author ?? []) {
        if (author.name && !authors.includes(author.name)) authors.push(author.name);
      }
      const landing = doc.id ? `https://doaj.org/article/${doc.id}` : null;
      if (!landing) continue;
      const fullText = doajFullText(bib.link);
      const metadata = {
        externalId: doc.id ?? title,
        resourceType: 'research_article' as const,
        title,
        creators: authors,
        landingPageUrl: landing,
        publisher: bib.publisher ?? undefined,
        publicationYear: year ?? undefined,
        doi: doiFromValue(bib.doi),
        issn: Array.isArray(bib.issn) && bib.issn.length > 0 ? bib.issn[0] : undefined,
        subjectHeadings: doajSubjects(bib),
        abstractText: bib.abstract ?? undefined,
        fullTextUrl: fullText,
        openAccess: true,
      };
      const item = resolveHarvestedItem(metadata);
      items.push(item);
    }
    const nextCursor = docs.length === PAGE_SIZE ? String(page + 1) : null;
    return { items, nextCursor };
  },
};