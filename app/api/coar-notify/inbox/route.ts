import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
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
  try {
    const payload = await request.json().catch(() => null);
    if (!payload || !validateCoarNotify(payload)) {
      return NextResponse.json({ error: 'Invalid COAR Notify payload' }, { status: 400 });
    }
    const supabase = getSupabaseAdminClient();
    await supabase.from('coar_notifications').insert({
      notification_id: payload.id,
      type: payload.type,
      actor_id: payload.actor?.id,
      object_id: payload.object?.id,
      target_id: payload.target?.id,
      payload,
    });
    return NextResponse.json({ success: true }, { status: 201, headers: { 'Content-Type': 'application/ld+json' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
