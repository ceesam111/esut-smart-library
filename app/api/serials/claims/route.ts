import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { createClaim, getClaims, updateClaimStatus, getPendingClaims } from '@/server/serials/claims';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const serialId = new URL(request.url).searchParams.get('serial_id');
    const pending = new URL(request.url).searchParams.get('pending');
    if (pending === 'true') {
      const claims = await getPendingClaims();
      return NextResponse.json({ success: true, data: claims });
    }
    if (!serialId) return NextResponse.json({ success: false, error: 'serial_id required' }, { status: 400 });
    const claims = await getClaims(serialId);
    return NextResponse.json({ success: true, data: claims });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const { serial_id, issue_number, volume, notes } = body as { serial_id?: string; issue_number?: string; volume?: string; notes?: string };
    if (!serial_id || !issue_number) return NextResponse.json({ success: false, error: 'serial_id and issue_number required' }, { status: 400 });
    const claim = await createClaim({ serial_id, issue_number, volume, notes });
    return NextResponse.json({ success: true, data: claim });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const { claim_id, status } = body as { claim_id?: string; status?: 'pending' | 'notified' | 'resolved' | 'cancelled' };
    if (!claim_id || !status) return NextResponse.json({ success: false, error: 'claim_id and status required' }, { status: 400 });
    await updateClaimStatus(claim_id, status);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
