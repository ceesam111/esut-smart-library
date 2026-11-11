import { afterEach, describe, expect, it, vi } from 'vitest';
import robots from './robots';

afterEach(() => {
  vi.unstubAllEnvs();
});

function toList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

describe('robots', () => {
  it('points the sitemap at the canonical base when no runtime base is set', () => {
    vi.stubEnv('APP_BASE_URL', '');
    const result = robots();
    expect(result.sitemap).toBe('https://virtuallibrary.esut.edu.ng/sitemap.xml');
  });

  it('uses a configured runtime base', () => {
    vi.stubEnv('APP_BASE_URL', 'https://staging.example.edu.ng');
    const result = robots();
    expect(result.sitemap).toBe('https://staging.example.edu.ng/sitemap.xml');
  });

  it('never emits a loopback sitemap URL in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_BASE_URL', 'http://localhost:3000');
    const result = robots();
    expect(result.sitemap).toBe('https://virtuallibrary.esut.edu.ng/sitemap.xml');
  });

  it('keeps the admin and dashboard paths disallowed', () => {
    vi.stubEnv('APP_BASE_URL', '');
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const disallow = rules.flatMap((entry) => toList(entry.disallow));
    expect(disallow).toContain('/admin');
    expect(disallow).toContain('/dashboard');
  });
});
