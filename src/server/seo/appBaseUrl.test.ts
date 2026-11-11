import { afterEach, describe, expect, it, vi } from 'vitest';
import { FALLBACK_BASE, appBaseUrl } from './scholarlyMetadata';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('appBaseUrl', () => {
  it('uses APP_BASE_URL when it is a https URL', () => {
    vi.stubEnv('APP_BASE_URL', 'https://staging.example.edu.ng/');
    expect(appBaseUrl()).toBe('https://staging.example.edu.ng');
  });

  it('keeps a loopback base outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('APP_BASE_URL', 'http://localhost:3000');
    expect(appBaseUrl()).toBe('http://localhost:3000');
  });

  it('rejects a loopback base in production and falls back to the canonical domain', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_BASE_URL', 'http://localhost:3000');
    expect(appBaseUrl()).toBe(FALLBACK_BASE);
  });

  it('rejects a loopback base with a port in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_BASE_URL', 'http://127.0.0.1:3000/');
    expect(appBaseUrl()).toBe(FALLBACK_BASE);
  });

  it('falls back to the canonical domain when APP_BASE_URL is unset', () => {
    vi.stubEnv('APP_BASE_URL', '');
    expect(appBaseUrl()).toBe(FALLBACK_BASE);
  });

  it('never trusts the build-time inlined NEXT_PUBLIC_APP_BASE_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_BASE_URL', 'http://localhost:3000');
    vi.stubEnv('APP_BASE_URL', '');
    expect(appBaseUrl()).toBe(FALLBACK_BASE);
  });

  it('strips trailing slashes from a configured base', () => {
    vi.stubEnv('APP_BASE_URL', 'https://staging.example.edu.ng///');
    expect(appBaseUrl()).toBe('https://staging.example.edu.ng');
  });
});
