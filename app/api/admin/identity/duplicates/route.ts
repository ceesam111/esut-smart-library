import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { findResearcherIdentityDuplicates } from '@/server/identity/duplicateResearchers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const report = await findResearcherIdentityDuplicates();
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Duplicate scan failed.';
    if (/Authentication required|Invalid or expired session/.test(message)) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (message === 'Forbidden.') return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
