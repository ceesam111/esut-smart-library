export type AccreditationResourceType =
  | 'ebook'
  | 'ejournal'
  | 'research_article'
  | 'report'
  | 'dataset'
  | 'thesis'
  | 'standard'
  | 'course_material';

export type AccessState = 'full_text' | 'abstract_only' | 'metadata_only' | 'paywalled';

export type VerificationStatus = 'verified' | 'unverified' | 'failed' | 'stale';

export type SyncStatus = 'never' | 'ok' | 'rate_limited' | 'error';

export interface HarvestQuery {
  programmeSlug: string;
  searchTerms: string[];
  yearFrom: number;
  yearTo: number;
  limit: number;
  cursor: string | null;
}

export interface HarvestedItem {
  externalId: string;
  resourceType: AccreditationResourceType;
  title: string;
  creators: string[];
  publisher?: string;
  publicationDate?: string;
  publicationYear?: number;
  doi?: string;
  isbn?: string;
  issn?: string;
  language?: string;
  subjectHeadings: string[];
  abstractText?: string;
  landingPageUrl: string;
  fullTextUrl?: string;
  accessState: AccessState;
  openAccess: boolean;
}

export interface ProviderHarvestResult {
  items: HarvestedItem[];
  nextCursor?: string | null;
  rateLimitedUntil?: string | null;
  error?: string;
}

export interface AccreditationProvider {
  id: string;
  displayName: string;
  homepageUrl: string;
  docsUrl: string;
  enabled: () => boolean;
  supportsServerYearFilter: boolean;
  courtesyDelayMs?: number;
  harvest: (query: HarvestQuery) => Promise<ProviderHarvestResult>;
}

export interface ScholarlyResourceRow {
  id: string;
  source_provider: string;
  external_id: string;
  resource_type: AccreditationResourceType;
  title: string;
  creators: string[];
  publisher: string | null;
  publication_date: string | null;
  publication_year: number | null;
  doi: string | null;
  isbn: string | null;
  issn: string | null;
  language: string | null;
  subject_headings: string[];
  abstract_text: string | null;
  landing_page_url: string;
  full_text_url: string | null;
  access_state: AccessState;
  open_access: boolean;
  verification_status: VerificationStatus;
  verification_http_status: number | null;
  verification_checked_at: string | null;
  programmes: string[];
  matched_terms: string[];
  relevance_score: number | null;
  first_indexed_at: string;
  last_synced_at: string;
  is_active: boolean;
}

export interface SyncStateRow {
  provider: string;
  programme_slug: string;
  cursor: string | null;
  last_run_at: string | null;
  last_status: SyncStatus;
  records_fetched: number;
  records_upserted: number;
  last_error: string | null;
  updated_at: string;
}

export interface SyncRunSummary {
  provider: string;
  programmeSlug: string;
  fetched: number;
  upserted: number;
  status: SyncStatus;
  error?: string;
}
