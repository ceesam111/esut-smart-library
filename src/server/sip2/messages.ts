export interface Sip2Message {
  code: string;
  fields: Map<string, string>;
  checksum: string;
  sequence: string;
}

export function parseSip2Message(raw: string): Sip2Message | null {
  const match = raw.match(/^(\d{2})(.{2})(\d{1})(.{1})([\s\S]*?)(AY\dAZ[\s\S]*?)$/);
  if (!match) return null;
  const [, code, statusCode, , , body,] = match;
  const fields = new Map<string, string>();
  let seq = '';
  const seqMatch = body.match(/AY(\d)/);
  if (seqMatch) seq = seqMatch[1];
  const fixedFields = body.match(/^(.{24})/);
  if (fixedFields) {
    const ff = fixedFields[1];
    fields.set('language', ff.slice(0, 3));
    fields.set('date', ff.slice(3, 19));
    fields.set('location', ff.slice(19, 24));
  }
  return { code, fields, checksum: '', sequence: seq };
}

export function buildSip2Response(code: string, fields: Array<[string, string]>, sequence: string): string {
  const fixed = '00eng' + new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14) + '00000';
  const body = fields.map(([tag, value]) => tag + value).join('') + 'AY' + sequence;
  const message = code + fixed + body;
  const checksum = computeChecksum(message + 'AZ');
  return message + checksum + '\r';
}

function computeChecksum(data: string): string {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum = (sum + data.charCodeAt(i)) & 0xFFFF;
  }
  const complement = (~sum + 1) & 0xFFFF;
  return complement.toString(16).toUpperCase().padStart(4, '0');
}

export const SIP2_CODES = {
  LOGIN: '93',
  LOGIN_RESPONSE: '94',
  PATRON_STATUS: '35',
  PATRON_STATUS_RESPONSE: '36',
  CHECKOUT: '11',
  CHECKOUT_RESPONSE: '12',
  RENEW: '17',
  RENEW_RESPONSE: '18',
  END_SESSION: '35',
  END_SESSION_RESPONSE: '36',
} as const;
