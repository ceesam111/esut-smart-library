import { NextResponse } from 'next/server';

export function handleApiError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Internal server error';

  if (message === 'Forbidden.' || message === 'Authentication required.' || message === 'Unauthorized') {
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }

  if (message === 'Not found') {
    return NextResponse.json({ success: false, error: message }, { status: 404 });
  }

  if (message === 'Bad request') {
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

export function isAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return message === 'Forbidden.' || message === 'Authentication required.' || message === 'Unauthorized';
}
