import { writeAuditLog } from '@/server/audit/writeAuditLog';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

function formatFromItemType(itemType: string) {
  if (itemType === 'ebook') return 'Ebook';
  if (itemType === 'journal') return 'Journal';
  if (itemType === 'database') return 'Database';
  return 'Book';
}

export async function approveStagedCatalogueRow(input: { id: string; actorUserId: string; actorRole?: string | null }) {
  const supabase = getSupabaseAdminClient();
  const { data: staged, error: stagedError } = await supabase.from('catalogue_staging').select('*').eq('id', input.id).single();
  if (stagedError) throw new Error(stagedError.message);
  if (staged.status !== 'pending' && staged.status !== 'needs_changes') throw new Error('Only pending staging rows can be approved.');

  const { data: duplicate, error: dupError } = staged.isbn
    ? await supabase.from('catalogue_items').select('id').eq('tenant_id', staged.tenant_id).eq('isbn', staged.isbn).maybeSingle()
    : { data: null, error: null };
  if (dupError) throw new Error(dupError.message);
  if (duplicate) throw new Error('A live catalogue item with this ISBN already exists.');

  const { data: item, error: itemError } = await supabase
    .from('catalogue_items')
    .insert({
      tenant_id: staged.tenant_id,
      title: staged.title || staged.isbn || 'Untitled resource',
      authors: staged.authors ?? [],
      isbn: staged.isbn,
      publisher: staged.publisher,
      year: staged.year,
      edition: staged.edition,
      subjects: staged.subjects ?? [],
      subjects_text: (staged.subjects ?? []).join(', '),
      call_number: null,
      format: formatFromItemType(staged.item_type),
      item_type: staged.item_type,
      language: staged.language || 'English',
      abstract: staged.notes,
      cover_image: staged.cover_url,
      total_copies: staged.copies || 1,
      available_copies: staged.copies || 1,
      source_url: staged.source_url,
      notes: staged.notes,
      status: 'available',
    })
    .select('*')
    .single();
  if (itemError) throw new Error(itemError.message);

  if ((staged.copies ?? 1) > 0) {
    const copies = Array.from({ length: staged.copies ?? 1 }, (_, index) => ({
      tenant_id: staged.tenant_id,
      item_id: item.id,
      call_number: null,
      location: staged.shelf_location,
      status: 'available',
      barcode: staged.isbn ? `${staged.isbn}-${String(index + 1).padStart(3, '0')}` : null,
    }));
    await supabase.from('catalogue_copies').insert(copies);
  }

  const { data: updated, error: updateError } = await supabase
    .from('catalogue_staging')
    .update({ status: 'approved', approved_by: input.actorUserId, approved_at: new Date().toISOString() })
    .eq('id', staged.id)
    .select('*')
    .single();
  if (updateError) throw new Error(updateError.message);

  await writeAuditLog({
    tenantId: staged.tenant_id,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole ?? null,
    action: 'catalogue_staging_approved',
    entityType: 'catalogue_staging',
    entityId: staged.id,
    beforeData: staged,
    afterData: updated,
    metadata: { catalogueItemId: item.id },
  });

  return { staged: updated, item };
}

export async function rejectStagedCatalogueRow(input: { id: string; actorUserId: string; actorRole?: string | null; reason: string }) {
  if (!input.reason.trim()) throw new Error('Rejection reason is required.');
  const supabase = getSupabaseAdminClient();
  const { data: staged, error: stagedError } = await supabase.from('catalogue_staging').select('*').eq('id', input.id).single();
  if (stagedError) throw new Error(stagedError.message);

  const { data: updated, error } = await supabase
    .from('catalogue_staging')
    .update({ status: 'rejected', rejected_by: input.actorUserId, rejected_at: new Date().toISOString(), rejection_reason: input.reason })
    .eq('id', input.id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: staged.tenant_id,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole ?? null,
    action: 'catalogue_staging_rejected',
    entityType: 'catalogue_staging',
    entityId: staged.id,
    beforeData: staged,
    afterData: updated,
    metadata: { reason: input.reason },
  });

  return updated;
}

export async function updateStagedCatalogueRow(input: { id: string; patch: Record<string, unknown>; actorUserId: string; actorRole?: string | null }) {
  const allowed = new Set(['isbn', 'title', 'authors', 'publisher', 'year', 'edition', 'language', 'category', 'subjects', 'copies', 'shelf_location', 'item_type', 'source_url', 'cover_url', 'notes', 'status']);
  const patch = Object.fromEntries(Object.entries(input.patch).filter(([key]) => allowed.has(key)));
  const supabase = getSupabaseAdminClient();
  const { data: before, error: beforeError } = await supabase.from('catalogue_staging').select('*').eq('id', input.id).single();
  if (beforeError) throw new Error(beforeError.message);

  const { data, error } = await supabase.from('catalogue_staging').update(patch).eq('id', input.id).select('*').single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    tenantId: data.tenant_id,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole ?? null,
    action: 'catalogue_staging_updated',
    entityType: 'catalogue_staging',
    entityId: input.id,
    beforeData: before,
    afterData: data,
  });

  return data;
}
