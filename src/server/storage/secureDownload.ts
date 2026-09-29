import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { getSignedDownloadUrl } from '@/server/storage/b2Client';

export interface SecureDownloadResult {
  downloadUrl?: string;
  reason?: string;
}

export async function createSecureRepositoryDownload(
  itemId: string,
  userId: string,
  userRoles: string[],
): Promise<SecureDownloadResult> {
  const supabase = getSupabaseAdminClient();
  const { data: item, error } = await supabase
    .from('repository_items')
    .select('id,title,file_url,file_size,status,visibility,embargo_until,submitter_id')
    .eq('id', itemId)
    .maybeSingle();

  if (error || !item) {
    return { reason: 'not_found' };
  }

  if (item.status !== 'published') {
    return { reason: 'not_published' };
  }

  if (item.embargo_until && new Date(item.embargo_until) > new Date()) {
    return { reason: 'embargoed' };
  }

  const isOwner = item.submitter_id === userId;
  const isAdmin = userRoles.some((r) => ['super_admin', 'library_admin', 'librarian'].includes(r));

  if (item.visibility === 'private' && !isOwner && !isAdmin) {
    return { reason: 'forbidden' };
  }

  if (item.visibility === 'faculty' && !isAdmin) {
    const { data: userProfile } = await supabase
      .from('patrons')
      .select('department')
      .eq('id', userId)
      .maybeSingle();
    if (!userProfile || userProfile.department !== item.department) {
      return { reason: 'forbidden' };
    }
  }

  if (!item.file_url) {
    return { reason: 'no_file' };
  }

  if (item.file_url.startsWith('https://') || item.file_url.startsWith('http://')) {
    return { downloadUrl: item.file_url };
  }

  try {
    const parts = item.file_url.split('/');
    const bucket = parts[0];
    const key = parts.slice(1).join('/');
    const downloadUrl = await getSignedDownloadUrl({ bucket, key, expiresIn: 300 });
    return { downloadUrl };
  } catch {
    return { reason: 'storage_error' };
  }
}
