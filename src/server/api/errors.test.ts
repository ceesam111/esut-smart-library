import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, normalizeError, publicErrorMessage } from './errors';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('API error normalization', () => {
  it('maps forbidden errors to safe API errors', () => {
    const error = normalizeError(new Error('Forbidden.'));
    expect(error.code).toBe('FORBIDDEN');
    expect(error.status).toBe(403);
  });

  it('hides production stack/internal messages for 500s', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(publicErrorMessage(new ApiError('INTERNAL_ERROR', 'database stack detail', 500))).toBe('Internal server error.');
  });
});
