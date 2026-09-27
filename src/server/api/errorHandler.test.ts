import { describe, it, expect } from 'vitest';
import { handleApiError, isAuthError } from '@/server/api/errorHandler';

describe('errorHandler', () => {
  it('returns 401 for auth errors', () => {
    const res = handleApiError(new Error('Forbidden.'));
    expect(res.status).toBe(401);
  });

  it('returns 401 for authentication required', () => {
    const res = handleApiError(new Error('Authentication required.'));
    expect(res.status).toBe(401);
  });

  it('returns 500 for unknown errors', () => {
    const res = handleApiError(new Error('Database connection failed'));
    expect(res.status).toBe(500);
  });

  it('detects auth errors correctly', () => {
    expect(isAuthError(new Error('Forbidden.'))).toBe(true);
    expect(isAuthError(new Error('Some other error'))).toBe(false);
  });
});
