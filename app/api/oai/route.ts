import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { buildContext, handleOaiRequest, type OaiParams } from '@/server/oai/service';
import { dateDatestamp } from '@/server/oai/oaiXml';
import { recordOaiRequest, snapshotMetrics } from '@/server/oai/observability';

export const dynamic = 'force-dynamic';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;
const buckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string, now: number): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    if (buckets.size > 5000) {
      const oldest = buckets.keys().next().value;
      if (oldest) buckets.delete(oldest);
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function isEnabled(): boolean {
  return process.env.OAI_ENABLED === 'true';
}

function xml(response: NextResponse): NextResponse {
  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      'Content-Type': 'text/xml; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
      'X-RateLimit-Window': String(RATE_LIMIT_WINDOW_MS),
    },
  });
}

export async function GET(request: NextRequest) {
  const started = Date.now();
  const url = new URL(request.url);

  if (url.searchParams.get('verb') === '__metrics') {
    return NextResponse.json({ success: true, data: snapshotMetrics() });
  }

  if (!isEnabled()) {
    return new NextResponse('OAI-PMH is not enabled. Set OAI_ENABLED=true.', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  }

  if (isRateLimited(clientKey(request), started)) {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <responseDate>${new Date(started).toISOString()}</responseDate>
  <error code="badArgument">Rate limit exceeded. OAI-PMH is intended for harvesting; slow down and retry.</error>
</OAI-PMH>`;
    return xml(new NextResponse(body, { status: 429 }));
  }

  const params: OaiParams = {
    verb: url.searchParams.get('verb'),
    metadataPrefix: url.searchParams.get('metadataPrefix'),
    from: url.searchParams.get('from'),
    until: url.searchParams.get('until'),
    identifier: url.searchParams.get('identifier'),
    set: url.searchParams.get('set'),
    resumptionToken: url.searchParams.get('resumptionToken'),
  };

  const context = buildContext(request.url);

  try {
    const db = getSupabaseAdminClient();
    const { data: earliest } = await db
      .from('repository_items')
      .select('updated_at')
      .eq('status', 'published')
      .order('updated_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    context.config.earliestDatestamp = earliest?.updated_at ? dateDatestamp(earliest.updated_at) : '';
  } catch {
    // Identify must never fail because of an earliestDatestamp lookup.
  }

  const result = await handleOaiRequest(params, context);
  const duration = Date.now() - started;

  recordOaiRequest({
    verb: params.verb ?? '',
    metadataPrefix: result.metadataPrefix,
    set: result.set,
    resumptionToken: result.resumptionToken,
    errorCode: result.errorCode,
    recordCount: result.recordCount,
    durationMs: duration,
  });

  return xml(new NextResponse(result.xml));
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}
