import { assertAiPurposeAllowed, type AiPurpose } from './aiPolicy';
import { startAiRunLog, completeAiRunLog, failAiRunLog } from './logAiUsage';
import { redactObject } from './redaction';
import {
  routeChatCompletion,
  AiRoutingError,
  type AiModelKind,
  type FallbackReason,
  type ProviderAttempt,
} from './providerRouter';

export type { AiModelKind };
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
  /** `local` restricts the chain to local providers (Ollama) and blocks cloud fallback. */
  privacy?: 'standard' | 'local';
  metadata?: Record<string, unknown>;
  skipLoggingForTests?: boolean;
}

export interface ControlledAiResponse {
  text: string;
  model: string;
  provider: string;
  providerLabel: string;
  agentRunId: string | null;
  inputTokens: number;
  outputTokens: number;
  attempts: ProviderAttempt[];
  raw: unknown;
}

export function getAiModel(kind: AiModelKind = 'default') {
  if (kind === 'fast') return process.env.AI_FAST_MODEL || process.env.AI_DEFAULT_MODEL || 'openai/gpt-4o-mini';
  if (kind === 'reasoning') return process.env.AI_REASONING_MODEL || process.env.AI_DEFAULT_MODEL || 'openai/gpt-4o';
  return process.env.AI_DEFAULT_MODEL || 'openai/gpt-4o-mini';
}

const TRANSIENT_REASONS: FallbackReason[] = ['timeout', 'network', 'server_error'];

function isTransient(error: unknown): boolean {
  if (!(error instanceof AiRoutingError)) return false;
  return error.attempts.some((attempt) => attempt.reason && TRANSIENT_REASONS.includes(attempt.reason));
}

export async function callAiGateway(input: ControlledAiRequest): Promise<ControlledAiResponse> {
  assertAiPurposeAllowed(input.purpose);
  const messages = redactObject(input.messages) as AiMessage[];
  const rounds = Math.max(1, (input.retries ?? 0) + 1);

  const run = input.skipLoggingForTests ? null : await startAiRunLog({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    agentName: input.agentName,
    jobType: input.jobType,
    purpose: input.purpose,
    model: input.model || getAiModel(input.modelKind),
    input: { messages, metadata: input.metadata ?? {} },
  });

  let lastError: unknown;
  for (let round = 1; round <= rounds; round += 1) {
    try {
      const result = await routeChatCompletion({
        messages,
        modelKind: input.modelKind,
        model: input.model,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
        timeoutMs: input.timeoutMs,
        privacy: input.privacy,
      });

      if (run) {
        await completeAiRunLog({
          runId: run.id,
          tenantId: run.tenant_id,
          purpose: input.purpose,
          model: result.model,
          provider: result.provider,
          output: {
            text: result.text,
            provider: result.provider,
            attempts: result.attempts,
          },
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          estimatedCost: 0,
        });
      }

      return {
        text: result.text,
        model: result.model,
        provider: result.provider,
        providerLabel: result.providerLabel,
        agentRunId: run?.id ?? null,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        attempts: result.attempts,
        raw: result.raw,
      };
    } catch (error) {
      lastError = error;
      if (round < rounds && isTransient(error)) {
        await new Promise((resolve) => setTimeout(resolve, 500 * round));
        continue;
      }
      break;
    }
  }

  if (run) await failAiRunLog({ runId: run.id, error: lastError });
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
