import type { AccreditationProvider, HarvestQuery, ProviderHarvestResult } from '../types';
import { harvestErrorOutcome, providerFetchJson, queryUrl } from './http';
import { compactTextArray, doiFromValue, firstText, httpUrl, resolveHarvestedItem, yearFromIsoDate } from './mapping';

const BASE = 'https://api.core.ac.uk/v3/search/works';
const LIMIT = 20;
const MAX_OFFSET = 75;

interface CoreWork {
  id?: number;
  title?: string;
  authors?: Array<{ name?: string }>;
  publishers?: Array<{ name?: string }>;
  publishedDate?: string;
  yearPublished?: number;
  language?: string;
  doi?: string;
  identifiers?: Array<{ type?: string; identifier?: string }>;
  documentType?: string;
  abstract?: string;
  fullText?: string;
  downloadUrl?: string;
  links?: Array<{ type?: string; url?: string }>;
}

function coreFullText(work: CoreWork): string | null {
  if (work.downloadUrl) {
    const candidate = httpUrl(work.downloadUrl);
    if (candidate) return candidate;
  }
  if (work.fullText && httpUrl(work.fullText)) {
    return httpUrl(work.fullText);
  }
  return null;
}

function coreYear(work: CoreWork): number | null {
  if (Number.isInteger(work.yearPublished) && work.yearPublished !== undefined) return work.yearPublished;
  return yearFromIsoDate(work.publishedDate);
}

export const coreProvider: AccreditationProvider = {
  id: 'core',
  displayName: 'CORE',
  homepageUrl: 'https://core.ac.uk',
  docsUrl: 'https://core.ac.uk/services/api',
  enabled: () => Boolean(process.env.CORE_API_KEY && process.env.CORE_API_KEY.trim()),
  supportsServerYearFilter: false,
  async harvest(query: HarvestQuery): Promise<ProviderHarvestResult> {
    if (!process.env.CORE_API_KEY) {
      return { items: [], error: 'CORE_API_KEY not configured' };
    }
    const offset = query.cursor ? Number.parseInt(query.cursor, 10) : 0;
    const safeOffset = Number.isInteger(offset) && offset >= 0 ? Math.min(offset, MAX_OFFSET) : 0;
    const outcome = await providerFetchJson(queryUrl(BASE, {
      q: query.searchTerms.join(' '),
      limit: LIMIT,
      offset: safeOffset,
    }), {
      headers: { Authorization: `Bearer ${process.env.CORE_API_KEY}` },
    });
    if (outcome.error) return harvestErrorOutcome(outcome);
    const payload = outcome.json as { results?: CoreWork[]; totalHits?: number } | null;
    const works = payload?.results ?? [];
    const items = works
      .map((work) => {
        const title = firstText(work.title);
        if (!title) return null;
        const year = coreYear(work);
        if (year === null || year < query.yearFrom || year > query.yearTo) return null;
        const authors = (work.authors ?? []).map((author) => author.name ?? '').filter(Boolean);
        const display = (work.links ?? []).find((link) => link.type === 'display');
        const landing = httpUrl(display?.url) ?? (work.doi ? `https://doi.org/${work.doi}` : `https://core.ac.uk/articles/${work.id ?? ''}`);
        const fullText = coreFullText(work);
        return resolveHarvestedItem({
          externalId: String(work.id ?? title),
          resourceType: 'research_article',
          title,
          creators: authors,
          landingPageUrl: landing,
          publisher: (typeof work.publishers?.[0]?.name === 'string' ? work.publishers[0].name : undefined),
          publicationDate: work.publishedDate ?? undefined,
          publicationYear: year ?? undefined,
          doi: doiFromValue(work.doi),
          language: work.language ?? undefined,
          subjectHeadings: compactTextArray([work.documentType].filter(Boolean)),
          abstractText: work.abstract ?? undefined,
          fullTextUrl: fullText,
          openAccess: Boolean(fullText),
        });
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const nextOffset = safeOffset + works.length;
    const nextCursor = works.length === LIMIT && nextOffset < MAX_OFFSET ? String(nextOffset) : null;
    return { items, nextCursor };
  },
};