import { describe, it, expect } from 'vitest';
import { computeChecksum } from '@/server/preservation/checksum';

describe('checksum', () => {
  it('computes SHA-256 checksum', () => {
    const result = computeChecksum(Buffer.from('hello world'));
    expect(result).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });

  it('produces different checksums for different content', () => {
    const a = computeChecksum(Buffer.from('abc'));
    const b = computeChecksum(Buffer.from('def'));
    expect(a).not.toBe(b);
  });

  it('produces same checksum for same content', () => {
    const a = computeChecksum(Buffer.from('test'));
    const b = computeChecksum(Buffer.from('test'));
    expect(a).toBe(b);
  });
});
