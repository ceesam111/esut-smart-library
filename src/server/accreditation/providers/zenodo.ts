import type { AccreditationProvider, AccreditationResourceType, HarvestQuery, ProviderHarvestResult } from '../types';
import { harvestErrorOutcome, providerFetchJson, queryUrl } from './http';
import { compactTextArray, doiFromValue, mapResearchType, resolveHarvestedItem, yearFromIsoDate } from './mapping';

const BASE = 'https://zenodo.org/api/records';

interface ZenodoFile {
  key?: string;
  size?: number;
  links?: { self?: string; preview?: string };
}

interface ZenodoHit {
  id?: string;
  doi?: string;
  metadata?: {
    title?: string;
    description?: string;
    publication_date?: string;
    creators?: Array<{ name?: string; affiliation?: string }>;
    doi?: string;
    version?: string;
    type?: { type?: string };
    resource_type?: { type?: string };
  };
  files?: ZenodoFile[];
}

function zenodoLanding(hits: ZenodoHit): string {
  if (hits.doi) return `https://doi.org/${hits.doi}`;
  if (hits.id) return `https://zenodo.org/records/${hits.id}`;
  return 'https://zenodo.org/';
}

function zenodoFiles(hits: ZenodoHit): string | null {
  const files = hits.files;
  if (!Array.isArray(files) || files.length === 0) return null;
  const first = files[0];
  if (first?.links?.preview) return first.links.preview;
  if (first?.key && hits.id) return `https://zenodo.org/records/${hits.id}/files/${encodeURIComponent(first.key)}`;
  return null;
}

function zenodoType(hits: ZenodoHit): AccreditationResourceType {
  const resourceType = hits.metadata?.resource_type?.type ?? hits.metadata?.type?.type ?? '';
  if (/publication|article|postprint|preprint|paper/.test(resourceType)) return mapResearchType(resourceType);
  if (/dataset|figure|image|archive/.test(resourceType)) return 'dataset';
  if (/report|software/.test(resourceType)) return 'report';
  if (/book|chapter/.test(resourceType)) return 'ebook';
  return mapResearchType(resourceType);
}

export const zenodoProvider: AccreditationProvider = {
  id: 'zenodo',
  displayName: 'Zenodo',
  homepageUrl: 'https://zenodo.org',
  docsUrl: 'https://zenodo.org/docs/api/',
  enabled: () => true,
  supportsServerYearFilter: false,
  async harvest(query: HarvestQuery): Promise<ProviderHarvestResult> {
    const outcome = await providerFetchJson(queryUrl(BASE, {
      q: query.searchTerms.join(' '),
      size: 25,
      sort: 'bestmatch',
    }), {
      headers: process.env.ZENODO_TOKEN ? { Authorization: `Bearer ${process.env.ZENODO_TOKEN}` } : undefined,
    });
    if (outcome.error) return harvestErrorOutcome(outcome);
    const payload = outcome.json as { hits?: { hits?: ZenodoHit[] } } | null;
    const hits = payload?.hits?.hits ?? [];
    const items = hits
      .map((hit) => {
        const metadata = hit.metadata ?? {};
        const title = metadata.title;
        if (!title) return null;
        const year = yearFromIsoDate(metadata.publication_date);
        if (year === null || year < query.yearFrom || year > query.yearTo) return null;
        const creators = (metadata.creators ?? []).map((creator) => creator.name ?? '').filter(Boolean);
        return resolveHarvestedItem({
          externalId: String(hit.id ?? title),
          resourceType: zenodoType(hit),
          title,
          creators,
          landingPageUrl: zenodoLanding(hit),
          publicationDate: metadata.publication_date ?? undefined,
          publicationYear: year ?? undefined,
          doi: doiFromValue(metadata.doi ?? hit.doi),
          subjectHeadings: compactTextArray([metadata.type?.type, metadata.resource_type?.type].filter(Boolean)),
          abstractText: metadata.description ?? undefined,
          fullTextUrl: zenodoFiles(hit),
          openAccess: true,
        });
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    return { items, nextCursor: null };
  },
};