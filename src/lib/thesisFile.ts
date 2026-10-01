import { supabase } from '@/lib/supabase';

/**
 * Resolves a thesis attachment to a short-lived signed URL and opens it.
 *
 * Thesis storage buckets are private, so `theses.file_url` holds a `bucket/key`
 * path that is useless as a hyperlink. The API authorizes the caller first and
 * only then mints the URL.
 */
export async function openThesisFile(thesisId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    throw new Error('Sign in to download this file.');
  }

  const response = await fetch('/api/thesis/download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
    body: JSON.stringify({ thesisId }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.downloadUrl) {
    const reason = typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`;
    throw new Error(
      reason === 'forbidden'
        ? 'You do not have access to this file.'
        : reason === 'no_file'
          ? 'This submission has no attached file.'
          : `Could not open the file (${reason}).`,
    );
  }

  window.open(payload.downloadUrl, '_blank', 'noopener,noreferrer');
}
