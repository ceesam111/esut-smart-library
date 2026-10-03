import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { searchAuthorityProviders, getProviderNames } from '@/server/catalogue/authorityProviders';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const type = searchParams.get('type') ?? undefined;

    if (!query) {
      return NextResponse.json({ error: 'q is required' }, { status: 400 });
    }

    const results = await searchAuthorityProviders(query, type);
    return NextResponse.json({ results, providers: getProviderNames() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
