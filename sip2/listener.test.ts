import { describe, it, expect } from 'vitest';
import { Sip2FrameDecoder } from './listener';

describe('SIP2 frame decoder', () => {
  it('extracts a single CR-terminated message', () => {
    const decoder = new Sip2FrameDecoder(8192);
    const out = decoder.push('9900002.00AY1AZ1234\r');
    expect(out.frames).toEqual(['9900002.00AY1AZ1234']);
    expect(out.oversize).toBe(false);
  });

  it('buffers a partial message across TCP segments', () => {
    const decoder = new Sip2FrameDecoder(8192);
    expect(decoder.push('941AY').frames).toEqual([]);
    expect(decoder.push('1AZ').frames).toEqual([]);
    const out = decoder.push('FEF6\r');
    expect(out.frames).toEqual(['941AY1AZFEF6']);
  });

  it('handles multiple messages coalesced in one segment', () => {
    const decoder = new Sip2FrameDecoder(8192);
    const out = decoder.push('97AZFEF6\r941AY1AZFEF6\r');
    expect(out.frames).toEqual(['97AZFEF6', '941AY1AZFEF6']);
  });

  it('tolerates LF and CRLF terminators and empty keep-alive frames', () => {
    const decoder = new Sip2FrameDecoder(8192);
    const out = decoder.push('9900002.00\r\n9900002.00\n\r\n');
    expect(out.frames).toEqual(['9900002.00', '9900002.00']);
  });

  it('reports oversize frames without unbounded buffering', () => {
    const decoder = new Sip2FrameDecoder(16);
    const out = decoder.push('X'.repeat(64));
    expect(out.oversize).toBe(true);
    expect(out.frames).toEqual([]);
  });

  it('reports oversize when a terminated frame exceeds the cap', () => {
    const decoder = new Sip2FrameDecoder(8);
    const out = decoder.push('123456789\r');
    expect(out.oversize).toBe(true);
    expect(out.frames).toEqual([]);
  });
});
