export type EmailProviderId = 'resend' | 'gmail';

export type EmailErrorCode = 'not_configured' | 'rate_limited' | 'send_failed';

export type EmailErrorCategory =
  | 'configuration'
  | 'authentication'
  | 'rate_limit'
  | 'rejected'
  | 'network'
  | 'timeout'
  | 'unknown';

export interface SendEmailOptions {
  /** One recipient or several. */
  to: string | string[];
  /** Optional display name applied to a single recipient. */
  toName?: string;
  subject: string;
  html: string;
  /** Plain-text fallback. Generated from the HTML when omitted. */
  text?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: true;
  provider: EmailProviderId;
  messageId: string | null;
}

/**
 * Controlled delivery error. `message` is safe to show to users; `detail`
 * carries provider output for server logs only and must never leave the API.
 */
export class EmailDeliveryError extends Error {
  readonly code: EmailErrorCode;
  readonly provider?: EmailProviderId;
  readonly category?: EmailErrorCategory;
  readonly detail?: string;
  /**
   * True when the provider may have accepted the message even though the call
   * failed (e.g. the response was lost). Falling back in that case could send
   * the same email twice, so the orchestrator does not fall back.
   */
  readonly ambiguous?: boolean;

  constructor(
    message: string,
    code: EmailErrorCode,
    info: {
      provider?: EmailProviderId;
      category?: EmailErrorCategory;
      detail?: string;
      ambiguous?: boolean;
    } = {},
  ) {
    super(message);
    this.name = 'EmailDeliveryError';
    this.code = code;
    this.provider = info.provider;
    this.category = info.category;
    this.detail = info.detail;
    this.ambiguous = info.ambiguous;
  }
}

/** Backwards-compatible alias for the pre-existing error class name. */
export const EmailSendError = EmailDeliveryError;
