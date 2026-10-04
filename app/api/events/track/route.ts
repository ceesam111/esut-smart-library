import { z } from 'zod';
import { NextResponse, type NextRequest } from 'next/server';
import { captureEvent, hashIp } from '@/server/analytics/eventCapture';
import { requireUser } from '@/server/auth/requireUser';
import { loadPatronContext } from '@/server/analytics/patronContext';

const ALLOWED_EVENTS = new Set([
  'federated_result_click', 'provider_result_click',
  'catalogue_result_click', 'catalogue_view', 'catalogue_export',
  'repository_item_view', 'repository_result_click', 'repository_search',
  'checkout', 'checkin', 'renewal', 'page_view',
]);

const trackSchema = z.object({
  event_type: z.string().refine((v) => ALLOWED_EVENTS.has(v), 'event_type not allowed'),
  entity_id: z.string().min(1).max(200),
  entity_type: z.string().max(50).optional(),
  search_query: z.string().max(300).optional(),
  provider: z.string().max(100).optional(),
  path: z.string().max(300).optional(),
  result_count: z.number().int().min(0).max(100000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
    const now = Date.now();
    const bucket = rateBuckets.get(ip);
    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(ip, { count: 1, resetAt: now + 60000 });
      if (rateBuckets.size > 5000) {
        for (const [key, value] of rateBuckets) {
          if (now > value.resetAt) rateBuckets.delete(key);
        }
      }
    } else {
      bucket.count += 1;
      if (bucket.count > 60) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = trackSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    let userId: string | undefined;
    try {
      const ctx = await requireUser(request);
      userId = ctx.user.id;
    } catch {
      // anonymous visitors may still emit events
    }
    const patron = await loadPatronContext(userId);

    await captureEvent({
      event_type: parsed.data.event_type,
      user_id: userId ?? null,
      ip_hash: hashIp(ip),
      user_agent: request.headers.get('user-agent') ?? undefined,
      referrer: request.headers.get('referer') ?? undefined,
      path: parsed.data.path,
      entity_type: parsed.data.entity_type,
      entity_id: parsed.data.entity_id,
      search_query: parsed.data.search_query,
      provider: parsed.data.provider,
      result_count: parsed.data.result_count,
      metadata: parsed.data.metadata,
      faculty: patron.faculty,
      department: patron.department,
      patron_role: patron.patronRole,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
