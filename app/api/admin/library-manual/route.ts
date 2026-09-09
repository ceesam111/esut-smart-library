import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

const ALLOWED = ['super_admin', 'librarian', 'catalog_admin'];

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  try {
    await requireRole(request, ALLOWED);
    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'ESUT Library Manual';
    const manualBody = typeof body.body === 'string' ? body.body.trim() : '';
    if (!manualBody) return NextResponse.json({ error: 'Manual content is required.' }, { status: 400 });

    const value = { title, body: manualBody, updatedAt: new Date().toISOString() };
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from('app_settings').upsert({ key: 'library_manual', value, description: 'Public Library Manual content' }, { onConflict: 'key' });
    if (error) throw new Error(error.message);
    return NextResponse.json({ manual: value });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed.';
    return NextResponse.json({ error: message }, { status: /forbidden/i.test(message) ? 403 : 400 });
  }
}
