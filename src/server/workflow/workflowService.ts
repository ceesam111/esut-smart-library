import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export type WorkflowAction = 'submit' | 'claim' | 'assign' | 'approve' | 'reject' | 'return_for_correction' | 'request_changes' | 'reassign' | 'withdraw' | 'publish';

export interface WorkflowTransitionResult {
  success: boolean;
  newState?: string;
  error?: string;
}

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

export async function transitionWorkflow(
  instanceId: string,
  action: WorkflowAction,
  actorId: string,
  comment?: string,
): Promise<WorkflowTransitionResult> {
  const supabase = getSupabaseAdminClient();

  const { data: instance, error } = await supabase
    .from('workflow_instances')
    .select('*')
    .eq('id', instanceId)
    .maybeSingle();

  if (error || !instance) return { success: false, error: 'Instance not found' };
  if (instance.status !== 'active') return { success: false, error: 'Workflow not active' };

  const currentState = instance.current_state;
  const allowedNext = VALID_TRANSITIONS[currentState] || [];

  let newState: string;
  switch (action) {
    case 'submit': newState = 'SUBMITTED'; break;
    case 'approve': {
      const idx = Object.keys(VALID_TRANSITIONS).indexOf(currentState);
      const states = Object.keys(VALID_TRANSITIONS);
      newState = states[idx + 1] || 'PUBLISHED';
      break;
    }
    case 'reject': newState = 'REJECTED'; break;
    case 'return_for_correction': newState = 'RETURNED'; break;
    case 'withdraw': newState = 'WITHDRAWN'; break;
    case 'publish': newState = 'PUBLISHED'; break;
    default: return { success: false, error: 'Invalid action for current state' };
  }

  if (!allowedNext.includes(newState) && action !== 'publish' && action !== 'withdraw') {
    return { success: false, error: `Cannot transition from ${currentState} to ${newState}` };
  }

  const { error: actionError } = await supabase.from('workflow_actions').insert({
    workflow_instance_id: instanceId,
    action,
    actor_id: actorId,
    previous_state: currentState,
    new_state: newState,
    comment: comment || null,
  });
  if (actionError) return { success: false, error: actionError.message };

  const { error: updateError } = await supabase
    .from('workflow_instances')
    .update({
      current_state: newState,
      status: ['PUBLISHED', 'REJECTED', 'WITHDRAWN'].includes(newState) ? newState.toLowerCase() : 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', instanceId);
  if (updateError) return { success: false, error: updateError.message };

  return { success: true, newState };
}

export async function claimTask(taskId: string, userId: string): Promise<WorkflowTransitionResult> {
  const supabase = getSupabaseAdminClient();
  const { data: task, error } = await supabase
    .from('workflow_tasks')
    .select('*')
    .eq('id', taskId)
    .eq('status', 'pending')
    .maybeSingle();

  if (error || !task) return { success: false, error: 'Task not available' };

  const { error: updateError } = await supabase
    .from('workflow_tasks')
    .update({ status: 'claimed', claimed_by: userId, claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('status', 'pending');
  if (updateError) return { success: false, error: updateError.message };

  return { success: true };
}

export async function createWorkflowInstance(
  workflowDefinitionId: string,
  repositoryItemId: string,
  createdBy: string,
): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('workflow_instances')
    .insert({
      workflow_definition_id: workflowDefinitionId,
      repository_item_id: repositoryItemId,
      current_state: 'DRAFT',
      status: 'active',
      created_by: createdBy,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}
