import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { captureEvent, classifyBot, hashIp } from '@/server/analytics/eventCapture';

export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HANDLE_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
const DEDUPE_MAX_ENTRIES = 10000;

const viewDedupe = new Map<string, number>();

function isDuplicateView(key: string, now: number): boolean {
  const last = viewDedupe.get(key);
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return true;
  viewDedupe.set(key, now);
  if (viewDedupe.size > DEDUPE_MAX_ENTRIES) {
    for (const [entryKey, seenAt] of viewDedupe) {
      if (now - seenAt >= DEDUPE_WINDOW_MS) viewDedupe.delete(entryKey);
    }
  }
  return false;
}

interface CounterRow {
  id: string;
  status: string | null;
  faculty_code: string | null;
  department: string | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const lookup = decodeURIComponent(id ?? '');
    const isUuid = UUID_PATTERN.test(lookup);
    if (!isUuid && !HANDLE_PATTERN.test(lookup)) {
      return NextResponse.json({ error: 'Invalid item reference' }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
    const action = body?.action === 'download' ? 'download' : 'view';

    const supabase = getSupabaseAdminClient();
    const selector = isUuid ? `id.eq.${lookup}` : `handle.eq.${lookup}`;
    const { data, error } = await supabase
      .from('repository_items')
      .select('id, status, faculty_code, department')
      .or(selector)
      .maybeSingle();
    if (error || !data || data.status !== 'published') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const item = data as CounterRow;

    const userAgent = request.headers.get('user-agent') ?? undefined;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'local';
    const ipHash = hashIp(ip);
    const botFlag = classifyBot(userAgent) === 'BOT' ? 'BOT' : 'HUMAN';
    const now = Date.now();

    if (botFlag === 'BOT') {
      await captureEvent({
        event_type: action === 'download' ? 'repository_file_download' : 'repository_item_view',
        ip_hash: ipHash,
        user_agent: userAgent,
        referrer: request.headers.get('referer') ?? undefined,
        path: `/repository/${item.id}`,
        entity_type: 'repository_item',
        entity_id: item.id,
        event_category: 'REPOSITORY',
        bot_flag: 'BOT',
        faculty: item.faculty_code ?? undefined,
        department: item.department ?? undefined,
      });
      return NextResponse.json({ success: true, counted: false });
    }

    if (action === 'view' && isDuplicateView(`${ipHash}:${item.id}`, now)) {
      return NextResponse.json({ success: true, counted: false, deduped: true });
    }

    let newCount: number | null = null;
    const rpcName = action === 'download' ? 'increment_repository_download_count' : 'increment_repository_view_count';
    const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, { p_item_id: item.id });
    if (!rpcError && typeof rpcData === 'number') newCount = rpcData;

    await captureEvent({
      event_type: action === 'download' ? 'repository_file_download' : 'repository_item_view',
      ip_hash: ipHash,
      user_agent: userAgent,
      referrer: request.headers.get('referer') ?? undefined,
      path: `/repository/${item.id}`,
      entity_type: 'repository_item',
      entity_id: item.id,
      event_category: 'REPOSITORY',
      bot_flag: 'HUMAN',
      faculty: item.faculty_code ?? undefined,
      department: item.department ?? undefined,
    });

    return NextResponse.json({ success: true, counted: newCount !== null, ...(newCount !== null ? { [action === 'download' ? 'download_count' : 'view_count']: newCount } : {}) });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
