import { NextResponse, type NextRequest } from 'next/server';
import { searchRor, getRorById } from '@/server/interoperability/ror';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const query = new URL(request.url).searchParams.get('q');
  const id = new URL(request.url).searchParams.get('id');

  if (id) {
    const org = await getRorById(id);
    if (!org) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: org });
  }

  if (!query) return NextResponse.json({ success: false, error: 'q or id required' }, { status: 400 });
  const results = await searchRor(query);
  return NextResponse.json({ success: true, data: results });
}
