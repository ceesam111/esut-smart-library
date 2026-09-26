export function getTurnstileSiteKey() {
  return process.env.CLOUDFLARE_SITE_KEY || process.env.NEXT_PUBLIC_CLOUDFLARE_SITE_KEY || '';
}

export function getTurnstileSecretKey() {
  return process.env.CLOUDFLARE_SECRET_KEY || '';
}

export async function verifyTurnstileToken(token: string | null | undefined, remoteIp?: string | null, expectedAction?: string | null) {
  // ⚡️ Temporarily disabled for development — always accept (no Cloudflare call)
  if (!getTurnstileSiteKey()) return { success: true, skipped: true };
  return { success: true, skipped: true };
}
