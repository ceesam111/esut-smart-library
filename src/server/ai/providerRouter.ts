/**
 * Free-first multi-provider AI router.
 *
 * Chain (default, configurable with AI_PROVIDER_ORDER):
 *   ollama (local, free) → gemini (free tier) → groq (free tier)
 *   → nvidia NIM (optional free developer tier) → vercel AI gateway (paid fallback)
 *
 * Behaviour:
 * - Providers that are not configured are skipped with reason `not_configured`.
 * - A circuit breaker opens a provider after consecutive failures (cooldown
 *   `AI_PROVIDER_BREAKER_MS`, default 60s) and the chain moves on.
 * - `privacy: 'local'` restricts the chain to local providers (Ollama) and
 *   never falls back to cloud providers.
 * - Every attempt is recorded with a machine-readable fallback reason code.
 */

export type AiModelKind = 'default' | 'fast' | 'reasoning';

export type ProviderId = 'ollama' | 'gemini' | 'groq' | 'nvidia' | 'gateway';

export type FallbackReason =
  | 'not_configured'
  | 'circuit_open'
  | 'timeout'
  | 'rate_limited'
  | 'auth_failed'
  | 'insufficient_credit'
  | 'invalid_request'
  | 'server_error'
  | 'network'
  | 'empty_response'
  | 'policy_local_only'
  | 'unknown';

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  local: boolean;
  freeTier: boolean;
  baseUrl: string;
  apiKey: string | null;
  models: Record<AiModelKind, string>;
}

export interface ProviderAttempt {
  provider: ProviderId;
  model: string;
  ok: boolean;
  reason?: FallbackReason;
  status?: number;
  ms: number;
}

export interface RouteChatInput {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  modelKind?: AiModelKind;
  /** Explicit model override. Applied to the gateway provider (provider/model form). */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  privacy?: 'standard' | 'local';
}

export interface RouteChatResult {
  text: string;
  provider: ProviderId;
  providerLabel: string;
  model: string;
  attempts: ProviderAttempt[];
  usage: { inputTokens: number; outputTokens: number };
  raw: unknown;
}

export class AiRoutingError extends Error {
  constructor(message: string, public readonly attempts: ProviderAttempt[], public readonly lastReason: FallbackReason) {
    super(message);
    this.name = 'AiRoutingError';
  }
}

const DEFAULT_ORDER: ProviderId[] = ['ollama', 'gemini', 'groq', 'nvidia', 'gateway'];
const ALL_PROVIDER_IDS = new Set<ProviderId>(DEFAULT_ORDER);

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

/** Ollama is opt-in: enabled only when explicitly configured (no local daemon on prod servers). */
function ollamaEnabled(): boolean {
  if (env('OLLAMA_ENABLED')) return /^(1|true|yes|on)$/i.test(env('OLLAMA_ENABLED')!);
  return Boolean(env('OLLAMA_BASE_URL'));
}

export function providerOrder(): ProviderId[] {
  const raw = env('AI_PROVIDER_ORDER');
  if (!raw) return [...DEFAULT_ORDER];
  const parsed = raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part): part is ProviderId => ALL_PROVIDER_IDS.has(part as ProviderId));
  // always keep the paid gateway as a last-resort fallback unless explicitly removed
  return parsed.length ? parsed : [...DEFAULT_ORDER];
}

export function resolveProviders(): ProviderDefinition[] {
  const gatewayBase = (env('AI_GATEWAY_BASE_URL') || 'https://ai-gateway.vercel.sh/v1').replace(/\/$/, '');
  const ollamaBase = (env('OLLAMA_BASE_URL') || 'http://localhost:11434/v1').replace(/\/$/, '');
  const geminiBase = (env('GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/$/, '');
  const groqBase = (env('GROQ_BASE_URL') || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
  const nvidiaBase = (env('NVIDIA_BASE_URL') || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '');

  const gatewayModel = env('AI_DEFAULT_MODEL') || 'openai/gpt-4o-mini';
  const gatewayFast = env('AI_FAST_MODEL') || gatewayModel;
  const gatewayReasoning = env('AI_REASONING_MODEL') || gatewayModel;

  const all: Record<ProviderId, ProviderDefinition> = {
    ollama: {
      id: 'ollama',
      label: 'Ollama (local)',
      local: true,
      freeTier: true,
      baseUrl: ollamaEnabled() ? ollamaBase : '',
      apiKey: env('OLLAMA_API_KEY') ?? null,
      models: {
        default: env('OLLAMA_MODEL') || 'llama3.2',
        fast: env('OLLAMA_FAST_MODEL') || env('OLLAMA_MODEL') || 'llama3.2',
        reasoning: env('OLLAMA_REASONING_MODEL') || env('OLLAMA_MODEL') || 'llama3.2',
      },
    },
    gemini: {
      id: 'gemini',
      label: 'Google Gemini (free tier)',
      local: false,
      freeTier: true,
      baseUrl: geminiBase,
      apiKey: env('GEMINI_API_KEY') ?? null,
      models: {
        default: env('GEMINI_MODEL') || 'gemini-3.8-flash',
        fast: env('GEMINI_FAST_MODEL') || env('GEMINI_MODEL') || 'gemini-3.8-flash',
        reasoning: env('GEMINI_REASONING_MODEL') || env('GEMINI_MODEL') || 'gemini-3.8-flash',
      },
    },
    groq: {
      id: 'groq',
      label: 'Groq (free tier)',
      local: false,
      freeTier: true,
      baseUrl: groqBase,
      apiKey: env('GROQ_API_KEY') ?? null,
      models: {
        default: env('GROQ_MODEL') || 'qwen/qwen3.8-27b',
        fast: env('GROQ_FAST_MODEL') || env('GROQ_MODEL') || 'qwen/qwen3.8-27b',
        reasoning: env('GROQ_REASONING_MODEL') || env('GROQ_MODEL') || 'openai/gpt-oss-120b',
      },
    },
    nvidia: {
      id: 'nvidia',
      label: 'NVIDIA NIM (optional)',
      local: false,
      freeTier: true,
      baseUrl: nvidiaBase,
      apiKey: env('NVIDIA_API_KEY') ?? env('NIM_API_KEY') ?? null,
      models: {
        default: env('NVIDIA_MODEL') || 'meta/llama-3.1-70b-instruct',
        fast: env('NVIDIA_FAST_MODEL') || env('NVIDIA_MODEL') || 'meta/llama-3.1-70b-instruct',
        reasoning: env('NVIDIA_REASONING_MODEL') || env('NVIDIA_MODEL') || 'meta/llama-3.1-70b-instruct',
      },
    },
    gateway: {
      id: 'gateway',
      label: 'Vercel AI Gateway (paid fallback)',
      local: false,
      freeTier: false,
      baseUrl: gatewayBase,
      apiKey: env('AI_GATEWAY_API_KEY') ?? null,
      models: { default: gatewayModel, fast: gatewayFast, reasoning: gatewayReasoning },
    },
  };

  return providerOrder().map((id) => all[id]);
}

// ── Circuit breaker + health cache ────────────────────────────────────────────

interface ProviderHealth {
  consecutiveFailures: number;
  openUntil: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastReason: FallbackReason | null;
  lastStatus: number | null;
}

const health = new Map<ProviderId, ProviderHealth>();

function breakerCooldownMs() {
  const raw = Number(env('AI_PROVIDER_BREAKER_MS'));
  return Number.isFinite(raw) && raw >= 0 ? raw : 60_000;
}

function healthFor(id: ProviderId): ProviderHealth {
  let entry = health.get(id);
  if (!entry) {
    entry = { consecutiveFailures: 0, openUntil: 0, lastSuccessAt: null, lastFailureAt: null, lastReason: null, lastStatus: null };
    health.set(id, entry);
  }
  return entry;
}

function isCircuitOpen(id: ProviderId, now = Date.now()) {
  return healthFor(id).openUntil > now;
}

function recordSuccess(id: ProviderId) {
  const entry = healthFor(id);
  entry.consecutiveFailures = 0;
  entry.openUntil = 0;
  entry.lastSuccessAt = new Date().toISOString();
  entry.lastReason = null;
  entry.lastStatus = null;
}

function recordFailure(id: ProviderId, reason: FallbackReason, status?: number) {
  const entry = healthFor(id);
  entry.consecutiveFailures += 1;
  entry.lastFailureAt = new Date().toISOString();
  entry.lastReason = reason;
  entry.lastStatus = status ?? null;
  const threshold = Number(env('AI_PROVIDER_BREAKER_THRESHOLD'));
  const failuresBeforeOpen = Number.isFinite(threshold) && threshold > 0 ? threshold : 3;
  if (entry.consecutiveFailures >= failuresBeforeOpen) {
    entry.openUntil = Date.now() + breakerCooldownMs();
  }
}

export function getAiProviderHealth(): Record<ProviderId | string, unknown> {
  const now = Date.now();
  const out: Record<string, unknown> = {};
  for (const provider of resolveProviders()) {
    const entry = healthFor(provider.id);
    out[provider.id] = {
      label: provider.label,
      configured: provider.local ? Boolean(provider.baseUrl) : Boolean(provider.apiKey),
      local: provider.local,
      freeTier: provider.freeTier,
      circuitOpen: entry.openUntil > now,
      openUntil: entry.openUntil > now ? new Date(entry.openUntil).toISOString() : null,
      consecutiveFailures: entry.consecutiveFailures,
      lastSuccessAt: entry.lastSuccessAt,
      lastFailureAt: entry.lastFailureAt,
      lastReason: entry.lastReason,
      lastStatus: entry.lastStatus,
    };
  }
  return out;
}

/** Test helper — clears circuit-breaker and health state. */
export function resetAiRouterState() {
  health.clear();
}

// ── Failure classification ────────────────────────────────────────────────────

export function classifyHttpStatus(status: number): FallbackReason {
  if (status === 401 || status === 403) return 'auth_failed';
  if (status === 402) return 'insufficient_credit';
  if (status === 429) return 'rate_limited';
  if (status === 408) return 'timeout';
  if (status >= 500) return 'server_error';
  return 'invalid_request';
}

export function classifyError(error: unknown): FallbackReason {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || /abort|timeout/i.test(error.message)) return 'timeout';
    if (/fetch failed|network|econnrefused|enotfound|socket/i.test(error.message)) return 'network';
  }
  return 'unknown';
}

// ── Core call ─────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function modelFor(provider: ProviderDefinition, kind: AiModelKind, explicit?: string) {
  if (provider.id === 'gateway' && explicit) return explicit;
  return provider.models[kind];
}

/**
 * Model catalogs churn: retired ids return 404, hot models return 503, and
 * some models emit empty content when the token budget is consumed by
 * reasoning. Each provider therefore keeps a candidate list — the router
 * walks it (primary first) before abandoning the provider, so a catalog
 * change can never permanently break Lexis or the agent workers.
 */
const MODEL_CANDIDATES: Record<ProviderId, string[]> = {
  ollama: ['llama3.2', 'llama3.1', 'qwen2.5:7b'],
  gemini: ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash'],
  groq: ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'allam-2-7b', 'llama-3.1-8b-instant'],
  nvidia: ['meta/llama-3.1-70b-instruct', 'deepseek-ai/deepseek-r1', 'qwen/qwen3-32b'],
  gateway: [],
};

function modelCandidates(provider: ProviderDefinition, kind: AiModelKind, explicit?: string): string[] {
  const primary = modelFor(provider, kind, explicit);
  if (explicit) return [primary];
  return [...new Set([primary, ...(MODEL_CANDIDATES[provider.id] ?? [])])];
}

/** Statuses that mean "this model id/availability is the problem, try the next candidate". */
function isCandidateRetryable(reason: FallbackReason, status?: number) {
  if (reason === 'empty_response') return true;
  return status === 404 || status === 503;
}

export async function routeChatCompletion(input: RouteChatInput): Promise<RouteChatResult> {
  const kind: AiModelKind = input.modelKind ?? 'default';
  const maxTokens = input.maxTokens ?? Number(env('AI_MAX_TOKENS_DEFAULT') || 1024);
  const temperature = input.temperature ?? Number(env('AI_TEMPERATURE_DEFAULT') || 0.2);
  const timeoutMs = input.timeoutMs ?? 30_000;
  const localOnly = input.privacy === 'local';

  const chain = resolveProviders().filter((provider) => (localOnly ? provider.local : true));
  const attempts: ProviderAttempt[] = [];

  if (!chain.length) {
    throw new AiRoutingError('No AI providers are enabled for this request.', attempts, 'not_configured');
  }

  for (const provider of chain) {
    const candidates = modelCandidates(provider, kind, input.model);
    const model = candidates[0];
    const startedAt = Date.now();

    if (localOnly && !provider.local) {
      attempts.push({ provider: provider.id, model, ok: false, reason: 'policy_local_only', ms: 0 });
      continue;
    }

    if (!provider.baseUrl || (provider.id !== 'ollama' && !provider.apiKey)) {
      attempts.push({ provider: provider.id, model, ok: false, reason: 'not_configured', ms: Date.now() - startedAt });
      continue;
    }

    if (isCircuitOpen(provider.id)) {
      attempts.push({ provider: provider.id, model, ok: false, reason: 'circuit_open', ms: Date.now() - startedAt });
      continue;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;

    for (const candidate of candidates) {
      const attemptStart = Date.now();
      try {
        const response = await fetchWithTimeout(
          `${provider.baseUrl}/chat/completions`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: candidate,
              messages: input.messages,
              max_tokens: maxTokens,
              temperature,
            }),
          },
          timeoutMs,
        );

        if (!response.ok) {
          const reason = classifyHttpStatus(response.status);
          recordFailure(provider.id, reason, response.status);
          attempts.push({ provider: provider.id, model: candidate, ok: false, reason, status: response.status, ms: Date.now() - attemptStart });
          if (isCandidateRetryable(reason, response.status)) continue;
          break;
        }

        const raw = await response.json();
        const text: string = raw?.choices?.[0]?.message?.content ?? '';
        if (!text.trim()) {
          recordFailure(provider.id, 'empty_response', response.status);
          attempts.push({ provider: provider.id, model: candidate, ok: false, reason: 'empty_response', status: response.status, ms: Date.now() - attemptStart });
          continue;
        }

        recordSuccess(provider.id);
        attempts.push({ provider: provider.id, model: candidate, ok: true, status: response.status, ms: Date.now() - attemptStart });
        return {
          text,
          provider: provider.id,
          providerLabel: provider.label,
          model: candidate,
          attempts,
          usage: {
            inputTokens: raw?.usage?.prompt_tokens ?? 0,
            outputTokens: raw?.usage?.completion_tokens ?? 0,
          },
          raw,
        };
      } catch (error) {
        const reason = classifyError(error);
        recordFailure(provider.id, reason);
        attempts.push({ provider: provider.id, model: candidate, ok: false, reason, ms: Date.now() - attemptStart });
        break; // timeouts and network errors are provider-level, not model-level
      }
    }
  }

  const last = [...attempts].reverse().find((attempt) => attempt.reason && attempt.reason !== 'not_configured');
  const lastReason: FallbackReason = last?.reason ?? (attempts.length ? 'not_configured' : 'not_configured');
  const attempted = attempts.filter((attempt) => attempt.reason !== 'not_configured' && attempt.reason !== 'circuit_open');
  const summary = attempted.length
    ? `All AI providers failed (${attempted.map((a) => `${a.provider}:${a.reason}`).join(', ')}).`
    : localOnly
      ? 'The local AI provider (Ollama) is not available and privacy settings prevent cloud fallback.'
      : 'No AI provider is configured. Set GEMINI_API_KEY, GROQ_API_KEY, NVIDIA_API_KEY or AI_GATEWAY_API_KEY.';
  throw new AiRoutingError(summary, attempts, lastReason);
}
