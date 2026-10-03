import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { searchZ3950 } from '@/server/z3950/search';
import type { IndexKey } from '@/server/z3950/pqf';

const VALID_INDEXES: IndexKey[] = ['keyword', 'title', 'author', 'subject', 'isbn', 'issn', 'control', 'publisher', 'year'];

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json();

    if (!body.targetId || !body.query || !body.index) {
      return NextResponse.json({ error: 'targetId, query, and index are required' }, { status: 400 });
    }

    if (!VALID_INDEXES.includes(body.index)) {
      return NextResponse.json({ error: `Invalid index. Must be one of: ${VALID_INDEXES.join(', ')}` }, { status: 400 });
    }

    const result = await searchZ3950(body.targetId, body.query, body.index);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
