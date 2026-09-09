import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import type { ResourceCandidate } from './types';
import { normalizeDoi, normalizeIdentifier, normalizeTitle } from './normalize';

export interface DuplicateMatch {
  kind: 'catalogue_items' | 'resource_candidates' | 'catalogue_staging';
  id: string;
  reason: string;
}

function firstAuthor(authors?: string[]) {
  return authors?.[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
}

export async function findDuplicateResource(tenantId: string, candidate: ResourceCandidate): Promise<DuplicateMatch | null> {
  const supabase = getSupabaseAdminClient();
  const isbn = normalizeIdentifier(candidate.isbn);
  const doi = normalizeDoi(candidate.doi);

  if (candidate.source_name && candidate.source_record_id) {
    const { data } = await supabase.from('catalogue_items').select('id').eq('tenant_id', tenantId).eq('source_name', candidate.source_name).eq('source_record_id', candidate.source_record_id).maybeSingle();
    if (data) return { kind: 'catalogue_items', id: data.id, reason: 'source_record' };
    const { data: staged } = await supabase.from('resource_candidates').select('id').eq('tenant_id', tenantId).eq('source_name', candidate.source_name).eq('source_record_id', candidate.source_record_id).neq('status', 'rejected').maybeSingle();
    if (staged) return { kind: 'resource_candidates', id: staged.id, reason: 'source_record' };
  }

  if (isbn) {
    const { data } = await supabase.from('catalogue_items').select('id').eq('tenant_id', tenantId).eq('isbn', isbn).maybeSingle();
    if (data) return { kind: 'catalogue_items', id: data.id, reason: 'isbn' };
    const { data: candidateDup } = await supabase.from('resource_candidates').select('id').eq('tenant_id', tenantId).eq('isbn', isbn).neq('status', 'rejected').maybeSingle();
    if (candidateDup) return { kind: 'resource_candidates', id: candidateDup.id, reason: 'isbn' };
    const { data: stagingDup } = await supabase.from('catalogue_staging').select('id').eq('tenant_id', tenantId).eq('isbn', isbn).neq('status', 'rejected').maybeSingle();
    if (stagingDup) return { kind: 'catalogue_staging', id: stagingDup.id, reason: 'isbn' };
  }

  if (doi) {
    const { data } = await supabase.from('catalogue_items').select('id').eq('tenant_id', tenantId).eq('doi', doi).maybeSingle();
    if (data) return { kind: 'catalogue_items', id: data.id, reason: 'doi' };
    const { data: candidateDup } = await supabase.from('resource_candidates').select('id').eq('tenant_id', tenantId).eq('doi', doi).neq('status', 'rejected').maybeSingle();
    if (candidateDup) return { kind: 'resource_candidates', id: candidateDup.id, reason: 'doi' };
  }

  if (candidate.issn && candidate.title) {
    const { data: candidateDup } = await supabase.from('resource_candidates').select('id,title').eq('tenant_id', tenantId).eq('issn', candidate.issn).neq('status', 'rejected').limit(20);
    const match = (candidateDup ?? []).find((row) => normalizeTitle(row.title) === normalizeTitle(candidate.title));
    if (match) return { kind: 'resource_candidates', id: match.id, reason: 'issn_title' };
  }

  if (candidate.title && candidate.year) {
    const normalized = normalizeTitle(candidate.title);
    const author = firstAuthor(candidate.authors);
    const [{ data: live }, { data: staged }] = await Promise.all([
      supabase.from('catalogue_items').select('id,title,authors,year').eq('tenant_id', tenantId).eq('year', candidate.year).ilike('title', `%${candidate.title.slice(0, 40)}%`).limit(20),
      supabase.from('resource_candidates').select('id,title,authors,year').eq('tenant_id', tenantId).eq('year', candidate.year).neq('status', 'rejected').ilike('title', `%${candidate.title.slice(0, 40)}%`).limit(20),
    ]);
    const liveMatch = (live ?? []).find((row) => normalizeTitle(row.title) === normalized && JSON.stringify(row.authors ?? '').toLowerCase().includes(author));
    if (liveMatch) return { kind: 'catalogue_items', id: liveMatch.id, reason: 'title_year_author' };
    const candidateMatch = (staged ?? []).find((row) => normalizeTitle(row.title) === normalized && JSON.stringify(row.authors ?? '').toLowerCase().includes(author));
    if (candidateMatch) return { kind: 'resource_candidates', id: candidateMatch.id, reason: 'title_year_author' };
  }

  if (candidate.title && candidate.title.length > 15) {
    const normalized = normalizeTitle(candidate.title);
    const [{ data: live }, { data: staged }] = await Promise.all([
      supabase.from('catalogue_items').select('id,title,authors,year').eq('tenant_id', tenantId).ilike('title', `%${candidate.title.slice(0, 40)}%`).limit(30),
      supabase.from('resource_candidates').select('id,title,authors,year').eq('tenant_id', tenantId).neq('status', 'rejected').ilike('title', `%${candidate.title.slice(0, 40)}%`).limit(30),
    ]);
    
    // If title exactly matches and either author or year matches (or both missing)
    const isStrongMatch = (row: any) => {
      if (normalizeTitle(row.title) !== normalized) return false;
      const sameYear = row.year === candidate.year || !row.year || !candidate.year;
      const author = firstAuthor(candidate.authors);
      const sameAuthor = author ? JSON.stringify(row.authors ?? '').toLowerCase().includes(author) : true;
      return sameYear && sameAuthor;
    };
    
    const liveMatchTitle = (live ?? []).find(isStrongMatch);
    if (liveMatchTitle) return { kind: 'catalogue_items', id: liveMatchTitle.id, reason: 'title_fallback' };
    
    const candidateMatchTitle = (staged ?? []).find(isStrongMatch);
    if (candidateMatchTitle) return { kind: 'resource_candidates', id: candidateMatchTitle.id, reason: 'title_fallback' };
  }

  return null;
}
