import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { approveStagedCatalogueRow } from '@/server/catalogue/approveStagedRow';

export async function POST(request: NextRequest, { params }: { params: { batchId: string } }) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('catalogue_staging')
      .select('id')
      .eq('tenant_id', tenant.tenantId)
      .eq('batch_id', params.batchId)
      .eq('status', 'pending')
      .eq('confidence', 'clean_match');
    if (error) throw new Error(error.message);
    let approved = 0;
    const failures: Array<{ id: string; error: string }> = [];
    for (const row of data ?? []) {
      try {
        await approveStagedCatalogueRow({ id: row.id, actorUserId: ctx.user.id, actorRole: ctx.primaryRole });
        approved++;
      } catch (error) {
        failures.push({ id: row.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return NextResponse.json({ approved, failures });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
