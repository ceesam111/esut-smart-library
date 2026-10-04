import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { routeError } from '@/server/http/routeError';
import { renderNotice, type NoticeTemplate } from '@/server/circulation/notices';
import { listTemplatesDb, updateTemplate } from '@/server/circulation/templateRepository';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel') as NoticeTemplate['channel'] | undefined;
    const enabledOnly = searchParams.get('enabled') !== 'false';
    const templates = await listTemplatesDb(channel, enabledOnly);
    return NextResponse.json({ success: true, templates });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const { action } = body as { action?: string };

    if (action === 'preview') {
      const { template, context } = body as { template: NoticeTemplate; context: Record<string, unknown> };
      const rendered = renderNotice(template, context as Parameters<typeof renderNotice>[1]);
      return NextResponse.json({
        success: true,
        rendered,
        notice: 'SAMPLE DATA — preview only, not sent',
      });
    }

    if (action === 'update') {
      const { templateId, changes, expectedVersion } = body as {
        templateId: string;
        changes: Parameters<typeof updateTemplate>[1];
        expectedVersion?: number;
      };
      if (!templateId) {
        return NextResponse.json({ success: false, error: 'templateId required' }, { status: 400 });
      }
      if (expectedVersion !== undefined) {
        const all = await listTemplatesDb(undefined, false);
        const current = all.find((t) => t.id === templateId);
        if (current && current.version !== expectedVersion) {
          return NextResponse.json(
            { success: false, error: 'Template was modified concurrently. Reload and retry.', currentVersion: current.version },
            { status: 409 },
          );
        }
      }
      const updated = await updateTemplate(templateId, changes);
      return NextResponse.json({ success: true, template: updated });
    }

    if (action === 'toggle') {
      const { templateId, enabled } = body as { templateId: string; enabled: boolean };
      if (!templateId) {
        return NextResponse.json({ success: false, error: 'templateId required' }, { status: 400 });
      }
      const updated = await updateTemplate(templateId, { enabled });
      return NextResponse.json({ success: true, template: updated });
    }

    if (action === 'duplicate') {
      const { templateId, newName } = body as { templateId: string; newName: string };
      const all = await listTemplatesDb(undefined, false);
      const original = all.find((t) => t.id === templateId);
      if (!original) {
        return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
      }
      const { createTemplate } = await import('@/server/circulation/templateRepository');
      const duplicate = await createTemplate({
        notice_type: original.notice_type,
        name: newName || `${original.name} (Copy)`,
        subject: original.subject,
        body_text: original.body_text,
        body_html: original.body_html,
        channel: original.channel,
      });
      return NextResponse.json({ success: true, template: duplicate });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && /modified concurrently/.test(error.message)) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    return routeError(error);
  }
}
