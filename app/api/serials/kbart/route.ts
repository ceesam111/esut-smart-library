import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { generateKbart, getSerialsForKbart } from '@/server/interoperability/kbart';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireRole(new Request('http://localhost'), LIBRARY_ADMIN_ROLES);
    const serials = await getSerialsForKbart();
    const kbart = generateKbart(serials);
    return new NextResponse(kbart, {
      headers: {
        'Content-Type': 'text/tab-separated-values',
        'Content-Disposition': 'attachment; filename="esut_serials_kbart.txt"',
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
