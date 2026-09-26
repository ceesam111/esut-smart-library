import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AiRoutingError,
  classifyHttpStatus,
  getAiProviderHealth,
  providerOrder,
  resetAiRouterState,
  routeChatCompletion,
} from './providerRouter';

const AI_ENV_KEYS = [
  'AI_PROVIDER_ORDER',
  'AI_GATEWAY_API_KEY',
  'AI_GATEWAY_BASE_URL',
  'AI_DEFAULT_MODEL',
  'GEMINI_API_KEY',
  'GEMINI_BASE_URL',
  'GROQ_API_KEY',
  'GROQ_BASE_URL',
  'NVIDIA_API_KEY',
  'NIM_API_KEY',
  'NVIDIA_BASE_URL',
  'OLLAMA_ENABLED',
  'OLLAMA_BASE_URL',
  'OLLAMA_API_KEY',
  'OLLAMA_MODEL',
  'AI_PROVIDER_BREAKER_MS',
  'AI_PROVIDER_BREAKER_THRESHOLD',
];

const originalEnv: Record<string, string | undefined> = {};
for (const key of AI_ENV_KEYS) originalEnv[key] = process.env[key];

function clearAiEnv() {
  for (const key of AI_ENV_KEYS) delete process.env[key];
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function completion(content: string) {
  return {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 5, completion_tokens: 7 },
  };
}

const MESSAGES = [{ role: 'user' as const, content: 'hello' }];

/** Attempts excluding providers that were simply not configured (e.g. local Ollama). */
function real(attempts: { provider: string; reason?: string }[]) {
  return attempts.filter((a) => a.reason !== 'not_configured');
}

beforeEach(() => {
  clearAiEnv();
  resetAiRouterState();
});

afterEach(() => {
  clearAiEnv();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetAiRouterState();
  vi.restoreAllMocks();
});

describe('provider order', () => {
  it('defaults to the free-first chain ending with the paid gateway', () => {
    expect(providerOrder()).toEqual(['ollama', 'gemini', 'groq', 'nvidia', 'gateway']);
  });

  it('honours AI_PROVIDER_ORDER and ignores unknown providers', () => {
    process.env.AI_PROVIDER_ORDER = 'groq, gemini, nope, gateway';
    expect(providerOrder()).toEqual(['groq', 'gemini', 'gateway']);
  });
});

describe('routeChatCompletion', () => {
  it('skips unconfigured providers and uses the configured gateway', async () => {
    process.env.AI_GATEWAY_API_KEY = 'gw-key';
    process.env.AI_GATEWAY_BASE_URL = 'https://gateway.test/v1';
    const fetchMock = vi.fn(async () => jsonResponse(completion('from gateway')));
    vi.stubGlobal('fetch', fetchMock);

    const result = await routeChatCompletion({ messages: MESSAGES });

    expect(result.provider).toBe('gateway');
    expect(result.text).toBe('from gateway');
    expect(result.attempts.every((a) => a.ok || a.reason === 'not_configured')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://gateway.test/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses free providers first when they are configured', async () => {
    process.env.GEMINI_API_KEY = 'gem-key';
    process.env.GEMINI_BASE_URL = 'https://gemini.test/v1';
    process.env.AI_GATEWAY_API_KEY = 'gw-key';
    process.env.AI_GATEWAY_BASE_URL = 'https://gateway.test/v1';
    const fetchMock = vi.fn(async (url: string) =>
      url.startsWith('https://gemini.test') ? jsonResponse(completion('from gemini')) : jsonResponse(completion('from gateway')),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await routeChatCompletion({ messages: MESSAGES });

    expect(result.provider).toBe('gemini');
    expect(real(result.attempts)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls through a rate-limited provider with a reason code', async () => {
    process.env.GEMINI_API_KEY = 'gem-key';
    process.env.GEMINI_BASE_URL = 'https://gemini.test/v1';
    process.env.GROQ_API_KEY = 'groq-key';
    process.env.GROQ_BASE_URL = 'https://groq.test/v1';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.startsWith('https://gemini.test')
          ? jsonResponse({ error: 'rate limited' }, 429)
          : jsonResponse(completion('from groq')),
      ),
    );

    const result = await routeChatCompletion({ messages: MESSAGES });

    expect(result.provider).toBe('groq');
    expect(real(result.attempts)[0]).toMatchObject({ provider: 'gemini', ok: false, reason: 'rate_limited', status: 429 });
    expect(real(result.attempts)[1]).toMatchObject({ provider: 'groq', ok: true });
  });

  it('treats an empty completion as a provider failure', async () => {
    process.env.GEMINI_API_KEY = 'gem-key';
    process.env.GEMINI_BASE_URL = 'https://gemini.test/v1';
    process.env.GROQ_API_KEY = 'groq-key';
    process.env.GROQ_BASE_URL = 'https://groq.test/v1';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.startsWith('https://gemini.test')
          ? jsonResponse({ choices: [{ message: { content: '   ' } }] })
          : jsonResponse(completion('from groq')),
      ),
    );

    const result = await routeChatCompletion({ messages: MESSAGES });

    expect(result.provider).toBe('groq');
    expect(real(result.attempts)[0]).toMatchObject({ provider: 'gemini', reason: 'empty_response' });
  });

  it('opens the circuit after consecutive failures and reports circuit_open', async () => {
    process.env.AI_PROVIDER_BREAKER_THRESHOLD = '2';
    process.env.AI_PROVIDER_BREAKER_MS = '60000';
    process.env.GEMINI_API_KEY = 'gem-key';
    process.env.GEMINI_BASE_URL = 'https://gemini.test/v1';
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'boom' }, 500));
    vi.stubGlobal('fetch', fetchMock);

    await expect(routeChatCompletion({ messages: MESSAGES })).rejects.toBeInstanceOf(AiRoutingError);
    await expect(routeChatCompletion({ messages: MESSAGES })).rejects.toBeInstanceOf(AiRoutingError);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const third = await routeChatCompletion({ messages: MESSAGES }).catch((error: AiRoutingError) => error);
    expect(third).toBeInstanceOf(AiRoutingError);
    expect(real((third as AiRoutingError).attempts)[0].reason).toBe('circuit_open');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const health = getAiProviderHealth() as Record<string, { circuitOpen: boolean }>;
    expect(health.gemini.circuitOpen).toBe(true);
  });

  it('never falls back to cloud providers when privacy is local', async () => {
    process.env.OLLAMA_ENABLED = 'true';
    process.env.OLLAMA_BASE_URL = 'http://ollama.test/v1';
    process.env.AI_GATEWAY_API_KEY = 'gw-key';
    process.env.AI_GATEWAY_BASE_URL = 'https://gateway.test/v1';
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'down' }, 503));
    vi.stubGlobal('fetch', fetchMock);

    const error = await routeChatCompletion({ messages: MESSAGES, privacy: 'local' }).catch((e: AiRoutingError) => e);

    expect(error).toBeInstanceOf(AiRoutingError);
    expect((error as AiRoutingError).attempts.map((a) => a.provider)).toEqual(['ollama']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((error as AiRoutingError).attempts[0].reason).toBe('server_error');
  });

  it('reports a local-only configuration error when Ollama is not enabled', async () => {
    process.env.AI_GATEWAY_API_KEY = 'gw-key';
    vi.stubGlobal('fetch', vi.fn());

    const error = await routeChatCompletion({ messages: MESSAGES, privacy: 'local' }).catch((e: AiRoutingError) => e);

    expect(error).toBeInstanceOf(AiRoutingError);
    expect((error as AiRoutingError).lastReason).toBe('not_configured');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('throws a structured error when nothing is configured', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const error = await routeChatCompletion({ messages: MESSAGES }).catch((e: AiRoutingError) => e);

    expect(error).toBeInstanceOf(AiRoutingError);
    expect((error as AiRoutingError).attempts.every((a) => a.reason === 'not_configured')).toBe(true);
    expect((error as AiRoutingError).message).toMatch(/No AI provider is configured/);
  });
});

describe('failure classification', () => {
  it('maps HTTP statuses to reason codes', () => {
    expect(classifyHttpStatus(401)).toBe('auth_failed');
    expect(classifyHttpStatus(429)).toBe('rate_limited');
    expect(classifyHttpStatus(500)).toBe('server_error');
    expect(classifyHttpStatus(400)).toBe('invalid_request');
  });
});
