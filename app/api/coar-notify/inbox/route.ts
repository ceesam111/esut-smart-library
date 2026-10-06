import { NextResponse, type NextRequest } from 'next/server';
import {
  verifyCoarSignature,
  checkCoarRateLimit,
  checkCoarSourceRateLimit,
  isDuplicateNonce,
  validateCoarUrl,
  isCoarConfigured,
  getCoarTargetHost,
} from '@/server/interoperability/coar-security';
import { validateCoarNotify } from '@/server/interoperability/coar-notify';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { childLogger } from '@/server/logging/logger';

export const dynamic = 'force-dynamic';

const JSON_CONTENT_TYPE = /^application\/(ld\+)?json\b/i;

export async function GET() {
  const inboxUrl = 'https://esutlibrary.edu.ng/api/coar-notify/inbox';
  const body = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: inboxUrl,
    type: 'OrderedCollection',
    name: 'ESUT Library COAR Notify Inbox',
    orderedItems: [],
  };
  return NextResponse.json(body, { headers: { 'Content-Type': 'application/ld+json' } });
}

function reject(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  const log = childLogger({ method: request.method, path: request.nextUrl.pathname });
  const rejectWithLog = (status: number, error: string, reason: string) => {
    log.warn('coar inbox rejected', { status, reason });
    return reject(status, error);
  };

  if (!isCoarConfigured()) {
    return rejectWithLog(503, 'COAR Notify not configured', 'not-configured');
  }

  const contentType = request.headers.get('content-type') || '';
  if (!JSON_CONTENT_TYPE.test(contentType)) {
    return rejectWithLog(415, 'Unsupported content type', 'unsupported-content-type');
  }

  const signature = request.headers.get('x-coar-signature') || '';
  const timestamp = request.headers.get('x-coar-timestamp') || '';
  const nonce = request.headers.get('x-coar-nonce') || '';

  if (!signature || !timestamp || !nonce) {
    return rejectWithLog(401, 'Missing authentication headers', 'missing-auth-headers');
  }

  const sourceKey = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (!checkCoarSourceRateLimit(sourceKey)) {
    return rejectWithLog(429, 'Rate limit exceeded', 'source-rate-limit');
  }

  const rawBody = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return rejectWithLog(400, 'Invalid JSON', 'invalid-json');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return rejectWithLog(400, 'Invalid payload', 'invalid-payload');
  }

  if (!verifyCoarSignature(rawBody, signature, timestamp)) {
    return rejectWithLog(401, 'Invalid signature', 'invalid-signature');
  }

  if (await isDuplicateNonce(nonce)) {
    return rejectWithLog(409, 'Duplicate nonce', 'duplicate-nonce');
  }

  if (!validateCoarNotify(payload)) {
    return rejectWithLog(400, 'Invalid COAR Notify payload', 'invalid-structure');
  }

  const p = payload;
  const actorId = p.actor.id;
  if (!validateCoarUrl(actorId)) {
    return rejectWithLog(400, 'Invalid actor', 'invalid-actor');
  }

  if (!checkCoarRateLimit(actorId)) {
    return rejectWithLog(429, 'Rate limit exceeded', 'actor-rate-limit');
  }

  const targetId = p.target.id;
  if (typeof targetId !== 'string' || !targetId.includes(getCoarTargetHost())) {
    return rejectWithLog(400, 'Invalid target', 'invalid-target');
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data: existing } = await supabase
      .from('coar_notifications')
      .select('id')
      .eq('notification_id', p.id)
      .maybeSingle();

    if (existing) {
      log.info('coar inbox duplicate notification ignored', { notificationId: p.id });
      return NextResponse.json({ success: true, duplicate: true }, { status: 200 });
    }

    const { error } = await supabase.from('coar_notifications').insert({
      notification_id: p.id,
      type: p.type,
      actor_id: actorId,
      object_id: p.object.id,
      target_id: targetId,
      payload: p,
    });

    if (error) {
      log.error('coar inbox store failed', { notificationId: p.id });
      return reject(500, 'Processing failed');
    }

    log.info('coar inbox notification stored', { notificationId: p.id });
    return NextResponse.json({ success: true }, { status: 201, headers: { 'Content-Type': 'application/ld+json' } });
  } catch {
    log.error('coar inbox unexpected failure');
    return reject(500, 'Processing failed');
  }
}
