import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireRole(request, GLOBAL_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();
    const entityType = request.nextUrl.searchParams.get('entityType');

    let query = supabase
      .from('audit_logs')
      .select('*')
      .or(`tenant_id.eq.${tenant.tenantId},tenant_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (entityType) query = query.eq('entity_type', entityType);
    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ auditLogs: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 401 });
  }
}
