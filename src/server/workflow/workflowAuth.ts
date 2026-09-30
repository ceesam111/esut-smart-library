/**
 * Workflow authorization rules.
 *
 * Pure functions with no I/O so they can be unit tested directly. Every
 * workflow API route resolves the actor's roles (see `getUserRoles`) and
 * passes them through these checks before touching the workflow service.
 */

export type ActorRoles = readonly string[];

/** Roles allowed to review, return, reject or claim repository work. */
export const WORKFLOW_REVIEWER_ROLES: readonly string[] = [
  'super_admin',
  'librarian',
  'faculty_librarian',
  'catalog_admin',
  'ir_admin',
  'dept_ir_officer',
  'admin',
];

/** Roles allowed to publish, withdraw or reassign other people's work. */
export const WORKFLOW_MANAGER_ROLES: readonly string[] = [
  'super_admin',
  'librarian',
  'catalog_admin',
  'ir_admin',
  'admin',
];

export type WorkflowAction =
  | 'submit'
  | 'resubmit'
  | 'approve'
  | 'reject'
  | 'return_for_correction'
  | 'request_changes'
  | 'withdraw'
  | 'publish'
  | 'claim'
  | 'unclaim'
  | 'assign'
  | 'reassign';

const SUBMITTER_ONLY: readonly WorkflowAction[] = ['submit', 'resubmit'];
const REVIEWER_ACTIONS: readonly WorkflowAction[] = [
  'approve',
  'reject',
  'return_for_correction',
  'request_changes',
  'claim',
  'unclaim',
];
const MANAGER_ACTIONS: readonly WorkflowAction[] = ['assign', 'reassign', 'publish'];

export interface ActionContext {
  /** true when the actor created the workflow instance */
  isCreator: boolean;
  /** true when the actor currently holds the task being acted on */
  isTaskHolder?: boolean;
}

export interface AuthDecision {
  allowed: boolean;
  reason?: string;
}

function hasAny(roles: ActorRoles, allowed: readonly string[]): boolean {
  return roles.some((role) => allowed.includes(role));
}

export function isWorkflowReviewer(roles: ActorRoles): boolean {
  return hasAny(roles, WORKFLOW_REVIEWER_ROLES);
}

export function isWorkflowManager(roles: ActorRoles): boolean {
  return hasAny(roles, WORKFLOW_MANAGER_ROLES);
}

export function canPerformAction(
  action: WorkflowAction,
  roles: ActorRoles,
  ctx: ActionContext,
): AuthDecision {
  if (roles.length === 0) return { allowed: false, reason: 'No roles resolved for actor.' };

  if (MANAGER_ACTIONS.includes(action)) {
    if (isWorkflowManager(roles)) return { allowed: true };
    if (action === 'publish') return { allowed: false, reason: 'Only library managers may publish.' };
    return { allowed: false, reason: 'Only library managers may reassign review tasks.' };
  }

  if (action === 'withdraw') {
    if (isWorkflowManager(roles)) return { allowed: true };
    if (ctx.isCreator) return { allowed: true };
    return { allowed: false, reason: 'Only the submitter or a library manager may withdraw.' };
  }

  if (SUBMITTER_ONLY.includes(action)) {
    if (ctx.isCreator) return { allowed: true };
    return { allowed: false, reason: 'Only the submitter may submit or resubmit this item.' };
  }

  if (REVIEWER_ACTIONS.includes(action)) {
    if (isWorkflowReviewer(roles)) return { allowed: true };
    return { allowed: false, reason: 'Reviewer role required for this action.' };
  }

  return { allowed: false, reason: 'Unknown workflow action.' };
}

/** Internal reviewer notes must never be returned to a submitter. */
export function canViewPrivateComments(roles: ActorRoles): boolean {
  return isWorkflowReviewer(roles) || isWorkflowManager(roles);
}

export function canManageTasks(roles: ActorRoles): boolean {
  return isWorkflowReviewer(roles);
}

export function canReassignTasks(roles: ActorRoles): boolean {
  return isWorkflowManager(roles);
}

/** Anyone with an account may start a submission workflow. */
export function canCreateWorkflow(roles: ActorRoles): boolean {
  return roles.length > 0 && !roles.every((role) => role === 'guest');
}

/**
 * Reviewers and managers may see every instance; other actors only ever get
 * the instances they created (the service applies that filter).
 */
export function canListAllInstances(roles: ActorRoles): boolean {
  return isWorkflowReviewer(roles) || isWorkflowManager(roles);
}
