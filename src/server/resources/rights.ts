import type { ResourceCandidate, RightsStatus } from './types';

const openLicenceTokens = ['cc-by', 'cc0', 'creative commons', 'public domain', 'open access', 'oapen', 'doab'];

export function classifyRights(candidate: ResourceCandidate): RightsStatus {
  const text = `${candidate.licence ?? ''} ${candidate.rights_status ?? ''} ${candidate.raw_metadata?.rights ?? ''}`.toLowerCase();
  if (text.includes('public domain')) return 'public_domain';
  if (openLicenceTokens.some((token) => text.includes(token))) return 'open';
  if (candidate.source_name === 'Google Books') return 'metadata_only';
  if (candidate.source_name === 'CrossRef' || candidate.source_name === 'OpenAlex') return candidate.download_url ? 'unclear' : 'metadata_only';
  return candidate.download_url ? 'unclear' : 'metadata_only';
}

export function canDownloadLegalFile(candidate: ResourceCandidate) {
  const rights = classifyRights(candidate);
  return Boolean(candidate.download_url && (rights === 'open' || rights === 'public_domain'));
}

export function applyRightsPolicy(candidate: ResourceCandidate): ResourceCandidate {
  const rights = classifyRights(candidate);
  return {
    ...candidate,
    rights_status: rights,
    download_url: rights === 'metadata_only' || rights === 'unclear' || rights === 'restricted' ? null : candidate.download_url,
    confidence: rights === 'unclear' ? 'needs_review' : candidate.confidence,
  };
}
