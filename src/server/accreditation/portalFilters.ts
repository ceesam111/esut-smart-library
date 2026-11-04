import type { PortalResourceItem } from '@/lib/accreditationApi';

export interface PortalFilterParams {
  base: PortalResourceItem[];
  needle: string | null;
  types: string[];
  source: string | null;
  localTypes: string[];
}

export interface PortalFilterOutcome {
  results: PortalResourceItem[];
  matchedTotal: number;
  typeCounts: Array<{ type: string; count: number }>;
  providerCounts: Array<{ provider: string; label: string; count: number }>;
}

const matchesNeedle = (item: PortalResourceItem, needle: string): boolean => {
  const lower = needle.toLowerCase();
  return (
    item.title.toLowerCase().includes(lower) ||
    item.creators.some((creator) => creator.toLowerCase().includes(lower)) ||
    (item.abstract?.toLowerCase().includes(lower) ?? false) ||
    item.subjects.some((subject) => subject.toLowerCase().includes(lower))
  );
};

const matchesSource = (
  item: PortalResourceItem,
  source: string,
  localTypes: string[],
): boolean =>
  localTypes.includes(source)
    ? item.recordSource === source
    : item.sourceProvider === source;

const matchesType = (item: PortalResourceItem, types: string[]): boolean =>
  types.length === 0 || types.includes(item.resourceType);

export const applyPortalFilters = ({
  base,
  needle,
  types,
  source,
  localTypes,
}: PortalFilterParams): PortalFilterOutcome => {
  const searched = needle ? base.filter((item) => matchesNeedle(item, needle)) : base;
  const sourceScoped = source
    ? searched.filter((item) => matchesSource(item, source, localTypes))
    : searched;
  const typeScoped = types.length > 0 ? searched.filter((item) => matchesType(item, types)) : searched;
  const results =
    types.length > 0 ? sourceScoped.filter((item) => matchesType(item, types)) : sourceScoped;

  const typeCountMap = new Map<string, number>();
  for (const item of sourceScoped) {
    typeCountMap.set(item.resourceType, (typeCountMap.get(item.resourceType) ?? 0) + 1);
  }
  const providerCountMap = new Map<string, { label: string; count: number }>();
  for (const item of typeScoped) {
    const providerKey = item.sourceProvider ?? item.recordSource;
    const existing = providerCountMap.get(providerKey);
    providerCountMap.set(providerKey, {
      label: item.sourceLabel,
      count: (existing?.count ?? 0) + 1,
    });
  }

  return {
    results,
    matchedTotal: sourceScoped.length,
    typeCounts: [...typeCountMap.entries()].map(([type, count]) => ({ type, count })),
    providerCounts: [...providerCountMap.entries()].map(([provider, entry]) => ({
      provider,
      label: entry.label,
      count: entry.count,
    })),
  };
};
