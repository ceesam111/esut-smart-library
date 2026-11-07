import type { PortalResourceItem } from '@/lib/accreditationApi';
import { accreditationProviders } from './providers';
import type { AccreditationProvider, HarvestQuery, HarvestedItem } from './types';

const LIVE_PROVIDER_IDS = ['openalex', 'doaj', 'europe-pmc', 'open-library'];
const LIVE_RESULT_LIMIT = 25;

export interface LiveOpenAccessSearchParams {
  needle: string;
  yearFrom: number;
  yearTo: number;
  providers?: AccreditationProvider[];
}

const isProviderEnabled = (provider: AccreditationProvider): boolean => {
  try {
    return provider.enabled();
  } catch {
    return false;
  }
};

const toPortalItem = (
  provider: AccreditationProvider,
  item: HarvestedItem,
): PortalResourceItem | null => {
  const year = item.publicationYear;
  if (year === undefined || year === null) return null;
  if (!item.openAccess) return null;
  return {
    key: `live:${provider.id}:${item.externalId}`,
    recordSource: 'external',
    sourceProvider: provider.id,
    sourceLabel: `${provider.displayName} (live)`,
    resourceType: item.resourceType,
    title: item.title,
    creators: item.creators,
    year,
    publisher: item.publisher ?? null,
    doi: item.doi ?? null,
    abstract: item.abstractText ?? null,
    subjects: item.subjectHeadings,
    landingUrl: item.landingPageUrl,
    fullTextUrl: item.fullTextUrl ?? null,
    accessState: item.accessState,
    openAccess: item.openAccess,
    verification: null,
    availability: null,
    relevanceScore: null,
    matchedTerms: [],
  };
};

export const searchLiveOpenAccess = async (
  params: LiveOpenAccessSearchParams,
): Promise<PortalResourceItem[]> => {
  const registry = params.providers ?? accreditationProviders;
  const active = registry.filter(
    (provider) => LIVE_PROVIDER_IDS.includes(provider.id) && isProviderEnabled(provider),
  );
  const query: HarvestQuery = {
    programmeSlug: '',
    searchTerms: [params.needle],
    yearFrom: params.yearFrom,
    yearTo: params.yearTo,
    limit: LIVE_RESULT_LIMIT,
    cursor: null,
  };
  const attempts = active.map(async (provider) => ({
    provider,
    result: await provider.harvest(query),
  }));
  const outcomes = await Promise.allSettled(attempts);
  const seen = new Set<string>();
  const items: PortalResourceItem[] = [];
  for (const outcome of outcomes) {
    if (outcome.status !== 'fulfilled') continue;
    const { provider, result } = outcome.value;
    for (const harvested of result.items) {
      const year = harvested.publicationYear;
      if (year === undefined || year === null || year < params.yearFrom || year > params.yearTo) {
        continue;
      }
      const portal = toPortalItem(provider, harvested);
      if (!portal) continue;
      const dedupeKey = portal.doi
        ? `doi:${portal.doi}`
        : `title:${portal.title.toLowerCase()}|${portal.year ?? ''}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      items.push(portal);
    }
  }
  return items;
};
