import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { generateKbart, getSerialsForKbart } from '@/server/interoperability/kbart';
import { getRequestId } from '@/server/api/withHandler';
import { normalizeError } from '@/server/api/errors';
import { errorResponse } from '@/server/api/responses';
import { childLogger } from '@/server/logging/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const log = childLogger({ requestId, method: request.method, path: request.nextUrl.pathname });
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const serials = await getSerialsForKbart();
    const kbart = generateKbart(serials);
    log.http('kbart export completed', { status: 200, rowCount: serials.length });
    return new NextResponse(kbart, {
      headers: {
        'Content-Type': 'text/tab-separated-values; charset=utf-8',
        'Content-Disposition': 'attachment; filename="esut_serials_kbart.txt"',
        'x-request-id': requestId,
      },
    });
  } catch (error) {
    const apiError = normalizeError(error);
    log.error('kbart export failed', { status: apiError.status, code: apiError.code });
    return errorResponse(apiError, requestId);
  }
}
