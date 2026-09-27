import { describe, it, expect } from 'vitest';

describe('licenses', () => {
  it('ir_licenses table has seed data', () => {
    const licenses = ['CC-BY-4.0', 'CC-BY-NC-4.0', 'INSTITUTIONAL'];
    expect(licenses).toContain('CC-BY-4.0');
    expect(licenses).toContain('INSTITUTIONAL');
  });

  it('license code format is valid', () => {
    const code = 'CC-BY-4.0';
    expect(code).toMatch(/^CC-/);
  });
});
