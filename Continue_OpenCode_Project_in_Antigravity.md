# ANTIGRAVITY — CONTINUE EXACTLY WHERE OPENCODE STOPPED

## Mission

**Continue the existing implementation from OpenCode's last verified point. Do NOT restart the project, reimplement finished stages, overwrite work in progress, or treat the last OpenCode conversation as proof that code was actually changed.** Inspect the actual repository and resume the next unfinished task.

The active project is `Projects/afued-smart-librarian` on the reported branch `afued-merger-20261103`. The read-only source repository is `Projects/ESUT SMART LIBRARY`. The larger objective is the AFUED/ESUT merger described in AFUED's `next-prompt.md` (Stages 1–10): port appropriate ESUT capabilities into AFUED while keeping institutional branding, credentials, tenancy and databases separate. **AFUED code and existing business rules are authoritative.**

## Mandatory first actions — read and reconcile, don't edit yet

1. Confirm the actual paths for both repositories. Read the *current* AFUED `AGENTS.md`, `next-prompt.md`, `IMPLEMENTATION-TRACKER.md`, `issues-to-fix.md`, `docs/discovery/feature-comparison-matrix.md`, relevant tests, and other project-specific rules. Read ESUT source files strictly as reference material.
2. Inspect `git status --short`, branch name, recent commits, staged/unstaged/untracked diffs, renames and pending work. **Do not reset, clean, stash, stage, amend, commit, push or discard anything during discovery.** Keep track of preexisting edits versus your edits.
3. Compare the attached OpenCode checkpoint with code that actually exists now. The checkpoint has **conflicting time slices**: an earlier section says D2 was unfinished, while the final, more recent passage says OpenCode was already **in D6, notice dispatch port**, reading sources before implementation. Verify D2 and D5 by inspecting code, tests, tracker and commits. **Do not fall back to D2 solely because the earlier summary says D2 was active.** If D6 is indeed the current unfinished work, continue D6. If the repo proves a different current state, follow the evidence and explain why.
4. Summarize in no more than ~12 lines: confirmed current branch, latest commits, dirty changes to preserve, last completed batch, current unfinished item, next files to edit, tests to run, and blockers. Then **continue implementation without asking me to restate the goal**. Ask only when a genuine permission or product decision is necessary.

## Latest reported work point — D6

OpenCode's final visible handoff says:

- **Current activity:** AFUED B4, specifically **D6 (notice dispatch port)**. It had read ESUT `src/server/circulation/notices.ts` (~689 lines), `deliveryService.ts` (~343 lines), `worker/handlers/communications.ts` (~192 lines), `worker/handlers/notices.ts` (~173 lines), and some related sources.
- **Remaining source review to verify/complete:** ESUT `src/server/circulation/templateRepository.ts`, `patronNotice.ts`, `inAppNotice.ts`; email `types.ts`, `emailService.ts`, `resend.provider.ts`, `gmail.provider.ts`; `sms/adapter.ts`; notice/template/delivery tests; AFUED `app/api/admin/agents/jobs/route.ts`, `src/server/email/resend.ts`, worker handler utilities and types. **Check what already exists in the repository before rereading or rewriting.**
- **Next execution:** Implement/complete the D6 adaptation in AFUED: additive notice templates and delivery-log migration if actually needed; AFUED-compatible repository, notices and delivery modules; `sendOverdueEmails`/`sendDueSoonEmails` handling; worker registration/job routing where appropriate; tests; and tracker updates. Do not copy ESUT's Next 16 patterns verbatim into AFUED's Next 14 architecture.
- The final OpenCode exchange ended with a network error resolving `opencode.ai`, followed by instruction to continue. A network error does **not** establish that a code change succeeded or failed: inspect files.
- The earlier D2 handoff describes a `holdCheckout.ts` extraction and `Circulation.tsx` checkout repair, but **verify whether those were completed before proceeding**; do not assume the earlier unfinished list is still current.
- A prior investigation verified the AFUED root `AGENTS.md` contained only `# Project Agents`, and **no `src/server/Boundaries.md` or boundary-check script existed**. A supposed boundary requirement was explicitly retracted as erroneous. Read the current files afresh and **do not invent a boundary policy or create new boundary tooling without a real requirement**.

## Verified-as-reported historical checkpoints (verify in Git)

- Stages 1–3 discovery and matrix completed; B0–B2 implemented; B3 reported committed at `634f58a` plus tracker commit `112ee8b` (earlier gate: 41 Vitest files/206 tests, zero touched-file lint errors, zero type errors, no institutional contamination).
- B4 covers **D2 (hold checkout), D5 (ILL), D6 (notice dispatch), D7 (offline circulation)**. Work toward D6 first if the current repo confirms it; finish D7 later; run all batch gates and update tracker before B4 commit.
- ESUT production deployment for commit `dab63ab` was reported *completed and verified* on its own deployment system. **Do not deploy ESUT again or touch ESUT production**. Check tracker for owner action #9 to record the confirmed historical outcome, not a fresh deployment claim.
- The recorded issue IDs: **#3 ILL, #13 active hold queue checkout, #22 reservation visibility; #17 is not the hold issue.** Treat `issues-to-fix.md` as authoritative.

## Hard constraints — mandatory

- **AFUED is authoritative. ESUT is read-only.** No ESUT identity, secrets, DB URLs, credentials or branding in AFUED. Preserve AFUED branches, turnstile, tenant isolation, current data and working functionality.
- **No `any` introduced; no new `eslint-disable`; no comments in ported code** (as specified in the handoff). Fix lint errors in touched files, including pre-existing ones, while minimizing unrelated scope.
- **No secret values in logs/output. Never stage `.env`** or other credential files. Leave `next-prompt*.md` and `tsconfig.tsbuildinfo` untracked as specified; do not accidentally stage unrelated files.
- **Do not push AFUED** while the tracked-secret issue (B10) remains. Rotation/untracking of existing credentials requires owner approval. No deploy to either institution without **fresh explicit approval for that deployment**.
- Additive-only database changes, with backup and staging verification before applying any migrations. Current reported AFUED Supabase refs were NXDOMAIN; do not invent a staging DB or mark migrations applied when none is available.
- Maintain the feature matrix's **10-field classification**, acceptance criteria, and in-repo `IMPLEMENTATION-TRACKER.md`; do not claim a stage complete until its acceptance evidence is real.
- On Windows PowerShell 5.1 use `npm.cmd` rather than `npm.ps1`; prefer direct local executable `.cmd` paths. Vitest `--maxWorkers=1`; avoid heavy parallel jobs. Lint may need a **600-second timeout**. Do not create uncontrolled background polling processes.
- AFUED reportedly uses **Next.js 14.2.35 / React 18**; ESUT reportedly uses **Next.js 16.4.0**. Translate routes/types and idioms as necessary rather than direct copying.

## D6-specific implementation expectations

1. Map each ESUT notice/delivery component to AFUED's existing modules and dependencies. Reuse AFUED's email transport, tenant checks, job wiring and data conventions.
2. Any new migrations for notice templates and notice delivery logs must be **additive and staged only** until safe DB approval and verification exist. Never report them as applied merely because migration files were created.
3. Support due-soon and overdue notices with tenant isolation, appropriate idempotency/delivery tracking, retries/failure visibility and sensible test coverage. Prevent duplicate messages or cross-institution delivery.
4. Register relevant worker handlers and, only if needed based on actual architecture, API job dispatch types. Follow existing patterns.
5. Add/extend tests for notice creation, template lookup, delivery behavior, failure conditions, deduplication, tenancy, and handlers. Use source tests as reference, not blindly copied contracts.
6. Keep changes limited to the current approved merger batch. Clearly separate blocked external integrations from implemented code.

## Verification and reporting

- Run targeted ESLint on every touched file, focused Vitest tests with `--maxWorkers=1`, relevant broader tests, TypeScript no-emit check, and institutional-contamination checks. Identify commands that actually exist before executing them. Capture pass/fail counts without exposing secrets.
- Review the diff for unrelated edits, risky SQL/data operations, credential exposure and ESUT-specific identity or URLs.
- Update the implementation tracker only with evidence. Record the current batch, specific completed deliverables, test results, unverified acceptance items and owner actions.
- **Do not commit automatically unless the project brief authorizes it and the current changes have been reviewed**. If authorized, stage only the intended B4 files and leave existing unrelated changes intact. Do not push.
- Finish with a **plain-English, nontechnical summary**: what was already complete, what you continued, files changed, features verified, unresolved blockers, and the exact next step. Mark uncertainty clearly.

## Execution directive

**Begin now. First inspect the live AFUED repository and reconcile the conflicting checkpoint timeline; then continue from the most recent *verified* unfinished step, expected to be D6 notice dispatch. Do not restart the merger plan, and do not stop after producing another plan if implementation can safely proceed.**
