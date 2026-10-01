import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { getSignedDownloadUrl } from '@/server/storage/b2Client';

/**
 * Thesis file download authorization.
 *
 * `theses.file_url` stores `bucket/key` (the buckets are private), so a link
 * printed in a page would 404. This resolves it to a short-lived signed URL
 * only after deciding the caller is allowed to see the file.
 */

const STAFF_ROLES = [
  'super_admin',
  'librarian',
  'faculty_librarian',
  'catalog_admin',
  'ir_admin',
  'dept_ir_officer',
  'admin',
];

export interface ThesisDownloadResult {
  downloadUrl?: string;
  reason?: 'not_found' | 'no_file' | 'forbidden' | 'storage_error';
}

export async function createThesisDownload(
  thesisId: string,
  userId: string,
  userEmail: string | null,
  userRoles: string[],
): Promise<ThesisDownloadResult> {
  const supabase = getSupabaseAdminClient();

  const { data: thesis, error } = await supabase
    .from('theses')
    .select('id, file_url, status, visibility, submitter_id, patron_id')
    .eq('id', thesisId)
    .maybeSingle();

  if (error || !thesis) return { reason: 'not_found' };
  if (!thesis.file_url) return { reason: 'no_file' };

  if (thesis.submitter_id === userId) return sign(thesis.file_url as string);

  if (userRoles.some((role) => STAFF_ROLES.includes(role))) return sign(thesis.file_url as string);

  const { data: patron } = await supabase
    .from('patrons')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (patron?.id && thesis.patron_id === patron.id) return sign(thesis.file_url as string);

  const { data: supervisors } = await supabase
    .from('thesis_supervisors')
    .select('supervisor_email')
    .eq('thesis_id', thesisId);
  if (
    userEmail &&
    (supervisors ?? []).some(
      (row) => (row.supervisor_email ?? '').toLowerCase() === userEmail.toLowerCase(),
    )
  ) {
    return sign(thesis.file_url as string);
  }

  if (thesis.status === 'published' && thesis.visibility === 'global') {
    return sign(thesis.file_url as string);
  }

  return { reason: 'forbidden' };
}

async function sign(fileUrl: string): Promise<ThesisDownloadResult> {
  if (/^https?:\/\//i.test(fileUrl)) return { downloadUrl: fileUrl };

  try {
    // `b2://bucket/key` is minted by the Backblaze presigner.
    if (fileUrl.startsWith('b2://')) {
      const rest = fileUrl.slice('b2://'.length);
      const separator = rest.indexOf('/');
      if (separator <= 0) return { reason: 'no_file' };
      const downloadUrl = await getSignedDownloadUrl({
        bucket: rest.slice(0, separator),
        key: rest.slice(separator + 1),
        expiresIn: 300,
      });
      return { downloadUrl };
    }

    // Everything else is a private Supabase Storage object stored as `bucket/key`.
    const parts = fileUrl.split('/');
    const bucket = parts[0];
    const key = parts.slice(1).join('/');
    if (!bucket || !key) return { reason: 'no_file' };

    const { data, error } = await getSupabaseAdminClient()
      .storage.from(bucket)
      .createSignedUrl(key, 300);
    if (error || !data?.signedUrl) return { reason: 'storage_error' };
    return { downloadUrl: data.signedUrl };
  } catch {
    return { reason: 'storage_error' };
  }
}
