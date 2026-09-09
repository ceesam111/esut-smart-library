import { describe, expect, it } from 'vitest';
import { stripPatronPii } from './commonSchemas';

describe('stripPatronPii', () => {
  it('redacts emails, phone numbers, and common patron identifiers', () => {
    const result = stripPatronPii('Email ada@example.edu.ng, phone +234 801 234 5678, matric no ESUT/22/1234.');

    expect(result).toContain('[redacted-email]');
    expect(result).toContain('[redacted-phone]');
    expect(result).toContain('[redacted-id]');
    expect(result).not.toContain('ada@example.edu.ng');
    expect(result).not.toContain('+234 801 234 5678');
  });
});
