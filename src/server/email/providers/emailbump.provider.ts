import { EmailDeliveryError, type SendEmailOptions, type SendEmailResult } from '../types';

const EMAILBUMP_EMAILS_URL = 'https://emailbump.com/api/v1/emails';
const REQUEST_TIMEOUT_MS = 15000;

const NEVER_LEFT_CLIENT = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH']);

export interface EmailbumpSendConfig {
  apiKey: string;
  fromEmail: string;
  fromName?: string | null;
}

export function isEmailbumpConfigReady(config: Partial<EmailbumpSendConfig> | null | undefined): boolean {
  return Boolean(config?.apiKey && config?.fromEmail);
}

function composeFrom(email: string, name?: string | null): string {
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
    return { ambiguous: true, category: 'timeout', detail };
  }
  if (NEVER_LEFT_CLIENT.has(code)) {
    return { ambiguous: false, category: 'network', detail };
  }
  return { ambiguous: true, category: 'network', detail };
}

export async function sendWithEmailbump(
  options: SendEmailOptions,
  config: EmailbumpSendConfig,
): Promise<SendEmailResult> {
  if (!isEmailbumpConfigReady(config)) {
    throw new EmailDeliveryError('The email service is not configured.', 'not_configured', {
      provider: 'emailbump',
      category: 'configuration',
      detail: 'EmailBump api_key or from address missing',
    });
  }

  const from = composeFrom(config.fromEmail, config.fromName);
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
    response = await fetch(EMAILBUMP_EMAILS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const failure = describeNetworkFailure(error);
    throw new EmailDeliveryError('The email provider could not be reached.', 'send_failed', {
      provider: 'emailbump',
      category: failure.category,
      detail: failure.detail,
      ambiguous: failure.ambiguous,
    });
  }

  if (response.ok) {
    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return { success: true, provider: 'emailbump', messageId: data.id ?? null };
  }

  const body = await response.text().catch(() => '');
  const detail = `emailbump http ${response.status}: ${body.slice(0, 300)}`;

  if (response.status === 429) {
    throw new EmailDeliveryError('The email provider is rate-limited right now.', 'rate_limited', {
      provider: 'emailbump',
      category: 'rate_limit',
      detail,
    });
  }
  if (response.status === 401 || response.status === 403) {
    throw new EmailDeliveryError('The email provider rejected its credentials.', 'send_failed', {
      provider: 'emailbump',
      category: 'authentication',
      detail,
    });
  }
  if (response.status >= 500) {
    throw new EmailDeliveryError('The email provider is temporarily unavailable.', 'send_failed', {
      provider: 'emailbump',
      category: 'rejected',
      detail,
    });
  }
  throw new EmailDeliveryError('The email provider rejected the message.', 'send_failed', {
    provider: 'emailbump',
    category: 'rejected',
    detail,
  });
}
