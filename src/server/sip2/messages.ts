export const SIP2_PROTOCOL_VERSION = '2.00';
export const SIP2_INSTITUTION_ID = 'ESUT';
export const SIP2_LIBRARY_NAME = 'ESUT Smart Library';

export interface Sip2Message {
  code: string;
  fixed: string[];
  fields: Map<string, string[]>;
  sequence: string | null;
  checksum: string | null;
  hasChecksum: boolean;
  checksumOk: boolean;
  body: string;
  raw: string;
}

/** Fixed-field lengths (after the 2-char command code) for every recognized SC→ACS command. */
const REQUEST_FIXED_LENGTHS: Record<string, number[]> = {
  '99': [1, 3, 4],              // status code, max print width, protocol version
  '93': [1, 1],                 // UID algorithm, PWD algorithm
  '23': [3, 18],                // language, transaction date
  '63': [3, 18, 10],            // language, transaction date, summary
  '17': [18],                   // transaction date
  '11': [1, 1, 18, 18],         // SC renewal policy, no block, transaction date, nb due date
  '09': [1, 18, 18],            // no block, transaction date, return date
  '29': [1, 1, 18, 18],         // third party allowed, no block, transaction date, nb due date
  '35': [18],                   // transaction date
  '01': [1, 18],                // card retained, transaction date
  '25': [18],                   // transaction date
  '65': [18],                   // transaction date
  '15': [1, 18],                // hold mode, transaction date
  '19': [18],                   // transaction date
  '37': [18, 2, 2, 3],          // transaction date, fee type, payment type, currency type
  '97': [],                     // Request ACS Resend — checksum only
};

export const SIP2_RECOGNIZED_COMMANDS = Object.keys(REQUEST_FIXED_LENGTHS);

export function computeSip2Checksum(data: string): string {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum = (sum + (data.charCodeAt(i) & 0xff)) & 0xffff;
  }
  const complement = (~sum + 1) & 0xffff;
  return complement.toString(16).toUpperCase().padStart(4, '0');
}

export function parseSip2Message(raw: string): Sip2Message | null {
  const message = raw.replace(/[\r\n]+$/, '');
  if (message.length < 2) return null;

  let body = message;
  let checksum: string | null = null;
  let sequence: string | null = null;
  let hasChecksum = false;
  let checksumOk = true;

  const checksumMatch = body.match(/AZ([0-9A-Fa-f]{4})$/);
  if (checksumMatch) {
    hasChecksum = true;
    checksum = checksumMatch[1].toUpperCase();
    const withoutChecksum = body.slice(0, body.length - 6);
    const expected = computeSip2Checksum(withoutChecksum + 'AZ');
    checksumOk = expected === checksum;
    const seqMatch = withoutChecksum.match(/AY(\d)$/);
    if (seqMatch) {
      sequence = seqMatch[1];
      body = withoutChecksum.slice(0, withoutChecksum.length - 3);
    } else {
      body = withoutChecksum;
    }
  } else {
    const seqMatch = body.match(/AY(\d)$/);
    if (seqMatch) {
      sequence = seqMatch[1];
      body = body.slice(0, body.length - 3);
    }
  }

  if (!/^\d{2}/.test(body)) return null;
  const code = body.slice(0, 2);
  const fixedLengths = REQUEST_FIXED_LENGTHS[code];
  const fixed: string[] = [];
  let fieldsStart = 2;

  if (fixedLengths) {
    const fixedTotal = fixedLengths.reduce((sum, len) => sum + len, 0);
    if (body.length - 2 < fixedTotal) return null;
    let cursor = 2;
    for (const len of fixedLengths) {
      fixed.push(body.slice(cursor, cursor + len));
      cursor += len;
    }
    fieldsStart = cursor;
  }

  const fields = new Map<string, string[]>();
  const rest = body.slice(fieldsStart);
  let i = 0;
  while (i + 3 <= rest.length) {
    const id = rest.slice(i, i + 2);
    if (!/^[A-Z][A-Z0-9]$/.test(id)) break;
    const delimiter = rest.indexOf('|', i + 2);
    if (delimiter === -1) break;
    const value = rest.slice(i + 2, delimiter);
    const existing = fields.get(id);
    if (existing) existing.push(value);
    else fields.set(id, [value]);
    i = delimiter + 1;
  }

  return { code, fixed, fields, sequence, checksum, hasChecksum, checksumOk, body, raw: message };
}

export function fieldOf(message: Sip2Message, id: string): string | null {
  const values = message.fields.get(id);
  return values && values.length > 0 ? values[values.length - 1] : null;
}

export interface BuildOptions {
  sequence?: string | null;
  checksum?: boolean;
}

/**
 * Assembles a wire message: code + fixed block + ID'd fields + optional AY + AZ + CR.
 * `fixed` must already be the exact fixed-field block for the message (no code, no fields).
 */
export function buildSip2Message(
  code: string,
  fixed: string,
  fields: Array<[string, string]>,
  options: BuildOptions = {},
): string {
  const { sequence = null, checksum = true } = options;
  let message = code + fixed;
  for (const [id, value] of fields) {
    message += `${id}${value}|`;
  }
  if (sequence !== null) message += `AY${sequence}`;
  if (checksum) message += `AZ${computeSip2Checksum(message + 'AZ')}`;
  return message + '\r';
}

/** Local time, ANSI X3.30/X3.43 form used by every 18-char date field: YYYYMMDDZZZZHHMMSS. */
export function sip2DateTime(date: Date = new Date()): string {
  const pad = (n: number, len: number) => String(n).padStart(len, '0');
  return (
    `${pad(date.getFullYear(), 4)}${pad(date.getMonth() + 1, 2)}${pad(date.getDate(), 2)}` +
    `    ` +
    `${pad(date.getHours(), 2)}${pad(date.getMinutes(), 2)}${pad(date.getSeconds(), 2)}`
  );
}

/** Parses YYYYMMDDZZZZHHMMSS (zone may be blanks or Z/other) into a Date, or null. */
export function parseSip2DateTime(value: string): Date | null {
  if (!/^\d{8}.{4}\d{6}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(12, 14));
  const minute = Number(value.slice(14, 16));
  const second = Number(value.slice(16, 18));
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export const SIP2_CODES = {
  SC_STATUS: '99',
  ACS_STATUS: '98',
  LOGIN: '93',
  LOGIN_RESPONSE: '94',
  PATRON_STATUS: '23',
  PATRON_STATUS_RESPONSE: '24',
  PATRON_INFO: '63',
  PATRON_INFO_RESPONSE: '64',
  ITEM_INFO: '17',
  ITEM_INFO_RESPONSE: '18',
  CHECKOUT: '11',
  CHECKOUT_RESPONSE: '12',
  CHECKIN: '09',
  CHECKIN_RESPONSE: '10',
  RENEW: '29',
  RENEW_RESPONSE: '30',
  END_SESSION: '35',
  END_SESSION_RESPONSE: '36',
  BLOCK_PATRON: '01',
  PATRON_ENABLE: '25',
  PATRON_ENABLE_RESPONSE: '26',
  HOLD: '15',
  HOLD_RESPONSE: '16',
  ITEM_STATUS_UPDATE: '19',
  ITEM_STATUS_UPDATE_RESPONSE: '20',
  FEE_PAID: '37',
  FEE_PAID_RESPONSE: '38',
  RENEW_ALL: '65',
  RENEW_ALL_RESPONSE: '66',
  REQUEST_ACS_RESEND: '97',
  REQUEST_SC_RESEND: '96',
} as const;

/** Command → response code, covering supported and recognized-but-unsupported pairs. */
export const SIP2_RESPONSE_FOR: Record<string, string> = {
  '99': '98',
  '93': '94',
  '23': '24',
  '63': '64',
  '17': '18',
  '11': '12',
  '09': '10',
  '29': '30',
  '35': '36',
  '01': '24',
  '25': '26',
  '65': '66',
  '15': '16',
  '19': '20',
  '37': '38',
  '97': '96',
};

/**
 * BX supported-messages, spec position order (0-based):
 * 0 Patron Status, 1 Checkout, 2 Checkin, 3 Block Patron, 4 SC/ACS Status,
 * 5 Resend, 6 Login, 7 Patron Information, 8 End Patron Session, 9 Fee Paid,
 * 10 Item Information, 11 Item Status Update, 12 Patron Enable, 13 Hold,
 * 14 Renew, 15 Renew All.
 */
const SUPPORTED_PAIRS: Record<number, boolean> = {
  0: true, 1: true, 2: true, 3: false, 4: true, 5: true, 6: true, 7: true,
  8: true, 9: false, 10: true, 11: false, 12: false, 13: false, 14: true, 15: false,
};

export function supportedMessagesBx(): string {
  let out = '';
  for (let pos = 0; pos < 16; pos++) out += SUPPORTED_PAIRS[pos] ? 'Y' : 'N';
  return out;
}
