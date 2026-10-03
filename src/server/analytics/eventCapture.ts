import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface EventCaptureInput {
  event_type: string;
  user_id?: string | null;
  session_id?: string;
  ip_hash?: string;
  user_agent?: string;
  referrer?: string;
  path?: string;
  metadata?: Record<string, unknown>;
  entity_type?: string;
  entity_id?: string;
  search_query?: string;
  provider?: string;
  bot_flag?: string;
  event_category?: string;
  faculty?: string;
  department?: string;
  patron_role?: string;
  result_count?: number;
  session_token?: string;
}

const VALID_EVENT_TYPES = new Set([
  'page_view', 'search', 'download', 'view_item', 'login', 'register',
  'catalogue_view', 'catalogue_search', 'catalogue_result_click', 'catalogue_export',
  'repository_item_view', 'repository_search', 'repository_result_click',
  'repository_file_download', 'repository_submission', 'repository_publication',
  'checkout', 'checkin', 'renewal', 'hold_placed', 'hold_fulfilled', 'hold_cancelled', 'overdue',
  'event_view', 'event_registration', 'blog_view', 'forum_activity',
  'federated_search', 'federated_result_click', 'provider_result_click',
  'ai_session_started', 'ai_query',
]);

const BOT_USER_AGENTS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
  'yandexbot', 'facebookexternalhit', 'twitterbot', 'linkedinbot',
  'whatsapp', 'telegrambot', 'slackbot', 'discordbot',
  'monitoring', 'healthcheck', 'pingdom', 'uptime',
];

export function classifyBot(userAgent?: string): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  for (const bot of BOT_USER_AGENTS) {
    if (ua.includes(bot)) return 'BOT';
  }
  return null;
}

export function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> {
  if (!metadata) return {};
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (key.includes('password') || key.includes('token') || key.includes('secret')) continue;
    if (typeof value === 'string' && value.length > 1000) {
      sanitized[key] = value.slice(0, 1000);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export async function captureEvent(input: EventCaptureInput): Promise<void> {
  try {
    if (!VALID_EVENT_TYPES.has(input.event_type)) return;

    const botFlag = input.bot_flag ?? classifyBot(input.user_agent) ?? 'HUMAN';
    const metadata = sanitizeMetadata(input.metadata);

    const supabase = getSupabaseAdminClient();
    await supabase.from('analytics_events').insert({
      event_type: input.event_type,
      user_id: input.user_id ?? null,
      session_id: input.session_id ?? null,
      ip_hash: input.ip_hash ?? null,
      user_agent: input.user_agent?.slice(0, 500) ?? null,
      referrer: input.referrer ?? null,
      path: input.path ?? null,
      metadata,
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
      search_query: input.search_query?.slice(0, 500) ?? null,
      provider: input.provider ?? null,
      bot_flag: botFlag,
      event_category: input.event_category ?? null,
      faculty: input.faculty ?? null,
      department: input.department ?? null,
      patron_role: input.patron_role ?? null,
      result_count: input.result_count ?? null,
      session_token: input.session_token ?? null,
    });
  } catch {
    // Analytics must never break the application
  }
}

const recentPageViews = new Map<string, number>();

export async function capturePageView(input: EventCaptureInput): Promise<void> {
  const key = `${input.session_id ?? 'anon'}:${input.path ?? ''}`;
  const now = Date.now();
  const last = recentPageViews.get(key) ?? 0;
  if (now - last < 5000) return;
  recentPageViews.set(key, now);
  if (recentPageViews.size > 10000) {
    const cutoff = now - 60000;
    for (const [k, v] of recentPageViews) {
      if (v < cutoff) recentPageViews.delete(k);
    }
  }
  await captureEvent({ ...input, event_type: 'page_view', event_category: 'ENGAGEMENT' });
}
