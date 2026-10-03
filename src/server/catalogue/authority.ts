import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface AuthorityRecord {
  id: string;
  term: string;
  term_type: string;
  preferred_heading: string | null;
  variants: string[];
  see_references: string[];
  see_also: string[];
  identifiers: Record<string, string>;
  source: string | null;
  notes: string;
  status: 'active' | 'retired' | 'merged';
  merged_into: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthoritySearchResult {
  id: string;
  term: string;
  term_type: string;
  preferred_heading: string | null;
  variants: string[];
}

export async function listAuthorities(filters?: { type?: string; search?: string; status?: string }): Promise<AuthorityRecord[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase.from('authority_control').select('*');
  if (filters?.type) query = query.eq('term_type', filters.type);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.search) query = query.ilike('term', `%${filters.search}%`);
  const { data, error } = await query.order('term').limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAuthority(id: string): Promise<AuthorityRecord | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('authority_control').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createAuthority(input: {
  term: string;
  term_type: string;
  preferred_heading?: string;
  variants?: string[];
  see_references?: string[];
  identifiers?: Record<string, string>;
  source?: string;
  notes?: string;
}): Promise<AuthorityRecord> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('authority_control').insert(input).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateAuthority(id: string, input: Partial<{
  term: string;
  term_type: string;
  preferred_heading: string;
  variants: string[];
  see_references: string[];
  identifiers: Record<string, string>;
  source: string;
  notes: string;
  status: 'active' | 'retired' | 'merged';
}>): Promise<AuthorityRecord> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('authority_control')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function searchAuthorities(query: string, type?: string): Promise<AuthoritySearchResult[]> {
  const supabase = getSupabaseAdminClient();
  let q = supabase.from('authority_control').select('id,term,term_type,preferred_heading,variants').ilike('term', `%${query}%`).limit(20);
  if (type) q = q.eq('term_type', type);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function linkItemToAuthority(itemId: string, authorityId: string, fieldTag: string, fieldSubfield?: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('item_authority_links').insert({
    item_id: itemId,
    authority_id: authorityId,
    field_tag: fieldTag,
    field_subfield: fieldSubfield ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function unlinkItemFromAuthority(itemId: string, authorityId: string, fieldTag: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('item_authority_links')
    .delete()
    .eq('item_id', itemId)
    .eq('authority_id', authorityId)
    .eq('field_tag', fieldTag);
  if (error) throw new Error(error.message);
}

export async function mergeAuthorities(sourceId: string, targetId: string, performedBy?: string): Promise<void> {
  if (sourceId === targetId) throw new Error('Cannot merge authority into itself');

  const supabase = getSupabaseAdminClient();

  const { data: source, error: sourceError } = await supabase.from('authority_control').select('*').eq('id', sourceId).single();
  if (sourceError) throw new Error(sourceError.message);
  if (source.merged_into) throw new Error('Source authority is already merged');

  const { data: target, error: targetError } = await supabase.from('authority_control').select('*').eq('id', targetId).single();
  if (targetError) throw new Error(targetError.message);
  if (target.merged_into) throw new Error('Target authority is already merged');

  const { count: bibCount } = await supabase
    .from('item_authority_links')
    .select('id', { count: 'exact', head: true })
    .eq('authority_id', sourceId);

  const { error: linkError } = await supabase
    .from('item_authority_links')
    .update({ authority_id: targetId })
    .eq('authority_id', sourceId);
  if (linkError) throw new Error(linkError.message);

  const { error: updateError } = await supabase
    .from('authority_control')
    .update({ status: 'merged', merged_into: targetId, updated_at: new Date().toISOString() })
    .eq('id', sourceId);
  if (updateError) throw new Error(updateError.message);

  await supabase.from('authority_merge_history').insert({
    source_authority_id: sourceId,
    target_authority_id: targetId,
    merged_by: performedBy ?? null,
    bibliographic_count: bibCount ?? 0,
  });
}

export async function getMergeHistory(authorityId: string): Promise<Array<{
  id: string;
  source_authority_id: string;
  target_authority_id: string;
  merged_by: string | null;
  bibliographic_count: number;
  merged_at: string;
}>> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('authority_merge_history')
    .select('*')
    .or(`source_authority_id.eq.${authorityId},target_authority_id.eq.${authorityId}`)
    .order('merged_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
