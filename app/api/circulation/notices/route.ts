import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { routeError } from '@/server/http/routeError';
import { renderNotice, type NoticeType, type NoticeContext } from '@/server/circulation/notices';
import { listTemplatesDb, resolveTemplate } from '@/server/circulation/templateRepository';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const { type, context, templateId } = body as {
      type: NoticeType;
      context: NoticeContext;
      templateId?: string;
    };

    if (!type || !context) {
      return NextResponse.json({ success: false, error: 'type and context required' }, { status: 400 });
    }

    const template = await resolveTemplate(type, templateId);
    const rendered = renderNotice(template, context);

    return NextResponse.json({ success: true, template: template.id, type: template.notice_type, source: template.source, ...rendered });
  } catch (error) {
    return routeError(error);
  }
}

/**
 * GET — list available templates for staff (library admin).
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel') as 'email' | 'in-app' | 'print' | undefined;
    const enabledOnly = searchParams.get('enabled') !== 'false';
    const templates = await listTemplatesDb(channel, enabledOnly);
    return NextResponse.json({ success: true, templates });
  } catch (error) {
    return routeError(error);
  }
}
