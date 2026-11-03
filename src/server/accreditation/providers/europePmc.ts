import type { AccreditationProvider, HarvestQuery, ProviderHarvestResult } from '../types';
import { harvestErrorOutcome, providerFetchJson, queryUrl } from './http';
import { compactTextArray, doiFromValue, firstText, httpUrl, resolveHarvestedItem, yearFromIsoDate } from './mapping';

const BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';
const PAGE_SIZE = 25;

interface EuropePmcResult {
  id?: number | string;
  source?: string;
  pmid?: string;
  pmcid?: string;
  doi?: string;
  title?: string;
  authorString?: string;
  journalTitle?: string;
  journalIssn?: string;
  pubYear?: string;
  pubDate?: string;
  firstPublicationDate?: string;
  abstractText?: string;
  isOpenAccess?: string;
  inEPMC?: string;
  fullTextUrlList?: Array<{ fullTextUrl?: { availableUrl?: Array<{ id?: string; availableType?: string; url?: string }>; } }>;
}

function europePmcFullText(result: EuropePmcResult): string | null {
  const list = result.fullTextUrlList;
  if (!Array.isArray(list)) return null;
  for (const row of list) {
    const urls = row?.fullTextUrl?.availableUrl;
    if (!Array.isArray(urls)) continue;
    const acceptable = urls.find((entry) => !entry?.availableType || /^(\s*(available)?\s*(full\s?text|pdf|html)|open access|free to read)/i.test(String(entry.availableType ?? '')));
    const candidate = httpUrl(acceptable?.url);
    if (candidate) return candidate;
  }
  return null;
}

export const europePmcProvider: AccreditationProvider = {
  id: 'europe-pmc',
  displayName: 'Europe PMC',
  homepageUrl: 'https://europepmc.org',
  docsUrl: 'https://europepmc.org/RestWebservice',
  enabled: () => true,
  supportsServerYearFilter: true,
  async harvest(query: HarvestQuery): Promise<ProviderHarvestResult> {
    const cursorMark = query.cursor && query.cursor !== 'first' ? query.cursor : null;
    const searchQuery = `${query.searchTerms.join(' ')} AND PUB_YEAR:[${query.yearFrom} TO ${query.yearTo}]`;
    const outcome = await providerFetchJson(queryUrl(BASE, {
      query: searchQuery,
      format: 'json',
      resultType: 'core',
      pageSize: PAGE_SIZE,
      ...(cursorMark ? { cursorMark } : {}),
    }));
    if (outcome.error) return harvestErrorOutcome(outcome);
    const payload = outcome.json as { resultList?: { result?: EuropePmcResult[] }; nextCursorMark?: string; hitCount?: number } | null;
    const results = payload?.resultList?.result ?? [];
    const items = results
      .map((result) => {
        const title = firstText(result.title);
        if (!title) return null;
        const id = String(result.id ?? result.pmcid ?? result.pmid ?? title);
        const yearString = result.pubYear ?? (firstText(result.firstPublicationDate) ?? result.pubDate);
        const year = Number.parseInt(yearString ?? '', 10);
        const pubYearValid = Number.isInteger(year) && year >= 1400 && year <= 2100 ? year : null;
        if (pubYearValid === null || pubYearValid < query.yearFrom || pubYearValid > query.yearTo) return null;
        const authors = (result.authorString ?? '')
          .split(/,|;| and /i)
          .map((part) => part.trim())
          .filter(Boolean);
        const landing = result.pmcid
          ? `https://europepmc.org/article/PMC/${result.pmcid}`
          : result.pmid
            ? `https://europepmc.org/article/MED/${result.pmid}`
            : result.doi
              ? `https://doi.org/${result.doi}`
              : `https://europepmc.org/search/${encodeURIComponent(id)}`;
        const fullText = europePmcFullText(result);
        return resolveHarvestedItem({
          externalId: `${result.source?.toLowerCase() ?? 'epmc'}/${id}`,
          resourceType: 'research_article',
          title,
          creators: authors,
          landingPageUrl: landing,
          publisher: result.journalTitle ?? undefined,
          publicationDate: result.firstPublicationDate ?? result.pubDate ?? undefined,
          publicationYear: pubYearValid ?? yearFromIsoDate(result.firstPublicationDate ?? result.pubDate ?? null),
          doi: doiFromValue(result.doi),
          issn: result.journalIssn ?? undefined,
          subjectHeadings: compactTextArray([result.journalTitle].filter(Boolean)),
          abstractText: result.abstractText ?? undefined,
          fullTextUrl: fullText,
          openAccess: result.isOpenAccess === 'Y',
        });
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const nextCursorMark = payload?.nextCursorMark;
    return { items, nextCursor: nextCursorMark ?? null };
  },
};