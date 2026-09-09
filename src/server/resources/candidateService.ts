import { writeAuditLog } from '@/server/audit/writeAuditLog';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import type { CandidateStatus, DiscoverySource, ResourceCandidate } from './types';
import { normalizeCandidate } from './normalize';
import { applyRightsPolicy } from './rights';
import { findDuplicateResource } from './dedupe';

function formatFromItemType(itemType?: string | null) {
  const normalized = itemType?.toLowerCase();
  if (normalized === 'ebook') return 'Ebook';
  if (normalized === 'article') return 'Article';
  if (normalized === 'journal') return 'Journal';
  if (normalized === 'thesis') return 'Thesis';
  return 'Book';
}

export async function stageResourceCandidate(input: {
  tenantId: string;
  candidate: ResourceCandidate;
  harvestRunId?: string | null;
  discoverySource: DiscoverySource;
  searchQuery?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const candidate = applyRightsPolicy(normalizeCandidate(input.candidate, input.searchQuery));
  const duplicate = await findDuplicateResource(input.tenantId, candidate);
  if (duplicate?.kind === 'resource_candidates') {
    const { data: existing, error: existingError } = await supabase
      .from('resource_candidates')
      .update({
        harvest_run_id: input.harvestRunId ?? null,
        search_query: input.searchQuery ?? null,
        last_external_checked_at: new Date().toISOString(),
        external_sources: [{ source_name: candidate.source_name, source_record_id: candidate.source_record_id, source_url: candidate.source_url }],
      })
      .eq('id', duplicate.id)
      .select('*')
      .single();
    if (existingError) throw new Error(existingError.message);
    return { candidate: existing, duplicate };
  }
  const status: CandidateStatus = duplicate ? 'duplicate' : candidate.confidence === 'clean_match' ? 'pending' : 'needs_review';
  const { data, error } = await supabase
    .from('resource_candidates')
    .insert({
      tenant_id: input.tenantId,
      harvest_run_id: input.harvestRunId ?? null,
      source_name: candidate.source_name,
      source_record_id: candidate.source_record_id,
      discovery_source: input.discoverySource,
      search_query: input.searchQuery ?? null,
      status,
      confidence: candidate.confidence ?? 'needs_review',
      title: candidate.title,
      authors: candidate.authors ?? [],
      publisher: candidate.publisher,
      year: candidate.year,
      language: candidate.language,
      subjects: candidate.subjects ?? [],
      description: candidate.description,
      isbn: candidate.isbn,
      issn: candidate.issn,
      doi: candidate.doi,
      item_type: candidate.item_type,
      licence: candidate.licence,
      rights_status: candidate.rights_status,
      source_url: candidate.source_url,
      download_url: candidate.download_url,
      cover_url: candidate.cover_url,
      raw_metadata: candidate.raw_metadata ?? {},
      duplicate_of: null,
      external_sources: [{ source_name: candidate.source_name, source_record_id: candidate.source_record_id, source_url: candidate.source_url }],
      last_external_checked_at: new Date().toISOString(),
      metadata_quality_score: scoreCandidateMetadata(candidate),
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return { candidate: data, duplicate };
}

export function scoreCandidateMetadata(candidate: ResourceCandidate) {
  let score = 0;
  if (candidate.title) score += 25;
  if (candidate.authors?.length) score += 15;
  if (candidate.year) score += 10;
  if (candidate.isbn || candidate.doi || candidate.issn) score += 25;
  if (candidate.licence || candidate.rights_status) score += 10;
  if (candidate.source_url) score += 10;
  if (candidate.description) score += 5;
  return Math.min(score, 100);
}

const TRUSTED_AUTO_APPROVAL_SOURCES = new Set([
  'DOAB',
  'DOAJ',
  'Project Gutenberg',
  'Standard Ebooks',
  'Internet Archive',
  'PubMed Central',
  'CORE',
  'OpenAlex',
]);

export function isTrustedAutoApprovable(candidate: any) {
  if (!TRUSTED_AUTO_APPROVAL_SOURCES.has(String(candidate.source_name ?? ''))) return false;
  if (!['open', 'public_domain'].includes(String(candidate.rights_status ?? ''))) return false;
  if (candidate.confidence !== 'clean_match') return false;
  if (!candidate.title || !candidate.source_url) return false;
  if (scoreCandidateMetadata(candidate) < 60) return false;
  return Boolean(candidate.doi || candidate.isbn || candidate.issn || (Array.isArray(candidate.authors) && candidate.authors.length && candidate.year));
}

export async function promoteCandidateToCatalogue(input: { candidateId: string; actorUserId: string | null; actorRole?: string | null }) {
  const supabase = getSupabaseAdminClient();
  const { data: candidate, error: candidateError } = await supabase.from('resource_candidates').select('*').eq('id', input.candidateId).single();
  if (candidateError) throw new Error(candidateError.message);
  if (!['pending', 'needs_review'].includes(candidate.status)) throw new Error('Only pending or review candidates can be approved.');

  const duplicate = await findDuplicateResource(candidate.tenant_id, candidate);
  if (duplicate?.kind === 'catalogue_items') {
    await supabase.from('resource_candidates').update({ status: 'duplicate', promoted_catalogue_item_id: duplicate.id }).eq('id', candidate.id);
    throw new Error('A live catalogue item already matches this candidate.');
  }

  const { data: item, error: itemError } = await supabase
    .from('catalogue_items')
    .insert({
      tenant_id: candidate.tenant_id,
      title: candidate.title || candidate.isbn || candidate.doi || 'Untitled resource',
      authors: candidate.authors ?? [],
      isbn: candidate.isbn,
      doi: candidate.doi,
      publisher: candidate.publisher,
      year: candidate.year,
      subjects: candidate.subjects ?? [],
      subjects_text: (candidate.subjects ?? []).join(', '),
      format: formatFromItemType(candidate.item_type),
      item_type: candidate.item_type || 'book',
      language: candidate.language || 'English',
      abstract: candidate.description,
      cover_image: candidate.cover_url,
      source_name: candidate.source_name,
      source_record_id: candidate.source_record_id,
      source_url: candidate.source_url,
      licence: candidate.licence,
      rights_status: candidate.rights_status,
      b2_object_key: candidate.b2_object_key,
      external_sources: candidate.external_sources ?? [],
      metadata_quality_score: candidate.metadata_quality_score,
      last_external_checked_at: candidate.last_external_checked_at,
      refresh_after: candidate.refresh_after,
      total_copies: 0,
      available_copies: 0,
      status: 'available',
    })
    .select('*')
    .single();
  if (itemError) throw new Error(itemError.message);

  const { data: updated, error: updateError } = await supabase
    .from('resource_candidates')
    .update({ status: 'approved', promoted_catalogue_item_id: item.id })
    .eq('id', candidate.id)
    .select('*')
    .single();
  if (updateError) throw new Error(updateError.message);

  await writeAuditLog({
    tenantId: candidate.tenant_id,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole ?? null,
    action: 'resource_candidate_approved',
    entityType: 'resource_candidate',
    entityId: candidate.id,
    beforeData: candidate,
    afterData: updated,
    metadata: { catalogueItemId: item.id },
  });

  return { candidate: updated, item };
}

export async function autoPromoteTrustedCandidate(input: { candidateId: string }) {
  const promoted = await promoteCandidateToCatalogue({ candidateId: input.candidateId, actorUserId: null, actorRole: 'system' });
  const { data, error } = await getSupabaseAdminClient()
    .from('resource_candidates')
    .update({
      status: 'approved',
      raw_metadata: {
        ...(promoted.candidate.raw_metadata ?? {}),
        auto_approved: true,
        auto_approved_reason: 'trusted_open_access_source',
      },
    })
    .eq('id', input.candidateId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return { candidate: data, item: promoted.item };
}

export async function rejectResourceCandidate(input: { candidateId: string; actorUserId: string; actorRole?: string | null; reason?: string }) {
  const supabase = getSupabaseAdminClient();
  const { data: before, error: beforeError } = await supabase.from('resource_candidates').select('*').eq('id', input.candidateId).single();
  if (beforeError) throw new Error(beforeError.message);
  const { data, error } = await supabase.from('resource_candidates').update({ status: 'rejected', raw_metadata: { ...(before.raw_metadata ?? {}), rejection_reason: input.reason ?? null } }).eq('id', input.candidateId).select('*').single();
  if (error) throw new Error(error.message);
  await writeAuditLog({ tenantId: before.tenant_id, actorUserId: input.actorUserId, actorRole: input.actorRole ?? null, action: 'resource_candidate_rejected', entityType: 'resource_candidate', entityId: input.candidateId, beforeData: before, afterData: data, metadata: { reason: input.reason ?? null } });
  return data;
}
