import { callAiGateway, type AiMessage, type AiModelKind } from './aiGatewayClient';
import type { AiPurpose } from './aiPolicy';

export type AiGatewayModelKind = AiModelKind;
export type AiGatewayMessage = AiMessage;

export interface AiGatewayRequest {
  tenantId?: string;
  actorUserId?: string | null;
  agentName: 'Cardo' | 'Hari' | 'Thesia' | 'Penna' | 'Norma' | 'Lyria';
  jobType: string;
  purpose: AiPurpose;
  messages: AiGatewayMessage[];
  model?: string;
  modelKind?: AiGatewayModelKind;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  retries?: number;
  metadata?: Record<string, unknown>;
}

export async function callVercelAiGateway(input: AiGatewayRequest) {
  return callAiGateway(input);
}
