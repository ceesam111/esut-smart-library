import { NextResponse, type NextRequest } from 'next/server';
import {
  verifyCoarSignature,
  checkCoarRateLimit,
  isDuplicateNonce,
  validateCoarUrl,
  isCoarConfigured,
} from '@/server/interoperability/coar-security';
import { validateCoarNotify, createCoarNotify, sendCoarNotify } from '@/server/interoperability/coar-notify';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export const dynamic = 'force-dynamic';

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

export async function POST(request: NextRequest) {
  if (!isCoarConfigured()) {
    return NextResponse.json({ error: 'COAR Notify not configured' }, { status: 503 });
  }

  const signature = request.headers.get('x-coar-signature') || '';
  const timestamp = request.headers.get('x-coar-timestamp') || '';
  const nonce = request.headers.get('x-coar-nonce') || '';

  if (!signature || !timestamp || !nonce) {
    return NextResponse.json({ error: 'Missing authentication headers' }, { status: 401 });
  }

  if (isDuplicateNonce(nonce)) {
    return NextResponse.json({ error: 'Duplicate nonce' }, { status: 409 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const rawBody = JSON.stringify(payload);
  if (!verifyCoarSignature(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (!validateCoarNotify(payload)) {
    return NextResponse.json({ error: 'Invalid COAR Notify payload' }, { status: 400 });
  }

  const p = payload as Record<string, unknown>;
  const actorId = (p.actor as Record<string, unknown>)?.id;
  if (!actorId || !validateCoarUrl(actorId)) {
    return NextResponse.json({ error: 'Invalid actor' }, { status: 400 });
  }

  if (!checkCoarRateLimit(actorId)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const targetId = (p.target as Record<string, unknown>)?.id;
  if (!targetId || !targetId.includes('esutlibrary.edu.ng')) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data: existing } = await supabase
      .from('coar_notifications')
      .select('id')
      .eq('notification_id', p.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, duplicate: true }, { status: 200 });
    }

    const { error } = await supabase.from('coar_notifications').insert({
      notification_id: p.id as string,
      type: p.type as string[],
      actor_id: actorId as string,
      object_id: (p.object as Record<string, unknown>)?.id as string,
      target_id: targetId as string,
      payload: p,
    });

    if (error) {
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201, headers: { 'Content-Type': 'application/ld+json' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
