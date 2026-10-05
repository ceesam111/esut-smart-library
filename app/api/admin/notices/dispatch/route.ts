import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { routeError } from '@/server/http/routeError';
import { noticeDeliveryService } from '@/server/circulation/deliveryService';
import { renderNotice, type NoticeType, type NoticeContext } from '@/server/circulation/notices';
import { resolveTemplate } from '@/server/circulation/templateRepository';
import { getPatronNoticeProfile } from '@/server/circulation/patronNotice';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const { action, loanId, holdId, userId, itemTitle, dueDate, channel } = body as {
      action: 'checkout' | 'checkin' | 'renewal' | 'hold_ready' | 'hold_cancelled' | 'due_soon' | 'overdue';
      loanId?: string;
      holdId?: string;
      userId?: string;
      itemTitle?: string;
      dueDate?: string;
      channel?: 'email' | 'in-app' | 'print';
    };

    if (!action || !userId || !itemTitle) {
      return NextResponse.json({ success: false, error: 'action, userId, and itemTitle required' }, { status: 400 });
    }

    const profile = await getPatronNoticeProfile({ userId });
    const patronName = profile?.fullName ?? 'Patron';
    const email = profile?.email ?? null;
    const useChannel = channel || 'email';

    const noticeTypeMap: Record<string, NoticeType> = {
      checkout: 'checkout_receipt',
      checkin: 'checkin_receipt',
      renewal: 'renewal_confirmation',
      hold_ready: 'hold_ready',
      hold_cancelled: 'hold_cancelled',
      due_soon: 'due_soon',
      overdue: 'overdue',
    };

    const noticeType = noticeTypeMap[action];
    if (!noticeType) {
      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }

    const context: NoticeContext = {
      patron_name: patronName,
      item_title: itemTitle,
      due_date: dueDate,
      return_date: action === 'checkin' ? new Date() : undefined,
    };

    const idemKey = `${noticeType}:${loanId ?? holdId ?? userId}:${action}:${useChannel}`;

    if (useChannel === 'email' && email) {
      const result = await noticeDeliveryService.send({
        noticeType,
        channel: 'email',
        email,
        userId,
        context,
        entityType: loanId ? 'loan' : holdId ? 'hold' : 'patron',
        entityId: loanId ?? holdId ?? userId,
        idempotencyKey: idemKey,
      });
      return NextResponse.json({ success: true, delivery: result });
    }

    if (useChannel === 'in-app') {
      const result = await noticeDeliveryService.send({
        noticeType,
        channel: 'in-app',
        email: email ?? '',
        userId,
        context,
        entityType: loanId ? 'loan' : holdId ? 'hold' : 'patron',
        entityId: loanId ?? holdId ?? userId,
        idempotencyKey: idemKey,
      });
      return NextResponse.json({ success: true, delivery: result });
    }

    if (useChannel === 'print') {
      const template = await resolveTemplate(noticeType);
      const rendered = renderNotice(template, context);
      return NextResponse.json({
        success: true,
        rendered: { subject: rendered.subject, html: rendered.html, text: rendered.text },
        notice: 'Print-ready content returned.',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid channel or missing email' }, { status: 400 });
  } catch (error) {
    return routeError(error);
  }
}
