# AI Provider Routing (free-first chain)

All AI calls in ESUT Smart Library go through one router:
`src/server/ai/providerRouter.ts`.

## Chain

Default order (`AI_PROVIDER_ORDER`):

```text
ollama (local, free) → gemini (free tier) → groq (free tier)
→ nvidia NIM (optional free tier) → vercel AI gateway (paid fallback)
```

- Only **configured** providers are attempted; everything else is skipped with
  the reason code `not_configured`.
- The paid Vercel AI Gateway stays the last-resort fallback so the app keeps
  working even when no free key is set.
- Ollama is **opt-in** (`OLLAMA_ENABLED=true` or `OLLAMA_BASE_URL` set) — prod
  servers have no local daemon.

## Call sites

| Call site | Path |
|---|---|
| Controlled agent/worker completions + usage logging | `src/server/ai/aiGatewayClient.ts` (`callAiGateway`) |
| Structured JSON completions | `src/server/ai/safeJsonCompletion.ts` |
| Lexis AI Reference Librarian chat | `app/api/ai/reference-librarian/route.ts` |
| Worker JSON jobs | `worker/ai.ts` (`workerJsonCompletion`) |
| Provider status (admins) | `GET /api/ai/providers` |

## Privacy and complexity routing

- `privacy: 'local'` (in `ControlledAiRequest.privacy`) restricts the chain to
  local providers (Ollama) and **never** falls back to the cloud.
- `modelKind` selects the model per provider (`fast`, `default`, `reasoning`).
- An explicit `model` value is applied to the gateway provider
  (provider/model form, e.g. `openai/gpt-4o-mini`).

## Resilience

- **Circuit breaker:** after `AI_PROVIDER_BREAKER_THRESHOLD` (default 3)
  consecutive failures a provider is skipped for `AI_PROVIDER_BREAKER_MS`
  (default 60 s).
- **Health cache:** last success/failure, reason and timestamp per provider
  (`getAiProviderHealth()`, also exposed by `GET /api/ai/providers`).
- **Timeout:** each attempt uses `timeoutMs` (default 30 s).
- **Fallback reason codes:** `not_configured`, `circuit_open`, `timeout`,
  `rate_limited`, `auth_failed`, `insufficient_credit` (HTTP 402), 
  `invalid_request`, `server_error`, `network`,
  `empty_response`, `policy_local_only`, `unknown`.
- When every provider fails, `AiRoutingError` carries the full attempt list;
  Lexis falls back to its limited-mode answer instead of erroring.

## Activating free providers (no paid gateway needed)

1. Create a key at https://aistudio.google.com/apikey (Gemini free tier) and/or
   https://console.groq.com/keys (Groq free tier).
2. Add `GEMINI_API_KEY=...` and/or `GROQ_API_KEY=...` to `/root/esut-extra.env`
   on the VPS (never to Git) and redeploy, or set them in local `.env`.
3. Check status: `GET /api/ai/providers` (global admin only) shows each
   provider's `configured` flag and last failure reason.

If only the paid gateway is configured and it returns `insufficient_credit`
(HTTP 402), either add free-tier keys as above or top up the gateway account —
until then Lexis answers in limited fallback mode.

## Configuration

See `.env.example` (`AI_PROVIDER_ORDER`, `GEMINI_API_KEY`, `GROQ_API_KEY`,
`NVIDIA_API_KEY`, `OLLAMA_*`, `AI_PROVIDER_BREAKER_*`). Keys are server-side
only — never expose them with `NEXT_PUBLIC_`.

Tests: `src/server/ai/providerRouter.test.ts` (mocked `fetch`, no network).
