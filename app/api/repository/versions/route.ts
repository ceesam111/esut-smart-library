import { NextResponse, type NextRequest } from 'next/server';
import { requireUser, type ServerUserContext } from '@/server/auth/requireUser';
import { getUserRoles } from '@/server/auth/requireRole';
import { hasAnyRole, LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { getVersions, createVersion } from '@/server/repository/versions';

export const dynamic = 'force-dynamic';

async function authorizeItem(user: ServerUserContext['user'], itemId: string, allowPublic: boolean): Promise<'ok' | 'not_found' | 'forbidden'> {
  const { data: item } = await getSupabaseAdminClient()
    .from('repository_items')
    .select('submitter_id,status,visibility')
    .eq('id', itemId)
    .maybeSingle();
  if (!item) return 'not_found';
  const isPublic = item.status === 'published' && item.visibility === 'global';
  if ((allowPublic && isPublic) || item.submitter_id === user.id) return 'ok';
  const roles = await getUserRoles(user.id);
  return hasAnyRole(roles, LIBRARY_ADMIN_ROLES) ? 'ok' : 'forbidden';
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireUser(request);
    const itemId = new URL(request.url).searchParams.get('item_id');
    if (!itemId) return NextResponse.json({ success: false, error: 'item_id required' }, { status: 400 });
    const verdict = await authorizeItem(user, itemId, true);
    if (verdict === 'not_found') return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    if (verdict === 'forbidden') return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
    const versions = await getVersions(itemId);
    return NextResponse.json({ success: true, data: versions });
  } catch {
    return NextResponse.json({ success: false, error: 'Version lookup failed.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const { item_id, file_url, change_note } = body as { item_id?: string; file_url?: string; change_note?: string };
    if (!item_id || !file_url) return NextResponse.json({ success: false, error: 'item_id and file_url required' }, { status: 400 });
    const verdict = await authorizeItem(user, item_id, false);
    if (verdict === 'not_found') return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    if (verdict === 'forbidden') return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
    const version = await createVersion({ item_id, file_url, change_note });
    return NextResponse.json({ success: true, data: version });
  } catch {
    return NextResponse.json({ success: false, error: 'Version create failed.' }, { status: 500 });
  }
}
