import { describe, expect, it } from 'vitest';
import { assertAiPurposeAllowed, requiresApprovalForAiOutput } from './aiPolicy';
import { redactObject, redactPatronPii } from './redaction';

describe('AI privacy and approval policy', () => {
  it('blocks patron bulk enrolment and raw personal data processing', () => {
    expect(() => assertAiPurposeAllowed('patron_bulk_enrolment')).toThrow('blocked');
    expect(() => assertAiPurposeAllowed('raw_personal_data_processing')).toThrow('blocked');
  });

  it('redacts patron PII before AI-safe transformations', () => {
    const redacted = redactPatronPii('Email jane@example.edu.ng, phone +234 803 123 4567, matric no EDU/2026/001');
    expect(redacted).toContain('[redacted-email]');
    expect(redacted).toContain('[redacted-phone]');
    expect(redacted).toContain('[redacted-id]');
  });

  it('redacts nested object values', () => {
    const redacted = redactObject({ patron: { email: 'student@example.edu.ng', note: 'library id LIB-001' } });
    expect(JSON.stringify(redacted)).not.toContain('student@example.edu.ng');
    expect(JSON.stringify(redacted)).not.toContain('LIB-001');
  });

  it('requires review for production-affecting non-low-risk AI output', () => {
    expect(requiresApprovalForAiOutput({ purpose: 'newsletter_draft', productionAffecting: true, risk: 'medium' })).toBe(true);
    expect(requiresApprovalForAiOutput({ purpose: 'search_explanation', productionAffecting: false, risk: 'low' })).toBe(false);
  });
});
