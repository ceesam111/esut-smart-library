import { z } from 'zod';
import { callAiGateway, type ControlledAiRequest } from './aiGatewayClient';
import { BASE_JSON_SYSTEM_PROMPT } from './agentPromptTemplates';

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed;
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (match) return match[1].trim();
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

export async function safeJsonCompletion<T>(input: Omit<ControlledAiRequest, 'messages'> & {
  userPrompt: string;
  schema: z.ZodType<T>;
  systemPrompt?: string;
}) {
  const response = await callAiGateway({
    ...input,
    messages: [
      { role: 'system', content: `${BASE_JSON_SYSTEM_PROMPT}\n${input.systemPrompt ?? ''}` },
      { role: 'user', content: input.userPrompt },
    ],
  });
  const parsed = JSON.parse(extractJson(response.text));
  return { data: input.schema.parse(parsed), response };
}
