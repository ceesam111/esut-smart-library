export type DiscoverySource = 'harvest' | 'search_discovery' | 'barcode_lookup' | 'csv_enrichment';
export type CandidateStatus = 'pending' | 'approved' | 'rejected' | 'auto_added' | 'duplicate' | 'needs_review' | 'error';
export type CandidateConfidence = 'clean_match' | 'needs_review' | 'no_match' | 'conflict';
export type RightsStatus = 'open' | 'public_domain' | 'metadata_only' | 'unclear' | 'restricted';

export interface ResourceCandidate {
  source_name: string;
  source_record_id?: string | null;
  title?: string | null;
  authors?: string[];
  publisher?: string | null;
  year?: number | null;
  language?: string | null;
  subjects?: string[];
  description?: string | null;
  isbn?: string | null;
  issn?: string | null;
  doi?: string | null;
  item_type?: string | null;
  licence?: string | null;
  rights_status?: RightsStatus | string | null;
  source_url?: string | null;
  download_url?: string | null;
  cover_url?: string | null;
  confidence?: CandidateConfidence;
  raw_metadata?: Record<string, unknown>;
}

export interface ResourceAdapter {
  name: string;
  sourceType: string;
  metadataOnly?: boolean;
  search(query: string, options?: { signal?: AbortSignal; limit?: number; apiKey?: string; apiKeys?: Record<string, string | undefined> }): Promise<ResourceCandidate[]>;
}

export interface LocalSearchResult {
  id: string;
  title: string;
  authors: unknown;
  isbn?: string | null;
  doi?: string | null;
  publisher?: string | null;
  year?: number | null;
  subjects?: unknown;
  source_url?: string | null;
  cover_image?: string | null;
  score: number;
  result_type: 'catalogue';
}

export interface DiscoveryPolicy {
  allowExternalLinkDisplay: boolean;
  allowAutoStageExactIdentifier: boolean;
  allowAutoPublishCleanMetadata: boolean;
  allowLegalFileDownloadQueue: boolean;
}

export const DEFAULT_DISCOVERY_POLICY: DiscoveryPolicy = {
  allowExternalLinkDisplay: true,
  allowAutoStageExactIdentifier: true,
  allowAutoPublishCleanMetadata: false,
  allowLegalFileDownloadQueue: true,
};
