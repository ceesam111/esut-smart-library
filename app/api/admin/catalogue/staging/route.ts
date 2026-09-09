import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const confidence = request.nextUrl.searchParams.get('confidence');
    const status = request.nextUrl.searchParams.get('status') || 'pending';
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('catalogue_staging')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(100);
    if (confidence) query = query.eq('confidence', confidence);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ rows: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 401 });
  }
}
