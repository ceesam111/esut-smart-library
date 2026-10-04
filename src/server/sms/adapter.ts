/**
 * SMS Adapter Architecture (Batch 13).
 *
 * This is an optional adapter interface. No SMS provider is purchased or configured
 * as part of Batch 13. The interface is defined so that an SMS service can be added
 * later without changing core notice/wiring logic. At runtime, if no SMS adapter is
 * configured, sends are silently no-op'd and delivery logging records SUPPRESSED status.
 *
 * To enable SMS: implement the SmsProvider class below, set
 * SMS_PROVIDER_CLASS in the environment, and ensure the provider's send() resolves
 * to an object with { success: true, messageId?: string } or rejects with an Error.
 *
 * To remain disabled (default): no code change needed; all SMS sends will be
 * logged as SUPPRESSED and no external request is made.
 */

export type SmsProviderStatus = {
  configured: boolean;
  provider?: string;
};

/** Base interface for an SMS provider. */
export interface SmsProvider {
  /** Send an SMS message. */
  send(to: string, body: string): Promise<{ success: boolean; messageId?: string }>;

  /** Check provider configuration status. */
  status(): SmsProviderStatus;
}

/**
 * No-op / disabled SMS provider.
 * Used when no SMS credentials are configured.
 */
export class NoOpSmsProvider implements SmsProvider {
  status(): SmsProviderStatus {
    return { configured: false, provider: 'none' };
  }
  send(_to: string, _body: string): Promise<{ success: boolean; messageId?: string }> {
    return Promise.resolve({ success: false });
  }
}

/**
 * Resend SMS adapter (if Resend supports SMS — this is a placeholder.
 * Resend is an email-only API; a real SMS adapter would use a different
 * provider (Twilio, Africa's Talking, etc.). For Batch 13 we only define
 * the interface; a concrete SMS adapter can be added later.
 */
export class ResendSmsProvider implements SmsProvider {
  private apiKey: string;
  private from: string;

  constructor(apiKey: string, from: string) {
    this.apiKey = apiKey;
    this.from = from;
  }

  status(): SmsProviderStatus {
    return { configured: !!this.apiKey, provider: 'resend-sms' };
  }

  send(_to: string, _body: string): Promise<{ success: boolean; messageId?: string }> {
    return Promise.resolve({ success: false });
  }
}

/** Default (no-op) SMS provider when none are configured. */
export const smsProvider: SmsProvider = new NoOpSmsProvider();

/** Obtain the currently-active SMS provider instance. */
export function getSmsProvider(): SmsProvider {
  return smsProvider;
}

