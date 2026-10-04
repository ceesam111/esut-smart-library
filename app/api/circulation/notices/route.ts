import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { renderNotice, getTemplate, type NoticeType, type NoticeContext, listTemplates } from '@/server/circulation/notices';

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

    // Use the specified template or look up default for the type
    const template = templateId
      ? (listTemplates().find((t) => t.id === templateId) ?? getTemplate(type))
      : getTemplate(type);

    const rendered = renderNotice(template, context);

    return NextResponse.json({ success: true, template: template.id, type: template.notice_type, ...rendered });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
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
    const templates = listTemplates(channel, enabledOnly);
    return NextResponse.json({ success: true, templates });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}