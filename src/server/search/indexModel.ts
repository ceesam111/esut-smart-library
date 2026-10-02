import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

const MAX_INDEXED_TEXT_CHARS = 2_000_000;

interface SearchDocumentRow {
  repository_item_id: string;
  repository_file_id: string | null;
  repository_version_id: string | null;
  uploader_id: string | null;
  title: string | null;
  authors: unknown;
  subjects: unknown;
  keywords: unknown;
  abstract: string | null;
  file_name: string | null;
  file_text: string | null;
  access_level: string;
  embargo_until: string | null;
  is_current_version: boolean;
  extraction_status: string;
}

export interface IndexResult {
  itemId: string;
  documents: number;
  skipped: boolean;
}

export async function removeItemDocuments(itemId: string): Promise<void> {
  const db = getSupabaseAdminClient();
  const { error } = await db.from('repository_search_documents').delete().eq('repository_item_id', itemId);
  if (error) throw new Error(`Failed to clear search documents: ${error.message}`);
}

export async function indexRepositoryItem(itemId: string): Promise<IndexResult> {
  const db = getSupabaseAdminClient();

  const { data: item, error: itemError } = await db
    .from('repository_items')
    .select('id, title, authors, subjects, keywords, abstract, embargo_until')
    .eq('id', itemId)
    .maybeSingle();

  if (itemError) throw new Error(`Failed to load repository item: ${itemError.message}`);
  if (!item) {
    await removeItemDocuments(itemId);
    return { itemId, documents: 0, skipped: true };
  }

  const { data: files, error: filesError } = await db
    .from('repository_files')
    .select('id, repository_version_id, uploader_id, display_filename, original_filename, extracted_text, access_level, embargo_until, extracted_text_status')
    .eq('repository_item_id', itemId)
    .order('display_order', { ascending: true });

  if (filesError) throw new Error(`Failed to load repository files: ${filesError.message}`);

  const { data: currentVersion } = await db
    .from('repository_versions')
    .select('id')
    .eq('repository_item_id', itemId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentVersionId = currentVersion?.id ?? null;

  await removeItemDocuments(itemId);

  const rows: SearchDocumentRow[] = (files ?? []).map((file) => ({
    repository_item_id: itemId,
    repository_file_id: file.id,
    repository_version_id: file.repository_version_id ?? null,
    uploader_id: file.uploader_id ?? null,
    title: item.title,
    authors: item.authors,
    subjects: item.subjects,
    keywords: item.keywords,
    abstract: item.abstract,
    file_name: file.display_filename ?? file.original_filename,
    file_text: file.extracted_text ? String(file.extracted_text).slice(0, MAX_INDEXED_TEXT_CHARS) : null,
    access_level: file.access_level,
    embargo_until: file.embargo_until ?? item.embargo_until,
    is_current_version: file.repository_version_id == null || file.repository_version_id === currentVersionId,
    extraction_status: file.extracted_text_status,
  }));

  if (rows.length === 0) {
    rows.push({
      repository_item_id: itemId,
      repository_file_id: null,
      repository_version_id: null,
      uploader_id: null,
      title: item.title,
      authors: item.authors,
      subjects: item.subjects,
      keywords: item.keywords,
      abstract: item.abstract,
      file_name: null,
      file_text: null,
      access_level: 'PUBLIC',
      embargo_until: item.embargo_until,
      is_current_version: true,
      extraction_status: 'not_required',
    });
  }

  const { error: insertError } = await db.from('repository_search_documents').insert(rows as never);
  if (insertError) throw new Error(`Failed to write search documents: ${insertError.message}`);

  return { itemId, documents: rows.length, skipped: false };
}

export async function indexRepositoryFile(fileId: string): Promise<IndexResult> {
  const db = getSupabaseAdminClient();
  const { data: file, error } = await db
    .from('repository_files')
    .select('id, repository_item_id')
    .eq('id', fileId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load repository file: ${error.message}`);
  if (!file) return { itemId: fileId, documents: 0, skipped: true };

  return indexRepositoryItem(file.repository_item_id);
}

export async function reindexAll(): Promise<{ items: number; documents: number }> {
  const db = getSupabaseAdminClient();
  const { data: items, error } = await db
    .from('repository_items')
    .select('id')
    .limit(10000);

  if (error) throw new Error(`Failed to load repository items: ${error.message}`);

  let documents = 0;
  for (const item of items ?? []) {
    const result = await indexRepositoryItem(item.id as string);
    documents += result.documents;
  }

  return { items: (items ?? []).length, documents };
}
