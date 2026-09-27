import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getDoiProvider, getHandleProvider } from '@/server/identifiers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const { title, creators, year, action } = body as { title?: string; creators?: string[]; year?: number; action?: string };

    if (action === 'doi') {
      const provider = getDoiProvider();
      if (!provider) return NextResponse.json({ success: false, error: 'DOI provider not configured' }, { status: 503 });
      const result = await provider.mintDoi({ title: title || '', creators: creators || [], year });
      if (!result) return NextResponse.json({ success: false, error: 'DOI minting failed' }, { status: 502 });
      return NextResponse.json({ success: true, doi: result.doi, url: result.url });
    }

    if (action === 'handle') {
      const provider = getHandleProvider();
      const handle = await provider.mintHandle({ year });
      return NextResponse.json({ success: true, handle });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
