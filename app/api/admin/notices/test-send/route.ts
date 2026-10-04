import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { routeError } from '@/server/http/routeError';
import { noticeDeliveryService } from '@/server/circulation/deliveryService';
import { renderNotice, type NoticeType } from '@/server/circulation/notices';
import { resolveTemplate } from '@/server/circulation/templateRepository';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const { action, deliveryId, noticeType, channel, email, context, userId } = body as {
      action?: 'retry';
      deliveryId?: string;
      noticeType?: NoticeType;
      channel?: 'email' | 'in-app' | 'print' | 'sms';
      email?: string;
      context?: Record<string, unknown>;
      userId?: string;
    };

    if (action === 'retry') {
      if (!deliveryId) {
        return NextResponse.json({ success: false, error: 'deliveryId required' }, { status: 400 });
      }
      const delivery = await noticeDeliveryService.retry(deliveryId);
      return NextResponse.json({ success: true, delivery });
    }

    if (!noticeType || !channel || !email || !context) {
      return NextResponse.json({ success: false, error: 'noticeType, channel, email, and context required' }, { status: 400 });
    }
    if (channel === 'in-app' && !userId) {
      return NextResponse.json({ success: false, error: 'userId required for in-app test send' }, { status: 400 });
    }

    const template = await resolveTemplate(noticeType);
    const rendered = renderNotice(template, context as Parameters<typeof renderNotice>[1]);

    if (channel === 'email' || channel === 'in-app' || channel === 'sms') {
      const result = await noticeDeliveryService.send({
        noticeType,
        channel,
        email,
        userId,
        context: context as Parameters<typeof renderNotice>[1],
        idempotencyKey: `test:${noticeType}:${channel}:${email}:${Date.now()}`,
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
    return routeError(error);
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
    return routeError(error);
  }
}
