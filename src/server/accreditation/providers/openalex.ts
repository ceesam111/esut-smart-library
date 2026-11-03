import type { AccreditationProvider, AccreditationResourceType, HarvestQuery, ProviderHarvestResult } from '../types';
import { harvestErrorOutcome, providerFetchJson, queryUrl } from './http';
import { compactTextArray, doiFromValue, firstText, httpUrl, resolveHarvestedItem, withinYearRange, yearFromIsoDate } from './mapping';

const BASE = 'https://api.openalex.org';
const PER_PAGE = 25;

interface OpenAlexLocation {
  source?: { display_name?: string };
  landing_page_url?: string;
  pdf_url?: string;
  is_oa?: boolean;
  version?: string;
}

interface OpenAlexWork {
  id?: string;
  doi?: string;
  display_name?: string;
  type?: string;
  publication_date?: string;
  authorships?: Array<{ author?: { display_name?: string } }>;
  primary_topic?: { display_name?: string };
  primary_location?: OpenAlexLocation;
  best_oa_location?: OpenAlexLocation;
  open_access?: { is_oa?: boolean; oa_url?: string };
  abstract_inverted_index?: Record<string, number[]>;
}

function reconstructAbstract(inverted?: Record<string, number[]>): string | undefined {
  if (!inverted || typeof inverted !== 'object') return undefined;
  const positions = new Map<number, string>();
  for (const word of Object.keys(inverted)) {
    const indexList = inverted[word];
    if (!Array.isArray(indexList)) continue;
    for (const index of indexList) if (Number.isInteger(index) && index >= 0) positions.set(index, word);
  }
  if (positions.size === 0) return undefined;
  const max = Math.max(...Array.from(positions.keys()));
  const tokens: string[] = [];
  for (let i = 0; i <= max; i += 1) {
    const token = positions.get(i);
    if (token) tokens.push(token);
  }
  return tokens.join(' ').trim() || undefined;
}

function mapType(type?: string): AccreditationResourceType {
  const value = (type ?? '').toLowerCase();
  if (/book|chapter/.test(value)) return 'ebook';
  if (/journal|magazine/.test(value)) return value.includes('article') ? 'research_article' : 'ejournal';
  return 'research_article';
}

function fullTextUrl(work: OpenAlexWork): string | null {
  const versionOk = (version?: string): boolean => !version || version === 'published_version' || version === 'accepted_version';
  const usable = (location?: OpenAlexLocation | null, trusted?: boolean): string | null => {
    if (!location) return null;
    const version = location.version;
    if (!trusted || !versionOk(version)) return null;
    const pdf = httpUrl(location.pdf_url);
    if (pdf) return pdf;
    const landing = httpUrl(location.landing_page_url);
    if (landing && /\/(pdf|full[-_ ]?text|fulltext|article|downloads?)$/i.test(landing)) return landing;
    return null;
  };
  return usable(work.best_oa_location, work.best_oa_location?.is_oa !== false)
    ?? usable(work.primary_location, work.open_access?.is_oa === true && Boolean(work.primary_location?.pdf_url))
    ?? httpUrl(work.open_access?.oa_url);
}

function parseCursor(cursor: string | null): number {
  const parsed = Number.parseInt(cursor ?? '1', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function buildUrl(query: HarvestQuery, page: number): string {
  return queryUrl(`${BASE}/works`, {
    search: query.searchTerms.join(' '),
    filter: `publication_year:${query.yearFrom}|${query.yearTo}`,
    'per-page': PER_PAGE,
    page,
    select: 'id,doi,display_name,type,publication_date,authorships,primary_topic,primary_location,best_oa_location,open_access,abstract_inverted_index',
    mailto: 'library@esut.edu.ng',
  });
}

export const openalexProvider: AccreditationProvider = {
  id: 'openalex',
  displayName: 'OpenAlex',
  homepageUrl: 'https://openalex.org',
  docsUrl: 'https://docs.openalex.org',
  enabled: () => true,
  supportsServerYearFilter: true,
  async harvest(query: HarvestQuery): Promise<ProviderHarvestResult> {
    const page = parseCursor(query.cursor);
    const outcome = await providerFetchJson(buildUrl(query, page));
    if (outcome.error) return harvestErrorOutcome(outcome);
    const works = ((outcome.json as { results?: OpenAlexWork[] } | null)?.results ?? []);
    const items = works
      .map((work) => {
        const title = firstText(work.display_name);
        if (!title) return null;
        const authors: string[] = [];
        for (const authorship of work.authorships ?? []) {
          const name = authorship.author?.display_name;
          if (name && !authors.includes(name)) authors.push(name);
        }
        const openAccess = work.open_access?.is_oa ?? false;
        return resolveHarvestedItem({
          externalId: work.id ?? work.doi ?? title,
          resourceType: mapType(work.type),
          title,
          creators: authors,
          landingPageUrl: httpUrl(work.primary_location?.landing_page_url) ?? `https://openalex.org/${(work.id ?? '').replace(/^https?:\/\/openalex\.org\//, '')}`,
          publisher: work.primary_location?.source?.display_name ?? undefined,
          publicationDate: work.publication_date ?? undefined,
          publicationYear: yearFromIsoDate(work.publication_date),
          doi: doiFromValue(work.doi),
          subjectHeadings: compactTextArray([work.primary_topic?.display_name].filter(Boolean)),
          abstractText: reconstructAbstract(work.abstract_inverted_index),
          fullTextUrl: fullTextUrl(work),
          openAccess,
        });
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter((item) => withinYearRange(item, query.yearFrom, query.yearTo));
    const nextCursor = works.length === PER_PAGE ? String(Math.min(page + 1, 4)) : null;
    return { items, nextCursor };
  },
};