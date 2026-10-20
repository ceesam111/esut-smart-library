import { NextResponse, type NextRequest } from 'next/server';
import { listPublicTheses } from '@/server/thesis/publicThesis';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') ?? '0');
  const size = Number(url.searchParams.get('size') ?? '25');

  try {
    const result = await listPublicTheses({
      q: url.searchParams.get('q') ?? '',
      degree: url.searchParams.get('degree') ?? '',
      sort: url.searchParams.get('sort') ?? 'year_desc',
      page: Number.isFinite(page) ? page : 0,
      size: Number.isFinite(size) ? size : 25,
    });
    return NextResponse.json(
      { success: true, data: result },
      { headers: { 'cache-control': 'public, max-age=60, s-maxage=300' } },
    );
  } catch {
    return NextResponse.json({ success: false, error: 'Thesis listing failed.' }, { status: 500 });
  }
}
