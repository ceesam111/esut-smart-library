import { NextResponse } from 'next/server';
import type { ApiError } from './errors';
import { publicErrorMessage } from './errors';

export function successResponse(data: unknown, requestId: string, status = 200) {
  return NextResponse.json({ success: true, data, requestId }, { status, headers: { 'x-request-id': requestId } });
}

export function errorResponse(error: ApiError, requestId: string) {
  return NextResponse.json({ success: false, error: { code: error.code, message: publicErrorMessage(error), requestId } }, { status: error.status, headers: { 'x-request-id': requestId } });
}
