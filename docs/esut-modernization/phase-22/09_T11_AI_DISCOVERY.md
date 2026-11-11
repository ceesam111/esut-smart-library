# 09 — T11: Responsible AI Research Discovery (Phase 22, §8)

## Approach

Per §8: "Upgrade incomplete implementations rather than building a parallel AI system." No parallel system was built; the existing AI search/discovery surfaces were hardened with two new server modules + evaluation tests.

| Component | Location |
|---|---|
| Source-grounding layer | `src/server/ai/researchGrounding.ts` + `researchGrounding.test.ts` |
| Token/cost budgeting | `src/server/ai/tokenBudget.ts` + `tokenBudget.test.ts` |
| AI policy (existing) | `src/server/ai/aiPolicy` (modified earlier in phase — tightened, not replaced) |

## The 10 mandatory requirements — evidence

| # | Requirement | How it's met | Evidence |
|---|---|---|---|
| 1 | Never fabricate publications | answers/recommendations assembled only from retrieved approved records; retrieval-empty ⇒ explicitly "no results", not invented items | `researchGrounding.test.ts` |
| 2 | Never fabricate citations | citation strings built from real record fields; `aiSummary` left guarded-off/empty instead of generating plausible text | grounding tests + T09 decision (07) |
| 3 | Ground answers in approved records | retrieval filters to `published` (+ visibility gate), same public gate as search | grounding tests |
| 4 | Link claims to source records | every claim carries its source record id/URL back-reference | grounding module |
| 5 | Exclude private/unauthorized content | permission-aware retrieval honors the same visibility rules as the public UI | grounding tests + anon probes (repository anon reads only 4 published rows) |
| 6 | Prompt-injection protection | user text is delimited/treated as data; policy layer rejects instruction-escaping patterns before retrieval | `aiPolicy` + grounding tests |
| 7 | Validate retrieval relevance | relevance scoring with threshold; below-threshold results dropped rather than returned | grounding tests |
| 8 | Limit abuse and AI costs | `tokenBudget` caps per-request/per-user spend; rate limiting on API routes | `tokenBudget.test.ts` + route rate limits |
| 9 | Handle unavailable AI gracefully | no-response/timeout path degrades to standard keyword search with a visible notice — never a fake "AI answer" | graceful-degradation tests |
| 10 | Unsupported claims visibly uncertain | uncertainty marking when evidence is thin; empty-evidence ⇒ no claim | grounding tests |

## Evaluation tests created (§8 mandate)

`researchGrounding.test.ts` covers **citation accuracy, retrieval relevance, groundedness**; access control is covered both there and by the route-level auth tests. `tokenBudget.test.ts` covers cost limiting.

## Paid providers & external transmission — not done (forbidden without approval)

- **No paid model provider connected.** No API keys for external LLMs exist in the workspace and none were added (§8 prohibition).
- No restricted research materials are transmitted externally: retrieval and grounding happen server-side against the project's own database.
- Consequently: **the production AI service itself is NOT claimed as validated** — §8 explicitly allows implementing and testing "the safe integration boundaries without pretending the production AI service has been validated." That is exactly the status: boundaries implemented + tested; live model integration out of scope pending approval.

## Resolved problems

- Ungrounded-summary risk eliminated: `aiSummary` remains an intentionally empty guarded field (never fabricated).
- Cost-abuse path closed via explicit budgets instead of relying solely on route rate limits.

## Remaining issues / unverified

- Semantic/vector search (embeddings + pgvector) not present — infra/cost decision, standing item (04/13).
- Live end-to-end AI answer quality against production data: unverified (no approved external model access; boundary tests only, as permitted).

## Verification results

Both new suites green in the final full run (115 files / 1003 tests, exit 0); `tsc` 0; ESLint 0; build 0.
