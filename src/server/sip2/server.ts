import {
  buildSip2Message,
  fieldOf,
  parseSip2Message,
  SIP2_CODES,
  SIP2_INSTITUTION_ID,
  SIP2_LIBRARY_NAME,
  SIP2_PROTOCOL_VERSION,
  sip2DateTime,
  supportedMessagesBx,
  type Sip2Message,
} from './messages';
import { authenticateSip2Terminal, isOperationAllowed, logSip2Event } from './auth';
import {
  checkoutSip2,
  checkinSip2,
  patronCirculationSummary,
  patronStatusFlags,
  renewSip2,
  resolveItemBarcode,
  resolvePatronBarcode,
} from '@/server/circulation/circulationService';

export interface Sip2Session {
  terminalId: string | null;
  authenticated: boolean;
  allowedOperations: string[];
  clientIp: string | null;
  patronBarcode: string | null;
  lastRequestRaw: string | null;
  lastResponse: string | null;
  messagesProcessed: number;
}

export interface Sip2HandlerDeps {
  authenticate?: typeof authenticateSip2Terminal;
  checkout?: typeof checkoutSip2;
  checkin?: typeof checkinSip2;
  renew?: typeof renewSip2;
  resolvePatron?: typeof resolvePatronBarcode;
  resolveItem?: typeof resolveItemBarcode;
  patronSummary?: typeof patronCirculationSummary;
  logEvent?: typeof logSip2Event;
}

export interface HandleSip2Result {
  /** Wire response (CR-terminated), or null when the message must be ignored. */
  response: string | null;
  session: Sip2Session;
}

export function createSip2Session(clientIp: string | null = null): Sip2Session {
  return {
    terminalId: null,
    authenticated: false,
    allowedOperations: [],
    clientIp,
    patronBarcode: null,
    lastRequestRaw: null,
    lastResponse: null,
    messagesProcessed: 0,
  };
}

function responseLanguage(message: Sip2Message | null): string {
  const lang = message?.fixed?.[0];
  return lang && /^\d{3}$/.test(lang) ? lang : '000';
}

function padCount(value: number): string {
  return String(Math.max(0, Math.min(9999, Math.round(value)))).padStart(4, '0');
}

function formatDueDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.replace(/[-T:]/g, '').slice(0, 8);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function amountField(amount: number): string {
  return amount.toFixed(2);
}

/** Response for a recognized command received before login, or an unsupported pair: failure form of the pair's response. */
function failureResponse(code: string, sequence: string | null, reason: string, patronBarcode?: string | null): string {
  const lang = '000';
  const now = sip2DateTime();
  let fields: Array<[string, string]>;
  let fixed: string;

  switch (code) {
    case '99':
      return buildSip2Message('98', `NNNNNN000003${now}${SIP2_PROTOCOL_VERSION}`, [
        ['AO', SIP2_INSTITUTION_ID],
        ['AM', SIP2_LIBRARY_NAME],
        ['BX', supportedMessagesBx()],
        ['AF', reason],
      ], { sequence });
    case '93':
      return buildSip2Message('94', '0', [], { sequence });
    case '23':
    case '01':
      fixed = `${' '.repeat(14)}${lang}${now}`;
      fields = [['AO', SIP2_INSTITUTION_ID], ['AF', reason]];
      if (patronBarcode) fields.push(['AA', patronBarcode]);
      return buildSip2Message('24', fixed, fields, { sequence });
    case '25':
      fixed = `${' '.repeat(14)}${lang}${now}`;
      fields = [['AO', SIP2_INSTITUTION_ID], ['BL', 'N'], ['AF', reason]];
      if (patronBarcode) fields.push(['AA', patronBarcode]);
      return buildSip2Message('26', fixed, fields, { sequence });
    case '63':
      fixed = `${' '.repeat(14)}${lang}${now}${'    '}${'    '}${'    '}${'    '}${'    '}${'    '}`;
      fields = [['AO', SIP2_INSTITUTION_ID], ['BL', 'N'], ['AF', reason]];
      if (patronBarcode) fields.push(['AA', patronBarcode]);
      return buildSip2Message('64', fixed, fields, { sequence });
    case '17':
      fixed = `010001${now}`;
      fields = [['AF', reason]];
      return buildSip2Message('18', fixed, fields, { sequence });
    case '11':
    case '29':
      fixed = `0NUN${now}`;
      fields = [['AO', SIP2_INSTITUTION_ID], ['AF', reason]];
      if (patronBarcode) fields.push(['AA', patronBarcode]);
      return buildSip2Message(code === '11' ? '12' : '30', fixed, fields, { sequence });
    case '09':
      fixed = `0NUN${now}`;
      fields = [['AO', SIP2_INSTITUTION_ID], ['AF', reason]];
      return buildSip2Message('10', fixed, fields, { sequence });
    case '35':
      fixed = `N${now}`;
      fields = [['AO', SIP2_INSTITUTION_ID], ['AF', reason]];
      if (patronBarcode) fields.push(['AA', patronBarcode]);
      return buildSip2Message('36', fixed, fields, { sequence });
    case '65':
      fixed = `000000000${now}`;
      fields = [['AO', SIP2_INSTITUTION_ID], ['AF', reason]];
      return buildSip2Message('66', fixed, fields, { sequence });
    case '15':
      fixed = `0N${now}`;
      fields = [['AO', SIP2_INSTITUTION_ID], ['AF', reason]];
      return buildSip2Message('16', fixed, fields, { sequence });
    case '19':
      fixed = `0${now}`;
      fields = [['AF', reason]];
      return buildSip2Message('20', fixed, fields, { sequence });
    case '37':
      fixed = `N${now}`;
      fields = [['AO', SIP2_INSTITUTION_ID], ['AF', reason]];
      if (patronBarcode) fields.push(['AA', patronBarcode]);
      return buildSip2Message('38', fixed, fields, { sequence });
    default:
      return '';
  }
}

const PRE_LOGIN_ALLOWED = new Set(['99', '93']);

function operationFor(code: string): string | null {
  switch (code) {
    case '63':
    case '23':
      return 'patron_info';
    case '17':
      return 'item_info';
    case '11':
    case '29':
      return 'checkout';
    case '09':
      return 'checkin';
    default:
      return null;
  }
}

export async function handleSip2Message(
  raw: string,
  session: Sip2Session,
  deps: Sip2HandlerDeps = {},
): Promise<HandleSip2Result> {
  const authenticate = deps.authenticate ?? authenticateSip2Terminal;
  const checkout = deps.checkout ?? checkoutSip2;
  const checkin = deps.checkin ?? checkinSip2;
  const renew = deps.renew ?? renewSip2;
  const resolvePatron = deps.resolvePatron ?? resolvePatronBarcode;
  const resolveItem = deps.resolveItem ?? resolveItemBarcode;
  const patronSummary = deps.patronSummary ?? patronCirculationSummary;
  const logEvent = deps.logEvent ?? logSip2Event;

  const next: Sip2Session = { ...session };
  next.messagesProcessed = session.messagesProcessed + 1;

  const done = (response: string | null): HandleSip2Result => {
    if (response !== null) {
      next.lastResponse = response;
    }
    return { response, session: next };
  };

  let message: Sip2Message | null;
  try {
    message = parseSip2Message(raw);
  } catch {
    message = null;
  }
  if (!message) {
    // Unparseable / unrecognized content: spec says ignore.
    await logEvent(next.terminalId, 'unparseable_message', false, { raw: raw.slice(0, 32) }, next.clientIp);
    return done(null);
  }

  // Bad checksum → 96 Request SC Resend (error detection enabled).
  if (message.hasChecksum && !message.checksumOk) {
    await logEvent(next.terminalId, 'checksum_failed', false, { code: message.code }, next.clientIp);
    return done(buildSip2Message('96', '', [], { sequence: null }));
  }

  // 97 Request ACS Resend → retransmit last response (or 96 if none).
  if (message.code === SIP2_CODES.REQUEST_ACS_RESEND) {
    await logEvent(next.terminalId, 'acs_resend_requested', true, null, next.clientIp);
    return done(next.lastResponse ?? buildSip2Message('96', '', [], { sequence: null }));
  }

  // Duplicate of previous request (same raw bytes) → resend last response.
  if (next.lastRequestRaw !== null && next.lastRequestRaw === message.raw) {
    await logEvent(next.terminalId, 'duplicate_request', true, { code: message.code }, next.clientIp);
    return done(next.lastResponse);
  }
  next.lastRequestRaw = message.raw;

  const sequence = message.sequence;
  const code = message.code;
  const unsupported = (): HandleSip2Result =>
    done(failureResponse(code, sequence, 'Operation not supported by this ACS.', next.patronBarcode));

  try {
    if (PRE_LOGIN_ALLOWED.has(code)) {
      // handled below
    } else if (!next.authenticated) {
      await logEvent(next.terminalId, 'pre_login_blocked', false, { code }, next.clientIp);
      const failure = failureResponse(code, sequence, 'Login required.', next.patronBarcode);
      return done(failure || null);
    }

    switch (code) {
      case '99': {
        const response = buildSip2Message(
          '98',
          `YYYYNN100003${sip2DateTime()}${SIP2_PROTOCOL_VERSION}`,
          [
            ['AO', SIP2_INSTITUTION_ID],
            ['AM', SIP2_LIBRARY_NAME],
            ['BX', supportedMessagesBx()],
          ],
          { sequence },
        );
        await logEvent(next.terminalId, 'status_request', true, null, next.clientIp);
        return done(response);
      }

      case '93': {
        const uidAlg = message.fixed[0];
        const pwdAlg = message.fixed[1];
        const username = fieldOf(message, 'CN') ?? '';
        const password = fieldOf(message, 'CO') ?? '';
        if (uidAlg !== '0' || pwdAlg !== '0') {
          await logEvent(next.terminalId, 'login_rejected', false, { reason: 'unsupported_algorithm' }, next.clientIp);
          return done(buildSip2Message('94', '0', [], { sequence }));
        }
        const result = await authenticate(username, password, SIP2_INSTITUTION_ID, next.clientIp);
        if (result.success) {
          next.authenticated = true;
          next.terminalId = result.terminalId ?? null;
          next.allowedOperations = result.allowedOperations ?? [];
          return done(buildSip2Message('94', '1', [], { sequence }));
        }
        return done(buildSip2Message('94', '0', [], { sequence }));
      }

      case '63':
      case '23': {
        const operation = operationFor(code)!;
        if (!isOperationAllowed(next.allowedOperations, operation)) {
          await logEvent(next.terminalId, 'operation_denied', false, { code, operation }, next.clientIp);
          return done(failureResponse(code, sequence, 'Operation not allowed for this terminal.', next.patronBarcode));
        }
        const barcode = fieldOf(message, 'AA') ?? '';
        const patron = await resolvePatron(barcode);
        const lang = responseLanguage(message);
        next.patronBarcode = barcode || null;
        if (!patron) {
          if (code === '23') {
            return done(
              buildSip2Message(
                '24',
                `${' '.repeat(14)}${lang}${sip2DateTime()}`,
                [['AO', SIP2_INSTITUTION_ID], ['AA', barcode], ['BL', 'N'], ['AF', 'Patron not found.']],
                { sequence },
              ),
            );
          }
          return done(
            buildSip2Message(
              '64',
              `${' '.repeat(14)}${lang}${sip2DateTime()}${'    '}${'    '}${'    '}${'    '}${'    '}${'    '}`,
              [['AO', SIP2_INSTITUTION_ID], ['AA', barcode], ['BL', 'N'], ['AF', 'Patron not found.']],
              { sequence },
            ),
          );
        }

        const summary = await patronSummary(patron.id);
        const blocked = patron.status !== 'active';
        const flags = patronStatusFlags({
          blocked,
          renewalDenied: summary.overdueCount > 0,
          atLoanLimit: summary.chargedCount > 0 && summary.chargedCount >= 100,
          hasOverdue: summary.overdueCount > 0,
          excessiveFines: summary.fineAmount >= 10000,
        });
        const baseFields: Array<[string, string]> = [
          ['AO', SIP2_INSTITUTION_ID],
          ['AA', patron.patron_id],
          ['AE', patron.full_name],
          ['BL', 'Y'],
          ['CQ', 'N'],
          ['BH', 'NGN'],
        ];
        if (summary.fineAmount > 0) baseFields.push(['BV', amountField(summary.fineAmount)]);

        if (code === '23') {
          await logEvent(next.terminalId, 'patron_status', true, { patron: patron.patron_id }, next.clientIp);
          return done(
            buildSip2Message('24', `${flags}${lang}${sip2DateTime()}`, baseFields, { sequence }),
          );
        }

        const summaryField = message.fixed[2] ?? '';
        const want = (pos: number) => summaryField.charAt(pos) === 'Y';
        const fields = [...baseFields];
        if (want(0)) for (const title of summary.holdTitles) fields.push(['AS', title]);
        if (want(1)) for (const title of summary.overdueTitles) fields.push(['AT', title]);
        if (want(2)) for (const title of summary.chargedTitles) fields.push(['AU', title]);
        if (want(3) && summary.fineItemCount > 0) fields.push(['AV', `${summary.fineItemCount} unpaid fine(s)`]);
        const counts =
          padCount(summary.holdCount) +
          padCount(summary.overdueCount) +
          padCount(summary.chargedCount) +
          padCount(summary.fineItemCount) +
          '    ' +
          '    ';
        await logEvent(next.terminalId, 'patron_info', true, { patron: patron.patron_id }, next.clientIp);
        return done(
          buildSip2Message('64', `${flags}${lang}${sip2DateTime()}${counts}`, fields, { sequence }),
        );
      }

      case '35': {
        const barcode = fieldOf(message, 'AA') ?? next.patronBarcode ?? '';
        next.patronBarcode = null;
        await logEvent(next.terminalId, 'end_session', true, null, next.clientIp);
        return done(
          buildSip2Message(
            '36',
            `Y${sip2DateTime()}`,
            [['AO', SIP2_INSTITUTION_ID], ['AA', barcode]],
            { sequence },
          ),
        );
      }

      case '17': {
        const operation = operationFor(code)!;
        if (!isOperationAllowed(next.allowedOperations, operation)) {
          await logEvent(next.terminalId, 'operation_denied', false, { code, operation }, next.clientIp);
          return done(failureResponse(code, sequence, 'Operation not allowed for this terminal.'));
        }
        const barcode = fieldOf(message, 'AB') ?? '';
        const resolved = await resolveItem(barcode);
        if (!resolved) {
          await logEvent(next.terminalId, 'item_info', false, { barcode, reason: 'not_found' }, next.clientIp);
          return done(
            buildSip2Message(
              '18',
              `010001${sip2DateTime()}`,
              [['AF', 'Item not found.']],
              { sequence },
            ),
          );
        }
        const item = resolved.item;
        const status = item.available_copies > 0 ? '03' : '04';
        const fields: Array<[string, string]> = [
          ['AB', barcode],
          ['AJ', item.title],
        ];
        await logEvent(next.terminalId, 'item_info', true, { barcode }, next.clientIp);
        return done(
          buildSip2Message('18', `${status}0001${sip2DateTime()}`, fields, { sequence }),
        );
      }

      case '11':
      case '29': {
        const operation = operationFor(code)!;
        if (!isOperationAllowed(next.allowedOperations, operation)) {
          await logEvent(next.terminalId, 'operation_denied', false, { code, operation }, next.clientIp);
          return done(failureResponse(code, sequence, 'Operation not allowed for this terminal.', next.patronBarcode));
        }
        const patronBarcode = fieldOf(message, 'AA') ?? '';
        const itemBarcode = fieldOf(message, 'AB') ?? '';
        const responseCode = code === '11' ? '12' : '30';

        if (!patronBarcode || !itemBarcode) {
          return done(
            buildSip2Message(
              responseCode,
              `0NUN${sip2DateTime()}`,
              [['AO', SIP2_INSTITUTION_ID], ['AF', 'Patron and item identifiers are required.']],
              { sequence },
            ),
          );
        }

        const result = code === '11'
          ? await checkout({ patronBarcode, itemBarcode })
          : await renew({ patronBarcode, itemBarcode });

        if (result.outcome === 'checked_out' || result.outcome === 'renewed') {
          const resolved = await resolveItem(itemBarcode);
          const fields: Array<[string, string]> = [
            ['AO', SIP2_INSTITUTION_ID],
            ['AA', patronBarcode],
            ['AB', itemBarcode],
          ];
          if (resolved) fields.push(['AJ', resolved.item.title]);
          fields.push(['AH', formatDueDate(result.dueDate)]);
          await logEvent(next.terminalId, code === '11' ? 'checkout' : 'renew', true, { patronBarcode, itemBarcode }, next.clientIp);
          const renewalOk = code === '29' ? 'Y' : 'N';
          return done(
            buildSip2Message(responseCode, `1${renewalOk}UN${sip2DateTime()}`, fields, { sequence }),
          );
        }

        if (result.outcome === 'already_held') {
          // Idempotent success: patron already holds the item (spec: renewal ok = Y).
          const resolved = await resolveItem(itemBarcode);
          const fields: Array<[string, string]> = [
            ['AO', SIP2_INSTITUTION_ID],
            ['AA', patronBarcode],
            ['AB', itemBarcode],
          ];
          if (resolved) fields.push(['AJ', resolved.item.title]);
          fields.push(['AH', formatDueDate(result.dueDate)]);
          fields.push(['AF', 'Item already checked out to this patron.']);
          await logEvent(next.terminalId, 'checkout_duplicate', true, { patronBarcode, itemBarcode }, next.clientIp);
          return done(
            buildSip2Message(responseCode, `1YUN${sip2DateTime()}`, fields, { sequence }),
          );
        }

        await logEvent(
          next.terminalId,
          code === '11' ? 'checkout' : 'renew',
          false,
          { patronBarcode, itemBarcode, reason: result.code },
          next.clientIp,
        );
        return done(
          buildSip2Message(
            responseCode,
            `0NUN${sip2DateTime()}`,
            [['AO', SIP2_INSTITUTION_ID], ['AA', patronBarcode], ['AB', itemBarcode], ['AF', result.message]],
            { sequence },
          ),
        );
      }

      case '09': {
        const operation = operationFor(code)!;
        if (!isOperationAllowed(next.allowedOperations, operation)) {
          await logEvent(next.terminalId, 'operation_denied', false, { code, operation }, next.clientIp);
          return done(failureResponse(code, sequence, 'Operation not allowed for this terminal.'));
        }
        const itemBarcode = fieldOf(message, 'AB') ?? '';
        if (!itemBarcode) {
          return done(
            buildSip2Message('10', `0NUN${sip2DateTime()}`, [['AO', SIP2_INSTITUTION_ID], ['AF', 'Item identifier is required.']], { sequence }),
          );
        }
        const result = await checkin({ itemBarcode, patronBarcode: null });
        if (result.outcome === 'returned') {
          const alert = result.fineAmount && result.fineAmount > 0 ? 'Y' : 'N';
          const fields: Array<[string, string]> = [
            ['AO', SIP2_INSTITUTION_ID],
            ['AB', itemBarcode],
            ['AJ', result.itemTitle],
          ];
          const notes: string[] = [];
          if (result.fineAmount && result.fineAmount > 0) notes.push(`Fine applied: NGN ${amountField(result.fineAmount)}`);
          if (notes.length > 0) fields.push(['AF', notes.join(' ')]);
          await logEvent(next.terminalId, 'checkin', true, { itemBarcode, fine: result.fineAmount ?? 0 }, next.clientIp);
          return done(buildSip2Message('10', `1NU${alert}${sip2DateTime()}`, fields, { sequence }));
        }
        if (result.outcome === 'no_loan') {
          await logEvent(next.terminalId, 'checkin_no_loan', true, { itemBarcode }, next.clientIp);
          return done(
            buildSip2Message(
              '10',
              `1NUN${sip2DateTime()}`,
              [['AO', SIP2_INSTITUTION_ID], ['AB', itemBarcode], ['AF', result.message]],
              { sequence },
            ),
          );
        }
        await logEvent(next.terminalId, 'checkin', false, { itemBarcode, reason: result.code }, next.clientIp);
        return done(
          buildSip2Message(
            '10',
            `0NUN${sip2DateTime()}`,
            [['AO', SIP2_INSTITUTION_ID], ['AB', itemBarcode], ['AF', result.message]],
            { sequence },
          ),
        );
      }

      case '01':
      case '25':
      case '65':
      case '15':
      case '19':
      case '37': {
        await logEvent(next.terminalId, 'unsupported_command', false, { code }, next.clientIp);
        return unsupported();
      }

      default: {
        // Unrecognized command identifiers must be ignored (no response).
        await logEvent(next.terminalId, 'unknown_command', false, { code }, next.clientIp);
        return done(null);
      }
    }
  } catch (err) {
    const messageText = err instanceof Error ? err.message : 'Internal error.';
    await logEvent(next.terminalId, 'handler_error', false, { code, error: messageText }, next.clientIp);
    const failure = failureResponse(code, sequence, 'Internal error — try again.', next.patronBarcode);
    if (failure) return done(failure);
    return done(null);
  }
}
