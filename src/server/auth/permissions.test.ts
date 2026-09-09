import { describe, expect, it } from 'vitest';
import {
  canReadApprovalItem,
  canReadAuditLogs,
  canReadTenantScopedRow,
} from './permissions';

describe('foundation permission helpers', () => {
  it('restricts patron approval items to global admins', () => {
    expect(canReadApprovalItem(['faculty_librarian'], 'patron_import')).toBe(false);
    expect(canReadApprovalItem(['admin_staff'], 'patron')).toBe(false);
    expect(canReadApprovalItem(['librarian'], 'patron_enrolment')).toBe(true);
    expect(canReadApprovalItem(['super_admin'], 'patron')).toBe(true);
  });

  it('allows library admins to read non-patron approval items', () => {
    expect(canReadApprovalItem(['faculty_librarian'], 'catalogue')).toBe(true);
    expect(canReadApprovalItem(['student'], 'catalogue')).toBe(false);
  });

  it('restricts audit logs to global admins', () => {
    expect(canReadAuditLogs(['super_admin'])).toBe(true);
    expect(canReadAuditLogs(['librarian'])).toBe(true);
    expect(canReadAuditLogs(['faculty_librarian'])).toBe(false);
  });

  it('enforces tenant scoped row visibility', () => {
    expect(canReadTenantScopedRow('tenant-a', 'tenant-a')).toBe(true);
    expect(canReadTenantScopedRow('tenant-a', 'tenant-b')).toBe(false);
    expect(canReadTenantScopedRow('tenant-a', null)).toBe(false);
    expect(canReadTenantScopedRow('tenant-a', null, true)).toBe(true);
  });
});
