import { afterEach, describe, expect, it } from 'vitest';
import { loadWorkerConfig } from './config';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('worker config', () => {
  it('loads Supabase and worker settings from env', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    process.env.WORKER_ID = 'worker-a';
    process.env.WORKER_CONCURRENCY = '4';
    const config = loadWorkerConfig();
    expect(config.supabaseUrl).toBe('https://example.supabase.co');
    expect(config.workerId).toBe('worker-a');
    expect(config.concurrency).toBe(4);
  });
});
