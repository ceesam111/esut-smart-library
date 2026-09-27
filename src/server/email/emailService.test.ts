import { beforeEach, describe, expect, it, vi } from 'vitest';

const resendMocks = vi.hoisted(() => ({
  isResendConfigured: vi.fn(() => true),
  sendWithResend: vi.fn(),
  createIdempotencyKey: vi.fn(() => 'idem-key'),
}));

const gmailMocks = vi.hoisted(() => ({
  isGmailConfigured: vi.fn(() => false),
  sendWithGmail: vi.fn(),
  verifyGmailTransport: vi.fn(),
}));

vi.mock('./providers/resend.provider', () => resendMocks);
vi.mock('./providers/gmail.provider', () => gmailMocks);
vi.mock('../logging/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { htmlToText, sendEmail, validateSendEmailOptions } from './emailService';
import { EmailDeliveryError } from './types';

const baseMessage = {
  to: 'reader@esut.edu.ng',
  subject: 'Test subject',
  html: '<p>Hello <strong>reader</strong></p>',
};

function resendFailure(info: {
  code?: EmailDeliveryError['code'];
  category?: EmailDeliveryError['category'];
  ambiguous?: boolean;
  detail?: string;
} = {}) {
  return new EmailDeliveryError('The email provider could not be reached.', info.code ?? 'send_failed', {
    provider: 'resend',
    category: info.category ?? 'rejected',
    ambiguous: info.ambiguous ?? false,
    detail: info.detail ?? 'resend http 500: upstream exploded',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resendMocks.isResendConfigured.mockReturnValue(true);
  gmailMocks.isGmailConfigured.mockReturnValue(false);
});

describe('sendEmail', () => {
  it('delivers with Resend when it accepts the message', async () => {
    resendMocks.sendWithResend.mockResolvedValue({ success: true, provider: 'resend', messageId: 're_123' });

    const result = await sendEmail(baseMessage);

    expect(result).toEqual({ success: true, provider: 'resend', messageId: 're_123' });
    expect(gmailMocks.sendWithGmail).not.toHaveBeenCalled();
    expect(resendMocks.sendWithResend).toHaveBeenCalledTimes(1);
    const [payload, idempotencyKey] = resendMocks.sendWithResend.mock.calls[0];
    expect(payload.text).toContain('Hello');
    expect(idempotencyKey).toBe('idem-key');
  });

  it('falls back to Gmail when Resend definitively did not accept the message', async () => {
    gmailMocks.isGmailConfigured.mockReturnValue(true);
    resendMocks.sendWithResend.mockRejectedValue(resendFailure({ category: 'rejected', ambiguous: false }));
    gmailMocks.sendWithGmail.mockResolvedValue({ success: true, provider: 'gmail', messageId: '<gm@1>' });

    const result = await sendEmail(baseMessage);

    expect(result.provider).toBe('gmail');
    expect(gmailMocks.sendWithGmail).toHaveBeenCalledTimes(1);
  });

  it('does not fall back when the Resend failure is ambiguous (no duplicate emails)', async () => {
    resendMocks.sendWithResend.mockRejectedValue(resendFailure({ category: 'timeout', ambiguous: true }));

    const promise = sendEmail(baseMessage);
    await expect(promise).rejects.toBeInstanceOf(EmailDeliveryError);
    await promise.catch((error: EmailDeliveryError) => {
      expect(error.ambiguous).toBe(true);
      expect(error.code).toBe('send_failed');
    });
    expect(gmailMocks.sendWithGmail).not.toHaveBeenCalled();
  });

  it('skips Resend and uses Gmail when Resend is not configured', async () => {
    resendMocks.isResendConfigured.mockReturnValue(false);
    gmailMocks.isGmailConfigured.mockReturnValue(true);
    gmailMocks.sendWithGmail.mockResolvedValue({ success: true, provider: 'gmail', messageId: '<gm@2>' });

    const result = await sendEmail(baseMessage);

    expect(result.provider).toBe('gmail');
    expect(resendMocks.sendWithResend).not.toHaveBeenCalled();
    const [payload] = gmailMocks.sendWithGmail.mock.calls[0];
    expect(payload.text).toContain('Hello');
  });

  it('fails with not_configured when no provider is available', async () => {
    resendMocks.isResendConfigured.mockReturnValue(false);
    gmailMocks.isGmailConfigured.mockReturnValue(false);

    const promise = sendEmail(baseMessage);
    await expect(promise).rejects.toBeInstanceOf(EmailDeliveryError);
    await promise.catch((error: EmailDeliveryError) => {
      expect(error.code).toBe('not_configured');
      expect(error.category).toBe('configuration');
    });
    expect(resendMocks.sendWithResend).not.toHaveBeenCalled();
    expect(gmailMocks.sendWithGmail).not.toHaveBeenCalled();
  });

  it('rejects invalid recipients before contacting any provider', async () => {
    const promise = sendEmail({ ...baseMessage, to: 'not-an-email' });
    await expect(promise).rejects.toBeInstanceOf(EmailDeliveryError);
    await promise.catch((error: EmailDeliveryError) => {
      expect(error.code).toBe('send_failed');
      expect(error.category).toBe('rejected');
    });
    expect(resendMocks.sendWithResend).not.toHaveBeenCalled();
    expect(gmailMocks.sendWithGmail).not.toHaveBeenCalled();
  });

  it('returns a controlled message without provider internals when the fallback fails too', async () => {
    resendMocks.sendWithResend.mockRejectedValue(resendFailure({ category: 'authentication', ambiguous: false }));
    gmailMocks.isGmailConfigured.mockReturnValue(true);
    gmailMocks.sendWithGmail.mockRejectedValue(
      new EmailDeliveryError('The fallback provider rejected its credentials.', 'send_failed', {
        provider: 'gmail',
        category: 'authentication',
        detail: 'gmail smtp 535: 535-5.7.8 Username and Password not accepted',
      }),
    );

    const promise = sendEmail(baseMessage);
    await expect(promise).rejects.toBeInstanceOf(EmailDeliveryError);
    await promise.catch((error: EmailDeliveryError) => {
      expect(error.message).toBe('Unable to send the email at this time. Please try again later.');
      expect(error.message).not.toContain('535');
      expect(error.code).toBe('send_failed');
    });
  });
});

describe('validateSendEmailOptions', () => {
  it('accepts a well-formed message', () => {
    expect(validateSendEmailOptions(baseMessage)).toEqual([]);
  });

  it('flags header injection in the subject', () => {
    expect(validateSendEmailOptions({ ...baseMessage, subject: 'Hello\r\nBcc: victim@x.com' })).not.toEqual([]);
  });

  it('flags line breaks in a recipient address', () => {
    expect(validateSendEmailOptions({ ...baseMessage, to: 'a@b.com\r\nX-Evil: 1' })).not.toEqual([]);
  });

  it('requires at least one recipient and an html body', () => {
    expect(validateSendEmailOptions({ ...baseMessage, to: '' })).not.toEqual([]);
    expect(validateSendEmailOptions({ ...baseMessage, html: '' })).not.toEqual([]);
  });
});

describe('htmlToText', () => {
  it('produces a readable plain-text fallback', () => {
    const text = htmlToText('<h2>Title</h2><p>Line one</p><p>Line &amp; two</p>');
    expect(text).toContain('Title');
    expect(text).toContain('Line one');
    expect(text).toContain('Line & two');
    expect(text).not.toContain('<');
  });
});
