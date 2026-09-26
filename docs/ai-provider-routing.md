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
  `rate_limited`, `auth_failed`, `invalid_request`, `server_error`, `network`,
  `empty_response`, `policy_local_only`, `unknown`.
- When every provider fails, `AiRoutingError` carries the full attempt list;
  Lexis falls back to its limited-mode answer instead of erroring.

## Configuration

See `.env.example` (`AI_PROVIDER_ORDER`, `GEMINI_API_KEY`, `GROQ_API_KEY`,
`NVIDIA_API_KEY`, `OLLAMA_*`, `AI_PROVIDER_BREAKER_*`). Keys are server-side
only — never expose them with `NEXT_PUBLIC_`.

Tests: `src/server/ai/providerRouter.test.ts` (mocked `fetch`, no network).
