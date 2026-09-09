import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe('browser Supabase env helper', () => {
  it('uses only browser-safe public Supabase variables', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = '';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = '';
    process.env.VITE_SUPABASE_URL = '';
    process.env.VITE_SUPABASE_ANON_KEY = '';
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = '';
    process.env.SUPABASE_URL = 'https://server-only.example.test';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'server-only-publishable-alias';

    const env = await import('./env');

    expect(env.SUPABASE_URL).toBe('');
    expect(env.SUPABASE_PUBLISHABLE_KEY).toBe('');
  });

  it('keeps legacy Vite public aliases for older client code paths', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = '';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = '';
    process.env.VITE_SUPABASE_URL = 'https://public-vite.example.test';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = '';

    const env = await import('./env');

    expect(env.SUPABASE_URL).toBe('https://public-vite.example.test');
    expect(env.SUPABASE_PUBLISHABLE_KEY).toBe('anon-key');
  });
});
