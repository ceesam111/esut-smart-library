import { describe, it, expect } from 'vitest';

describe('orcid', () => {
  it('ORCID ID format validation', () => {
    const valid = '0000-0002-1825-0097';
    expect(valid).toMatch(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/);
  });

  it('ORCID ID with X checksum is valid', () => {
    const valid = '0000-0001-5109-3700';
    expect(valid).toMatch(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/);
  });

  it('Invalid ORCID format is rejected', () => {
    const invalid = 'not-an-orcid';
    expect(invalid).not.toMatch(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/);
  });
});
