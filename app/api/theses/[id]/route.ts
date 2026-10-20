import { NextResponse, type NextRequest } from 'next/server';
import { getPublicThesis } from '@/server/thesis/publicThesis';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let decoded: string;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  try {
    const thesis = await getPublicThesis(decoded);
    if (!thesis) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(
      { success: true, data: thesis },
      { headers: { 'cache-control': 'public, max-age=300, s-maxage=900' } },
    );
  } catch {
    return NextResponse.json({ success: false, error: 'Thesis lookup failed.' }, { status: 500 });
  }
}
