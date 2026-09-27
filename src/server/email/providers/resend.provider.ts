import { randomUUID } from 'crypto';
import { EmailDeliveryError, type SendEmailOptions, type SendEmailResult } from '../types';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 15000;

/** Connection-level failures that prove the request never left this machine. */
const NEVER_LEFT_CLIENT = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH']);

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && (process.env.FROM_EMAIL || process.env.RESEND_FROM_EMAIL));
}

export function createIdempotencyKey(): string {
  return randomUUID();
}

function buildFrom(): string {
  const email = process.env.FROM_EMAIL || process.env.RESEND_FROM_EMAIL || '';
  const name = process.env.FROM_NAME || process.env.RESEND_FROM_NAME || '';
  if (!email) return '';
  return name ? `${name} <${email}>` : email;
}

function describeNetworkFailure(error: unknown): {
  ambiguous: boolean;
  category: 'network' | 'timeout';
  detail: string;
} {
  const err = error as { name?: string; code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = err?.cause?.code || err?.code || '';
  const name = err?.name || '';
  const detail = err?.cause?.message || err?.message || String(error);

  if (name === 'TimeoutError' || name === 'AbortError' || code === 'ETIMEDOUT' || /timed?\s?out|timeout/i.test(detail)) {
    // The request may already have reached Resend — do not assume it was lost.
    return { ambiguous: true, category: 'timeout', detail };
  }
  if (NEVER_LEFT_CLIENT.has(code)) {
    return { ambiguous: false, category: 'network', detail };
  }
  return { ambiguous: true, category: 'network', detail };
}

/**
 * Primary provider: the Resend HTTP API.
 *
 * Uses an `Idempotency-Key` per logical send, so an ambiguous retry of the
 * same send can never create a duplicate email.
 */
export async function sendWithResend(
  options: SendEmailOptions,
  idempotencyKey: string,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = buildFrom();

  if (!apiKey || !from) {
    throw new EmailDeliveryError('The email service is not configured.', 'not_configured', {
      provider: 'resend',
      category: 'configuration',
      detail: !apiKey ? 'RESEND_API_KEY missing' : 'FROM_EMAIL/RESEND_FROM_EMAIL missing',
    });
  }

  const payload: Record<string, unknown> = {
    from,
    to: Array.isArray(options.to) ? options.to : [options.to],
    subject: options.subject,
    html: options.html,
  };
  if (options.text) payload.text = options.text;
  if (options.replyTo) payload.reply_to = options.replyTo;

  let response: Response;
  try {
    response = await fetch(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const failure = describeNetworkFailure(error);
    throw new EmailDeliveryError('The email provider could not be reached.', 'send_failed', {
      provider: 'resend',
      category: failure.category,
      detail: failure.detail,
      ambiguous: failure.ambiguous,
    });
  }

  if (response.ok) {
    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return { success: true, provider: 'resend', messageId: data.id ?? null };
  }

  const body = await response.text().catch(() => '');
  const detail = `resend http ${response.status}: ${body.slice(0, 300)}`;

  if (response.status === 429) {
    throw new EmailDeliveryError('The email provider is rate-limited right now.', 'rate_limited', {
      provider: 'resend',
      category: 'rate_limit',
      detail,
    });
  }
  if (response.status === 401 || response.status === 403) {
    throw new EmailDeliveryError('The email provider rejected its credentials.', 'send_failed', {
      provider: 'resend',
      category: 'authentication',
      detail,
    });
  }
  if (response.status >= 500) {
    // Resend did not process the request, so a fallback cannot duplicate it.
    throw new EmailDeliveryError('The email provider is temporarily unavailable.', 'send_failed', {
      provider: 'resend',
      category: 'rejected',
      detail,
    });
  }
  throw new EmailDeliveryError('The email provider rejected the message.', 'send_failed', {
    provider: 'resend',
    category: 'rejected',
    detail,
  });
}
