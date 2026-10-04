import { NextResponse } from 'next/server';

/**
 * Maps auth/service errors thrown by requireUser/requireRole to proper HTTP
 * status codes so security checks return 401/403 instead of 500.
 */
export function routeError(error: unknown): NextResponse {
  if (error instanceof Error) {
    if (error.message === 'Forbidden.' || error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    if (
      error.message === 'Authentication required.' ||
      error.message === 'Authentication required' ||
      /Invalid or expired session/.test(error.message)
    ) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
}
