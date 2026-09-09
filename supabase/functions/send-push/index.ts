// Simple in-app notification broadcaster (no VAPID / web-push).
// Inserts rows into user_notifications which the in-app NotificationBell reads.
// Called from the app via supabase.functions.invoke('send-push', ...).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    // Identify the caller (RLS-respecting client with their token)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    const payload = await req.json().catch(() => ({}));
    const { userId, broadcast, title, body: message, url, type } = payload as {
      userId?: string;
      broadcast?: boolean;
      title?: string;
      body?: string;
      url?: string;
      type?: string;
    };

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const notif = {
      title: title ?? 'ESUT Library',
      body: message ?? 'You have a new notification.',
      url: url ?? '/',
      type: type ?? 'system',
    };

    if (broadcast) {
      // Broadcasting requires a privileged role.
      const { data: isStaff } = await userClient.rpc('is_library_staff', {
        _user_id: user.id,
      });
      if (!isStaff) return json({ error: 'Forbidden' }, 403);

      // Insert one in-app notification per user (paginated).
      let count = 0;
      let page = 1;
      const perPage = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: list, error: listErr } =
          await admin.auth.admin.listUsers({ page, perPage });
        if (listErr) throw listErr;
        const users = list?.users ?? [];
        if (users.length === 0) break;

        const rows = users.map((u) => ({ user_id: u.id, ...notif }));
        const { error: insErr } = await admin.from('user_notifications').insert(rows);
        if (insErr) throw insErr;
        count += rows.length;

        if (users.length < perPage) break;
        page++;
      }
      return json({ count });
    }

    // Single-user notification: only super admins may target other users.
    const targetUserId = userId ?? user.id;
    if (targetUserId !== user.id) {
      const { data: isSuper } = await userClient.rpc('is_super_admin', {
        _user_id: user.id,
      });
      if (!isSuper) return json({ error: 'Forbidden' }, 403);
    }

    const { error: insErr } = await admin
      .from('user_notifications')
      .insert({ user_id: targetUserId, ...notif });
    if (insErr) throw insErr;

    return json({ count: 1 });
  } catch (err) {
    return json({ error: (err as Error).message ?? 'Failed to send notification' }, 500);
  }
});
