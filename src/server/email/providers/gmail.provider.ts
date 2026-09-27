import nodemailer, { type Transporter } from 'nodemailer';
import { EmailDeliveryError, type SendEmailOptions, type SendEmailResult } from '../types';

const GMAIL_HOST = 'smtp.gmail.com';
const GMAIL_PORT = 465;

let cached: { key: string; transport: Transporter } | null = null;

export function isGmailConfigured(): boolean {
  return Boolean(process.env.GMAIL_SMTP_USER && process.env.GMAIL_SMTP_APP_PASSWORD);
}

function transport(): Transporter {
  const user = process.env.GMAIL_SMTP_USER || '';
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD || '';
  const key = `${user}:${pass.length}`;
  if (!cached || cached.key !== key) {
    cached = {
      key,
      transport: nodemailer.createTransport({
        host: GMAIL_HOST,
        port: GMAIL_PORT,
        secure: true,
        auth: { user, pass },
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      }),
    };
  }
  return cached.transport;
}

export function __resetGmailTransportForTests() {
  cached = null;
}

function buildFrom(): string {
  const user = process.env.GMAIL_SMTP_USER || '';
  const name = process.env.FROM_NAME || 'ESUT Library';
  return `${name} <${user}>`;
}

function describeSmtpFailure(error: unknown): {
  message: string;
  code: EmailDeliveryError['code'];
  category: EmailDeliveryError['category'];
  detail: string;
} {
  const err = error as { responseCode?: number; message?: string; code?: string };
  const responseCode = err?.responseCode;
  const raw = err?.message || String(error);
  const detail = `gmail smtp ${responseCode ?? err?.code ?? 'error'}: ${raw.slice(0, 300)}`;

  if (
    responseCode === 421 ||
    responseCode === 450 ||
    responseCode === 451 ||
    responseCode === 452 ||
    /rate.?limit|too many|throttl|try again later|quota exceeded|exceeded a rate limit/i.test(raw)
  ) {
    return {
      message: 'The fallback provider is rate-limited right now.',
      code: 'rate_limited',
      category: 'rate_limit',
      detail,
    };
  }
  if (responseCode === 535 || /authentication|username and password|invalid login|not accepted/i.test(raw)) {
    return {
      message: 'The fallback provider rejected its credentials.',
      code: 'send_failed',
      category: 'authentication',
      detail,
    };
  }
  return {
    message: 'The fallback provider could not send the message.',
    code: 'send_failed',
    category: responseCode && responseCode >= 500 ? 'rejected' : 'unknown',
    detail,
  };
}

/**
 * Fallback provider: Gmail over SMTP (implicit TLS on port 465), authenticated
 * with a Google App Password — never the account password.
 */
export async function sendWithGmail(options: SendEmailOptions): Promise<SendEmailResult> {
  if (!isGmailConfigured()) {
    throw new EmailDeliveryError('The fallback email provider is not configured.', 'not_configured', {
      provider: 'gmail',
      category: 'configuration',
      detail: 'GMAIL_SMTP_USER/GMAIL_SMTP_APP_PASSWORD missing',
    });
  }

  try {
    const info = await transport().sendMail({
      from: buildFrom(),
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      ...(options.text ? { text: options.text } : {}),
      ...(options.replyTo ? { replyTo: options.replyTo } : {}),
    });
    return { success: true, provider: 'gmail', messageId: info.messageId ?? null };
  } catch (error) {
    const failure = describeSmtpFailure(error);
    throw new EmailDeliveryError(failure.message, failure.code, {
      provider: 'gmail',
      category: failure.category,
      detail: failure.detail,
    });
  }
}

/** Development/debug helper: checks the Gmail SMTP handshake without sending. */
export async function verifyGmailTransport(): Promise<{ ok: boolean; error?: string }> {
  if (!isGmailConfigured()) {
    return { ok: false, error: 'Gmail SMTP is not configured.' };
  }
  try {
    await transport().verify();
    return { ok: true };
  } catch (error) {
    const failure = describeSmtpFailure(error);
    return { ok: false, error: failure.detail };
  }
}
