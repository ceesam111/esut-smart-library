import { institutionConfig as cfg } from '@config/institution.config';
import nodemailer from 'nodemailer';

const BRAND = {
  primary: cfg.primaryColour,
  accent: '#C9A84C',
  libraryName: cfg.libraryName,
  institution: cfg.name,
  location: cfg.state ? `${cfg.state} State, Nigeria` : 'Nigeria',
  supportEmail: cfg.supportEmail,
  domainLabel: cfg.primaryDomain,
  domainUrl: cfg.domain,
};

function template(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${BRAND.libraryName}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
  <tr>
    <td style="background:${BRAND.primary};border-radius:12px 12px 0 0;padding:28px 32px">
      <p style="margin:0;color:${BRAND.accent};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${BRAND.libraryName}</p>
      <h1 style="margin:4px 0 0;color:#ffffff;font-size:22px;font-weight:700">${BRAND.institution}</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px">${BRAND.location}</p>
    </td>
  </tr>
  <tr>
    <td style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none">
      ${content}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 20px">
      <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
        ${BRAND.libraryName} &middot; ${BRAND.location}<br>
        <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primary}">${BRAND.supportEmail}</a>
        &nbsp;&middot;&nbsp;
        <a href="${BRAND.domainUrl}" style="color:${BRAND.primary}">${BRAND.domainLabel}</a>
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendEmail(to: string, toName: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
  const fromName = process.env.FROM_NAME || BRAND.libraryName;

  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.');
  if (!fromEmail) throw new Error('FROM_EMAIL is not configured.');

  const port = Number(process.env.RESEND_SMTP_PORT || process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.RESEND_SMTP_HOST || process.env.SMTP_HOST || 'smtp.resend.com',
    port,
    secure: port === 465 || port === 2465,
    requireTLS: port === 587 || port === 2587,
    auth: {
      user: process.env.RESEND_SMTP_USER || process.env.SMTP_USER || 'resend',
      pass: apiKey,
    },
  });

  await transporter.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to: toName ? `${toName} <${to}>` : to,
    subject,
    html,
  });
}

export async function sendRegistrationVerificationEmailServer(patron: {
  email: string;
  full_name: string;
  verificationLink: string;
  expiresAt: string;
}) {
  const html = template(`
    <h2 style="color:#1A4731;margin-top:0">Verify Your ESUT Library Email</h2>
    <p style="color:#374151">Dear <strong>${patron.full_name}</strong>,</p>
    <p style="color:#374151">Please confirm that this email address belongs to you before your library account is activated.</p>
    <a href="${patron.verificationLink}" style="display:inline-block;background:#1A4731;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;margin:16px 0">Verify Email Address</a>
    <p style="color:#374151">This verification link expires on <strong>${new Date(patron.expiresAt).toLocaleString('en-GB')}</strong>.</p>
    <p style="color:#94a3b8;font-size:13px;line-height:1.6">If the button does not work, copy and paste this link into your browser:<br><a href="${patron.verificationLink}" style="color:#1A4731;word-break:break-all">${patron.verificationLink}</a></p>
  `);

  await sendEmail(patron.email, patron.full_name, 'Verify your ESUT Library email', html);
}
