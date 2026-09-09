import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { stageCatalogueImport } from '@/server/catalogue/stageImport';

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('catalogue_import_batches')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return NextResponse.json({ batches: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json();
    if (!Array.isArray(body.rows)) throw new Error('rows must be an array.');
    const result = await stageCatalogueImport({
      uploadedBy: ctx.user.id,
      filename: body.filename ?? null,
      rows: body.rows,
      includeWarnings: body.includeWarnings !== false,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
