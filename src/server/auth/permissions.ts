export type FoundationRole =
  | 'super_admin'
  | 'catalog_admin'
  | 'ir_admin'
  | 'dept_ir_officer'
  | 'librarian'
  | 'faculty_librarian'
  | 'admin'
  | 'student'
  | 'researcher_lecturer'
  | 'admin_staff'
  | 'guest';

/** Library operations: catalogue, staging, approvals, harvest, barcodes, storage, agents. */
export const LIBRARY_ADMIN_ROLES: FoundationRole[] = [
  'super_admin',
  'librarian',
  'faculty_librarian',
  'catalog_admin',
  'admin',
];

export const GLOBAL_ADMIN_ROLES: FoundationRole[] = ['super_admin', 'librarian', 'admin'];

export const ACCOUNT_MANAGER_ROLES: FoundationRole[] = ['super_admin', 'librarian', 'admin'];

/**
 * Roles that only a super administrator may grant or revoke. Library admins
 * (librarians) manage patron-facing roles but cannot create peer administrators.
 */
export const ADMIN_GRANT_ONLY_ROLES: FoundationRole[] = [
  'super_admin',
  'catalog_admin',
  'ir_admin',
  'dept_ir_officer',
];

/**
 * Roles that may only come from `user_roles` — never from `patrons.account_role`.
 * Must stay in sync with `privilegedRoles` in `src/hooks/useAuth.ts`.
 */
export const PRIVILEGED_ROLES: FoundationRole[] = [
  'super_admin',
  'catalog_admin',
  'ir_admin',
  'dept_ir_officer',
  'librarian',
  'faculty_librarian',
  'admin',
];

export const PATRON_APPROVAL_CONTENT_TYPES = ['patron', 'patron_import', 'patron_enrolment'];

export function hasAnyRole(userRoles: string[], required: string[]) {
  return userRoles.some((role) => required.includes(role));
}

export function canReadApprovalItem(userRoles: string[], contentType: string) {
  if (!hasAnyRole(userRoles, LIBRARY_ADMIN_ROLES)) return false;
  if (PATRON_APPROVAL_CONTENT_TYPES.includes(contentType)) {
    return hasAnyRole(userRoles, GLOBAL_ADMIN_ROLES);
  }
  return true;
}

export function canReadAuditLogs(userRoles: string[]) {
  return hasAnyRole(userRoles, GLOBAL_ADMIN_ROLES);
}

export function isPrivilegedRole(role: string | null | undefined) {
  return !!role && PRIVILEGED_ROLES.includes(role as FoundationRole);
}

export function canReadTenantScopedRow(userTenantId: string, rowTenantId: string | null | undefined, allowGlobal = false) {
  if (allowGlobal && !rowTenantId) return true;
  return !!rowTenantId && rowTenantId === userTenantId;
}
