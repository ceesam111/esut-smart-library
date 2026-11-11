import nodemailer, { type Transporter } from 'nodemailer';
import { EmailDeliveryError, type SendEmailOptions, type SendEmailResult } from '../types';

export interface SmtpSendConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName?: string | null;
}

const CONNECTION_TIMEOUT_MS = 15000;
const GREETING_TIMEOUT_MS = 10000;
const SOCKET_TIMEOUT_MS = 20000;

const transports = new Map<string, Transporter>();

export function isSmtpConfigReady(config: Partial<SmtpSendConfig> | null | undefined): boolean {
  return Boolean(config?.host && config?.user && config?.password && config?.fromEmail);
}

function transportFor(config: SmtpSendConfig): Transporter {
  const key = `${config.host}:${config.port}:${config.user}:${config.password.length}`;
  const existing = transports.get(key);
  if (existing) return existing;
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  });
  transports.set(key, transport);
  if (transports.size > 8) {
    const oldest = transports.keys().next().value;
    if (oldest) transports.delete(oldest);
  }
  return transport;
}

function composeFrom(config: SmtpSendConfig): string {
  return config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail;
}

function describeSmtpFailure(host: string, error: unknown): {
  message: string;
  code: EmailDeliveryError['code'];
  category: EmailDeliveryError['category'];
  detail: string;
} {
  const err = error as { responseCode?: number; message?: string; code?: string };
  const responseCode = err?.responseCode;
  const raw = err?.message || String(error);
  const detail = `smtp ${host} ${responseCode ?? err?.code ?? 'error'}: ${raw.slice(0, 300)}`;

  if (
    responseCode === 421 ||
    responseCode === 450 ||
    responseCode === 451 ||
    responseCode === 452 ||
    /rate.?limit|too many|throttl|try again later|quota exceeded|exceeded a rate limit/i.test(raw)
  ) {
    return { message: 'The email provider is rate-limited right now.', code: 'rate_limited', category: 'rate_limit', detail };
  }
  if (responseCode === 535 || /authentication|username and password|invalid login|not accepted/i.test(raw)) {
    return { message: 'The email provider rejected its credentials.', code: 'send_failed', category: 'authentication', detail };
  }
  return {
    message: 'The email provider could not send the message.',
    code: 'send_failed',
    category: responseCode && responseCode >= 500 ? 'rejected' : 'unknown',
    detail,
  };
}

export async function sendWithSmtp(options: SendEmailOptions, config: SmtpSendConfig): Promise<SendEmailResult> {
  if (!isSmtpConfigReady(config)) {
    throw new EmailDeliveryError('The email service is not configured.', 'not_configured', {
      provider: 'smtp',
      category: 'configuration',
      detail: 'SMTP host, credentials, or from address missing',
    });
  }

  try {
    const info = await transportFor(config).sendMail({
      from: composeFrom(config),
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      ...(options.text ? { text: options.text } : {}),
      ...(options.replyTo ? { replyTo: options.replyTo } : {}),
    });
    return { success: true, provider: 'smtp', messageId: info.messageId ?? null };
  } catch (error) {
    const failure = describeSmtpFailure(config.host, error);
    throw new EmailDeliveryError(failure.message, failure.code, {
      provider: 'smtp',
      category: failure.category,
      detail: failure.detail,
    });
  }
}
