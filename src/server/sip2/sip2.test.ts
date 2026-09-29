import { describe, it, expect } from 'vitest';
import { parseSip2Message, buildSip2Response, SIP2_CODES } from '@/server/sip2/messages';
import { createSip2Session, handleSip2Message } from '@/server/sip2/server';

describe('sip2', () => {
  it('SIP2 codes are defined', () => {
    expect(SIP2_CODES.LOGIN).toBe('93');
    expect(SIP2_CODES.CHECKOUT).toBe('11');
    expect(SIP2_CODES.END_SESSION).toBe('35');
  });

  it('creates initial SIP2 session', () => {
    const session = createSip2Session();
    expect(session.authenticated).toBe(false);
    expect(session.terminalId).toBeNull();
    expect(session.allowedOperations).toEqual([]);
  });

  it('builds SIP2 response with checksum', () => {
    const response = buildSip2Response('94', [['AF', 'OK']], '1');
    expect(response).toContain('94');
    expect(response).toContain('AF');
    expect(response).toMatch(/AZ[0-9A-F]{4}/);
  });

  it('parseSip2Message handles invalid input', () => {
    const result = parseSip2Message('invalid');
    expect(result).toBeNull();
  });
});
