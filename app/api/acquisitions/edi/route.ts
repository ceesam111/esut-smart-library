import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { generateEdi850Async } from '@/server/acquisitions/edi';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const poId = new URL(request.url).searchParams.get('po_id');
    if (!poId) return NextResponse.json({ success: false, error: 'po_id required' }, { status: 400 });
    const edi = await generateEdi850Async(poId);
    return new NextResponse(edi, { headers: { 'Content-Type': 'application/edi-x12', 'Content-Disposition': `attachment; filename="po_${poId}.edi"` } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
