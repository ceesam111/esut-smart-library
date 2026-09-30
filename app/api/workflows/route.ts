import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getUserRoles } from '@/server/auth/requireRole';
import { listWorkflowInstances, createWorkflowInstance, transitionWorkflow } from '@/server/workflow/workflowService';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  thesisId: z.string().min(1).max(64).optional(),
  repositoryItemId: z.string().min(1).max(64).optional(),
  resourceType: z.enum(['thesis', 'repository']).optional(),
  submit: z.boolean().optional(),
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
    const { searchParams } = new URL(request.url);
    const instances = await listWorkflowInstances({
      status: searchParams.get('status') ?? undefined,
      state: searchParams.get('state') ?? undefined,
      thesisId: searchParams.get('thesisId') ?? undefined,
      repositoryItemId: searchParams.get('repositoryItemId') ?? undefined,
      createdBy: ctx.user.id,
      actorRoles: roles,
    });
    return NextResponse.json({ data: instances });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireUser(request);
    const roles = await getUserRoles(ctx.user.id);

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }
    if (!parsed.data.thesisId && !parsed.data.repositoryItemId) {
      return NextResponse.json({ error: 'thesisId or repositoryItemId is required' }, { status: 400 });
    }

    const id = await createWorkflowInstance({
      createdBy: ctx.user.id,
      thesisId: parsed.data.thesisId,
      repositoryItemId: parsed.data.repositoryItemId,
      resourceType: parsed.data.resourceType,
      actorRoles: roles,
    });

    let warning: string | undefined;
    if (parsed.data.submit) {
      const result = await transitionWorkflow(id, 'submit', ctx.user.id, { actorRoles: roles });
      if (!result.success) warning = result.error;
    }

    return NextResponse.json({ data: { id }, ...(warning ? { warning } : {}) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /not allowed to start/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error && /workflow definition/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return authError(error) ?? NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
