import { createHash } from 'crypto';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { getSignedDownloadUrl } from '@/server/storage/b2Client';

export interface RepositoryFileInput {
  repositoryItemId: string;
  repositoryVersionId?: string | null;
  file: Buffer | Blob;
  originalFilename: string;
  displayFilename?: string;
  mimeType?: string;
  role?: 'ORIGINAL' | 'SUPPLEMENTARY' | 'THUMBNAIL' | 'TEXT' | 'LICENSE' | 'METADATA';
  accessLevel?: 'PUBLIC' | 'AUTHENTICATED' | 'FACULTY' | 'RESTRICTED' | 'PRIVATE';
  embargoUntil?: string | null;
  description?: string;
  displayOrder?: number;
  uploaderId: string;
}

function sanitizeFilename(filename: string): string {
  return filename.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
}

function detectMimeType(filename: string, provided?: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv', txt: 'text/plain', json: 'application/json', xml: 'application/xml',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', zip: 'application/zip',
  };
  return provided || mimeMap[ext] || 'application/octet-stream';
}

export function calculateChecksum(data: Buffer): { checksum: string; algorithm: string } {
  return { checksum: createHash('sha256').update(data).digest('hex'), algorithm: 'sha256' };
}

export async function uploadRepositoryFile(input: RepositoryFileInput) {
  const supabase = getSupabaseAdminClient();
  const bytes = input.file instanceof Buffer ? input.file : Buffer.from(await (input.file as Blob).arrayBuffer());
  const { checksum, algorithm } = calculateChecksum(bytes);
  const safeName = sanitizeFilename(input.originalFilename);
  const mimeType = detectMimeType(safeName, input.mimeType);
  const key = `repository/${input.repositoryItemId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from('repository').upload(key, bytes, { contentType: mimeType, upsert: false });
  if (uploadError) throw new Error('Storage upload failed: ' + uploadError.message);

  const { data, error } = await supabase.from('repository_files').insert({
    repository_item_id: input.repositoryItemId,
    repository_version_id: input.repositoryVersionId || null,
    storage_provider: 'supabase', storage_bucket: 'repository', storage_key: key,
    original_filename: safeName, display_filename: input.displayFilename || safeName,
    mime_type: mimeType, file_size: bytes.length, checksum, checksum_algorithm: algorithm,
    checksum_calculated_at: new Date().toISOString(), description: input.description || null,
    role: input.role || 'ORIGINAL', display_order: input.displayOrder ?? 0,
    access_level: input.accessLevel || 'PUBLIC', embargo_until: input.embargoUntil || null,
    uploader_id: input.uploaderId, preservation_status: 'PENDING', extracted_text_status: 'PENDING',
  }).select('*').single();

  if (error) { await supabase.storage.from('repository').remove([key]); throw new Error('File record creation failed: ' + error.message); }
  return data;
}

export async function getFileDownload(fileId: string, userId: string, userRoles: string[]) {
  const supabase = getSupabaseAdminClient();
  const { data: file, error } = await supabase.from('repository_files').select('*, repository_items(status, visibility, embargo_until, submitter_id)').eq('id', fileId).maybeSingle();
  if (error || !file) return { reason: 'not_found' };
  if (file.embargo_until && new Date(file.embargo_until) > new Date()) {
    const isOwner = file.submitter_id === userId;
    const isAdmin = userRoles.some((r) => ['super_admin', 'library_admin', 'librarian'].includes(r));
    if (!isOwner && !isAdmin) return { reason: 'embargoed' };
  }
  const isOwner = file.submitter_id === userId;
  const isAdmin = userRoles.some((r) => ['super_admin', 'library_admin', 'librarian'].includes(r));
  if (file.access_level === 'PRIVATE' && !isOwner && !isAdmin) return { reason: 'forbidden' };
  if (file.access_level === 'RESTRICTED' && !isAdmin) return { reason: 'forbidden' };
  try {
    const downloadUrl = await getSignedDownloadUrl({ bucket: file.storage_bucket, key: file.storage_key, expiresIn: 300 });
    return { downloadUrl, itemId: String(file.repository_item_id ?? ''), fileId: String(file.id ?? '') };
  } catch { return { reason: 'storage_error' }; }
}

export async function deleteRepositoryFile(fileId: string, userId: string, userRoles: string[]) {
  const supabase = getSupabaseAdminClient();
  const { data: file, error } = await supabase.from('repository_files').select('*').eq('id', fileId).maybeSingle();
  if (error || !file) return { success: false, reason: 'not_found' };
  const isOwner = file.uploader_id === userId;
  const isAdmin = userRoles.some((r) => ['super_admin', 'library_admin', 'librarian'].includes(r));
  if (!isOwner && !isAdmin) return { success: false, reason: 'forbidden' };
  await supabase.storage.from(file.storage_bucket).remove([file.storage_key]);
  await supabase.from('repository_files').delete().eq('id', fileId);
  return { success: true };
}
