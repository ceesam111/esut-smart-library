import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { noticeDeliveryService } from '@/server/circulation/deliveryService';
import { getTemplate, type NoticeType, type NoticeContext } from '@/server/circulation/notices';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export const dynamic = 'force-dynamic';

const WORKFLOW_NOTICE_MAP: Record<string, NoticeType> = {
  submission_received: 'submission_received',
  reviewer_assigned: 'reviewer_assigned',
  changes_requested: 'changes_requested',
  returned_for_correction: 'returned_for_correction',
  approved: 'approved',
  rejected: 'rejected',
  published: 'published',
};

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const { action, userId, itemTitle, channel, metadata } = body as {
      action: string;
      userId?: string;
      itemTitle?: string;
      channel?: 'email' | 'in-app' | 'print';
      metadata?: Record<string, unknown>;
    };

    if (!action || !userId || !itemTitle) {
      return NextResponse.json({ success: false, error: 'action, userId, and itemTitle required' }, { status: 400 });
    }

    const noticeType = WORKFLOW_NOTICE_MAP[action];
    if (!noticeType) {
      return NextResponse.json({ success: false, error: `Unknown workflow action: ${action}` }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: patron } = await supabase
      .from('patrons')
      .select('email, first_name, last_name')
      .eq('user_id', userId)
      .maybeSingle();

    const patronName = patron ? `${patron.first_name ?? ''} ${patron.last_name ?? ''}`.trim() || 'Patron' : 'Patron';
    const email = patron?.email ?? undefined;
    const useChannel = channel || 'email';

    const context: NoticeContext = {
      patron_name: patronName,
      item_title: itemTitle,
      repository_title: itemTitle,
      workflow_status: action,
      ...metadata,
    };

    const template = getTemplate(noticeType);
    const idemKey = `workflow:${userId}:${action}:${itemTitle}`;

    if (useChannel === 'email' && email) {
      const result = await noticeDeliveryService.send({
        noticeType,
        templateId: template.id,
        channel: 'email',
        email,
        userId,
        context,
        entityType: 'workflow',
        entityId: `${userId}:${action}`,
        idempotencyKey: idemKey,
      });
      return NextResponse.json({ success: true, delivery: result });
    }

    if (useChannel === 'in-app') {
      const result = await noticeDeliveryService.send({
        noticeType,
        templateId: template.id,
        channel: 'in-app',
        email: email ?? '',
        userId,
        context,
        entityType: 'workflow',
        entityId: `${userId}:${action}`,
        idempotencyKey: idemKey,
      });
      return NextResponse.json({ success: true, delivery: result });
    }

    if (useChannel === 'print') {
      const { renderNotice } = await import('@/server/circulation/notices');
      const rendered = renderNotice(template, context);
      return NextResponse.json({
        success: true,
        rendered: { subject: rendered.subject, html: rendered.html, text: rendered.text },
        notice: 'Print-ready content returned.',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid channel or missing email' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
