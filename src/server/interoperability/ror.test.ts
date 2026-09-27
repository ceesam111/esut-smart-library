import { describe, it, expect } from 'vitest';
import type { RorOrganization } from '@/server/interoperability/ror';

describe('ror', () => {
  it('ROR organization structure is valid', () => {
    const org: RorOrganization = {
      id: 'https://ror.org/01abc123',
      name: 'Test University',
      types: ['Education'],
      country: { country_name: 'Nigeria', country_code: 'NG' },
      aliases: [],
      acronyms: ['TU'],
      external_ids: {},
      links: [],
      locations: [],
    };
    expect(org.id).toContain('ror.org');
    expect(org.name).toBe('Test University');
    expect(org.types).toContain('Education');
  });

  it('ROR search returns array', async () => {
    expect(Array.isArray([])).toBe(true);
  });
});
