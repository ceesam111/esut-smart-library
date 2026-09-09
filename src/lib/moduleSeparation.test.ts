import { describe, expect, it } from 'vitest';
import { isIrType, makeRepositoryHandle } from './moduleSeparation';

describe('module separation', () => {
  it('recognises IR material types', () => {
    expect(isIrType('Thesis')).toBe(true);
    expect(isIrType('Conference Paper')).toBe(true);
    expect(isIrType('Book')).toBe(false);
  });

  it('generates stable repository handles', () => {
    expect(makeRepositoryHandle(2026, 'abc-123')).toBe('esutir/2026/abc-123');
  });
});
