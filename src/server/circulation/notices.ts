export type NoticeType =
  | 'checkout_receipt'
  | 'checkin_receipt'
  | 'due_soon'
  | 'overdue'
  | 'overdue_escalation'
  | 'hold_ready'
  | 'hold_cancelled'
  | 'renewal_confirmation'
  | 'fine_notice'
  | 'welcome'
  | 'email_verification'
  | 'password_reset'
  | 'account_expiry'
  | 'account_restriction'
  | 'submission_received'
  | 'reviewer_assigned'
  | 'changes_requested'
  | 'returned_for_correction'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'claim_notice'
  | 'order_notice'
  | 'vendor_notice'
  | 'custom_notice';

export interface NoticeVariableSchema {
  [key: string]: {
    type: 'string' | 'number' | 'date' | 'boolean';
    required: boolean;
    description: string;
  };
}

export interface NoticeTemplate {
  id: string;
  notice_type: NoticeType;
  name: string;
  subject: string;
  body_text: string;
  body_html?: string;
  channel: 'email' | 'in-app' | 'print';
  locale: string;
  enabled: boolean;
  variables: NoticeVariableSchema;
  tenant_id?: string;
  library_id?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  version: number;
}

export interface NoticeContext {
  patron_name: string;
  item_title: string;
  item_barcode?: string;
  due_date?: string | Date;
  return_date?: string | Date;
  fine_amount?: number | string;
  hold_pickup_location?: string;
  repository_title?: string;
  workflow_status?: string;
  [key: string]: unknown;
}

/**
 * Render a template subject and body given a NoticeTemplate and NoticeContext.
 * Unknown required variables cause a clear error; unknown optional variables are
 * substituted as empty string.
 */
export function renderNotice(
  template: NoticeTemplate,
  context: NoticeContext
): { subject: string; text: string; html: string; printHtml: string } {
  // Build a full context merge: caller-provided fields + normalized defaults.
  const merged: Record<string, unknown> = {
    ...context,
    patron_name: context.patron_name || '',
    item_title: context.item_title || '',
    item_barcode: context.item_barcode || undefined,
    due_date:
      context.due_date !== undefined
        ? typeof context.due_date === 'string'
          ? context.due_date
          : context.due_date.toISOString().split('T')[0]
        : undefined,
    return_date:
      context.return_date !== undefined
        ? typeof context.return_date === 'string'
          ? context.return_date
          : typeof context.return_date === 'object'
          ? context.return_date.toISOString().split('T')[0]
          : undefined
        : undefined,
    fine_amount: context.fine_amount !== undefined ? String(context.fine_amount) : undefined,
    hold_pickup_location: context.hold_pickup_location || undefined,
    repository_title: context.repository_title || undefined,
    workflow_status: context.workflow_status || undefined,
  };

  const resolveVars = (input: string): string =>
    input.replace(/\{\{([^}]+)\}\}/g, (_match, varName: string) => {
      const key = varName.trim();
      const value = merged[key];
      return value !== undefined ? String(value) : '';
    });

  // Render subject
  const subject = resolveVars(template.subject);

  // Render html body if present; otherwise render text body
  let html: string;
  let text: string;

  const printerHtml = (baseHtml: string) =>
    baseHtml
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<link[^>]*>/gi, '')
      .replace(/<meta[^>]*>/gi, '')
      .replace('<head>', '<head><style>@page { margin: 15mm; } body { font-family: sans-serif; font-size: 12pt; line-height: 1.5; color: #000; background: #fff; } a { color: #000; text-decoration: none; }</style>')
      .replace('</head>', '');

  if (template.body_html) {
    html = resolveVars(template.body_html);
    html = html.replace(/<script[^>]*>.*?<\/script>/gi, '').replace(/<style[^>]*>.*?<\/style>/gi, '').replace(/<[^>]+>/g, '');

    text = resolveVars(template.body_text);
    text = text
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '');
  } else {
    text = resolveVars(template.body_text);
    text = text
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '');

    html = text;
  }

  return { subject, text, html, printHtml: printerHtml(html) };
}

function makeTemplate(partial: Omit<NoticeTemplate, 'created_at' | 'updated_at' | 'version'>): NoticeTemplate {
  return {
    ...partial,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  };
}

/**
 * Default template store (in-memory for now; persist to Supabase later).
 * Each template defines its variable schema.
 */
const templateStore: Record<NoticeType, Omit<NoticeTemplate, 'created_at' | 'updated_at' | 'version'>> = {
  // CIRCULATION types
  checkout_receipt: {
    id: 'checkout-receipt-default',
    notice_type: 'checkout_receipt',
    name: 'Checkout Receipt',
    subject: 'Receipt: {{item_title}}',
    body_text: `Dear {{patron_name}},\n\nThis confirms the checkout of the following item:\n\n{{item_title}}\n\nReturn date: {{due_date}}\n\nThank you for using {{library_name}}.`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>This confirms the checkout of the following item:</p>
<p><strong>{{item_title}}</strong><br/>Return date: {{due_date}}</p>
<p>Thank you for using {{library_name}}.</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      item_title: { type: 'string', required: true, description: 'Title of the checked-out item' },
      due_date: { type: 'date', required: true, description: 'Item due date' },
      library_name: { type: 'string', required: false, description: 'Library name' },
    },
  },
  checkin_receipt: {
    id: 'checkin-receipt-default',
    notice_type: 'checkin_receipt',
    name: 'Checkin Receipt',
    subject: 'Receipt: {{item_title}} returned',
    body_text: `Dear {{patron_name}},\n\nThis confirms the return of the following item:\n\n{{item_title}}\n\nReturn date: {{return_date}}\n\nThank you for using {{library_name}}.`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>This confirms the return of the following item:</p>
<p><strong>{{item_title}}</strong><br/>Return date: {{return_date}}</p>
<p>Thank you for using {{library_name}}.</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      item_title: { type: 'string', required: true, description: 'Title of the returned item' },
      return_date: { type: 'date', required: true, description: 'Date the item was returned' },
      library_name: { type: 'string', required: false, description: 'Library name' },
    },
  },
  due_soon: {
    id: 'due-soon-default',
    notice_type: 'due_soon',
    name: 'Due Soon Reminder',
    subject: 'Due Soon: {{item_title}}',
    body_text: `Dear {{patron_name}},\n\nThis is a reminder that the following item is due soon:\n\n{{item_title}}\n\nDue date: {{due_date}}\n\nPlease return or renew this item before the due date to avoid fines.\n\nThank you,\n{{library_name}}`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>This is a reminder that the following item is due soon:</p>
<p><strong>{{item_title}}</strong><br/>Due date: {{due_date}}</p>
<p>Please return or renew this item before the due date to avoid fines.</p>
<p>Thank you,\n{{library_name}}</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      item_title: { type: 'string', required: true, description: 'Title of the item due soon' },
      due_date: { type: 'date', required: true, description: 'Item due date' },
      library_name: { type: 'string', required: false, description: 'Library name' },
    },
  },
  overdue: {
    id: 'overdue-default',
    notice_type: 'overdue',
    name: 'Overdue Notice',
    subject: 'Overdue Notice: {{item_title}}',
    body_text: `Dear {{patron_name}},\n\nThe following item is overdue and must be returned immediately:\n\n{{item_title}}\n\nDue date: {{due_date}}\n\nPlease return this item to {{library_name}} as soon as possible to avoid additional fines.\n\nThank you,\n{{library_name}}`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>The following item is overdue and must be returned immediately:</p>
<p><strong>{{item_title}}</strong><br/>Due date: {{due_date}}</p>
<p>Please return this item to {{library_name}} as soon as possible to avoid additional fines.</p>
<p>Thank you,\n{{library_name}}</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      item_title: { type: 'string', required: true, description: 'Title of the overdue item' },
      due_date: { type: 'date', required: true, description: 'Item due date' },
      library_name: { type: 'string', required: false, description: 'Library name' },
    },
  },
  overdue_escalation: {
    id: 'overdue-escalation-default',
    notice_type: 'overdue_escalation',
    name: 'Overdue Escalation',
    subject: 'Final Notice: {{item_title}}',
    body_text: `Dear {{patron_name}},\n\nThis is a final notice regarding the following overdue item:\n\n{{item_title}}\n\nDue date was {{due_date}}\n\nPlease return this item immediately or contact the library to discuss renewal or payment options.\n\nThank you,\n{{library_name}}`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>This is a final notice regarding the following overdue item:</p>
<p><strong>{{item_title}}</strong><br/>Due date was {{due_date}}</p>
<p>Please return this item immediately or contact the library to discuss renewal or payment options.</p>
<p>Thank you,\n{{library_name}}</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      item_title: { type: 'string', required: true, description: 'Title of the overdue item' },
      due_date: { type: 'date', required: true, description: 'Item due date' },
      library_name: { type: 'string', required: false, description: 'Library name' },
    },
  },
  hold_ready: {
    id: 'hold-ready-default',
    notice_type: 'hold_ready',
    name: 'Hold Ready',
    subject: 'Hold Ready: {{item_title}}',
    body_text: `Dear {{patron_name}},\n\nThe item you requested, {{item_title}}, is now available for pickup.\n\nPlease pick up this item at {{hold_pickup_location}} within 3 days.\n\nThank you,\n{{library_name}}`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>The item you requested, <strong>{{item_title}}</strong>, is now available for pickup.</p>
<p>Please pick up this item at <strong>{{hold_pickup_location}}</strong> within 3 days.</p>
<p>Thank you,\n{{library_name}}</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      item_title: { type: 'string', required: true, description: 'Title of the hold-ready item' },
      hold_pickup_location: { type: 'string', required: true, description: 'Pickup location name' },
      library_name: { type: 'string', required: false, description: 'Library name' },
    },
  },
  hold_cancelled: {
    id: 'hold-cancelled-default',
    notice_type: 'hold_cancelled',
    name: 'Hold Cancelled',
    subject: 'Hold Cancelled: {{item_title}}',
    body_text: `Dear {{patron_name}},\n\nYour hold on {{item_title}} has been cancelled.\n\nThe item is now available for other patrons.\n\nThank you,\n{{library_name}}`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>Your hold on <strong>{{item_title}}</strong> has been cancelled.</p>
<p>The item is now available for other patrons.</p>
<p>Thank you,\n{{library_name}}</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      item_title: { type: 'string', required: true, description: 'Title of the cancelled hold item' },
      library_name: { type: 'string', required: false, description: 'Library name' },
    },
  },
  renewal_confirmation: {
    id: 'renewal-confirmation-default',
    notice_type: 'renewal_confirmation',
    name: 'Renewal Confirmation',
    subject: 'Renewal Confirmed: {{item_title}}',
    body_text: `Dear {{patron_name}},\n\nYour renewal for the following item has been confirmed:\n\n{{item_title}}\n\nNew due date: {{due_date}}\n\nThank you for using {{library_name}}.`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>Your renewal for the following item has been confirmed:</p>
<p><strong>{{item_title}}</strong><br/>New due date: {{due_date}}</p>
<p>Thank you for using {{library_name}}.</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      item_title: { type: 'string', required: true, description: 'Title of the renewed item' },
      due_date: { type: 'date', required: true, description: 'New due date after renewal' },
      library_name: { type: 'string', required: false, description: 'Library name' },
    },
  },
  fine_notice: {
    id: 'fine-notice-default',
    notice_type: 'fine_notice',
    name: 'Fine Notice',
    subject: 'Fine Notice: {{item_title}}',
    body_text: `Dear {{patron_name}},\n\nA fine has been assessed for the following item:\n\n{{item_title}}\n\nFine amount: {{fine_amount}}\n\nPlease pay this fine at {{library_name}}.\n\nThank you,\n{{library_name}}`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>A fine has been assessed for the following item:</p>
<p><strong>{{item_title}}</strong><br/>Fine amount: {{fine_amount}}</p>
<p>Please pay this fine at {{library_name}}.</p>
<p>Thank you,\n{{library_name}}</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      item_title: { type: 'string', required: true, description: 'Title of the fined item' },
      fine_amount: { type: 'string', required: true, description: 'Fine amount' },
      library_name: { type: 'string', required: false, description: 'Library name' },
    },
  },

  // ACCOUNT types
  welcome: {
    id: 'welcome-default',
    notice_type: 'welcome',
    name: 'Welcome',
    subject: 'Welcome to {{library_name}}',
    body_text: `Dear {{patron_name}},\n\nWelcome to {{library_name}}! Your account has been created.\n\nUsername: {{username}}\n\nIf you have any questions, please contact the library.`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>Welcome to <strong>{{library_name}}</strong>! Your account has been created.</p>
<p><strong>Username:</strong> {{username}}</p>
<p>If you have any questions, please contact the library.</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'New patron full name' },
      library_name: { type: 'string', required: true, description: 'Library name' },
      username: { type: 'string', required: true, description: 'Account username' },
    },
  },
  email_verification: {
    id: 'email-verification-default',
    notice_type: 'email_verification',
    name: 'Email Verification',
    subject: 'Verify Your Email',
    body_text: `Dear {{patron_name}},\n\nPlease verify your email address by clicking the link below:\n\n{{verification_url}}\n\nThis link will expire in 24 hours.\n\nThank you,\n{{library_name}}`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>Please verify your email address by clicking the link below:</p>
<p><a href="{{verification_url}}">Verify Email</a></p>
<p>This link will expire in 24 hours.</p>
<p>Thank you,\n{{library_name}}</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      verification_url: { type: 'string', required: true, description: 'Email verification URL' },
      library_name: { type: 'string', required: false, description: 'Library name' },
    },
  },
  password_reset: {
    id: 'password-reset-default',
    notice_type: 'password_reset',
    name: 'Password Reset',
    subject: 'Password Reset',
    body_text: `Dear {{patron_name}},\n\nTo reset your password, click the link below:\n\n{{reset_url}}\n\nThis link will expire in 1 hour.\n\nIf you did not request a password reset, please ignore this email.\n\nThank you,\n{{library_name}}`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>To reset your password, click the link below:</p>
<p><a href="{{reset_url}}">Reset Password</a></p>
<p>This link will expire in 1 hour.</p>
<p>If you did not request a password reset, please ignore this email.</p>
<p>Thank you,\n{{library_name}}</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      reset_url: { type: 'string', required: true, description: 'Password reset URL' },
      library_name: { type: 'string', required: false, description: 'Library name' },
    },
  },
  account_expiry: {
    id: 'account-expiry-default',
    notice_type: 'account_expiry',
    name: 'Account Expiry',
    subject: 'Account Expiry Warning',
    body_text: `Dear {{patron_name}},\n\nYour account at {{library_name}} is expiring on {{expiry_date}}.\n\nPlease renew your membership to continue accessing library services.\n\nThank you.`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>Your account at <strong>{{library_name}}</strong> is expiring on <strong>{{expiry_date}}</strong>.</p>
<p>Please renew your membership to continue accessing library services.</p>
<p>Thank you.</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      library_name: { type: 'string', required: true, description: 'Library name' },
      expiry_date: { type: 'date', required: true, description: 'Account expiry date' },
    },
  },
  account_restriction: {
    id: 'account-restriction-default',
    notice_type: 'account_restriction',
    name: 'Account Restriction',
    subject: 'Account Restriction',
    body_text: `Dear {{patron_name}},\n\nYour account at {{library_name}} has been restricted. Reason: {{restriction_reason}}.\n\nTo restore access, please contact the library.\n\nThank you.`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>Your account at <strong>{{library_name}}</strong> has been restricted. Reason: {{restriction_reason}}.</p>
<p>To restore access, please contact the library.</p>
<p>Thank you.</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      library_name: { type: 'string', required: true, description: 'Library name' },
      restriction_reason: { type: 'string', required: true, description: 'Reason for restriction' },
    },
  },

  // REPOSITORY types
  submission_received: {
    id: 'submission-received-default',
    notice_type: 'submission_received',
    name: 'Submission Received',
    subject: 'Submission Received',
    body_text: `Dear {{patron_name}},\n\nYour submission has been received. Status: {{submission_status}}.\n\nYou can track the progress via your dashboard.\n\nThank you,{{library_name}}`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>Your submission has been received. Status: {{submission_status}}.</p>
<p>You can track the progress via your dashboard.</p>
<p>Thank you,{{library_name}}</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      submission_status: { type: 'string', required: true, description: 'Current submission status' },
      library_name: { type: 'string', required: false, description: 'Library name' },
    },
  },
  reviewer_assigned: {
    id: 'reviewer-assigned-default',
    notice_type: 'reviewer_assigned',
    name: 'Reviewer Assigned',
    subject: 'Reviewer Assigned',
    body_text: `Dear {{patron_name}},\n\nA reviewer has been assigned to your submission: {{submission_title}}.\n\nYou can expect feedback within {{review_timeout}} days.\n\nThank you,{{library_name}}`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>A reviewer has been assigned to your submission: <strong>{{submission_title}}</strong>.</p>
<p>You can expect feedback within <strong>{{review_timeout}}</strong> days.</p>
<p>Thank you,{{library_name}}</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      submission_title: { type: 'string', required: true, description: 'Title of the submitted work' },
      review_timeout: { type: 'string', required: true, description: 'Expected feedback timeout in days' },
      library_name: { type: 'string', required: false, description: 'Library name' },
    },
  },
  changes_requested: {
    id: 'changes-requested-default',
    notice_type: 'changes_requested',
    name: 'Changes Requested',
    subject: 'Changes Requested',
    body_text: `Dear {{patron_name}},\n\nChanges have been requested for your submission: {{submission_title}}.\n\nPlease address the following: {{changes_details}}\n\nThank you,{{library_name}}`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>Changes have been requested for your submission: <strong>{{submission_title}}</strong>.</p>
<p>Please address the following: {{changes_details}}</p>
<p>Thank you,{{library_name}}</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      submission_title: { type: 'string', required: true, description: 'Title of the submitted work' },
      changes_details: { type: 'string', required: true, description: 'Details of requested changes' },
      library_name: { type: 'string', required: false, description: 'Library name' },
    },
  },
  returned_for_correction: {
    id: 'returned-for-correction-default',
    notice_type: 'returned_for_correction',
    name: 'Returned for Correction',
    subject: 'Returned for Correction',
    body_text: `Dear {{patron_name}},\n\nYour submission has been returned for correction: {{submission_title}}.\n\nPlease address the issues and resubmit within {{resubmit_timeout}} days.\n\nThank you,{{library_name}}`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>Your submission has been returned for correction: <strong>{{submission_title}}</strong>.</p>
<p>Please address the issues and resubmit within <strong>{{resubmit_timeout}}</strong> days.</p>
<p>Thank you,{{library_name}}</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      submission_title: { type: 'string', required: true, description: 'Title of the submitted work' },
      resubmit_timeout: { type: 'string', required: true, description: 'Resubmission timeout in days' },
      library_name: { type: 'string', required: false, description: 'Library name' },
    },
  },
  approved: {
    id: 'approved-default',
    notice_type: 'approved',
    name: 'Approved',
    subject: 'Approved: {{submission_title}}',
    body_text: `Dear {{patron_name}},\n\nYour submission: {{submission_title}} has been approved.\n\nCongratulations!\\n\nYou can access the published version via your dashboard.\n\nThank you,{{library_name}}`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>Your submission: <strong>{{submission_title}}</strong> has been approved.</p>
<p><strong>Congratulations!</strong></p>
<p>You can access the published version via your dashboard.</p>
<p>Thank you,{{library_name}}</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      submission_title: { type: 'string', required: true, description: 'Title of the approved submission' },
      library_name: { type: 'string', required: false, description: 'Library name' },
    },
  },
  rejected: {
    id: 'rejected-default',
    notice_type: 'rejected',
    name: 'Rejected',
    subject: 'Rejected: {{submission_title}}',
    body_text: `Dear {{patron_name}},\n\nYour submission: {{submission_title}} has been rejected.\n\nFeedback: {{rejection_feedback}}\n\nYou may resubmit after addressing the feedback.\n\nThank you,{{library_name}}`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>Your submission: <strong>{{submission_title}}</strong> has been rejected.</p>
<p><strong>Feedback:</strong> {{rejection_feedback}}</p>
<p>You may resubmit after addressing the feedback.</p>
<p>Thank you,{{library_name}}</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      submission_title: { type: 'string', required: true, description: 'Title of the rejected submission' },
      rejection_feedback: { type: 'string', required: true, description: 'Rejection feedback' },
      library_name: { type: 'string', required: false, description: 'Library name' },
    },
  },
  published: {
    id: 'published-default',
    notice_type: 'published',
    name: 'Published',
    subject: 'Published: {{submission_title}}',
    body_text: `Dear {{patron_name}},\n\nYour submission: {{submission_title}} has been published.\n\nCongratulations!\\n\nThe published version is available at {{published_url}}.\n\nThank you,{{library_name}}`,
    body_html: `<p>Dear {{patron_name}},</p>
<p>Your submission: <strong>{{submission_title}}</strong> has been published.</p>
<p><strong>Congratulations!</strong></p>
<p>The published version is available at <a href="{{published_url}}">{{published_url}}</a>.</p>
<p>Thank you,{{library_name}}</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      patron_name: { type: 'string', required: true, description: 'Recipient full name' },
      submission_title: { type: 'string', required: true, description: 'Title of the published submission' },
      published_url: { type: 'string', required: true, description: 'URL of the published work' },
      library_name: { type: 'string', required: false, description: 'Library name' },
    },
  },

  // ACQUISITIONS/SERIALS types
  claim_notice: {
    id: 'claim-notice-default',
    notice_type: 'claim_notice',
    name: 'Claim Notice',
    subject: 'Claim Notice',
    body_text: `Notice of claim regarding order {{order_number}}.\n\nStatus: {{claim_status}}.\n\nThank you.`,
    body_html: `<p>Notice of claim regarding order <strong>{{order_number}}</strong>.</p>
<p><strong>Status:</strong> {{claim_status}}.</p>
<p>Thank you.</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      order_number: { type: 'string', required: true, description: 'Order number' },
      claim_status: { type: 'string', required: true, description: 'Claim status' },
    },
  },
  order_notice: {
    id: 'order-notice-default',
    notice_type: 'order_notice',
    name: 'Order Notice',
    subject: 'Order Update: {{order_number}}',
    body_text: `Order {{order_number}} status update: {{order_status}}.\n\nThank you.`,
    body_html: `<p>Order <strong>{{order_number}}</strong> status update: {{order_status}}.</p>
<p>Thank you.</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      order_number: { type: 'string', required: true, description: 'Order number' },
      order_status: { type: 'string', required: true, description: 'Order status' },
    },
  },
  vendor_notice: {
    id: 'vendor-notice-default',
    notice_type: 'vendor_notice',
    name: 'Vendor Notice',
    subject: 'Vendor Notice',
    body_text: `Vendor notice: {{vendor_message}}.\n\nThank you.`,
    body_html: `<p>Vendor notice: {{vendor_message}}.</p>
<p>Thank you.</p>`,
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      vendor_message: { type: 'string', required: true, description: 'Vendor message content' },
    },
  },

  // ADMIN custom
  custom_notice: {
    id: 'custom-notice-default',
    notice_type: 'custom_notice',
    name: 'Custom Notice',
    subject: '{{subject_text}}',
    body_text: '{{body_text}}',
    body_html: '{{body_html}}',
    channel: 'email',
    locale: 'en',
    enabled: true,
    variables: {
      subject_text: { type: 'string', required: true, description: 'Custom subject' },
      body_text: { type: 'string', required: true, description: 'Custom body text' },
      body_html: { type: 'string', required: false, description: 'Custom body HTML' },
    },
  },
} as unknown as Record<NoticeType, Omit<NoticeTemplate, 'created_at' | 'updated_at' | 'version'>>;

/** Built-in defaults used to bootstrap notice_templates and as last-resort fallback. */
export const DEFAULT_TEMPLATES: Record<NoticeType, Omit<NoticeTemplate, 'created_at' | 'updated_at' | 'version'>> =
  templateStore;

const resolvedStore: Record<NoticeType, NoticeTemplate> = Object.fromEntries(
  Object.entries(templateStore).map(([key, value]) => [key, makeTemplate(value)])
) as Record<NoticeType, NoticeTemplate>;

/**
 * Look up a template by notice type. Returns the default template for the type.
 */
export function getTemplate(noticetype: NoticeType): NoticeTemplate {
  const t = resolvedStore[noticetype];
  if (!t) throw new Error(`No template found for notice type: ${noticetype}`);
  return t;
}

/**
 * List all enabled templates, optionally filtered by channel.
 */
export function listTemplates(
  channel?: NoticeTemplate['channel'],
  enabledOnly = true
): NoticeTemplate[] {
  const all: NoticeTemplate[] = Object.values(resolvedStore);
  return all.filter((t) => {
    if (enabledOnly && !t.enabled) return false;
    if (channel && t.channel !== channel) return false;
    return true;
  });
}