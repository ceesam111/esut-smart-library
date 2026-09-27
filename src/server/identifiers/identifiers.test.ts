import { describe, it, expect } from 'vitest';
import { LocalHandleProvider } from '@/server/identifiers/handle';
import { getIdentifierStatus } from '@/server/identifiers';

describe('identifiers', () => {
  it('local handle provider mints esutir/{year}/{id}', async () => {
    const provider = new LocalHandleProvider();
    expect(provider.isAvailable()).toBe(true);
    const handle = await provider.mintHandle({ year: 2026 });
    expect(handle).toMatch(/^esutir\/2026\//);
  });

  it('local handle provider generates unique ids', async () => {
    const provider = new LocalHandleProvider();
    const h1 = await provider.mintHandle({ year: 2026 });
    const h2 = await provider.mintHandle({ year: 2026 });
    expect(h1).not.toBe(h2);
  });

  it('identifier status reports handle provider always available', () => {
    const status = getIdentifierStatus();
    expect(status.handleProvider).toBe('local');
  });
});
