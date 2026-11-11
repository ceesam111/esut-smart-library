import { logger } from '../logging/logger';
import { createIdempotencyKey, isResendConfigured, sendWithResend, type ResendSendConfig } from './providers/resend.provider';
import { isGmailConfigured, sendWithGmail } from './providers/gmail.provider';
import { isEmailbumpConfigReady, sendWithEmailbump, type EmailbumpSendConfig } from './providers/emailbump.provider';
import { sendWithSmtp, type SmtpSendConfig } from './providers/smtp.provider';
import { getEmailProviderConfigs, type EmailProviderConfigRecord } from './providerConfig';
import { EmailDeliveryError, type EmailProviderId, type SendEmailOptions, type SendEmailResult } from './types';

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
  database: { active: boolean; providers: { id: string; provider: EmailProviderId; label: string; priority: number }[] };
}

interface RuntimeProvider {
  id: EmailProviderId;
  configId: string | null;
  label: string;
  priority: number;
  send: (options: SendEmailOptions) => Promise<SendEmailResult>;
}

export async function getEmailProviderStatus(): Promise<EmailProviderStatus> {
  const gmailUser = process.env.GMAIL_SMTP_USER;
  const rows = await getEmailProviderConfigs();
  const active = rows.filter((row) => row.is_enabled && isRowConfigured(row));
  return {
    resend: { configured: isResendConfigured() },
    gmail: {
      configured: isGmailConfigured(),
      ...(gmailUser ? { user: gmailUser } : {}),
    },
    database: {
      active: active.length > 0,
      providers: active.map((row) => ({
        id: row.id,
        provider: row.provider,
        label: row.label,
        priority: row.priority,
      })),
    },
  };
}

function isRowConfigured(row: EmailProviderConfigRecord): boolean {
  if (!row.from_email) return false;
  if (row.provider === 'resend') return Boolean(row.config.api_key);
  if (row.provider === 'emailbump') {
    return isEmailbumpConfigReady({ apiKey: row.config.api_key, fromEmail: row.from_email });
  }
  if (row.provider === 'smtp') {
    return Boolean(row.config.smtp_host && row.config.smtp_user && row.config.smtp_password);
  }
  return false;
}

function rowToRuntime(row: EmailProviderConfigRecord): RuntimeProvider {
  const fromEmail = row.from_email;
  const fromName = row.from_name;
  if (row.provider === 'resend') {
    const config: ResendSendConfig = { apiKey: row.config.api_key ?? '', fromEmail, fromName };
    return {
      id: 'resend',
      configId: row.id,
      label: row.label,
      priority: row.priority,
      send: (options) => sendWithResend(options, createIdempotencyKey(), config),
    };
  }
  if (row.provider === 'emailbump') {
    const config: EmailbumpSendConfig = { apiKey: row.config.api_key ?? '', fromEmail, fromName };
    return {
      id: 'emailbump',
      configId: row.id,
      label: row.label,
      priority: row.priority,
      send: (options) => sendWithEmailbump(options, config),
    };
  }
  const port = Number(row.config.smtp_port) || 587;
  const config: SmtpSendConfig = {
    host: row.config.smtp_host ?? '',
    port,
    secure: row.config.smtp_secure ?? port === 465,
    user: row.config.smtp_user ?? '',
    password: row.config.smtp_password ?? '',
    fromEmail,
    fromName,
  };
  return {
    id: 'smtp',
    configId: row.id,
    label: row.label,
    priority: row.priority,
    send: (options) => sendWithSmtp(options, config),
  };
}

function environmentChain(): RuntimeProvider[] {
  const chain: RuntimeProvider[] = [];
  if (isResendConfigured()) {
    chain.push({
      id: 'resend',
      configId: null,
      label: 'Resend (environment)',
      priority: 10,
      send: (options) => sendWithResend(options, createIdempotencyKey()),
    });
  }
  if (isGmailConfigured()) {
    chain.push({
      id: 'gmail',
      configId: null,
      label: 'Gmail SMTP (environment)',
      priority: 20,
      send: (options) => sendWithGmail(options),
    });
  }
  return chain;
}

async function buildChain(): Promise<RuntimeProvider[]> {
  const rows = await getEmailProviderConfigs();
  const enabled = rows
    .filter((row) => row.is_enabled && isRowConfigured(row))
    .map((row) => rowToRuntime(row));
  if (enabled.length === 0) return environmentChain();
  return [...enabled, ...environmentChain()].sort((a, b) => a.priority - b.priority);
}

/**
 * Central delivery entry point.
 *
 * Admin-configured providers from the database run in priority order with the
 * environment providers (Resend, then Gmail SMTP) merged in as the last
 * resort, so a database provider with a high priority number acts as a
 * fallback and never removes the environment safety net. A provider whose
 * failure may still have delivered the message blocks the fallback so the
 * recipient cannot receive the email twice.
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

  const chain = await buildChain();

  if (chain.length === 0) {
    throw new EmailDeliveryError('The email service is not configured.', 'not_configured', {
      category: 'configuration',
      detail: 'No email provider is enabled in the database or environment',
    });
  }

  for (let index = 0; index < chain.length; index += 1) {
    const provider = chain[index];
    try {
      const result = await provider.send(payload);
      logger.info('[email] Delivery successful', {
        provider: provider.id,
        label: provider.label,
        configId: provider.configId,
      });
      return result;
    } catch (error) {
      const failure = error instanceof EmailDeliveryError ? error : null;
      logger.warn('[email] Provider delivery failed', {
        provider: provider.id,
        label: provider.label,
        category: failure?.category ?? 'unknown',
        code: failure?.code ?? 'send_failed',
        detail: failure?.detail ?? (error instanceof Error ? error.message : String(error)),
        ambiguous: failure?.ambiguous ?? false,
      });

      if (failure?.ambiguous) {
        throw new EmailDeliveryError(
          'The email could not be confirmed as sent. Please try again shortly.',
          failure.code,
          { provider: failure.provider ?? provider.id, category: failure.category, detail: failure.detail, ambiguous: true },
        );
      }
      if (index === chain.length - 1) {
        throw new EmailDeliveryError(
          'Unable to send the email at this time. Please try again later.',
          failure?.code ?? 'send_failed',
          {
            provider: failure?.provider ?? provider.id,
            category: failure?.category ?? 'unknown',
            detail: failure?.detail,
          },
        );
      }
    }
  }

  throw new EmailDeliveryError('Unable to send the email at this time. Please try again later.', 'send_failed', {
    category: 'unknown',
  });
}

export async function sendEmailViaConfig(configId: string, options: SendEmailOptions): Promise<SendEmailResult> {
  const errors = validateSendEmailOptions(options);
  if (errors.length > 0) {
    throw new EmailDeliveryError(errors[0], 'send_failed', { category: 'rejected', detail: errors.join(' ') });
  }

  const rows = await getEmailProviderConfigs();
  const row = rows.find((item) => item.id === configId);
  if (!row || !row.is_enabled || !isRowConfigured(row)) {
    throw new EmailDeliveryError('The selected email provider is not available.', 'not_configured', {
      category: 'configuration',
      detail: `No enabled provider config ${configId}`,
    });
  }

  const payload: SendEmailOptions = {
    ...options,
    to: normalizeRecipients(options.to),
    text: options.text || htmlToText(options.html),
  };

  const provider = rowToRuntime(row);
  try {
    const result = await provider.send(payload);
    logger.info('[email] Directed delivery successful', { provider: provider.id, configId: row.id });
    return result;
  } catch (error) {
    const failure = error instanceof EmailDeliveryError ? error : null;
    logger.warn('[email] Directed delivery failed', {
      provider: provider.id,
      configId: row.id,
      category: failure?.category ?? 'unknown',
      detail: failure?.detail ?? (error instanceof Error ? error.message : String(error)),
    });
    throw new EmailDeliveryError(
      failure?.message ?? 'Unable to send the email at this time. Please try again later.',
      failure?.code ?? 'send_failed',
      {
        provider: failure?.provider ?? provider.id,
        category: failure?.category ?? 'unknown',
        detail: failure?.detail,
      },
    );
  }
}
