import { describe, it, expect } from 'vitest';
import { checkSSRF } from './ssrf';

describe('checkSSRF', () => {
  it('allows standard Z39.50 port 210 for untrusted target', async () => {
    const result = await checkSSRF('8.8.8.8', 210, false);
    expect(result.allowed).toBe(true);
  });

  it('blocks non-standard port for untrusted target', async () => {
    const result = await checkSSRF('8.8.8.8', 9909, false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not the standard Z39.50 port');
  });

  it('allows non-standard port for trusted target', async () => {
    const result = await checkSSRF('8.8.8.8', 9909, true);
    expect(result.allowed).toBe(true);
  });

  it('blocks port 22 even for trusted target', async () => {
    const result = await checkSSRF('example.com', 22, true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('blocked');
  });

  it('blocks port 3306 even for trusted target', async () => {
    const result = await checkSSRF('example.com', 3306, true);
    expect(result.allowed).toBe(false);
  });

  it('blocks private IP 10.x.x.x', async () => {
    const result = await checkSSRF('10.0.0.1', 210, true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('private/reserved');
  });

  it('blocks private IP 192.168.x.x', async () => {
    const result = await checkSSRF('192.168.1.1', 210, true);
    expect(result.allowed).toBe(false);
  });

  it('blocks loopback 127.0.0.1', async () => {
    const result = await checkSSRF('127.0.0.1', 210, true);
    expect(result.allowed).toBe(false);
  });

  it('blocks link-local 169.254.x.x', async () => {
    const result = await checkSSRF('169.254.169.254', 210, true);
    expect(result.allowed).toBe(false);
  });

  it('blocks 172.16-31.x.x', async () => {
    const result = await checkSSRF('172.16.0.1', 210, true);
    expect(result.allowed).toBe(false);
  });

  it('allows public IP', async () => {
    const result = await checkSSRF('8.8.8.8', 210, true);
    expect(result.allowed).toBe(true);
  });

  it('returns reason when host cannot be resolved', async () => {
    const result = await checkSSRF('this-host-does-not-exist-12345.invalid', 210, true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Could not resolve');
  });
});
