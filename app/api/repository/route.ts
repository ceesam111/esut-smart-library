import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { parseSearchParams, searchRepository } from '@/server/search/repositorySearch';

export const dynamic = 'force-dynamic';

async function optionalUserId(request: NextRequest): Promise<string | null> {
  try {
    const ctx = await requireUser(request);
    return ctx.user.id as string;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const userId = await optionalUserId(request);
  const params = parseSearchParams(new URL(request.url).searchParams);

  try {
    const result = await searchRepository({ ...params, userId });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Repository search failed.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
