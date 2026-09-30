import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getUserRoles } from '@/server/auth/requireRole';
import { listReviewerTasks, claimTask, unclaimTask, getWorkflowTask } from '@/server/workflow/workflowService';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const taskActionSchema = z.object({
  taskId: z.string().min(1).max(64),
  action: z.enum(['claim', 'unclaim']),
});

function authError(error: unknown) {
  if (error instanceof Error && /Authentication required|Invalid or expired session/.test(error.message)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireUser(request);
    const roles = await getUserRoles(ctx.user.id);
    const tasks = await listReviewerTasks(ctx.user.id, roles);
    return NextResponse.json({ data: tasks });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
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

    const parsed = taskActionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const task = await getWorkflowTask(parsed.data.taskId);
    if (!task || task.workflow_instance_id !== id) {
      return NextResponse.json({ error: 'Task not found for this workflow.' }, { status: 404 });
    }

    const result =
      parsed.data.action === 'claim'
        ? await claimTask(parsed.data.taskId, ctx.user.id, roles)
        : await unclaimTask(parsed.data.taskId, ctx.user.id, roles);

    if (!result.success && result.code === 'FORBIDDEN') {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }
    if (!result.success && result.code === 'NOT_FOUND') {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json(result, { status: result.success ? 200 : 409 });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
