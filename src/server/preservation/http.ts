import { NextResponse } from 'next/server';

export function preservationErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  if (message === 'Authentication required.' || message === 'Invalid or expired session.') {
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }
  if (message === 'Forbidden.') {
    return NextResponse.json({ success: false, error: message }, { status: 403 });
  }
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}
