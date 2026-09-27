import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from('authority_control').select('*').order('term');
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const { item_type, item_id, authority_id, heading } = body as {
      item_type?: 'catalogue' | 'repository';
      item_id?: string;
      authority_id?: string;
      heading?: string;
    };
    if (!item_type || !item_id || !authority_id) {
      return NextResponse.json({ success: false, error: 'item_type, item_id, and authority_id required' }, { status: 400 });
    }
    const table = item_type === 'catalogue' ? 'catalogue_items' : 'repository_items';
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(table)
      .update({ authority_id, authority_heading: heading || null })
      .eq('id', item_id)
      .select('id, authority_id, authority_heading')
      .single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
