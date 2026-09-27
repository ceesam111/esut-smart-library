export { sendEmail, validateSendEmailOptions, normalizeRecipients, htmlToText, getEmailProviderStatus } from './emailService';
export type { EmailProviderStatus } from './emailService';
export { verifyGmailTransport, isGmailConfigured } from './providers/gmail.provider';
export { isResendConfigured } from './providers/resend.provider';
export { EmailDeliveryError, EmailSendError } from './types';
export type {
  EmailErrorCode,
  EmailErrorCategory,
  EmailProviderId,
  SendEmailOptions,
  SendEmailResult,
} from './types';
