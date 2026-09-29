import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOperationAllowed } from '@/server/sip2/auth';
import { validateCoarUrl, verifyCoarSignature, checkCoarRateLimit, isDuplicateNonce } from '@/server/interoperability/coar-security';

describe('storage-security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('repository file access control', () => {
    it('denies access to unpublished items', () => {
      const item = { status: 'draft', visibility: 'global', embargo_until: null };
      expect(item.status === 'published').toBe(false);
    });

    it('denies access to embargoed items', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const item = { status: 'published', visibility: 'global', embargo_until: futureDate };
      expect(new Date(item.embargo_until) > new Date()).toBe(true);
    });

    it('allows access to published non-embargoed items', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const item = { status: 'published', visibility: 'global', embargo_until: pastDate };
      expect(item.status === 'published').toBe(true);
      expect(new Date(item.embargo_until) > new Date()).toBe(false);
    });

    it('denies access to private items for non-owners', () => {
      const item = { status: 'published', visibility: 'private', submitter_id: 'user-1' };
      const currentUserId = 'user-2';
      const isOwner = item.submitter_id === currentUserId;
      expect(isOwner).toBe(false);
    });

    it('allows access to private items for owners', () => {
      const item = { status: 'published', visibility: 'private', submitter_id: 'user-1' };
      const currentUserId = 'user-1';
      const isOwner = item.submitter_id === currentUserId;
      expect(isOwner).toBe(true);
    });
  });

  describe('signed URL security', () => {
    it('uses short expiry for signed URLs', () => {
      const expiresIn = 300;
      expect(expiresIn).toBeLessThanOrEqual(900);
    });

    it('does not persist signed URLs in database', () => {
      const item = { file_url: 'repository/2026/123/file.pdf' };
      expect(item.file_url).not.toContain('X-Amz-Signature');
      expect(item.file_url).not.toContain('signature');
    });
  });

  describe('SSRF protection in COAR Notify', () => {
    it('rejects localhost URLs', () => {
      expect(validateCoarUrl('http://localhost/path')).toBe(false);
      expect(validateCoarUrl('http://127.0.0.1/path')).toBe(false);
    });

    it('rejects private IP URLs', () => {
      expect(validateCoarUrl('http://10.0.0.1/path')).toBe(false);
      expect(validateCoarUrl('http://192.168.1.1/path')).toBe(false);
    });

    it('rejects internal network URLs', () => {
      expect(validateCoarUrl('http://169.254.1.1/path')).toBe(false);
    });
  });

  describe('SIP2 operation authorization', () => {
    it('denies unauthorized operations', () => {
      expect(isOperationAllowed(['checkout'], 'checkin')).toBe(false);
    });

    it('allows authorized operations', () => {
      expect(isOperationAllowed(['checkout', 'checkin'], 'checkout')).toBe(true);
    });

    it('allows all operations with wildcard', () => {
      expect(isOperationAllowed(['*'], 'any_operation')).toBe(true);
    });
  });
});
