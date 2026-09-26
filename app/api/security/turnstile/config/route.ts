import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Turnstile is disabled for this deployment.
 *
 * The configured CLOUDFLARE_SITE_KEY / CLOUDFLARE_SECRET_KEY belong to a
 * different Cloudflare application, so no widget may be rendered and no
 * challenge may be issued here. Returning no siteKey keeps every client
 * (including stale bundles) from loading Cloudflare's challenge script.
 *
 * To re-enable: provision Turnstile keys for virtuallibrary.esut.edu.ng,
 * restore the widget in the login/registration pages, and serve the key here.
 */
export async function GET() {
  return NextResponse.json({ siteKey: null });
}
