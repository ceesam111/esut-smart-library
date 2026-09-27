import { institutionConfig as cfg } from '@config/institution.config';
import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, requireUser } from '@/server/auth/requireUser';
import { sendEmail, validateSendEmailOptions } from '@/server/email';
import { EmailDeliveryError, type SendEmailOptions } from '@/server/email';
import { logger } from '@/server/logging/logger';
import { verifyRecoveryReceipt } from '@/server/registration/recoveryReceipt';

const WINDOW_MS = 60 * 60 * 1000;
const ANON_MAX_SENDS = 10;
const TRUSTED_MAX_SENDS = 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function allow(key: string, max: number) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (attempts.size > 1000) {
      for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
}

/**
 * The library inbox (and the institution's own inboxes) may be contacted
 * without a session so the public contact forms keep working. Nothing else is
 * reachable from an untrusted caller: this route must never become an open
 * relay for arbitrary recipients.
 */
function isLibraryInbox(recipient: string): boolean {
  const value = recipient.trim().toLowerCase();
  const allowed = new Set(['library@esut.edu.ng', cfg.supportEmail.toLowerCase()]);
  if (allowed.has(value)) return true;
  return value.endsWith('@esut.edu.ng');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const options: SendEmailOptions = {
      to: payload.to as SendEmailOptions['to'],
      toName: String(payload.toName ?? payload.to_name ?? '') || undefined,
      subject: String(payload.subject ?? ''),
      html: String(payload.html ?? ''),
      text: typeof payload.text === 'string' && payload.text.trim() ? payload.text : undefined,
      replyTo: String(payload.replyTo ?? payload.reply_to ?? '') || undefined,
    };

    const validation = validateSendEmailOptions(options);
    if (validation.length > 0) {
      return NextResponse.json({ ok: false, error: validation[0], reason: 'invalid_payload' }, { status: 400 });
    }

    const ip = clientKey(request);
    const bearer = getBearerToken(request);
    let trusted = false;
    let identity = `ip:${ip}`;

    if (bearer) {
      try {
        const ctx = await requireUser(request);
        trusted = true;
        identity = `user:${ctx.user.id}`;
      } catch {
        return NextResponse.json(
          { ok: false, error: 'Invalid or expired session.', reason: 'unauthenticated' },
          { status: 401 },
        );
      }
    } else {
      const receipt = typeof payload.recoveryReceipt === 'string' ? payload.recoveryReceipt : null;
      const userId = typeof payload.userId === 'string' ? payload.userId : '';
      if (receipt && userId && verifyRecoveryReceipt(receipt, userId)) {
        trusted = true;
        identity = `receipt:${userId}`;
      }
    }

    if (!trusted) {
      const recipients = (Array.isArray(options.to) ? options.to : [options.to]).map((value) => String(value));
      if (!recipients.every(isLibraryInbox)) {
        logger.warn('[email] Rejected unauthenticated send to non-library recipient', {
          recipients: recipients.length,
          ip,
        });
        return NextResponse.json(
          { ok: false, error: 'This recipient can only be contacted from a signed-in session.', reason: 'forbidden_recipient' },
          { status: 403 },
        );
      }
    }

    if (!allow(`email:${identity}`, trusted ? TRUSTED_MAX_SENDS : ANON_MAX_SENDS)) {
      return NextResponse.json(
        { ok: false, error: 'Too many emails requested. Please wait and try again.', reason: 'rate_limited' },
        { status: 429 },
      );
    }

    const result = await sendEmail(options);
    logger.info('[email] Gateway delivery successful', {
      provider: result.provider,
      messageId: result.messageId,
      trusted,
      recipients: Array.isArray(options.to) ? options.to.length : 1,
    });

    return NextResponse.json({ ok: true, provider: result.provider, messageId: result.messageId });
  } catch (error) {
    if (error instanceof EmailDeliveryError) {
      const status = error.code === 'not_configured' ? 503 : 502;
      const message =
        error.code === 'not_configured'
          ? 'The email service is not configured.'
          : error.code === 'rate_limited'
            ? 'The email provider is rate-limited right now. Please try again shortly.'
            : 'Unable to send the email at this time. Please try again later.';
      return NextResponse.json({ ok: false, error: message, reason: error.code }, { status });
    }

    logger.error('[email] Gateway delivery failed unexpectedly', {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: 'Unable to send the email at this time. Please try again later.', reason: 'send_failed' },
      { status: 502 },
    );
  }
}
