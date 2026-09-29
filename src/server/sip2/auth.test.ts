import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hashSip2Password, isOperationAllowed, authenticateSip2Terminal } from '@/server/sip2/auth';

describe('sip2-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hashSip2Password', () => {
    it('produces consistent hashes', () => {
      const hash1 = hashSip2Password('test-password');
      const hash2 = hashSip2Password('test-password');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different passwords', () => {
      const hash1 = hashSip2Password('password1');
      const hash2 = hashSip2Password('password2');
      expect(hash1).not.toBe(hash2);
    });

    it('produces a 64-char hex string', () => {
      const hash = hashSip2Password('test');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('isOperationAllowed', () => {
    it('allows operation when explicitly listed', () => {
      expect(isOperationAllowed(['checkout', 'checkin'], 'checkout')).toBe(true);
    });

    it('allows all operations with wildcard', () => {
      expect(isOperationAllowed(['*'], 'checkout')).toBe(true);
      expect(isOperationAllowed(['*'], 'patron_info')).toBe(true);
    });

    it('denies operation not in list', () => {
      expect(isOperationAllowed(['checkout'], 'checkin')).toBe(false);
    });

    it('denies when list is empty', () => {
      expect(isOperationAllowed([], 'checkout')).toBe(false);
    });

    it('denies when list is undefined', () => {
      expect(isOperationAllowed(undefined, 'checkout')).toBe(false);
    });
  });

  describe('authenticateSip2Terminal', () => {
    it('rejects blank username', async () => {
      const result = await authenticateSip2Terminal('', 'password', 'ESUT', null);
      expect(result.success).toBe(false);
    });

    it('rejects blank password', async () => {
      const result = await authenticateSip2Terminal('user', '', 'ESUT', null);
      expect(result.success).toBe(false);
    });

    it('rejects blank credentials', async () => {
      const result = await authenticateSip2Terminal('', '', 'ESUT', null);
      expect(result.success).toBe(false);
    });
  });
});
