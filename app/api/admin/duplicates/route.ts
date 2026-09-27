import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { findPotentialDuplicates, findTitleDuplicates } from '@/server/catalogue/duplicates';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const type = new URL(request.url).searchParams.get('type') || 'isbn';
    const groups = type === 'title' ? await findTitleDuplicates() : await findPotentialDuplicates();
    return NextResponse.json({ success: true, data: groups });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
