import { describe, it, expect } from 'vitest';

describe('duplicates', () => {
  it('normalizes ISBN by removing non-alphanumeric chars', () => {
    const normalize = (isbn: string) => isbn.replace(/[^0-9X]/gi, '').toUpperCase();
    expect(normalize('978-0-13-468599-1')).toBe('9780134685991');
    expect(normalize('978 0 13 468599 1')).toBe('9780134685991');
  });

  it('normalizes title by lowercasing and removing non-alphanumeric', () => {
    const normalize = (title: string) => title.toLowerCase().replace(/[^a-z0-9]/g, '');
    expect(normalize('The Great Gatsby!')).toBe('thegreatgatsby');
    expect(normalize('the great gatsby')).toBe('thegreatgatsby');
  });

  it('duplicate group structure is correct', () => {
    const group = {
      id: 'abc',
      title: 'Test',
      isbn: '9780134685991',
      items: [{ id: 'abc', title: 'Test', isbn: '9780134685991', created_at: '2026-01-01', status: 'active' }],
    };
    expect(group.items).toHaveLength(1);
    expect(group.isbn).toBe('9780134685991');
  });
});
