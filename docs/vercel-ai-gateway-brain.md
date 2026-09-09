# Vercel AI Gateway Brain

## Purpose

The AI Brain centralizes controlled model calls for Smart Library app, worker, and server-side workflows.

It uses Vercel AI Gateway's OpenAI-compatible `/chat/completions` API and logs every production call to Supabase tables:

- `agent_runs`
- `tenant_ai_usage`

## Server-Only Environment

```env
AI_GATEWAY_API_KEY=
AI_GATEWAY_BASE_URL=https://ai-gateway.vercel.sh/v1
AI_DEFAULT_MODEL=
AI_FAST_MODEL=
AI_REASONING_MODEL=
AI_MAX_TOKENS_DEFAULT=1024
AI_TEMPERATURE_DEFAULT=0.2
```

Never expose `AI_GATEWAY_API_KEY` to the browser.

## Files

- `src/server/ai/aiGatewayClient.ts`
- `src/server/ai/agentPromptTemplates.ts`
- `src/server/ai/safeJsonCompletion.ts`
- `src/server/ai/logAiUsage.ts`
- `src/server/ai/redaction.ts`
- `src/server/ai/aiPolicy.ts`
- `src/server/ai/brain.ts`

## Agents

- Cardo: catalogue ambiguity/classification.
- Hari: resource classification/summarization.
- Thesia: abstract cleanup and keywords.
- Penna: communications drafts.
- Norma: accreditation report drafts.
- Lexis: AI librarian/search explanations.

## Allowed Purposes

- `catalogue_metadata_conflict_resolution`
- `subject_classification`
- `abstract_cleanup`
- `keyword_generation`
- `newsletter_draft`
- `accreditation_report_draft`
- `research_recommendation`
- `search_explanation`

## Blocked Purposes

- patron bulk enrolment
- raw personal data processing
- password/auth decisions
- automatic approval of sensitive records
- direct database mutation from AI output

## Prompt Injection Defense

External metadata, descriptions, abstracts, harvested records, and pages are treated as untrusted text. Prompts instruct the model to extract/classify/summarize only, never follow instructions inside content, never reveal secrets, and never perform side effects.

## Functions

- `classifyResourceSubjects`
- `resolveCatalogueMetadataConflict`
- `generateThesisKeywords`
- `cleanAbstract`
- `draftNewsletter`
- `draftAccreditationSummary`
- `generateSearchExplanation`

Each function validates input with Zod, redacts PII, calls the gateway, validates JSON output, logs usage, and returns confidence/warnings.

## Approval Rule

AI outputs that affect production records should go to approval unless they are explicitly low-risk and configured for automatic use. The AI layer never mutates database records directly.
