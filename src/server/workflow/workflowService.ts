import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { getUserRoles } from '@/server/auth/requireRole';
import {
  canCreateWorkflow,
  canListAllInstances,
  canManageTasks,
  canPerformAction,
  canReassignTasks,
  canViewPrivateComments,
  type ActorRoles,
  type WorkflowAction,
} from './workflowAuth';

export type { WorkflowAction };

export type TransitionErrorCode =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'TERMINAL'
  | 'FORBIDDEN'
  | 'INVALID_TRANSITION'
  | 'INVALID_ACTION'
  | 'CONFLICT'
  | 'INTERNAL';

export interface WorkflowTransitionResult {
  success: boolean;
  newState?: string;
  error?: string;
  code?: TransitionErrorCode;
}

export interface WorkflowComment {
  id: string;
  workflow_instance_id: string;
  author_id: string;
  body: string;
  is_private: boolean;
  created_at: string;
}

export interface TransitionOptions {
  comment?: string;
  assignTo?: string;
  actorRoles?: ActorRoles;
  repositoryItemId?: string;
  thesisId?: string;
}

const CHAIN = [
  'DRAFT',
  'SUBMITTED',
  'SUPERVISOR_REVIEW',
  'DEPARTMENT_REVIEW',
  'FACULTY_REVIEW',
  'LIBRARY_METADATA_REVIEW',
  'COPYRIGHT_REVIEW',
  'FINAL_APPROVAL',
  'PUBLISHED',
];

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['SUPERVISOR_REVIEW', 'REJECTED', 'RETURNED'],
  SUPERVISOR_REVIEW: ['DEPARTMENT_REVIEW', 'RETURNED', 'REJECTED'],
  DEPARTMENT_REVIEW: ['FACULTY_REVIEW', 'RETURNED', 'REJECTED'],
  FACULTY_REVIEW: ['LIBRARY_METADATA_REVIEW', 'RETURNED', 'REJECTED'],
  LIBRARY_METADATA_REVIEW: ['COPYRIGHT_REVIEW', 'RETURNED', 'REJECTED'],
  COPYRIGHT_REVIEW: ['FINAL_APPROVAL', 'RETURNED', 'REJECTED'],
  FINAL_APPROVAL: ['PUBLISHED', 'REJECTED', 'WITHDRAWN'],
  RETURNED: ['SUBMITTED', 'REJECTED'],
  REJECTED: [],
  PUBLISHED: ['WITHDRAWN'],
  WITHDRAWN: [],
};

/** No outgoing transitions are allowed from these states. */
const TERMINAL_STATES = ['REJECTED', 'WITHDRAWN'];

/** An instance in one of these statuses is closed and cannot be transitioned. */
const BLOCKED_INSTANCE_STATUSES = ['rejected', 'withdrawn'];

/** Non state-changing actions are handled by the task endpoints. */
const STATE_ACTIONS: WorkflowAction[] = [
  'submit',
  'resubmit',
  'approve',
  'reject',
  'return_for_correction',
  'request_changes',
  'withdraw',
  'publish',
];

const THESIS_STATE_TO_STATUS: Record<string, string> = {
  SUBMITTED: 'submitted',
  SUPERVISOR_REVIEW: 'supervisor_review',
  DEPARTMENT_REVIEW: 'committee_review',
  FACULTY_REVIEW: 'committee_review',
  LIBRARY_METADATA_REVIEW: 'committee_review',
  COPYRIGHT_REVIEW: 'committee_review',
  FINAL_APPROVAL: 'committee_review',
  RETURNED: 'returned_to_student',
  REJECTED: 'rejected',
  PUBLISHED: 'published',
  WITHDRAWN: 'withdrawn',
};

function statusForState(state: string): string {
  if (state === 'PUBLISHED') return 'completed';
  if (state === 'REJECTED') return 'rejected';
  if (state === 'WITHDRAWN') return 'withdrawn';
  return 'active';
}

function nextStateFor(action: WorkflowAction, currentState: string): { next?: string; error?: string } {
  switch (action) {
    case 'submit':
    case 'resubmit':
      return { next: 'SUBMITTED' };
    case 'reject':
      return { next: 'REJECTED' };
    case 'return_for_correction':
    case 'request_changes':
      return { next: 'RETURNED' };
    case 'withdraw':
      return { next: 'WITHDRAWN' };
    case 'publish':
      return { next: 'PUBLISHED' };
    case 'approve': {
      if (currentState === 'DRAFT' || currentState === 'RETURNED') {
        return { error: 'Item must be submitted before it can be approved.' };
      }
      const idx = CHAIN.indexOf(currentState);
      if (idx < 0 || idx >= CHAIN.length - 1) {
        return { error: `No further approval step from ${currentState}.` };
      }
      return { next: CHAIN[idx + 1] };
    }
    default:
      return { error: `${action} is not a state transition.` };
  }
}

async function notify(
  userIds: Array<string | null | undefined>,
  message: { title: string; body: string; url?: string },
  excludeUserId?: string,
) {
  const supabase = getSupabaseAdminClient();
  const unique = [...new Set(userIds.filter((id): id is string => !!id))].filter((id) => id !== excludeUserId);
  for (const userId of unique) {
    try {
      await supabase.from('user_notifications').insert({
        user_id: userId,
        title: message.title,
        body: message.body,
        url: message.url ?? '/dashboard/workflows',
        type: 'system',
        is_read: false,
      });
    } catch {
      // Notification delivery must never fail a transition.
    }
  }
}

async function syncThesisState(
  thesisId: string,
  state: string,
  actorId: string,
  action: WorkflowAction,
  comment?: string,
) {
  const supabase = getSupabaseAdminClient();
  const thesisStatus = THESIS_STATE_TO_STATUS[state];
  if (!thesisStatus) return;

  const patch: Record<string, unknown> = { status: thesisStatus, updated_at: new Date().toISOString() };
  if (state === 'RETURNED' && comment) patch.revision_notes = comment;

  const { error } = await supabase.from('theses').update(patch).eq('id', thesisId);
  if (error) throw new Error(error.message);

  await supabase.from('thesis_workflow').insert({
    thesis_id: thesisId,
    stage: thesisStatus,
    action,
    acted_by: actorId,
    notes: comment || null,
  });
}

async function syncRepositoryState(itemId: string, state: string) {
  const status = state === 'PUBLISHED' ? 'published' : state === 'WITHDRAWN' ? 'withdrawn' : null;
  if (!status) return;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('repository_items')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', itemId);
  if (error) throw new Error(error.message);
}

/** States where a reviewer still has to pick the submission up. */
const REVIEW_STATES = [
  'SUBMITTED',
  'SUPERVISOR_REVIEW',
  'DEPARTMENT_REVIEW',
  'FACULTY_REVIEW',
  'LIBRARY_METADATA_REVIEW',
  'COPYRIGHT_REVIEW',
  'FINAL_APPROVAL',
];

/**
 * Keeps one open reviewer task per instance.
 *
 * A review state must always have exactly one pending/claimed task so the
 * reviewer queue, claim/unclaim and reassignment have something to act on;
 * closing a state (returned, rejected, withdrawn, published) completes any
 * task still open. Both operations are idempotent, so replays are harmless.
 */
async function syncTasksForState(
  instanceId: string,
  definitionId: string | null | undefined,
  state: string,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!REVIEW_STATES.includes(state)) {
    const { error } = await supabase
      .from('workflow_tasks')
      .update({ status: 'completed', completed_at: now, updated_at: now })
      .eq('workflow_instance_id', instanceId)
      .in('status', ['pending', 'claimed']);
    if (error) throw new Error(error.message);
    return;
  }

  const { data: open, error: openError } = await supabase
    .from('workflow_tasks')
    .select('id')
    .eq('workflow_instance_id', instanceId)
    .in('status', ['pending', 'claimed'])
    .limit(1);
  if (openError) throw new Error(openError.message);
  if ((open ?? []).length > 0) return;

  const orderIndex = Math.max(CHAIN.indexOf(state), 0);
  let step: { id: string; required_role?: string } | null = null;
  if (definitionId) {
    const { data: steps, error: stepError } = await supabase
      .from('workflow_steps')
      .select('id, required_role')
      .eq('workflow_definition_id', definitionId)
      .order('order_index', { ascending: true });
    if (stepError) throw new Error(stepError.message);
    const list = steps ?? [];
    step = list[orderIndex] ?? list[list.length - 1] ?? null;
  }

  const { error } = await supabase.from('workflow_tasks').insert({
    workflow_instance_id: instanceId,
    workflow_step_id: step?.id ?? null,
    assigned_role: step?.required_role ?? null,
    assigned_to: null,
    claimed_by: null,
    status: 'pending',
  });
  if (error) throw new Error(error.message);
}

/**
 * Applies a state transition to a workflow instance.
 *
 * The commit point is a conditional UPDATE guarded by the state the actor
 * actually read. PostgREST runs that statement atomically, so exactly one of
 * two concurrent transitions can match the row; the loser receives CONFLICT
 * instead of silently overwriting the winner. History is written only after
 * the state has moved, and is rolled back if that write fails.
 */
export async function transitionWorkflow(
  instanceId: string,
  action: WorkflowAction,
  actorId: string,
  options: TransitionOptions = {},
): Promise<WorkflowTransitionResult> {
  const supabase = getSupabaseAdminClient();

  const { data: instance, error } = await supabase
    .from('workflow_instances')
    .select('*')
    .eq('id', instanceId)
    .maybeSingle();

  if (error || !instance) return { success: false, code: 'NOT_FOUND', error: 'Workflow instance not found.' };
  if (BLOCKED_INSTANCE_STATUSES.includes(instance.status)) {
    return { success: false, code: 'INACTIVE', error: 'Workflow is no longer active.' };
  }
  if (TERMINAL_STATES.includes(instance.current_state)) {
    return { success: false, code: 'TERMINAL', error: 'Workflow is in a terminal state.' };
  }
  if (!STATE_ACTIONS.includes(action)) {
    return { success: false, code: 'INVALID_ACTION', error: `${action} is handled by the task endpoints.` };
  }

  const roles: ActorRoles = options.actorRoles ?? (await getUserRoles(actorId));
  const decision = canPerformAction(action, roles, { isCreator: instance.created_by === actorId });
  if (!decision.allowed) {
    return { success: false, code: 'FORBIDDEN', error: decision.reason ?? 'Not permitted.' };
  }

  const currentState: string = instance.current_state;
  const { next, error: shapeError } = nextStateFor(action, currentState);
  if (!next) return { success: false, code: 'INVALID_ACTION', error: shapeError ?? 'Invalid action.' };

  const allowedNext = VALID_TRANSITIONS[currentState] || [];
  if (!allowedNext.includes(next)) {
    return {
      success: false,
      code: 'INVALID_TRANSITION',
      error: `Cannot transition from ${currentState} to ${next}.`,
    };
  }

  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from('workflow_instances')
    .update({ current_state: next, status: statusForState(next), updated_at: now })
    .eq('id', instanceId)
    .eq('current_state', currentState)
    .select('id');

  if (updateError) return { success: false, code: 'INTERNAL', error: updateError.message };
  if (!updated || updated.length === 0) {
    return {
      success: false,
      code: 'CONFLICT',
      error: 'Workflow changed while your action was in flight. Reload and try again.',
    };
  }

  const { error: actionError } = await supabase.from('workflow_actions').insert({
    workflow_instance_id: instanceId,
    action,
    actor_id: actorId,
    previous_state: currentState,
    new_state: next,
    comment: options.comment || null,
  });

  if (actionError) {
    await supabase
      .from('workflow_instances')
      .update({ current_state: currentState, status: instance.status, updated_at: now })
      .eq('id', instanceId)
      .eq('current_state', next)
      .select('id');
    return { success: false, code: 'INTERNAL', error: actionError.message };
  }

  try {
    if (options.assignTo) {
      await supabase
        .from('workflow_tasks')
        .update({ assigned_to: options.assignTo, updated_at: now })
        .eq('workflow_instance_id', instanceId)
        .eq('status', 'pending');
    }

    const repositoryItemId = options.repositoryItemId ?? instance.repository_item_id;
    const thesisId = options.thesisId ?? instance.thesis_id;

    if (repositoryItemId) await syncRepositoryState(repositoryItemId, next);
    if (thesisId) await syncThesisState(thesisId, next, actorId, action, options.comment);
    await syncTasksForState(instanceId, instance.workflow_definition_id, next);

    if (options.comment) {
      await supabase.from('workflow_comments').insert({
        workflow_instance_id: instanceId,
        author_id: actorId,
        body: options.comment,
        is_private: false,
      });
    }
  } catch (sideEffectError) {
    return {
      success: false,
      code: 'INTERNAL',
      error:
        sideEffectError instanceof Error
          ? `State advanced to ${next} but a follow-up update failed: ${sideEffectError.message}`
          : `State advanced to ${next} but a follow-up update failed.`,
    };
  }

  const { data: taskRows } = await supabase
    .from('workflow_tasks')
    .select('assigned_to')
    .eq('workflow_instance_id', instanceId);
  const assignees = (taskRows ?? []).map((row: { assigned_to: string | null }) => row.assigned_to);

  await notify(
    [instance.created_by, ...assignees],
    {
      title: `Submission ${next.replace(/_/g, ' ').toLowerCase()}`,
      body: options.comment || `Your submission moved to ${next.replace(/_/g, ' ')}.`,
      url: `/dashboard/workflows/${instanceId}`,
    },
    actorId,
  );

  return { success: true, newState: next };
}

export async function getWorkflowTask(taskId: string): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('workflow_tasks').select('*').eq('id', taskId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function claimTask(taskId: string, userId: string, actorRoles?: ActorRoles): Promise<WorkflowTransitionResult> {
  const supabase = getSupabaseAdminClient();
  const roles: ActorRoles = actorRoles ?? (await getUserRoles(userId));
  if (!canManageTasks(roles)) return { success: false, code: 'FORBIDDEN', error: 'Reviewer role required.' };

  const { data: task, error } = await supabase
    .from('workflow_tasks')
    .select('*')
    .eq('id', taskId)
    .maybeSingle();

  if (error || !task) return { success: false, code: 'NOT_FOUND', error: 'Task not found.' };
  if (task.status !== 'pending') return { success: false, code: 'CONFLICT', error: 'Task is no longer available.' };

  const { data: claimed, error: updateError } = await supabase
    .from('workflow_tasks')
    .update({
      status: 'claimed',
      claimed_by: userId,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .eq('status', 'pending')
    .select('id');

  if (updateError) return { success: false, code: 'INTERNAL', error: updateError.message };
  if (!claimed || claimed.length === 0) {
    return { success: false, code: 'CONFLICT', error: 'Task was claimed by someone else first.' };
  }

  return { success: true };
}

export async function unclaimTask(taskId: string, userId: string, actorRoles?: ActorRoles): Promise<WorkflowTransitionResult> {
  const supabase = getSupabaseAdminClient();
  const roles: ActorRoles = actorRoles ?? (await getUserRoles(userId));
  if (!canManageTasks(roles)) return { success: false, code: 'FORBIDDEN', error: 'Reviewer role required.' };

  const { data: released, error } = await supabase
    .from('workflow_tasks')
    .update({ status: 'pending', claimed_by: null, claimed_at: null, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('claimed_by', userId)
    .eq('status', 'claimed')
    .select('id');

  if (error) return { success: false, code: 'INTERNAL', error: error.message };
  if (!released || released.length === 0) {
    return { success: false, code: 'CONFLICT', error: 'You are not the holder of this task.' };
  }
  return { success: true };
}

export async function reassignTask(
  taskId: string,
  fromUserId: string,
  toUserId: string,
  actorRoles?: ActorRoles,
): Promise<WorkflowTransitionResult> {
  const supabase = getSupabaseAdminClient();
  const roles: ActorRoles = actorRoles ?? (await getUserRoles(fromUserId));
  if (!canReassignTasks(roles)) return { success: false, code: 'FORBIDDEN', error: 'Library manager role required.' };

  const { data: reassigned, error } = await supabase
    .from('workflow_tasks')
    .update({ assigned_to: toUserId, claimed_by: null, claimed_at: null, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('assigned_to', fromUserId)
    .select('id');

  if (error) return { success: false, code: 'INTERNAL', error: error.message };
  if (!reassigned || reassigned.length === 0) {
    return { success: false, code: 'CONFLICT', error: 'Task is not assigned to you.' };
  }

  await notify([toUserId], {
    title: 'Review task reassigned to you',
    body: 'A repository review task has been reassigned to you.',
    url: '/admin/workflows',
  });

  return { success: true };
}

export async function addWorkflowComment(
  instanceId: string,
  authorId: string,
  body: string,
  isPrivate: boolean,
  actorRoles?: ActorRoles,
): Promise<WorkflowComment> {
  const roles: ActorRoles = actorRoles ?? (await getUserRoles(authorId));
  if (isPrivate && !canViewPrivateComments(roles)) {
    throw new Error('Internal notes can only be written by library staff.');
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('workflow_comments')
    .insert({ workflow_instance_id: instanceId, author_id: authorId, body, is_private: isPrivate })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getWorkflowHistory(instanceId: string): Promise<Array<Record<string, unknown>>> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('workflow_actions')
    .select('*')
    .eq('workflow_instance_id', instanceId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getWorkflowComments(
  instanceId: string,
  includePrivate: boolean,
): Promise<WorkflowComment[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from('workflow_comments')
    .select('*')
    .eq('workflow_instance_id', instanceId)
    .order('created_at', { ascending: true });
  if (!includePrivate) query = query.eq('is_private', false);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createWorkflowInstance(input: {
  createdBy: string;
  repositoryItemId?: string;
  thesisId?: string;
  resourceType?: string;
  actorRoles?: ActorRoles;
}): Promise<string> {
  if (!input.repositoryItemId && !input.thesisId) {
    throw new Error('A workflow instance needs a repository item or a thesis.');
  }
  const roles: ActorRoles = input.actorRoles ?? (await getUserRoles(input.createdBy));
  if (!canCreateWorkflow(roles)) throw new Error('You are not allowed to start a submission workflow.');

  const supabase = getSupabaseAdminClient();
  const resourceType = input.resourceType ?? (input.thesisId ? 'thesis' : 'repository');

  const targetColumn = input.thesisId ? 'thesis_id' : 'repository_item_id';
  const targetValue = input.thesisId ?? input.repositoryItemId;

  const { data: existing } = await supabase
    .from('workflow_instances')
    .select('id')
    .eq(targetColumn, targetValue)
    .eq('status', 'active')
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: definition, error: defError } = await supabase
    .from('workflow_definitions')
    .select('*')
    .eq('resource_type', resourceType)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (defError) throw new Error(defError.message);
  if (!definition) throw new Error(`No active ${resourceType} workflow definition is configured.`);

  const { data, error } = await supabase
    .from('workflow_instances')
    .insert({
      workflow_definition_id: definition.id,
      repository_item_id: input.repositoryItemId ?? null,
      thesis_id: input.thesisId ?? null,
      current_state: 'DRAFT',
      status: 'active',
      created_by: input.createdBy,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function getWorkflowInstance(instanceId: string): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('workflow_instances')
    .select('*, workflow_definitions(*), workflow_tasks(*), repository_items(title,status), theses(title,status,reference_no)')
    .eq('id', instanceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listWorkflowInstances(filters?: {
  status?: string;
  state?: string;
  createdBy?: string;
  thesisId?: string;
  repositoryItemId?: string;
  actorRoles?: ActorRoles;
}): Promise<Array<Record<string, unknown>>> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from('workflow_instances')
    .select('*, workflow_definitions(*), workflow_tasks(*), repository_items(title,status), theses(title,status,reference_no)')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.state) query = query.eq('current_state', filters.state);
  if (filters?.thesisId) query = query.eq('thesis_id', filters.thesisId);
  if (filters?.repositoryItemId) query = query.eq('repository_item_id', filters.repositoryItemId);
  if (filters?.createdBy && !(filters.actorRoles && canListAllInstances(filters.actorRoles))) {
    query = query.eq('created_by', filters.createdBy);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listReviewerTasks(userId: string, actorRoles?: ActorRoles): Promise<Array<Record<string, unknown>>> {
  const supabase = getSupabaseAdminClient();
  const roles: ActorRoles = actorRoles ?? (await getUserRoles(userId));
  if (!canManageTasks(roles)) return [];

  const query = supabase
    .from('workflow_tasks')
    .select('*, workflow_instances(*, repository_items(title,authors,item_type,abstract), theses(title,reference_no))')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if (canReassignTasks(roles)) return data ?? [];

  // A reviewer sees work assigned to them personally, unassigned work their
  // role is responsible for, and work assigned to their role by a manager.
  return (data ?? []).filter((task) => {
    const assignedTo = task.assigned_to as string | null;
    const assignedRole = task.assigned_role as string | null;
    if (assignedTo === userId) return true;
    if (!assignedRole) return assignedTo === null;
    return roles.includes(assignedRole);
  });
}
