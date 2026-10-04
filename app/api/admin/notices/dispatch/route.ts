import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { noticeDeliveryService } from '@/server/circulation/deliveryService';
import { getTemplate, renderNotice, type NoticeType, type NoticeContext } from '@/server/circulation/notices';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export const dynamic = 'force-dynamic';

async function getPatronEmail(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  const { data: patron } = await supabase
    .from('patrons')
    .select('email, first_name, last_name')
    .eq('user_id', userId)
    .maybeSingle();
  return patron?.email ?? null;
}

async function getPatronName(userId: string): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const { data: patron } = await supabase
    .from('patrons')
    .select('first_name, last_name')
    .eq('user_id', userId)
    .maybeSingle();
  if (!patron) return 'Patron';
  return `${patron.first_name ?? ''} ${patron.last_name ?? ''}`.trim() || 'Patron';
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const { action, loanId, holdId, userId, itemTitle, dueDate, channel } = body as {
      action: 'checkout' | 'checkin' | 'hold_ready' | 'hold_cancelled' | 'due_soon' | 'overdue';
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

    const patronName = await getPatronName(userId);
    const email = await getPatronEmail(userId);
    const useChannel = channel || 'email';

    const noticeTypeMap: Record<string, NoticeType> = {
      checkout: 'checkout_receipt',
      checkin: 'checkin_receipt',
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

    const template = getTemplate(noticeType);
    const idemKey = `${noticeType}:${loanId ?? holdId ?? userId}:${action}`;

    if (useChannel === 'email' && email) {
      const result = await noticeDeliveryService.send({
        noticeType,
        templateId: template.id,
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
        templateId: template.id,
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
