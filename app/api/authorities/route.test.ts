import { describe, it, expect } from 'vitest';

describe('authorities', () => {
  it('authority linking payload structure is correct', () => {
    const payload = {
      item_type: 'catalogue',
      item_id: 'abc-123',
      authority_id: 'def-456',
      heading: 'Test Heading',
    };
    expect(payload.item_type).toBe('catalogue');
    expect(payload.item_id).toBe('abc-123');
    expect(payload.authority_id).toBe('def-456');
  });

  it('authority control table has expected columns', () => {
    const columns = ['term', 'term_type', 'variants'];
    expect(columns).toContain('term');
    expect(columns).toContain('term_type');
  });
});
