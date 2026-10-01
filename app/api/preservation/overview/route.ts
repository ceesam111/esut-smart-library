import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { getPreservationOverview } from '@/server/preservation/service';
import { preservationErrorResponse } from '@/server/preservation/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const overview = await getPreservationOverview();
    return NextResponse.json({ success: true, data: overview });
  } catch (error) {
    return preservationErrorResponse(error);
  }
}
