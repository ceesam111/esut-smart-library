import type { AccreditationProgramme } from '@/data/accreditation/programmes';
import type { AccreditationDatabase } from '@/data/accreditation/databases';
import type {
  AccreditationResourceType,
  AccessState,
  SyncStateRow,
  SyncRunSummary,
  VerificationStatus,
} from '@/server/accreditation/types';

export interface ProgrammeStats {
  indexed: number;
  recent2023: number;
  ebooks: number;
  ejournals: number;
  articles: number;
  openAccessJournals: number;
  verifiedFullText: number;
  lastSyncedAt: string | null;
}

export type ProgrammeWithStats = AccreditationProgramme & { stats: ProgrammeStats };

export interface ProgrammesResponseData {
  programmes: ProgrammeWithStats[];
  databases: AccreditationDatabase[];
  yearFrom: number;
  yearTo: number;
}

export interface PortalResourceItem {
  key: string;
  recordSource: 'external' | 'catalogue' | 'repository';
  sourceProvider: string | null;
  sourceLabel: string;
  resourceType: AccreditationResourceType | string;
  title: string;
  creators: string[];
  year: number | null;
  publisher: string | null;
  doi: string | null;
  abstract: string | null;
  subjects: string[];
  landingUrl: string;
  fullTextUrl: string | null;
  accessState: AccessState | 'local_holdings';
  openAccess: boolean;
  verification: { status: VerificationStatus; checkedAt: string | null } | null;
  availability: { callNumber: string | null; shelfLocation: string | null } | null;
  relevanceScore: number | null;
  matchedTerms: string[];
}

export interface ResourceQuery {
  programme?: string;
  q?: string;
  yearFrom?: number;
  yearTo?: number;
  types?: string[];
  fullTextOnly?: boolean;
  source?: string;
  page?: number;
  pageSize?: number;
  sort?: 'relevance' | 'year_desc';
}

export interface ResourcesResponseData {
  total: number;
  matchedTotal: number;
  externalTotal: number;
  localTotal: number;
  page: number;
  pageSize: number;
  capped: boolean;
  items: PortalResourceItem[];
  providerFacets: Array<{ provider: string; label: string; count: number }>;
  typeFacets: Array<{ type: string; label: string; count: number }>;
}

export interface CoverageTopic {
  topic: string;
  count: number;
  weak: boolean;
}

export interface CoverageResponseData {
  slug: string;
  name: string;
  totals: { indexed: number; recent2023: number; verified: number; fullText: number };
  byType: Array<{ type: string; count: number }>;
  topics: CoverageTopic[];
  warnings: Array<{ level: 'ok' | 'weak' | 'empty'; message: string }>;
  thresholds: { programmeMinimum: number; topicMinimum: number };
}

export type EvidenceStatus = 'verified' | 'partially_verified' | 'pending_review' | 'not_available';

export interface EvidenceByProgramme {
  slug: string;
  name: string;
  visitStart: string;
  visitEnd: string;
  total: number;
  recent2023: number;
  verified: number;
  fullText: number;
  byType: Record<string, number>;
  byTypeVerified: Record<string, number>;
  openAccessJournals: number;
  failedLinks: number;
  evidenceStatus: EvidenceStatus;
  weakTopics: string[];
  warning: string | null;
}

export interface EvidenceSampleRecord {
  title: string;
  creators: string[];
  year: number | null;
  sourceLabel: string;
  doi: string | null;
  landingUrl: string;
  verificationStatus: VerificationStatus;
  verificationCheckedAt: string | null;
}

export interface EvidenceResponseData {
  generatedAt: string;
  totals: {
    indexed: number;
    active: number;
    uniqueWorks: number;
    recent2023: number;
    withFullText: number;
    withDoi: number;
    verified: number;
    unverified: number;
    failed: number;
    stale: number;
    catalogueMatches: number;
    repositoryMatches: number;
    providersEnabled: number;
    providersWithData: number;
  };
  byProgramme: EvidenceByProgramme[];
  byProvider: Array<{ provider: string; label: string; count: number; recent2023: number }>;
  sampleRecords: EvidenceSampleRecord[];
  syncState: SyncStateRow[];
  thresholds: { programmeMinimum: number; topicMinimum: number };
}

export interface SyncRequestBody {
  programme?: string;
  providers?: string[];
  maxPerProgrammePerProvider?: number;
}

export interface SyncResponseData {
  runs: SyncRunSummary[];
  requestsMade: number;
  elapsedMs: number;
}

export interface VerifyResponseData {
  checked: number;
  verified: number;
  failed: number;
  unverifiable: number;
}

export interface SyncStatusResponseData {
  providers: Array<{ id: string; displayName: string; enabled: boolean }>;
  state: SyncStateRow[];
}

const parse = async <T>(response: Response): Promise<T> => {
  const payload = (await response.json()) as { data?: T; error?: string };
  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error ?? `Request failed (${response.status})`);
  }
  return payload.data;
};

export const fetchProgrammes = async (): Promise<ProgrammesResponseData> =>
  parse<ProgrammesResponseData>(await fetch('/api/accreditation/programmes'));

const buildResourceUrl = (query: ResourceQuery): string => {
  const params = new URLSearchParams();
  if (query.programme) params.set('programme', query.programme);
  if (query.q) params.set('q', query.q);
  if (query.yearFrom !== undefined) params.set('year_from', String(query.yearFrom));
  if (query.yearTo !== undefined) params.set('year_to', String(query.yearTo));
  if (query.types && query.types.length > 0) params.set('type', query.types.join(','));
  if (query.fullTextOnly) params.set('fulltext_only', 'true');
  if (query.source) params.set('source', query.source);
  params.set('page', String(query.page ?? 1));
  params.set('page_size', String(query.pageSize ?? 20));
  params.set('sort', query.sort ?? 'relevance');
  return `/api/accreditation/resources?${params.toString()}`;
};

export const fetchResources = async (query: ResourceQuery): Promise<ResourcesResponseData> =>
  parse<ResourcesResponseData>(await fetch(buildResourceUrl(query)));

export const fetchCoverage = async (slug: string): Promise<CoverageResponseData> =>
  parse<CoverageResponseData>(await fetch(`/api/accreditation/coverage?programme=${encodeURIComponent(slug)}`));

export const fetchEvidence = async (
  headers: Record<string, string>,
): Promise<EvidenceResponseData> =>
  parse<EvidenceResponseData>(await fetch('/api/admin/accreditation/evidence', { headers }));

export const triggerAccreditationSync = async (
  body: SyncRequestBody,
  headers: Record<string, string>,
): Promise<SyncResponseData> =>
  parse<SyncResponseData>(
    await fetch('/api/admin/accreditation/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  );

export const triggerAccreditationVerify = async (
  body: { limit: number },
  headers: Record<string, string>,
): Promise<VerifyResponseData> =>
  parse<VerifyResponseData>(
    await fetch('/api/admin/accreditation/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  );

export const fetchAccreditationSyncStatus = async (
  headers: Record<string, string>,
): Promise<SyncStatusResponseData> =>
  parse<SyncStatusResponseData>(await fetch('/api/admin/accreditation/sync-status', { headers }));
