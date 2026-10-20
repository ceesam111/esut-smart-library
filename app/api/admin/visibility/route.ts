import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { VISIBILITY_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { computeVisibilityDiagnostics } from '@/server/visibility/visibilityDiagnostics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, VISIBILITY_ADMIN_ROLES);
    const deep = new URL(request.url).searchParams.get('deep') === '1';
    const data = await computeVisibilityDiagnostics(getSupabaseAdminClient(), { deep });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Visibility diagnostics failed.';
    const status = message === 'Forbidden.'
      ? 403
      : message === 'Authentication required.' || message === 'Invalid or expired session.'
        ? 401
        : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
