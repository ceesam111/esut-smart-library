import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { listAuthorities, getAuthority, createAuthority, updateAuthority, searchAuthorities, linkItemToAuthority, unlinkItemFromAuthority, mergeAuthorities, getMergeHistory } from '@/server/catalogue/authority';

const AUTHORITY_MERGE_ROLES = ['super_admin', 'catalog_admin', 'admin'];

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (id) {
      const authority = await getAuthority(id);
      if (!authority) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const mergeHistory = await getMergeHistory(id);
      return NextResponse.json({ authority, mergeHistory });
    }

    if (search) {
      const results = await searchAuthorities(search, type ?? undefined);
      return NextResponse.json({ results });
    }

    const authorities = await listAuthorities({ type: type ?? undefined });
    return NextResponse.json({ authorities });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json();

    if (body.action === 'merge') {
      if (!body.sourceId || !body.targetId) {
        return NextResponse.json({ error: 'sourceId and targetId are required' }, { status: 400 });
      }
      await requireRole(request, AUTHORITY_MERGE_ROLES);
      await mergeAuthorities(body.sourceId, body.targetId, ctx.user.id);
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'link') {
      if (!body.itemId || !body.authorityId || !body.fieldTag) {
        return NextResponse.json({ error: 'itemId, authorityId, and fieldTag are required' }, { status: 400 });
      }
      await linkItemToAuthority(body.itemId, body.authorityId, body.fieldTag, body.fieldSubfield);
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'unlink') {
      if (!body.itemId || !body.authorityId || !body.fieldTag) {
        return NextResponse.json({ error: 'itemId, authorityId, and fieldTag are required' }, { status: 400 });
      }
      await unlinkItemFromAuthority(body.itemId, body.authorityId, body.fieldTag);
      return NextResponse.json({ ok: true });
    }

    if (!body.term || !body.term_type) {
      return NextResponse.json({ error: 'term and term_type are required' }, { status: 400 });
    }
    const authority = await createAuthority(body);
    return NextResponse.json({ authority }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const authority = await updateAuthority(body.id, body);
    return NextResponse.json({ authority });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
