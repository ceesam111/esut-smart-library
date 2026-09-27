import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getVersions, createVersion } from '@/server/repository/versions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const itemId = new URL(request.url).searchParams.get('item_id');
    if (!itemId) return NextResponse.json({ success: false, error: 'item_id required' }, { status: 400 });
    const versions = await getVersions(itemId);
    return NextResponse.json({ success: true, data: versions });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const { item_id, file_url, change_note } = body as { item_id?: string; file_url?: string; change_note?: string };
    if (!item_id || !file_url) return NextResponse.json({ success: false, error: 'item_id and file_url required' }, { status: 400 });
    const version = await createVersion({ item_id, file_url, change_note });
    return NextResponse.json({ success: true, data: version });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
