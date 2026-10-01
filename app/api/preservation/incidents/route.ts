import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { applyIncidentAction, listIncidents, type IncidentAction, type IncidentStatus } from '@/server/preservation/incidents';
import { preservationErrorResponse } from '@/server/preservation/http';

export const dynamic = 'force-dynamic';

const ACTIONS: IncidentAction[] = ['acknowledged', 'resolved', 'reopened'];
const STATUSES: IncidentStatus[] = ['open', 'acknowledged', 'resolved'];

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status');
    const status = statusParam && STATUSES.includes(statusParam as IncidentStatus) ? (statusParam as IncidentStatus) : undefined;
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50));
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
    const result = await listIncidents({ status, limit, offset });
    return NextResponse.json({ success: true, data: result.rows, total: result.total });
  } catch (error) {
    return preservationErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === 'string' ? body.id : '';
    const actionRaw = typeof body.action === 'string' ? body.action : '';
    if (!id) return NextResponse.json({ success: false, error: 'id is required.' }, { status: 400 });
    if (!ACTIONS.includes(actionRaw as IncidentAction)) {
      return NextResponse.json({ success: false, error: `action must be one of ${ACTIONS.join(', ')}.` }, { status: 400 });
    }
    const action = actionRaw as IncidentAction;
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 1000) : null;
    const result = await applyIncidentAction({ incidentId: id, action, actorId: ctx.user.id, note });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 409 });
    return NextResponse.json({ success: true, data: { status: result.status } });
  } catch (error) {
    return preservationErrorResponse(error);
  }
}
