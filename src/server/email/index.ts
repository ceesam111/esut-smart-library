export { sendEmail, sendEmailViaConfig, validateSendEmailOptions, normalizeRecipients, htmlToText, getEmailProviderStatus } from './emailService';

export { isEmailbumpConfigReady, type EmailbumpSendConfig } from './providers/emailbump.provider';
export { isSmtpConfigReady, type SmtpSendConfig } from './providers/smtp.provider';
export type { EmailProviderStatus } from './emailService';
export { verifyGmailTransport, isGmailConfigured } from './providers/gmail.provider';
export { EmailDeliveryError, EmailSendError } from './types';
export type {
  EmailErrorCode,
  EmailErrorCategory,
  EmailProviderId,
  SendEmailOptions,
  SendEmailResult,
} from './types';
