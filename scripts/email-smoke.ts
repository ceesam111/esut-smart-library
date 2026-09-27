import { getEmailProviderStatus, sendEmail, verifyGmailTransport } from '../src/server/email';
import { loadDotEnv } from './demo-seed-lib';

function argValue(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  loadDotEnv();
  const action = (argValue('action') ?? 'status').trim().toLowerCase();

  if (action === 'status') {
    console.log(JSON.stringify(getEmailProviderStatus(), null, 2));
    return;
  }

  if (action === 'verify') {
    console.log(JSON.stringify({ providers: getEmailProviderStatus(), gmail: await verifyGmailTransport() }, null, 2));
    return;
  }

  if (action !== 'send') {
    throw new Error('Unknown --action. Use: status | verify | send');
  }

  const to = argValue('to')?.trim();
  const confirmed = process.argv.includes('--send');
  if (!to || !confirmed) {
    throw new Error(
      'Sending requires an explicit recipient and flag:\n' +
        '  npx tsx scripts/email-smoke.ts --action=send --to=you@example.com --send',
    );
  }

  const result = await sendEmail({
    to,
    subject: 'ESUT Library email smoke test',
    html: '<p>This is a smoke test from the ESUT Library email service (Resend primary, Gmail fallback).</p>',
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
