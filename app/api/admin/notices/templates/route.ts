import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { listTemplates, type NoticeTemplate } from '@/server/circulation/notices';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel') as NoticeTemplate['channel'] | undefined;
    const enabledOnly = searchParams.get('enabled') !== 'false';
    const templates = listTemplates(channel, enabledOnly);
    return NextResponse.json({ success: true, templates });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const { action } = body as { action?: string };

    if (action === 'preview') {
      const { template, context } = body as { template: NoticeTemplate; context: Record<string, unknown> };
      const { renderNotice } = await import('@/server/circulation/notices');
      const rendered = renderNotice(template, context as Parameters<typeof renderNotice>[1]);
      return NextResponse.json({
        success: true,
        rendered,
        notice: 'SAMPLE DATA — preview only, not sent',
      });
    }

    if (action === 'toggle') {
      const { templateId, enabled } = body as { templateId: string; enabled: boolean };
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase
        .from('notice_templates')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('id', templateId);
      if (error) throw new Error(`Failed to toggle template: ${error.message}`);
      return NextResponse.json({ success: true });
    }

    if (action === 'duplicate') {
      const { templateId, newName } = body as { templateId: string; newName: string };
      const supabase = getSupabaseAdminClient();
      const { data: original } = await supabase.from('notice_templates').select('*').eq('id', templateId).maybeSingle();
      if (!original) throw new Error('Template not found');
      const { data: duplicate, error } = await supabase.from('notice_templates').insert({
        ...original,
        id: undefined,
        name: newName,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select().single();
      if (error) throw new Error(`Failed to duplicate template: ${error.message}`);
      return NextResponse.json({ success: true, template: duplicate });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
