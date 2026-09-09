export function getTurnstileSiteKey() {
  return process.env.CLOUDFLARE_SITE_KEY || process.env.NEXT_PUBLIC_CLOUDFLARE_SITE_KEY || '';
}

export function getTurnstileSecretKey() {
  return process.env.CLOUDFLARE_SECRET_KEY || '';
}

export async function verifyTurnstileToken(token: string | null | undefined, remoteIp?: string | null, expectedAction?: string | null) {
  const secret = getTurnstileSecretKey();
  const siteKey = getTurnstileSiteKey();
  if (!siteKey) return { success: true, skipped: true };
  if (!secret) return { success: false, error: 'Turnstile secret key is not configured.' };
  if (!token) return { success: false, error: 'Security challenge is required.' };

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (remoteIp) body.set('remoteip', remoteIp);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const result = await response.json().catch(() => ({}));
  if (result.success && expectedAction && result.action && result.action !== expectedAction) {
    return { success: false, result, error: 'Turnstile action mismatch.' };
  }
  return { success: !!result.success, result, error: result['error-codes']?.join(', ') };
}
