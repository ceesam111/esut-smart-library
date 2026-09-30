import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getUserRoles } from '@/server/auth/requireRole';
import { getWorkflowInstance } from '@/server/workflow/workflowService';
import { canListAllInstances } from '@/server/workflow/workflowAuth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireUser(request);
    const roles = await getUserRoles(ctx.user.id);
    const { id } = await params;

    const instance = await getWorkflowInstance(id);
    if (!instance) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!canListAllInstances(roles) && instance.created_by !== ctx.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ data: instance });
  } catch (error) {
    if (error instanceof Error && /Authentication required|Invalid or expired session/.test(error.message)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
