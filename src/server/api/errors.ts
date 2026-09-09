export type ApiErrorCode = 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'RATE_LIMITED' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR';

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, message: string, public status = 500, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

export function normalizeError(error: unknown) {
  if (error instanceof ApiError) return error;
  if (error instanceof Error) {
    if (error.message === 'Forbidden.') return new ApiError('FORBIDDEN', 'Forbidden.', 403);
    if (/authorization|unauthorized|not authenticated/i.test(error.message)) return new ApiError('UNAUTHORIZED', 'Unauthorized.', 401);
    return new ApiError('INTERNAL_ERROR', error.message || 'Unexpected error', 500);
  }
  return new ApiError('INTERNAL_ERROR', 'Unexpected error', 500);
}

export function publicErrorMessage(error: ApiError) {
  if (process.env.NODE_ENV === 'production' && error.status >= 500) return 'Internal server error.';
  return error.message;
}
