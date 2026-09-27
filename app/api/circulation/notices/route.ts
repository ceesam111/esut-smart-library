import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { generateNoticeContent } from '@/server/circulation/notices';
import { sendEmail } from '@/server/email/emailService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const body = await request.json().catch(() => ({}));
    const input = body as Parameters<typeof generateNoticeContent>[0];

    if (!input.type || !input.recipient_email || !input.recipient_name || !input.item_title) {
      return NextResponse.json({ success: false, error: 'type, recipient_email, recipient_name, and item_title required' }, { status: 400 });
    }

    const content = generateNoticeContent(input);

    try {
      await sendEmail({
        to: input.recipient_email,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
      return NextResponse.json({ success: true, message: `Notice sent to ${input.recipient_email}` });
    } catch (emailError) {
      return NextResponse.json({ success: false, error: emailError instanceof Error ? emailError.message : 'Failed to send' }, { status: 502 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
