export interface NoticeInput {
  type: 'overdue' | 'due_soon' | 'hold_available' | 'receipt' | 'fine';
  recipient_email: string;
  recipient_name: string;
  item_title: string;
  item_id?: string;
  due_date?: string;
  return_date?: string;
  fine_amount?: number;
  loan_id?: string;
  library_name?: string;
}

export function generateNoticeContent(input: NoticeInput): { subject: string; html: string; text: string } {
  const library = input.library_name || 'ESUT Library';
  const item = input.item_title || 'Library item';

  switch (input.type) {
    case 'overdue': {
      const subject = `Overdue Notice: ${item}`;
      const html = `<p>Dear ${input.recipient_name},</p>
<p>The following item is overdue and must be returned immediately:</p>
<p><strong>${item}</strong><br/>Due date: ${input.due_date || 'N/A'}</p>
<p>Please return this item to ${library} as soon as possible to avoid additional fines.</p>
<p>Thank you,<br/>${library}</p>`;
      const text = `Dear ${input.recipient_name},\n\nThe following item is overdue:\n\n${item}\nDue date: ${input.due_date || 'N/A'}\n\nPlease return this item to ${library} as soon as possible.\n\nThank you,\n${library}`;
      return { subject, html, text };
    }
    case 'due_soon': {
      const subject = `Due Soon Reminder: ${item}`;
      const html = `<p>Dear ${input.recipient_name},</p>
<p>This is a reminder that the following item is due soon:</p>
<p><strong>${item}</strong><br/>Due date: ${input.due_date || 'N/A'}</p>
<p>Please return or renew this item before the due date to avoid fines.</p>
<p>Thank you,<br/>${library}</p>`;
      const text = `Dear ${input.recipient_name},\n\nThis is a reminder that the following item is due soon:\n\n${item}\nDue date: ${input.due_date || 'N/A'}\n\nPlease return or renew this item before the due date.\n\nThank you,\n${library}`;
      return { subject, html, text };
    }
    case 'hold_available': {
      const subject = `Hold Available: ${item}`;
      const html = `<p>Dear ${input.recipient_name},</p>
<p>An item you requested is now available for pickup:</p>
<p><strong>${item}</strong></p>
<p>Please pick up this item at ${library} within 3 days.</p>
<p>Thank you,<br/>${library}</p>`;
      const text = `Dear ${input.recipient_name},\n\nAn item you requested is now available for pickup:\n\n${item}\n\nPlease pick up this item at ${library} within 3 days.\n\nThank you,\n${library}`;
      return { subject, html, text };
    }
    case 'receipt': {
      const subject = `Return Receipt: ${item}`;
      const html = `<p>Dear ${input.recipient_name},</p>
<p>This confirms the return of the following item:</p>
<p><strong>${item}</strong><br/>Returned on: ${input.return_date || new Date().toISOString().slice(0, 10)}</p>
<p>Thank you for using ${library}.</p>`;
      const text = `Dear ${input.recipient_name},\n\nThis confirms the return of the following item:\n\n${item}\nReturned on: ${input.return_date || new Date().toISOString().slice(0, 10)}\n\nThank you for using ${library}.`;
      return { subject, html, text };
    }
    case 'fine': {
      const subject = `Fine Notice: ${item}`;
      const html = `<p>Dear ${input.recipient_name},</p>
<p>A fine has been assessed for the following item:</p>
<p><strong>${item}</strong><br/>Fine amount: ₦${input.fine_amount?.toFixed(2) || '0.00'}</p>
<p>Please pay this fine at ${library}.</p>
<p>Thank you,<br/>${library}</p>`;
      const text = `Dear ${input.recipient_name},\n\nA fine has been assessed for the following item:\n\n${item}\nFine amount: ₦${input.fine_amount?.toFixed(2) || '0.00'}\n\nPlease pay this fine at ${library}.\n\nThank you,\n${library}`;
      return { subject, html, text };
    }
  }
}
