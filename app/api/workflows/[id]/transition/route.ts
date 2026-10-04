import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getUserRoles } from '@/server/auth/requireRole';
import {
  transitionWorkflow,
  claimTask,
  unclaimTask,
  reassignTask,
  getWorkflowTask,
} from '@/server/workflow/workflowService';
import { canListAllInstances, type WorkflowAction } from '@/server/workflow/workflowAuth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const transitionSchema = z.object({
  action: z.enum([
    'submit',
    'resubmit',
    'approve',
    'reject',
    'return_for_correction',
    'request_changes',
    'withdraw',
    'publish',
    'claim',
    'unclaim',
    'assign',
    'reassign',
  ]),
  comment: z.string().max(2000).optional(),
  assignTo: z.string().min(1).max(64).optional(),
  repositoryItemId: z.string().min(1).max(64).optional(),
  thesisId: z.string().min(1).max(64).optional(),
  taskId: z.string().min(1).max(64).optional(),
});

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

function authError(error: unknown) {
  if (error instanceof Error && /Authentication required|Invalid or expired session/.test(error.message)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  return null;
}

function statusFor(code?: string) {
  if (code === 'FORBIDDEN') return 403;
  if (code === 'NOT_FOUND') return 404;
  if (code === 'CONFLICT') return 409;
  if (code === 'INVALID_ACTION' || code === 'INVALID_TRANSITION' || code === 'TERMINAL' || code === 'INACTIVE') return 422;
  return 500;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireUser(request);
    const roles = await getUserRoles(ctx.user.id);
    const { id } = await params;

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    const parsed = transitionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { action, comment, assignTo, repositoryItemId, thesisId, taskId } = parsed.data;

    if (action === 'claim' || action === 'unclaim') {
      if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
      const task = await getWorkflowTask(taskId);
      if (!task || task.workflow_instance_id !== id) {
        return NextResponse.json({ error: 'Task not found for this workflow.' }, { status: 404 });
      }
      const result = action === 'claim'
        ? await claimTask(taskId, ctx.user.id, roles)
        : await unclaimTask(taskId, ctx.user.id, roles);
      return NextResponse.json(result, { status: result.success ? 200 : statusFor(result.code) });
    }

    if (action === 'assign' || action === 'reassign') {
      if (!assignTo) return NextResponse.json({ error: 'assignTo is required' }, { status: 400 });
      if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
      const task = await getWorkflowTask(taskId);
      if (!task || task.workflow_instance_id !== id) {
        return NextResponse.json({ error: 'Task not found for this workflow.' }, { status: 404 });
      }
      const result = await reassignTask(taskId, String(task.assigned_to ?? ctx.user.id), assignTo, roles);
      return NextResponse.json(result, { status: result.success ? 200 : statusFor(result.code) });
    }

    if (!STATE_ACTIONS.includes(action)) {
      return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
    }

    const result = await transitionWorkflow(id, action, ctx.user.id, {
      comment,
      assignTo,
      repositoryItemId,
      thesisId,
      actorRoles: roles,
    });

    if (!result.success && result.code === 'FORBIDDEN' && !canListAllInstances(roles)) {
      // Do not reveal whether the instance exists to someone who may not see it.
      return NextResponse.json({ error: 'Not permitted.' }, { status: 403 });
    }

    if (result.success && STATE_ACTIONS.includes(action)) {
      void import('@/server/circulation/workflowNotices')
        .then(({ dispatchWorkflowNotice }) =>
          dispatchWorkflowNotice({ instanceId: id, action, actorId: ctx.user.id, comment }),
        )
        .catch(() => undefined);
    }

    return NextResponse.json(result, { status: result.success ? 200 : statusFor(result.code) });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
