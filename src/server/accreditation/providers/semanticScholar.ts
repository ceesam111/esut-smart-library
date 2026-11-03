import type { AccreditationProvider, HarvestQuery, ProviderHarvestResult } from '../types';
import { harvestErrorOutcome, providerFetchJson, queryUrl } from './http';
import { compactTextArray, doiFromValue, firstText, httpUrl, resolveHarvestedItem } from './mapping';

const BASE = 'https://api.semanticscholar.org/graph/v1/paper/search';
const LIMIT = 25;

interface S2Author {
  name?: string;
}

interface S2Paper {
  paperId?: string;
  title?: string;
  authors?: S2Author[];
  year?: number;
  externalIds?: { DOI?: string; ArXiv?: string; CorpusId?: string; PubMed?: string };
  openAccessPdf?: { url?: string } | null;
  isOpenAccess?: boolean;
  journal?: { name?: string; volume?: string; pages?: string };
  abstract?: string;
  venue?: string;
}

function s2FullText(paper: S2Paper): string | null {
  const candidate = paper.openAccessPdf?.url;
  return httpUrl(candidate);
}

function s2Landing(paper: S2Paper): string {
  if (paper.externalIds?.DOI) return `https://doi.org/${paper.externalIds.DOI}`;
  if (paper.externalIds?.ArXiv) return `https://arxiv.org/abs/${paper.externalIds.ArXiv}`;
  if (paper.paperId) return `https://www.semanticscholar.org/paper/${paper.paperId}`;
  return `https://www.semanticscholar.org/search?q=${encodeURIComponent(paper.title ?? '')}`;
}

export const semanticScholarProvider: AccreditationProvider = {
  id: 'semantic-scholar',
  displayName: 'Semantic Scholar',
  homepageUrl: 'https://www.semanticscholar.org',
  docsUrl: 'https://api.semanticscholar.org/api-docs/graph',
  enabled: () => true,
  supportsServerYearFilter: false,
  courtesyDelayMs: 1500,
  async harvest(query: HarvestQuery): Promise<ProviderHarvestResult> {
    const outcome = await providerFetchJson(queryUrl(BASE, {
      query: query.searchTerms.join(' '),
      fields: 'paperId,title,authors,year,externalIds,openAccessPdf,isOpenAccess,journal,abstract,venue',
      limit: LIMIT,
    }), {
      headers: process.env.SEMANTIC_SCHOLAR_API_KEY
        ? { 'X-Api-Key': process.env.SEMANTIC_SCHOLAR_API_KEY }
        : undefined,
    });
    if (outcome.error) return harvestErrorOutcome(outcome);
    const payload = outcome.json as { data?: S2Paper[]; total?: number } | null;
    const papers = payload?.data ?? [];
    const items = papers
      .map((paper) => {
        const title = firstText(paper.title);
        if (!title) return null;
        const year = numberOrUndefined(paper.year);
        if (year === undefined || year < query.yearFrom || year > query.yearTo) return null;
        const authors: string[] = [];
        for (const author of paper.authors ?? []) {
          if (author.name && !authors.includes(author.name)) authors.push(author.name);
        }
        const fullText = s2FullText(paper);
        return resolveHarvestedItem({
          externalId: paper.paperId ?? title,
          resourceType: 'research_article',
          title,
          creators: authors,
          landingPageUrl: s2Landing(paper),
          publisher: paper.journal?.name ?? paper.venue ?? undefined,
          publicationYear: year,
          doi: doiFromValue(paper.externalIds?.DOI),
          subjectHeadings: compactTextArray([paper.journal?.name ?? paper.venue].filter(Boolean)),
          abstractText: paper.abstract ?? undefined,
          fullTextUrl: fullText,
          openAccess: paper.isOpenAccess ?? false,
        });
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    return { items, nextCursor: null };
  },
};

function numberOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1400 && value <= 2100) return value;
  return undefined;
}