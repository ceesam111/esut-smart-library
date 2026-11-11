import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getEmailProviderStatus, sendEmail, sendEmailViaConfig, verifyGmailTransport, EmailDeliveryError } from '@/server/email';
import { template } from '@/server/email/resend';
import { logger } from '@/server/logging/logger';

export const dynamic = 'force-dynamic';

/**
 * Super-admin diagnostics for the email service.
 *
 * - `GET`  — configuration status (never exposes keys or app passwords)
 * - `POST` — `{ action: 'verify' }` checks the Gmail SMTP handshake;
 *            `{ action: 'send', to, providerId? }` sends one real test message
 *            through the provider chain, or through one database provider when
 *            `providerId` is given.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const status = await getEmailProviderStatus();
    return NextResponse.json({
      ...status,
      healthy: status.database.active || status.resend.configured || status.gmail.configured,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : 'status';

    if (action === 'verify') {
      const gmail = await verifyGmailTransport();
      const status = await getEmailProviderStatus();
      return NextResponse.json({
        resend: status.resend,
        database: status.database,
        gmail,
      });
    }

    if (action !== 'send') {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    }

    const to = String(body.to ?? '').trim();
    if (!/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(to)) {
      return NextResponse.json({ error: 'A valid recipient address is required.' }, { status: 400 });
    }

    const providerId = typeof body.providerId === 'string' && body.providerId ? body.providerId : null;

    const html = template(`
      <h2 style="color:#6B1D2A;margin-top:0">Email service test</h2>
      <p style="color:#374151">This message was sent from the ESUT Library admin console to confirm that delivery works.</p>
      <p style="color:#374151">If you are reading it, the configured provider chain is healthy.</p>
      <p style="color:#94a3b8;font-size:13px">Sent at ${new Date().toISOString()}</p>
    `);

    try {
      const result = providerId
        ? await sendEmailViaConfig(providerId, { to, subject: 'ESUT Library email service test', html })
        : await sendEmail({ to, subject: 'ESUT Library email service test', html });
      logger.info('[email] Admin test message sent', { provider: result.provider, messageId: result.messageId, providerId });
      return NextResponse.json({ ok: true, provider: result.provider, messageId: result.messageId });
    } catch (error) {
      if (error instanceof EmailDeliveryError) {
        const status = error.code === 'not_configured' ? 503 : 502;
        return NextResponse.json(
          { ok: false, error: error.message, reason: error.code, category: error.category ?? null },
          { status },
        );
      }
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 401 });
  }
}
