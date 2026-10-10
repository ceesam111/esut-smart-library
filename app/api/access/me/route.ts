import { withHandler } from '@/server/api/withHandler';
import { requireUser } from '@/server/auth/requireUser';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { generateStaticCredential, hashForStorage } from '@/server/slaas/qr';

async function ensureIdentity(supabase: ReturnType<typeof getSupabaseAdminClient>, patronId: string, tenantId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('library_access_identities')
    .select('id')
    .eq('patron_id', patronId)
    .eq('status', 'active')
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('library_access_identities')
    .insert({ tenant_id: tenantId, patron_id: patronId, secure_token_hash: 'pending', status: 'active' })
    .select('id');
  if (!error && created?.[0]) return created[0].id;

  const { data: afterConflict } = await supabase
    .from('library_access_identities')
    .select('id')
    .eq('patron_id', patronId)
    .eq('status', 'active')
    .maybeSingle();
  if (afterConflict) return afterConflict.id;
  throw new Error(error?.message ?? 'Could not create access identity');
}

export const GET = withHandler({
  async handler({ request }) {
    const ctx = await requireUser(request);
    const supabase = getSupabaseAdminClient();

    const { data: patron } = await supabase
      .from('patrons')
      .select('id, tenant_id, full_name, patron_category, department, faculty_code, status, membership_expires_at')
      .eq('user_id', ctx.user.id)
      .maybeSingle();
    if (!patron) return { data: { registered: false, identity: null, visits: [], stats: null } };

    const identityId = await ensureIdentity(supabase, patron.id, patron.tenant_id);

    const credential = generateStaticCredential(identityId);
    const { error: hashError } = await supabase
      .from('library_access_identities')
      .update({ secure_token_hash: hashForStorage(credential), issued_at: new Date().toISOString() })
      .eq('id', identityId);
    if (hashError) throw new Error(hashError.message);

    const { data: identityRow } = await supabase
      .from('library_access_identities')
      .select('status, issued_at, revoked_at')
      .eq('id', identityId)
      .maybeSingle();

    const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
    const { data: visits } = await supabase
      .from('access_visits')
      .select('id, branch_id, status, checked_in_at, checked_out_at, duration_minutes, library_branches(name)')
      .eq('patron_id', patron.id)
      .gte('checked_in_at', since)
      .order('checked_in_at', { ascending: false })
      .limit(100);

    const rows = visits ?? [];
    const durations = rows.filter((r) => r.duration_minutes != null).map((r) => r.duration_minutes as number);
    const stats = {
      totalVisits: rows.length,
      avgDurationMinutes: durations.length === 0
        ? null
        : Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10,
      currentlyInside: rows.some((r) => r.status === 'checked_in'),
      visitsThisMonth: rows.filter((r) => r.checked_in_at >= new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()).length,
    };

    return {
      data: {
        registered: true,
        patron: {
          fullName: patron.full_name,
          patronCategory: patron.patron_category,
          department: patron.department,
          status: patron.status,
        },
        identity: {
          id: identityId,
          status: identityRow?.status ?? 'active',
          issued_at: identityRow?.issued_at ?? null,
          credential,
        },
        visits: rows,
        stats,
      },
    };
  },
});
