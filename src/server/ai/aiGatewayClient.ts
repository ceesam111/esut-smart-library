import { assertAiPurposeAllowed, type AiPurpose } from './aiPolicy';
import { startAiRunLog, completeAiRunLog, failAiRunLog } from './logAiUsage';
import { redactObject } from './redaction';

export type AiModelKind = 'default' | 'fast' | 'reasoning';
export type AiMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface ControlledAiRequest {
  tenantId?: string;
  actorUserId?: string | null;
  agentName: 'Cardo' | 'Hari' | 'Thesia' | 'Penna' | 'Norma' | 'Lyria';
  jobType: string;
  purpose: AiPurpose;
  messages: AiMessage[];
  modelKind?: AiModelKind;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  retries?: number;
  metadata?: Record<string, unknown>;
  skipLoggingForTests?: boolean;
}

export interface ControlledAiResponse {
  text: string;
  model: string;
  agentRunId: string | null;
  inputTokens: number;
  outputTokens: number;
  raw: unknown;
}

export function getAiModel(kind: AiModelKind = 'default') {
  if (kind === 'fast') return process.env.AI_FAST_MODEL || process.env.AI_DEFAULT_MODEL || 'openai/gpt-4o-mini';
  if (kind === 'reasoning') return process.env.AI_REASONING_MODEL || process.env.AI_DEFAULT_MODEL || 'openai/gpt-4o';
  return process.env.AI_DEFAULT_MODEL || 'openai/gpt-4o-mini';
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}

export async function callAiGateway(input: ControlledAiRequest): Promise<ControlledAiResponse> {
  assertAiPurposeAllowed(input.purpose);
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error('Missing AI_GATEWAY_API_KEY.');
  const baseUrl = (process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.vercel.sh/v1').replace(/\/$/, '');
  const model = input.model || getAiModel(input.modelKind);
  const messages = redactObject(input.messages);
  const maxTokens = input.maxTokens ?? Number(process.env.AI_MAX_TOKENS_DEFAULT || 1024);
  const temperature = input.temperature ?? Number(process.env.AI_TEMPERATURE_DEFAULT || 0.2);
  const attempts = Math.max(1, (input.retries ?? 1) + 1);
  const run = input.skipLoggingForTests ? null : await startAiRunLog({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    agentName: input.agentName,
    jobType: input.jobType,
    purpose: input.purpose,
    model,
    input: { messages, metadata: input.metadata ?? {} },
  });

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
      }, input.timeoutMs ?? 30000);
      if (!response.ok) throw new Error(`AI Gateway failed with ${response.status}: ${await response.text()}`);
      const raw = await response.json();
      const text = raw.choices?.[0]?.message?.content ?? '';
      const inputTokens = raw.usage?.prompt_tokens ?? 0;
      const outputTokens = raw.usage?.completion_tokens ?? 0;
      if (run) await completeAiRunLog({ runId: run.id, tenantId: run.tenant_id, purpose: input.purpose, model, output: { text, usage: raw.usage ?? null }, inputTokens, outputTokens, estimatedCost: 0 });
      return { text, model, agentRunId: run?.id ?? null, inputTokens, outputTokens, raw };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  if (run) await failAiRunLog({ runId: run.id, error: lastError });
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
