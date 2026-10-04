import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { noticeDeliveryService } from '@/server/circulation/deliveryService';
import { getTemplate, renderNotice, type NoticeType } from '@/server/circulation/notices';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const { noticeType, channel, email, context } = body as {
      noticeType?: NoticeType;
      channel?: 'email' | 'in-app' | 'print' | 'sms';
      email?: string;
      context?: Record<string, unknown>;
    };

    if (!noticeType || !channel || !email || !context) {
      return NextResponse.json({ success: false, error: 'noticeType, channel, email, and context required' }, { status: 400 });
    }

    const template = getTemplate(noticeType);
    const rendered = renderNotice(template, context as Parameters<typeof renderNotice>[1]);

    if (channel === 'email') {
      const result = await noticeDeliveryService.send({
        noticeType,
        templateId: template.id,
        channel: 'email',
        email,
        context: context as Parameters<typeof renderNotice>[1],
        idempotencyKey: `test:${noticeType}:${email}:${Date.now()}`,
        isTest: true,
      });
      return NextResponse.json({ success: true, delivery: result, rendered: { subject: rendered.subject } });
    }

    if (channel === 'in-app') {
      const result = await noticeDeliveryService.send({
        noticeType,
        templateId: template.id,
        channel: 'in-app',
        email,
        context: context as Parameters<typeof renderNotice>[1],
        idempotencyKey: `test:${noticeType}:${email}:${Date.now()}`,
        isTest: true,
      });
      return NextResponse.json({ success: true, delivery: result, rendered: { subject: rendered.subject } });
    }

    if (channel === 'print') {
      return NextResponse.json({
        success: true,
        rendered: { subject: rendered.subject, html: rendered.html, text: rendered.text },
        notice: 'Print-ready content returned. Use browser print or save as PDF.',
      });
    }

    return NextResponse.json({ success: false, error: 'Unsupported channel for test send' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);
    const channel = searchParams.get('channel') as 'email' | 'in-app' | 'print' | 'sms' | undefined;
    const status = searchParams.get('status') as 'PENDING' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'CANCELLED' | 'SUPPRESSED' | undefined;

    const history = await noticeDeliveryService.listHistory({ limit, offset, channel, status });
    return NextResponse.json({ success: true, history, count: history.length });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
