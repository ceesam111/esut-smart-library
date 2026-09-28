import { NextResponse, type NextRequest } from 'next/server';
import { getPublicDirectory, isDirectoryKind } from '@/server/directory/directory';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: NextRequest) {
  try {
    const directory = new URL(request.url).searchParams.get('directory');
    if (!isDirectoryKind(directory)) {
      return NextResponse.json({ success: false, error: 'Invalid directory.' }, { status: 400 });
    }
    const data = await getPublicDirectory(directory);
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load directory.' },
      { status: 500 },
    );
  }
}
