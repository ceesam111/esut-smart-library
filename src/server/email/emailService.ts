import { logger } from '../logging/logger';
import { createIdempotencyKey, isResendConfigured, sendWithResend } from './providers/resend.provider';
import { isGmailConfigured, sendWithGmail } from './providers/gmail.provider';
import { EmailDeliveryError, type SendEmailOptions, type SendEmailResult } from './types';

const MAX_RECIPIENTS = 10;
const MAX_SUBJECT_LENGTH = 500;
const MAX_HTML_BYTES = 500_000;

const EMAIL_PATTERN = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

export function normalizeRecipients(to: string | string[]): string[] {
  const list = (Array.isArray(to) ? to : [to]).map((entry) => String(entry ?? '').trim()).filter(Boolean);
  return [...new Set(list)];
}

/** Rejects malformed recipients and header-injection attempts early. */
export function validateSendEmailOptions(options: SendEmailOptions): string[] {
  if (!options || typeof options !== 'object') return ['Email options are required.'];
  const errors: string[] = [];

  const recipients = normalizeRecipients(options.to);
  if (recipients.length === 0) errors.push('At least one recipient is required.');
  if (recipients.length > MAX_RECIPIENTS) errors.push(`A single send may not exceed ${MAX_RECIPIENTS} recipients.`);
  for (const recipient of recipients) {
    if (/[\r\n]/.test(recipient) || !EMAIL_PATTERN.test(recipient)) {
      errors.push('One or more recipient addresses are invalid.');
      break;
    }
  }

  const subject = String(options.subject ?? '');
  if (!subject.trim()) errors.push('A subject is required.');
  if (/[\r\n]/.test(subject)) errors.push('The subject may not contain line breaks.');
  if (subject.length > MAX_SUBJECT_LENGTH) errors.push('The subject is too long.');

  const html = String(options.html ?? '');
  if (!html.trim()) errors.push('An HTML body is required.');
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) errors.push('The message body is too large.');

  if (options.replyTo && (/[\r\n]/.test(options.replyTo) || !EMAIL_PATTERN.test(options.replyTo.trim()))) {
    errors.push('The reply-to address is invalid.');
  }
  if (options.toName && /[\r\n]/.test(String(options.toName))) {
    errors.push('The recipient name may not contain line breaks.');
  }

  return errors;
}

/** Minimal plain-text fallback for providers that accept one. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface EmailProviderStatus {
  resend: { configured: boolean };
  gmail: { configured: boolean; user?: string };
}

export function getEmailProviderStatus(): EmailProviderStatus {
  const gmailUser = process.env.GMAIL_SMTP_USER;
  return {
    resend: { configured: isResendConfigured() },
    gmail: {
      configured: isGmailConfigured(),
      ...(gmailUser ? { user: gmailUser } : {}),
    },
  };
}

/**
 * Central delivery entry point.
 *
 * Resend is primary; Gmail SMTP takes over only when Resend definitively did
 * not accept the message. When Resend may have accepted it but the response
 * was lost, no fallback runs so the recipient cannot receive the email twice.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const errors = validateSendEmailOptions(options);
  if (errors.length > 0) {
    throw new EmailDeliveryError(errors[0], 'send_failed', { category: 'rejected', detail: errors.join(' ') });
  }

  const payload: SendEmailOptions = {
    ...options,
    to: normalizeRecipients(options.to),
    text: options.text || htmlToText(options.html),
  };

  const resendReady = isResendConfigured();
  const gmailReady = isGmailConfigured();

  if (!resendReady && !gmailReady) {
    throw new EmailDeliveryError('The email service is not configured.', 'not_configured', {
      category: 'configuration',
      detail: 'Neither RESEND_API_KEY nor GMAIL_SMTP_APP_PASSWORD is set',
    });
  }

  if (resendReady) {
    logger.debug('[email] Attempting delivery using Resend');
    try {
      const result = await sendWithResend(payload, createIdempotencyKey());
      logger.info('[email] Resend delivery successful');
      return result;
    } catch (error) {
      const failure = error instanceof EmailDeliveryError ? error : null;
      logger.warn('[email] Resend delivery failed', {
        category: failure?.category ?? 'unknown',
        code: failure?.code ?? 'send_failed',
        detail: failure?.detail ?? (error instanceof Error ? error.message : String(error)),
        ambiguous: failure?.ambiguous ?? false,
      });

      if (failure?.ambiguous) {
        // Resend may already have accepted the message: fall back only by
        // risking a duplicate, so surface a controlled failure instead.
        throw new EmailDeliveryError(
          'The email could not be confirmed as sent. Please try again shortly.',
          failure.code,
          { provider: 'resend', category: failure.category, detail: failure.detail, ambiguous: true },
        );
      }
      // Not accepted by Resend — a Gmail retry cannot duplicate anything.
    }
  }

  if (gmailReady) {
    logger.debug('[email] Attempting Gmail fallback');
    try {
      const result = await sendWithGmail(payload);
      logger.info('[email] Gmail fallback successful');
      return result;
    } catch (error) {
      const failure = error instanceof EmailDeliveryError ? error : null;
      logger.error('[email] Gmail fallback failed', {
        category: failure?.category ?? 'unknown',
        code: failure?.code ?? 'send_failed',
        detail: failure?.detail ?? (error instanceof Error ? error.message : String(error)),
      });
      throw new EmailDeliveryError(
        'Unable to send the email at this time. Please try again later.',
        failure?.code ?? 'send_failed',
        { provider: 'gmail', category: failure?.category ?? 'unknown', detail: failure?.detail },
      );
    }
  }

  // Resend failed and no fallback provider is configured.
  logger.error('[email] Delivery failed and Gmail SMTP fallback is not configured');
  throw new EmailDeliveryError('Unable to send the email at this time. Please try again later.', 'send_failed', {
    provider: 'resend',
    category: 'configuration',
    detail: 'Gmail fallback not configured',
  });
}
