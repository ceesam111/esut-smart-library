export type RegistrationAccessPolicy =
  | 'direct_access'
  | 'email_verification'
  | 'email_verification_with_branch_approval';

export const REGISTRATION_POLICY_KEY = 'registration_access_policy';

export const DEFAULT_REGISTRATION_POLICY: RegistrationAccessPolicy = 'email_verification_with_branch_approval';

export const REGISTRATION_POLICY_LABELS: Record<RegistrationAccessPolicy, string> = {
  direct_access: 'Direct access after registration',
  email_verification: 'Email verification required',
  email_verification_with_branch_approval: 'Email verification plus branch approval',
};

export function parseRegistrationPolicy(value: unknown): RegistrationAccessPolicy {
  if (value === 'direct_access' || value === 'email_verification' || value === 'email_verification_with_branch_approval') return value;
  if (value && typeof value === 'object' && 'mode' in value) return parseRegistrationPolicy((value as { mode?: unknown }).mode);
  return DEFAULT_REGISTRATION_POLICY;
}

export function policyRequiresEmailVerification(policy: RegistrationAccessPolicy) {
  return policy === 'email_verification' || policy === 'email_verification_with_branch_approval';
}

export function policyRequiresBranchApproval(policy: RegistrationAccessPolicy) {
  return policy === 'email_verification_with_branch_approval';
}

export function isPrivilegedSelfRegistrationRole(role: string | null | undefined) {
  return role === 'super_admin' || role === 'librarian' || role === 'faculty_librarian';
}
