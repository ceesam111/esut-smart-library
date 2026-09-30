import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getUserRoles } from '@/server/auth/requireRole';
import { getWorkflowComments, addWorkflowComment } from '@/server/workflow/workflowService';
import { canViewPrivateComments } from '@/server/workflow/workflowAuth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const commentSchema = z.object({
  body: z.string().min(1).max(2000),
  isPrivate: z.boolean().default(false),
});

function authError(error: unknown) {
  if (error instanceof Error && /Authentication required|Invalid or expired session/.test(error.message)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireUser(request);
    const roles = await getUserRoles(ctx.user.id);
    const { id } = await params;
    const comments = await getWorkflowComments(id, canViewPrivateComments(roles));
    return NextResponse.json({ data: comments });
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

    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const comment = await addWorkflowComment(
      id,
      ctx.user.id,
      parsed.data.body,
      parsed.data.isPrivate,
      roles,
    );
    return NextResponse.json({ data: comment }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /library staff/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return authError(error) ?? NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
