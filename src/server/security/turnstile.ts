export function getTurnstileSiteKey() {
  return process.env.CLOUDFLARE_SITE_KEY || process.env.NEXT_PUBLIC_CLOUDFLARE_SITE_KEY || '';
}

export function getTurnstileSecretKey() {
  return process.env.CLOUDFLARE_SECRET_KEY || '';
}

export interface TurnstileVerifyResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

export async function verifyTurnstileToken(
  _token?: string | null,
  _remoteIp?: string | null,
  _expectedAction?: string | null,
): Promise<TurnstileVerifyResult> {
  // TEMPORARILY DISABLED for development — always accept without calling Cloudflare.
  // Re-enable by calling Cloudflare's siteverify endpoint with getTurnstileSecretKey().
  return { success: true, skipped: true };
}
