import { describe, expect, it } from 'vitest';
import { redact } from './logger';

describe('structured logger redaction', () => {
  it('redacts sensitive keys recursively', () => {
    const output = redact({
      authorization: 'Bearer secret-token',
      nested: { password: 'pass', apiKey: 'key', safe: 'value' },
    }) as any;

    expect(output.authorization).toBe('[redacted]');
    expect(output.nested.password).toBe('[redacted]');
    expect(output.nested.apiKey).toBe('[redacted]');
    expect(output.nested.safe).toBe('value');
  });
});
