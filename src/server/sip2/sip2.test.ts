import { describe, it, expect, vi } from 'vitest';
import {
  buildSip2Message,
  computeSip2Checksum,
  fieldOf,
  parseSip2Message,
  sip2DateTime,
  SIP2_CODES,
  SIP2_RESPONSE_FOR,
  SIP2_PROTOCOL_VERSION,
  supportedMessagesBx,
} from '@/server/sip2/messages';
import { createSip2Session, handleSip2Message, type Sip2HandlerDeps } from '@/server/sip2/server';

const DATE = '20261005    143015';

function makeDeps(overrides: Partial<Sip2HandlerDeps> = {}): Sip2HandlerDeps {
  return {
    authenticate: vi.fn(async () => ({ success: true, terminalId: 'term-1', allowedOperations: ['*'] })),
    checkout: vi.fn(),
    checkin: vi.fn(),
    renew: vi.fn(),
    resolvePatron: vi.fn(async () => null),
    resolveItem: vi.fn(async () => null),
    patronSummary: vi.fn(async () => ({
      chargedCount: 0,
      overdueCount: 0,
      holdCount: 0,
      fineItemCount: 0,
      fineAmount: 0,
      chargedTitles: [],
      overdueTitles: [],
      holdTitles: [],
    })),
    logEvent: vi.fn(async () => undefined),
    ...overrides,
  };
}

async function loginSession(deps: Sip2HandlerDeps, session = createSip2Session('127.0.0.1')) {
  const raw = buildSip2Message('93', '00', [['CN', 'kiosk-1'], ['CO', 'secret']], { sequence: '1' });
  const out = await handleSip2Message(raw, session, deps);
  expect(out.response).toMatch(/^941AY1AZ[0-9A-F]{4}\r$/);
  return out.session;
}

describe('SIP2 message layer', () => {
  it('computes a spec checksum (two-complement, uppercase, 4 hex)', () => {
    // sum('941') = 57+52+49 = 158 = 0x009E → complement 0xFF62
    expect(computeSip2Checksum('941')).toBe('FF62');
    expect(computeSip2Checksum('')).toBe('0000');
    expect(computeSip2Checksum('941')).toMatch(/^[0-9A-F]{4}$/);
  });

  it('round-trips a login request through build + parse', () => {
    const raw = buildSip2Message('93', '00', [['CN', 'kiosk-1'], ['CO', 'secret'], ['CP', 'MAIN']], { sequence: '3' });
    const parsed = parseSip2Message(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.code).toBe('93');
    expect(parsed!.fixed).toEqual(['0', '0']);
    expect(fieldOf(parsed!, 'CN')).toBe('kiosk-1');
    expect(fieldOf(parsed!, 'CO')).toBe('secret');
    expect(fieldOf(parsed!, 'CP')).toBe('MAIN');
    expect(parsed!.sequence).toBe('3');
    expect(parsed!.checksumOk).toBe(true);
    expect(parsed!.raw).toBe(raw.slice(0, -1)); // trailing CR tolerated, raw normalized
  });

  it('parses fixed blocks positionally for 63, 11, 09, 37', () => {
    const p63 = parseSip2Message(buildSip2Message('63', `000${DATE}Y         `, [['AO', 'ESUT'], ['AA', 'LIB001']], { sequence: '2' }));
    expect(p63!.fixed[0]).toBe('000');
    expect(p63!.fixed[1]).toBe(DATE);
    expect(p63!.fixed[2]).toBe('Y'.padEnd(10, ' '));

    const p11 = parseSip2Message(buildSip2Message('11', `NN${DATE}${DATE}`, [['AA', 'LIB001'], ['AB', 'BK1']], { sequence: '0' }));
    expect(p11!.fixed).toEqual(['N', 'N', DATE, DATE]);

    const p09 = parseSip2Message(buildSip2Message('09', `N${DATE}${DATE}`, [['AB', 'BK1']], { sequence: '4' }));
    expect(p09!.fixed).toEqual(['N', DATE, DATE]);

    const p37 = parseSip2Message(buildSip2Message('37', `${DATE}0100NGN`, [['BV', '250']], { sequence: '5' }));
    expect(p37!.fixed).toEqual([DATE, '01', '00', 'NGN']);
  });

  it('detects a corrupted checksum', () => {
    const raw = buildSip2Message('94', '1', [], { sequence: '1' });
    const corrupted = raw.slice(0, -5) + '0000\r';
    const parsed = parseSip2Message(corrupted);
    expect(parsed!.hasChecksum).toBe(true);
    expect(parsed!.checksumOk).toBe(false);
  });

  it('rejects invalid and truncated input', () => {
    expect(parseSip2Message('invalid')).toBeNull();
    expect(parseSip2Message('')).toBeNull();
    expect(parseSip2Message('93')).toBeNull();
    expect(parseSip2Message('930')).toBeNull();
  });

  it('accepts trailing CR without breaking checksum validation', () => {
    const raw = buildSip2Message('94', '1', [], { sequence: '1' });
    const parsed = parseSip2Message(raw + '\r');
    expect(parsed!.checksumOk).toBe(true);
    expect(parsed!.sequence).toBe('1');
  });

  it('maps every recognized command to its spec response', () => {
    expect(SIP2_CODES.PATRON_STATUS).toBe('23');
    expect(SIP2_CODES.PATRON_STATUS_RESPONSE).toBe('24');
    expect(SIP2_CODES.PATRON_INFO).toBe('63');
    expect(SIP2_CODES.PATRON_INFO_RESPONSE).toBe('64');
    expect(SIP2_CODES.CHECKOUT).toBe('11');
    expect(SIP2_CODES.CHECKOUT_RESPONSE).toBe('12');
    expect(SIP2_CODES.RENEW).toBe('29');
    expect(SIP2_CODES.RENEW_RESPONSE).toBe('30');
    expect(SIP2_CODES.ITEM_INFO).toBe('17');
    expect(SIP2_CODES.END_SESSION).toBe('35');
    expect(SIP2_CODES.BLOCK_PATRON).toBe('01');
    expect(SIP2_RESPONSE_FOR['01']).toBe('24');
    expect(SIP2_RESPONSE_FOR['97']).toBe('96');
    expect(SIP2_RESPONSE_FOR['65']).toBe('66');
  });

  it('reports supported messages in spec BX position order', () => {
    const bx = supportedMessagesBx();
    expect(bx).toHaveLength(16);
    expect(bx[0]).toBe('Y'); // patron status
    expect(bx[3]).toBe('N'); // block patron unsupported
    expect(bx[6]).toBe('Y'); // login
    expect(bx[13]).toBe('N'); // hold unsupported
    expect(bx[14]).toBe('Y'); // renew
    expect(bx[15]).toBe('N'); // renew all unsupported
  });

  it('formats the 18-char transaction date', () => {
    const value = sip2DateTime(new Date(2026, 9, 5, 14, 30, 15));
    expect(value).toBe('20261005    143015');
    expect(value).toHaveLength(18);
  });
});

describe('SIP2 session handler', () => {
  it('creates an unauthenticated session', () => {
    const session = createSip2Session();
    expect(session.authenticated).toBe(false);
    expect(session.terminalId).toBeNull();
    expect(session.allowedOperations).toEqual([]);
    expect(session.clientIp).toBeNull();
    expect(session.messagesProcessed).toBe(0);
  });

  it('ignores unrecognized commands (no response)', async () => {
    const deps = makeDeps();
    const session = await loginSession(deps);
    const raw = buildSip2Message('42', '', [['AO', 'ESUT']], { sequence: '1' });
    const out = await handleSip2Message(raw, session, deps);
    expect(out.response).toBeNull();
  });

  it('answers 96 when checksum validation fails', async () => {
    const deps = makeDeps();
    const bad = `990000${SIP2_PROTOCOL_VERSION}AY1AZ0000\r`;
    const out = await handleSip2Message(bad, createSip2Session('127.0.0.1'), deps);
    expect(out.response).toBe(`96AZ${computeSip2Checksum('96AZ')}\r`);
    expect(deps.logEvent).toHaveBeenCalledWith(null, 'checksum_failed', false, { code: '99' }, '127.0.0.1');
  });

  it('retransmits the last response for a 97 resend request', async () => {
    const deps = makeDeps();
    let session = createSip2Session('127.0.0.1');
    const status = await handleSip2Message(buildSip2Message('99', `0000${SIP2_PROTOCOL_VERSION}`, [], { sequence: '1' }), session, deps);
    session = status.session!;
    const firstResponse = status.response;
    expect(firstResponse).toMatch(/^98/);

    const resend = await handleSip2Message(buildSip2Message('97', '', [], { sequence: null }), session, deps);
    expect(resend.response).toBe(firstResponse);
  });

  it('answers 96 for a resend request before any response exists', async () => {
    const deps = makeDeps();
    const out = await handleSip2Message(buildSip2Message('97', '', [], { sequence: null }), createSip2Session('127.0.0.1'), deps);
    expect(out.response).toBe(`96AZ${computeSip2Checksum('96AZ')}\r`);
  });

  it('resends the last response for a duplicated request', async () => {
    const deps = makeDeps();
    let session = createSip2Session('127.0.0.1');
    const raw = buildSip2Message('99', `0000${SIP2_PROTOCOL_VERSION}`, [], { sequence: '1' });
    const first = await handleSip2Message(raw, session, deps);
    session = first.session;
    const second = await handleSip2Message(raw, session, deps);
    expect(second.response).toBe(first.response);
    expect(deps.logEvent).toHaveBeenCalledWith(null, 'duplicate_request', true, { code: '99' }, '127.0.0.1');
  });

  it('rejects operational commands before login', async () => {
    const deps = makeDeps();
    const raw = buildSip2Message('11', `NN${DATE}${DATE}`, [['AA', 'LIB001'], ['AB', 'BK1']], { sequence: '1' });
    const out = await handleSip2Message(raw, createSip2Session('10.0.0.5'), deps);
    expect(out.response).toMatch(/^120/);
    expect(out.response).toContain('AFLogin required.|');
    expect(deps.logEvent).toHaveBeenCalledWith(null, 'pre_login_blocked', false, { code: '11' }, '10.0.0.5');
    expect(deps.checkout).not.toHaveBeenCalled();
  });

  it('allows status and login before login', async () => {
    const deps = makeDeps();
    const status = await handleSip2Message(
      buildSip2Message('99', `0000${SIP2_PROTOCOL_VERSION}`, [], { sequence: '0' }),
      createSip2Session('127.0.0.1'),
      deps,
    );
    expect(status.response).toMatch(/^98YYYYNN100003/);
    expect(status.response).toContain('BX');
    expect(status.response).toContain(`AY0AZ`);
  });

  it('accepts login with CN/CO and rejects bad credentials', async () => {
    const deps = makeDeps();
    const session = await loginSession(deps);
    expect(session.authenticated).toBe(true);
    expect(session.terminalId).toBe('term-1');
    expect(session.allowedOperations).toEqual(['*']);
    expect(deps.authenticate).toHaveBeenCalledWith('kiosk-1', 'secret', 'ESUT', '127.0.0.1');

    const failDeps = makeDeps({
      authenticate: vi.fn(async () => ({ success: false, reason: 'Invalid credentials' })),
    });
    const out = await handleSip2Message(
      buildSip2Message('93', '00', [['CN', 'kiosk-1'], ['CO', 'wrong']], { sequence: '2' }),
      createSip2Session('127.0.0.1'),
      failDeps,
    );
    expect(out.response).toMatch(/^940AY2AZ[0-9A-F]{4}\r$/);
    expect(out.session.authenticated).toBe(false);
  });

  it('sends an ACS Status response with a valid checksum', async () => {
    const deps = makeDeps();
    const session = await loginSession(deps);
    const out = await handleSip2Message(
      buildSip2Message('99', `0000${SIP2_PROTOCOL_VERSION}`, [], { sequence: '2' }),
      session,
      deps,
    );
    const wire = out.response!;
    expect(wire.startsWith('98YYYYNN100003')).toBe(true);
    expect(wire).toMatch(/AY2AZ[0-9A-F]{4}\r$/);
    const withoutCr = wire.slice(0, -1);
    const payload = withoutCr.slice(0, -6); // strip AZ + 4-hex checksum (AY2 stays)
    expect(computeSip2Checksum(payload + 'AZ')).toBe(withoutCr.slice(-4));
    expect(wire).toContain('BX');
  });

  it('returns a 24 patron status for a valid patron', async () => {
    const deps = makeDeps({
      resolvePatron: vi.fn(async () => ({
        id: 'uuid-1',
        patron_id: 'LIB001',
        full_name: 'Amara Okonkwo',
        email: 'amara@example.com',
        patron_category: 'undergraduate',
        status: 'active',
        membership_expires_at: null,
        user_id: null,
      })),
      patronSummary: vi.fn(async () => ({
        chargedCount: 2,
        overdueCount: 1,
        holdCount: 0,
        fineItemCount: 1,
        fineAmount: 150,
        chargedTitles: ['T1', 'T2'],
        overdueTitles: ['T2'],
        holdTitles: [],
      })),
    });
    const session = await loginSession(deps);
    const out = await handleSip2Message(
      buildSip2Message('23', `000${DATE}`, [['AO', 'ESUT'], ['AA', 'LIB001']], { sequence: '3' }),
      session,
      deps,
    );
    const wire = out.response!;
    expect(wire.startsWith('24')).toBe(true);
    const fixed = wire.slice(2, 37);
    expect(fixed).toHaveLength(35);
    expect(fixed.slice(14, 17)).toBe('000');
    expect(fixed.slice(17, 35)).toMatch(/^\d{8} {4}\d{6}$/); // response time, not request time
    expect(fixed.slice(0, 14).charAt(6)).toBe('Y'); // overdue
    expect(wire).toContain('AALIB001|');
    expect(wire).toContain('AEAmara Okonkwo|');
    expect(wire).toContain('BLY|');
    expect(wire).toContain('BV150.00|');
    expect(wire).toContain('BHNGN|');
    expect(wire).toContain('AY3AZ');
  });

  it('answers BL=N for an unknown patron on 63', async () => {
    const deps = makeDeps();
    const session = await loginSession(deps);
    const out = await handleSip2Message(
      buildSip2Message('63', `000${DATE}          `, [['AO', 'ESUT'], ['AA', 'NOPE']], { sequence: '4' }),
      session,
      deps,
    );
    expect(out.response).toMatch(/^64/);
    expect(out.response).toContain('BLN|');
    expect(out.response).toContain('AFPatron not found.|');
  });

  it('includes counts and detail items in a 64 response', async () => {
    const deps = makeDeps({
      resolvePatron: vi.fn(async () => ({
        id: 'uuid-1',
        patron_id: 'LIB001',
        full_name: 'Amara Okonkwo',
        email: 'amara@example.com',
        patron_category: 'undergraduate',
        status: 'active',
        membership_expires_at: null,
        user_id: null,
      })),
      patronSummary: vi.fn(async () => ({
        chargedCount: 3,
        overdueCount: 2,
        holdCount: 1,
        fineItemCount: 0,
        fineAmount: 0,
        chargedTitles: ['Alpha', 'Beta', 'Gamma'],
        overdueTitles: ['Beta', 'Gamma'],
        holdTitles: ['Delta'],
      })),
    });
    const session = await loginSession(deps);
    const summary = 'Y'.padEnd(10, ' ');
    const out = await handleSip2Message(
      buildSip2Message('63', `000${DATE}${summary}`, [['AO', 'ESUT'], ['AA', 'LIB001']], { sequence: '5' }),
      session,
      deps,
    );
    const wire = out.response!;
    const fixed = wire.slice(2, 61);
    expect(fixed).toHaveLength(59);
    expect(fixed.slice(35, 39)).toBe('0001'); // holds
    expect(fixed.slice(39, 43)).toBe('0002'); // overdue
    expect(fixed.slice(43, 47)).toBe('0003'); // charged
    expect(fixed.slice(47, 51)).toBe('0000'); // fines
    expect(wire).toContain('ASDelta|');
    expect(wire).not.toContain('AT'); // overdue detail not requested
    expect(wire).not.toContain('AU'); // charged detail not requested
  });

  it('reports an item via 18 and AF when not found', async () => {
    const deps = makeDeps({
      resolveItem: vi.fn(async () => ({
        item: {
          id: 'item-1',
          title: 'Clean Code',
          call_number: 'QA76.73',
          isbn: '9780132350884',
          available_copies: 2,
          total_copies: 3,
          format: 'book',
        },
        scannedBarcode: 'BK1',
      })),
    });
    const session = await loginSession(deps);
    const found = await handleSip2Message(
      buildSip2Message('17', DATE, [['AO', 'ESUT'], ['AB', 'BK1']], { sequence: '6' }),
      session,
      deps,
    );
    expect(found.response).toMatch(/^18/);
    expect(found.response!.slice(2, 8)).toBe('030001'); // available + security + fee
    expect(found.response).toContain('ABBK1|');
    expect(found.response).toContain('AJClean Code|');

    const missDeps = makeDeps();
    const missSession = await loginSession(missDeps);
    const missing = await handleSip2Message(
      buildSip2Message('17', DATE, [['AO', 'ESUT'], ['AB', 'NOPE']], { sequence: '7' }),
      missSession,
      missDeps,
    );
    expect(missing.response).toMatch(/^18/);
    expect(missing.response).toContain('AFItem not found.|');
  });

  it('checks out with a standards-correct 12 response', async () => {
    const due = '2026-10-19T00:00:00.000Z';
    const deps = makeDeps({
      checkout: vi.fn(async () => ({ outcome: 'checked_out' as const, loanId: 'loan-1', dueDate: due, renewal: false })),
      resolveItem: vi.fn(async () => ({
        item: {
          id: 'item-1',
          title: 'Clean Code',
          call_number: null,
          isbn: null,
          available_copies: 2,
          total_copies: 3,
          format: null,
        },
        scannedBarcode: 'BK1',
      })),
    });
    const session = await loginSession(deps);
    const out = await handleSip2Message(
      buildSip2Message('11', `NN${DATE}${DATE}`, [['AO', 'ESUT'], ['AA', 'LIB001'], ['AB', 'BK1']], { sequence: '1' }),
      session,
      deps,
    );
    const wire = out.response!;
    expect(wire.slice(0, 6)).toBe('121NUN'); // ok, not renewal, magnetic U, no desensitize
    expect(wire.slice(6, 24)).toMatch(/^\d{8} {4}\d{6}$/); // 18-char transaction date
    expect(wire).toContain('AALIB001|');
    expect(wire).toContain('ABBK1|');
    expect(wire).toContain('AJClean Code|');
    expect(wire).toContain('AH20261019|');
    expect(wire).toContain('AY1AZ');
    expect(deps.checkout).toHaveBeenCalledWith({ patronBarcode: 'LIB001', itemBarcode: 'BK1' });
  });

  it('treats an already-held checkout as idempotent (renewal ok = Y)', async () => {
    const deps = makeDeps({
      checkout: vi.fn(async () => ({ outcome: 'already_held' as const, loanId: 'loan-1', dueDate: '2026-10-19T00:00:00.000Z' })),
    });
    const session = await loginSession(deps);
    const out = await handleSip2Message(
      buildSip2Message('11', `NN${DATE}${DATE}`, [['AA', 'LIB001'], ['AB', 'BK1']], { sequence: '2' }),
      session,
      deps,
    );
    expect(out.response!.slice(0, 6)).toBe('121YUN');
    expect(out.response).toContain('AFItem already checked out to this patron.|');
  });

  it('returns ok=0 with AF on a rejected checkout', async () => {
    const deps = makeDeps({
      checkout: vi.fn(async () => ({ outcome: 'rejected' as const, code: 'PATRON_BLOCKED', message: 'Patron account is suspended.' })),
    });
    const session = await loginSession(deps);
    const out = await handleSip2Message(
      buildSip2Message('11', `NN${DATE}${DATE}`, [['AA', 'LIB001'], ['AB', 'BK1']], { sequence: '3' }),
      session,
      deps,
    );
    expect(out.response!.slice(0, 6)).toBe('120NUN');
    expect(out.response).toContain('AFPatron account is suspended.|');
  });

  it('checks in with an alert flag when a fine applies', async () => {
    const deps = makeDeps({
      checkin: vi.fn(async () => ({ outcome: 'returned' as const, loanId: 'loan-1', patronId: 'uuid-1', fineAmount: 250, itemTitle: 'Clean Code' })),
    });
    const session = await loginSession(deps);
    const out = await handleSip2Message(
      buildSip2Message('09', `N${DATE}${DATE}`, [['AO', 'ESUT'], ['AB', 'BK1']], { sequence: '4' }),
      session,
      deps,
    );
    const wire = out.response!;
    expect(wire.slice(0, 6)).toBe('101NUY'); // ok, no resensitize, magnetic U, alert
    expect(wire).toContain('ABBK1|');
    expect(wire).toContain('AJClean Code|');
    expect(wire).toContain('AFFine applied: NGN 250.00|');
  });

  it('answers idempotent ok=1 when there is no active loan', async () => {
    const deps = makeDeps({
      checkin: vi.fn(async () => ({ outcome: 'no_loan' as const, message: 'No active loan for this item.' })),
    });
    const session = await loginSession(deps);
    const out = await handleSip2Message(
      buildSip2Message('09', `N${DATE}${DATE}`, [['AB', 'BK1']], { sequence: '5' }),
      session,
      deps,
    );
    expect(out.response!.slice(0, 6)).toBe('101NUN');
    expect(out.response).toContain('AFNo active loan for this item.|');
  });

  it('renews with a 30 response', async () => {
    const deps = makeDeps({
      renew: vi.fn(async () => ({ outcome: 'renewed' as const, loanId: 'loan-1', dueDate: '2026-11-02T00:00:00.000Z' })),
    });
    const session = await loginSession(deps);
    const out = await handleSip2Message(
      buildSip2Message('29', `NN${DATE}${DATE}`, [['AO', 'ESUT'], ['AA', 'LIB001'], ['AB', 'BK1']], { sequence: '6' }),
      session,
      deps,
    );
    expect(out.response!.startsWith('301YUN')).toBe(true);
    expect(out.response).toContain('AH20261102|');
  });

  it('ends the patron session with 36 and clears patron state', async () => {
    const deps = makeDeps();
    const session = await loginSession(deps);
    session.patronBarcode = 'LIB001';
    const out = await handleSip2Message(
      buildSip2Message('35', DATE, [['AO', 'ESUT'], ['AA', 'LIB001']], { sequence: '7' }),
      session,
      deps,
    );
    expect(out.response).toMatch(/^36Y/);
    expect(out.response).toContain('AALIB001|');
    expect(out.session.patronBarcode).toBeNull();
    expect(out.session.authenticated).toBe(true); // terminal login persists
  });

  it('responds with failure forms for recognized-but-unsupported commands', async () => {
    const deps = makeDeps();
    const session = await loginSession(deps);

    const renewAll = await handleSip2Message(
      buildSip2Message('65', DATE, [['AO', 'ESUT'], ['AA', 'LIB001']], { sequence: '1' }),
      session,
      deps,
    );
    expect(renewAll.response).toMatch(/^660/);
    expect(renewAll.response!.slice(2, 11)).toBe('000000000');
    expect(renewAll.response).toContain('AF');

    const block = await handleSip2Message(
      buildSip2Message('01', `N${DATE}`, [['AO', 'ESUT'], ['AA', 'LIB001']], { sequence: '2' }),
      session,
      deps,
    );
    expect(block.response).toMatch(/^24/);
    expect(block.response).toContain('AF');

    const hold = await handleSip2Message(
      buildSip2Message('15', `+${DATE}`, [['AO', 'ESUT'], ['AA', 'LIB001'], ['AB', 'BK1']], { sequence: '3' }),
      session,
      deps,
    );
    expect(hold.response).toMatch(/^160N/);
    expect(hold.response).toContain('AF');

    const feePaid = await handleSip2Message(
      buildSip2Message('37', `${DATE}0100NGN`, [['BV', '250'], ['AA', 'LIB001']], { sequence: '4' }),
      session,
      deps,
    );
    expect(feePaid.response).toMatch(/^38N/);
    expect(feePaid.response).toContain('AF');
  });

  it('denies operations not granted to the terminal', async () => {
    const deps = makeDeps({
      authenticate: vi.fn(async () => ({ success: true, terminalId: 'term-2', allowedOperations: ['patron_info'] })),
    });
    const session = await loginSession(deps);
    const out = await handleSip2Message(
      buildSip2Message('11', `NN${DATE}${DATE}`, [['AA', 'LIB001'], ['AB', 'BK1']], { sequence: '1' }),
      session,
      deps,
    );
    expect(out.response).toMatch(/^120/);
    expect(out.response).toContain('AFOperation not allowed for this terminal.|');
    expect(deps.checkout).not.toHaveBeenCalled();
  });

  it('echoes the request sequence number in every response', async () => {
    const deps = makeDeps();
    const session = await loginSession(deps);
    const out = await handleSip2Message(
      buildSip2Message('23', `000${DATE}`, [['AA', 'NOPE']], { sequence: '9' }),
      session,
      deps,
    );
    expect(out.response).toContain('AY9AZ');
  });

  it('counts processed messages on the session', async () => {
    const deps = makeDeps();
    let session = createSip2Session('127.0.0.1');
    const first = await handleSip2Message(
      buildSip2Message('99', `0000${SIP2_PROTOCOL_VERSION}`, [], { sequence: '1' }),
      session,
      deps,
    );
    session = first.session;
    const second = await handleSip2Message(
      buildSip2Message('99', `0000${SIP2_PROTOCOL_VERSION}`, [], { sequence: '2' }),
      session,
      deps,
    );
    expect(second.session.messagesProcessed).toBe(2);
  });
});
