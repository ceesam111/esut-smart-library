import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export async function GET(request: NextRequest, { params }: { params: { batchId: string } }) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const confidence = request.nextUrl.searchParams.get('confidence');
    const supabase = getSupabaseAdminClient();
    const { data: batch, error: batchError } = await supabase
      .from('catalogue_import_batches')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .eq('id', params.batchId)
      .single();
    if (batchError) throw new Error(batchError.message);

    let query = supabase
      .from('catalogue_staging')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .eq('batch_id', params.batchId)
      .order('created_at', { ascending: true });
    if (confidence) query = query.eq('confidence', confidence);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ batch, rows: rows ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
