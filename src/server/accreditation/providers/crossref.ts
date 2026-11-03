import type { AccreditationProvider, HarvestQuery, ProviderHarvestResult } from '../types';
import { harvestErrorOutcome, providerFetchJson, queryUrl } from './http';
import { compactTextArray, doiFromValue, firstText, httpUrl, resolveHarvestedItem, withinYearRange } from './mapping';

const BASE = 'https://api.crossref.org';
const ROWS = 25;

interface CrossrefWork {
  DOI?: string;
  title?: string[];
  author?: Array<{ given?: string; family?: string; name?: string }>;
  'container-title'?: string[];
  issued?: { 'date-parts'?: unknown[] };
  printed?: { 'date-parts'?: unknown[] };
  URL?: string;
  publisher?: string;
  type?: string;
  ISSN?: string[];
  abstract?: string;
}

function issuedYear(work: CrossrefWork): number | null {
  const dateParts = work.issued?.['date-parts'] ?? work.printed?.['date-parts'];
  if (!Array.isArray(dateParts) || dateParts.length === 0) return null;
  const first = dateParts[0];
  if (Array.isArray(first) && first.length > 0) {
    const value = Number(first[0]);
    return Number.isInteger(value) && value >= 1400 && value <= 2100 ? value : null;
  }
  return null;
}

function parseCursor(cursor: string | null): { cursorKey: string | null } {
  if (!cursor) return { cursorKey: null };
  const parts = cursor.split('|');
  return { cursorKey: parts[0] || null };
}

function queryFor(work: CrossrefWork): string | null {
  return httpUrl(work.URL) ?? (work.DOI ? `https://doi.org/${work.DOI}` : null);
}

export const crossrefProvider: AccreditationProvider = {
  id: 'crossref',
  displayName: 'Crossref',
  homepageUrl: 'https://www.crossref.org',
  docsUrl: 'https://api.crossref.org/swagger-ui/index.html',
  enabled: () => true,
  supportsServerYearFilter: true,
  async harvest(query: HarvestQuery): Promise<ProviderHarvestResult> {
    const { cursorKey } = parseCursor(query.cursor);
    const params: Record<string, string | number | undefined> = {
      'query.bibliographic': query.searchTerms.join(' '),
      filter: `from-pub-date:${query.yearFrom}-01-01,until-pub-date:${query.yearTo}-12-31`,
      rows: ROWS,
      mailto: 'library@esut.edu.ng',
    };
    if (cursorKey) {
      params.cursor = cursorKey;
    } else {
      params.sort = 'relevance';
      params.order = 'desc';
    }
    const outcome = await providerFetchJson(queryUrl(`${BASE}/works`, params));
    if (outcome.error) return harvestErrorOutcome(outcome);
    const payload = outcome.json as { message?: { items?: CrossrefWork[]; 'next-cursor'?: string } } | null;
    const works = payload?.message?.items ?? [];
    const items = works
      .map((work) => {
        const title = firstText(work.title);
        if (!title) return null;
        const authors: string[] = [];
        for (const author of work.author ?? []) {
          const name = author.name || [author.given, author.family].filter(Boolean).join(' ');
          if (name && !authors.includes(name)) authors.push(name);
        }
        const landing = queryFor(work);
        if (!landing) return null;
        const issn = work.ISSN && work.ISSN.length > 0 ? work.ISSN[0] : undefined;
        const publicationDateParts = work.issued?.['date-parts'];
        const publicationDate = Array.isArray(publicationDateParts) && publicationDateParts.length > 0
          ? (Array.isArray(publicationDateParts[0])
            ? (publicationDateParts[0] as Array<number | string>).filter((part): part is number => typeof part === 'number').join('-')
            : undefined)
          : undefined;
        return resolveHarvestedItem({
          externalId: work.DOI ?? title,
          resourceType: 'research_article',
          title,
          creators: authors,
          landingPageUrl: landing,
          publisher: work.publisher ?? undefined,
          publicationDate,
          publicationYear: issuedYear(work),
          doi: doiFromValue(work.DOI),
          issn: issn ?? undefined,
          subjectHeadings: compactTextArray(work['container-title']),
          abstractText: work.abstract ?? undefined,
        });
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter((item) => withinYearRange(item, query.yearFrom, query.yearTo));
    const nextCursor = payload?.message?.['next-cursor'] ? `${payload.message['next-cursor']}|0` : null;
    return { items, nextCursor };
  },
};