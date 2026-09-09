export type DownloadPolicy = 'metadata_only' | 'link_only' | 'download_legal_files';

export interface ResourceSourceDefinition {
  sourceType: string;
  name: string;
  category: 'ebook' | 'journal' | 'article' | 'database' | 'repository' | 'biomedical' | 'doi_metadata';
  requiresKey: boolean;
  keyEnv?: string;
  rateLimitNotes: string;
  rightsBehavior: string;
  downloadsAllowed: boolean;
  downloadPolicy: DownloadPolicy;
  requiresHumanApproval: boolean;
  defaultEnabled: boolean;
  defaultLimit: number;
  priority: number;
}

export const RESOURCE_SOURCES: ResourceSourceDefinition[] = [
  { sourceType: 'google_books', name: 'Google Books', category: 'ebook', requiresKey: false, rateLimitNotes: 'Public API; keep requests modest.', rightsBehavior: 'Metadata and preview links.', downloadsAllowed: false, downloadPolicy: 'link_only', requiresHumanApproval: true, defaultEnabled: true, defaultLimit: 5, priority: 72 },
  { sourceType: 'open_library', name: 'Open Library', category: 'ebook', requiresKey: false, rateLimitNotes: 'Public API; keep requests modest and cache/stage results.', rightsBehavior: 'Metadata and read links; lending/download rights vary by edition.', downloadsAllowed: false, downloadPolicy: 'link_only', requiresHumanApproval: true, defaultEnabled: true, defaultLimit: 5, priority: 70 },
  { sourceType: 'openalex', name: 'OpenAlex', category: 'article', requiresKey: false, rateLimitNotes: 'No key required; include contact email where supported.', rightsBehavior: 'Open when source OA flag/location is present; otherwise metadata only.', downloadsAllowed: true, downloadPolicy: 'download_legal_files', requiresHumanApproval: true, defaultEnabled: true, defaultLimit: 5, priority: 95 },
  { sourceType: 'doab', name: 'DOAB', category: 'ebook', requiresKey: false, rateLimitNotes: 'Public API; peer-reviewed OA book metadata.', rightsBehavior: 'Open access monographs.', downloadsAllowed: true, downloadPolicy: 'download_legal_files', requiresHumanApproval: true, defaultEnabled: true, defaultLimit: 5, priority: 90 },
  { sourceType: 'doaj', name: 'DOAJ', category: 'journal', requiresKey: false, rateLimitNotes: 'Public API; avoid aggressive polling.', rightsBehavior: 'Open access journal/article records.', downloadsAllowed: true, downloadPolicy: 'download_legal_files', requiresHumanApproval: true, defaultEnabled: true, defaultLimit: 5, priority: 90 },
  { sourceType: 'crossref', name: 'CrossRef', category: 'doi_metadata', requiresKey: false, rateLimitNotes: 'Use polite pool with mailto when possible.', rightsBehavior: 'Metadata only; use Unpaywall to locate legal OA copies.', downloadsAllowed: false, downloadPolicy: 'metadata_only', requiresHumanApproval: true, defaultEnabled: true, defaultLimit: 5, priority: 75 },
  { sourceType: 'unpaywall', name: 'Unpaywall', category: 'doi_metadata', requiresKey: false, keyEnv: 'UNPAYWALL_EMAIL', rateLimitNotes: 'Requires contact email; used as DOI enrichment step.', rightsBehavior: 'Open when best OA location exists.', downloadsAllowed: true, downloadPolicy: 'download_legal_files', requiresHumanApproval: true, defaultEnabled: true, defaultLimit: 0, priority: 80 },
  { sourceType: 'core', name: 'CORE', category: 'repository', requiresKey: true, keyEnv: 'CORE_API_KEY', rateLimitNotes: 'API key recommended/required.', rightsBehavior: 'Open when downloadUrl/fulltext URL exists.', downloadsAllowed: true, downloadPolicy: 'download_legal_files', requiresHumanApproval: true, defaultEnabled: true, defaultLimit: 5, priority: 85 },
  { sourceType: 'pubmed', name: 'PubMed', category: 'biomedical', requiresKey: false, keyEnv: 'NCBI_API_KEY', rateLimitNotes: 'Use NCBI tool/email; API key increases rate limit.', rightsBehavior: 'Metadata only; DOI can be enriched through Unpaywall.', downloadsAllowed: false, downloadPolicy: 'metadata_only', requiresHumanApproval: true, defaultEnabled: true, defaultLimit: 5, priority: 80 },
  { sourceType: 'pmc', name: 'PubMed Central', category: 'biomedical', requiresKey: false, keyEnv: 'NCBI_API_KEY', rateLimitNotes: 'Use NCBI tool/email; API key increases rate limit.', rightsBehavior: 'Free full text from PMC; downloadable only through PMC links.', downloadsAllowed: true, downloadPolicy: 'link_only', requiresHumanApproval: true, defaultEnabled: true, defaultLimit: 5, priority: 85 },
  { sourceType: 'hathitrust', name: 'HathiTrust', category: 'ebook', requiresKey: false, rateLimitNotes: 'Bibliographic APIs work best with identifiers; general keyword search is linked out.', rightsBehavior: 'Public domain/full-view links only; limited view is link-only/metadata.', downloadsAllowed: false, downloadPolicy: 'link_only', requiresHumanApproval: true, defaultEnabled: true, defaultLimit: 5, priority: 55 },
  { sourceType: 'gutenberg', name: 'Project Gutenberg', category: 'ebook', requiresKey: false, rateLimitNotes: 'Gutendex public API; cache/stage results.', rightsBehavior: 'Public domain ebooks.', downloadsAllowed: true, downloadPolicy: 'download_legal_files', requiresHumanApproval: true, defaultEnabled: true, defaultLimit: 5, priority: 80 },
  { sourceType: 'standard_ebooks', name: 'Standard Ebooks', category: 'ebook', requiresKey: false, rateLimitNotes: 'OPDS/catalog feed; keep requests modest.', rightsBehavior: 'Public domain ebooks with curated editions.', downloadsAllowed: true, downloadPolicy: 'download_legal_files', requiresHumanApproval: true, defaultEnabled: true, defaultLimit: 5, priority: 75 },
  { sourceType: 'internet_archive', name: 'Internet Archive', category: 'repository', requiresKey: false, rateLimitNotes: 'Advanced search API; filter to texts/open/public-domain indicators.', rightsBehavior: 'Open/public-domain when source flags indicate rights are clear.', downloadsAllowed: true, downloadPolicy: 'download_legal_files', requiresHumanApproval: true, defaultEnabled: true, defaultLimit: 5, priority: 75 },
];

export function sourceDefinition(sourceType: string) {
  return RESOURCE_SOURCES.find((source) => source.sourceType === sourceType || source.name === sourceType);
}
