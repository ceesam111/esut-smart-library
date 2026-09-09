import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertAiPurposeAllowed } from './aiPolicy';
import { redactPatronPii } from './redaction';
import { classifyResourceSubjects } from './brain';

describe('AI Brain policy and redaction', () => {
  it('blocks unsafe AI purposes', () => {
    expect(() => assertAiPurposeAllowed('patron_bulk_enrolment')).toThrow(/blocked/);
    expect(() => assertAiPurposeAllowed('subject_classification')).not.toThrow();
  });

  it('redacts patron PII', () => {
    const redacted = redactPatronPii('Email ada@example.edu.ng phone +234 801 234 5678 matric no ESUT/22/1');
    expect(redacted).toContain('[redacted-email]');
    expect(redacted).toContain('[redacted-phone]');
    expect(redacted).toContain('[redacted-id]');
  });
});

describe('AI Brain JSON completion', () => {
  beforeEach(() => {
    process.env.AI_GATEWAY_API_KEY = 'test-key';
    process.env.AI_GATEWAY_BASE_URL = 'https://gateway.test/v1';
  });

  afterEach(() => vi.restoreAllMocks());

  it('calls OpenAI-compatible gateway and validates structured output', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ subjects: ['Cataloguing'], category: 'Library Science', confidence: 'high', warnings: [] }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 8 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const result = await classifyResourceSubjects({ resource: { title: 'Modern Cataloguing' }, skipLoggingForTests: true });

    expect(result.data.category).toBe('Library Science');
    expect(result.data.subjects).toContain('Cataloguing');
    expect(fetch).toHaveBeenCalledWith('https://gateway.test/v1/chat/completions', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer test-key' }) }));
  });
});
