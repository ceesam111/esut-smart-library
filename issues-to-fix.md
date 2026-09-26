I want you to do a deep check and deep research to fix these production issues or errors we notice or found out in this app, 1.photo or user profile photo  upload should be between 50kb to 240kb 
2. Registration page date field should be selectable and easy to fill 
3. The Interlibrary Loan Request is not working , the submit your first request not working 
4. We search for a resource or book say for example Fundamental of Library book but it return books that do not fully match our request and all the returned resources are only from open library, it should be able to check out all other sources as define in the app 
5.All resources should be labelled appropriately with their corresponding name e.g a journal should not be lablelled as ebook, and we notice some of the 3D ebooks displayed has their name or description over flowing horizontally from the 3D figure or book
6. PDF Upload Failed saying Submission Failed, ,bucket not found ...on the project of thesis or resources upload page
7.The research profile and supervised theses menu belong to lecturer or Researchers. It does not belong to student. Hence must be removed from  student dashboard
8. Replace every OGBL Related Demo data in the app and databases with AFUED
9. The Repository page header text is not showing or visible or displaying properly
10.Lyria (AI Reference Librarian ) is not working, saying temporarily unavailable
11.News Items Under News Index does not have date
12.Researcher page at /researchers is not displaying or showing properly 
13. At the Active Hold Queue, we try to checkout for a student on circulation but not working
14.Scanned or Barcode Scanning not working or scanning
15.Statistics not working on catalogue page at /admin/catalogue
16.we notice that the system is importing or staging the same book or material or resources more than one time
17.Run HArvest Now button failed at the Newspaper Index page at /admin/newspapers-index
18.Content Harvest Engine also failed to Run
19. All the AI Agent Workers seems not to be working , failed to run or operations failed
20.i want the registration page to notify or alert the user if the user did not check the cloudflare turnstile verification instead of just hanging in creating without user knowing the cause of it, and the cloudflare turnstile can be place at the bottom of the form instead of at the top just like you did for the login page, we also want the user to be able to upload profile picture during registration and should be able to update basic account information in account settings...image size should not be more than 50kb to 150kb , else reject it, the profile image should now be used where neccessary like the dashboard , on the Digital ID Card
21.On the Digital ID Cards, only render surname as capital letter or make it the first with comma seperating it from other names, Please add an instructions on how to play the games on the student overview at the take a break section, Replace Colour Match Game with Another More Interesting Game.....All games should have instructions......give more sounds for the Ambient sounds for birds...all musical instruments ...all animals..., also under the stress , anxiety sections, the quote should not be static , it should be changing or dynamic based on result....there should be other sections for short music, animations,curiosity[something the users does not know...it maybe under technology, fashion, agric....],Also for the Talk to Calm section should have functionality to allow user to use speech to text instead of only typing, the users might be tired ...user can tell it to play him a relaxation music or somethings, also on the take a break page, there should be back button to always go back, also under the quick access on the dashboard, add Library Manual to the Quick Access , then add a correpponding form for the admin or superadmin to add Library Manual...i also notice that the cloudflare security sometimes block page  when we are already using the page or when we navigate to some page...the page will just show a next js client error white page ...but when i hard refresh ..it load the cloudflare turntile...and i click it ..it then work..this is not good ....also we notice that Lyria do not give real time information as of today when we ask it, it cannot even play music....user should be able to use speech to text with lyria as well
22.Also the response from lyria is not properly formatted or display properly in a readeable format,  also the file size limit for profile image should only have maximum requirement of 150kb, the minimum requirement should be removed.....also the user account setting form should  have more fields to update like email, password and probably all other things, also add a back button to all page for user to easily go back to previous page, we notice that on the admin or superadmin or librarian module we notice that add catalogue Item page , some functionality that exisited before are missing: Library of Congress Classification, World Catalogue, and one other one ...please do a deep check and deep research to fix all these issues..,also add DEWEY Decimal Classification, also we want to know where the reserved book are in between patron, librarian and the super admin, a patron reserve a book , and the patron did not , see , and also we could not see it on the super admin or librarian dashboard to either approve it or do something

---

## Session status 2026-09-26 (part 2 — provider keys wired, B2/Turnstile/Voice fixed)

Commits: `9aa4b55` (current model defaults + model-candidate fallback + Turnstile build arg), pushed and deployed.

Secrets configuration (never committed — `/root/esut-extra.env` on VPS, `gitignored .env.local` locally):
`GEMINI_API_KEY`, `GROQ_API_KEY`, `ELEVENLABS_*`, `CLOUDFLARE_SITE_KEY`, `CLOUDFLARE_SECRET_KEY`, `NEXT_PUBLIC_CLOUDFLARE_SITE_KEY`, `B2_ENDPOINT`, `B2_REGION`, `B2_BUCKET_LIBRARY_FILES/BACKUPS/EXPORTS`, `B2_PUBLIC_BASE_URL`.

Root causes found and fixed:

1. **Issue 10/19 (AI unavailable)** — the router's default models were retired (`gemini-2.0-flash`, `llama-3.3-70b-versatile` → 404). Fixed defaults to models that exist today (`gemini-3.8-flash`, `qwen/qwen3.8-27b`, reasoning `openai/gpt-oss-120b`) and added a **model-candidate fallback**: on 404/503/empty the router walks the provider's candidate list before moving on, so future catalog churn cannot break Lexis or the agent workers. Live proof: `GET /api/ai/reference-librarian` returns a real answer served by **Gemini** (free tier); `/api/ai/providers` shows `gemini configured=true, lastSuccessAt=...`.
2. **Issue 20 (Turnstile)** — keys now configured; `/api/security/turnstile/config` returns a site key, and `/api/security/turnstile/verify` rejects a bad token with the real Cloudflare code `invalid-input-response`. The form already shows "Please complete the Cloudflare security verification before submitting." and renders the widget above the submit button. Dockerfile/deploy now pass `NEXT_PUBLIC_CLOUDFLARE_SITE_KEY`.
3. **Issue 6 (PDF upload "bucket not found")** — the container had **zero** `B2_*` variables, `B2_ENDPOINT` lacked the `https://` scheme, `B2_REGION` and bucket names were unset. Configured `https://s3.us-east-005.backblazeb2.com`, region `us-east-005`, bucket `esuttlibrary` (discovered from the account). Verified with a real put/head/delete probe — PASS.
4. **Issue 10 (Lyria voice)** — ElevenLabs key was valid but the configured voice was a **library (paid) voice**: API returned `402 paid_plan_required` for free users. Switched `ELEVENLABS_LYRIA_VOICE_ID` to premade voice **Sarah** (`EXAVITQu4vr4xnSDxMaL`). Live proof: `/api/ai/lyria-voice` returns `audio/mpeg`, 30 KB, 1.6 s.

Verification evidence (2026-09-26, after final deploy): `next build` OK · vitest **52/52** · `verify-resource-pages.mjs` 18/18 · tsc clean for changed files (only the 64 pre-existing `libraryMode` errors) · production E2E **13/13** · Lexis real answer · Lyria audio · Turnstile configured · B2 probe PASS · app + worker healthy with 44 env lines.

Still open (not addressed in this session): issues 1-5, 7-9, 11-19, 21, 22 from the numbered list above (ILS submit, search relevance, resource labels/3D overflow, student-only menus, repository header, news dates, researchers page, hold checkout, barcode, catalogue statistics, duplicate staging, harvest buttons, content engine, Take-A-Break, account settings, back buttons, Dewey/LoC/WorldCat fields, reserved-books visibility). Turnstile keys still need the Cloudflare site's allowed domains to include `virtuallibrary.esut.edu.ng`, and the Vercel AI Gateway still has no credit (harmless — free providers now serve first).


## Session status 2026-09-26 (registration + AI tools + AI router)

Commits (pushed to `ceesam111/esut-smart-library` master, deployed to VPS):

- `0e71ed4` — registration profile creation via server endpoint, email rate-limit resilience, optional photo, AI Tools directory, free-first AI provider router.
- `4f18b43` — security: create-profile requires a bearer token for the same user or an unconfirmed auth user created within the last 30 minutes.
- `286fd13` — classify HTTP 402 as `insufficient_credit`; docs for activating free providers.

Resolved in this session:

- Registration now creates the `patrons` row server-side (`app/api/registration/create-profile`) because RLS blocks anon inserts when email confirmation is on; CSRF exemption added for `/api/registration/`; verified live end-to-end (signup → row persisted → recovery path).
- Verification email is best-effort (202 `rate_limited`/`send_failed`, friendly notices on Register/Login via `?registration=verified|expired|invalid`) — no more hard failures when Resend is rate-limited.
- Profile photo is optional, max 150 KB after client-side auto-compression; all four registration forms wrap `registerAccount` in try/catch/finally.
- Subscribed Databases: EBSCOHOST via TERAS (https://teras.ng) added — 7 cards, `scripts/verify-resource-pages.mjs` updated to 7.
- AI Tools directory rebuilt from `university_library_open_access_ai_tools_directory.md` via `scripts/parse-ai-tools.mjs` → `src/config/aiTools.data.ts` (42 tools, 12 groups, search/filters/detail modal/governance notices); nav label "AI Tools Directory".
- AI calls now use `src/server/ai/providerRouter.ts`: Ollama (opt-in) → Gemini → Groq → NVIDIA NIM → paid gateway, with circuit breaker, health cache, reason codes; Lexis and worker JSON jobs routed through it; `GET /api/ai/providers` (global admin) shows status; tests in `providerRouter.test.ts`.

Verification evidence (2026-09-26): `next build` OK; vitest 51/51; `verify-resource-pages.mjs` 18/18; tsc shows only the 64 pre-existing `libraryMode` errors; production E2E 13/13 checks passed (health, policy, providers 401, create-profile 400/200/recovered/persistence/401, `/ai-tools` 200); bundle greps confirm `ebscohost`, `teras.ng`, "AI Tools Directory" shipped; app + worker containers healthy.

Open items (need user action):

1. ~~**Lexis limited-mode**~~ — resolved in part 2: free-tier `GEMINI_API_KEY`/`GROQ_API_KEY` added to `/root/esut-extra.env`, Lexis now answers via Gemini. Vercel AI Gateway still has no credit (harmless fallback).
2. ~~Cloudflare Turnstile: no site/secret keys exist yet~~ — resolved in part 2: keys configured, site key served, verify endpoint rejects bad tokens with the real Cloudflare code.
3. AFUED domain Cloudflare 403 (Under Attack / Bot Fight Mode) must be disabled by the account owner.
4. Remaining items from the numbered list above (ILS loan, search ranking across sources, statistics, harvest, reserved-books workflow, etc.) not touched in this session — PDF bucket (issue 6) and Lyria voice (issue 10) fixed in part 2. ISSUE 22: MyProfile photo limits now fixed (max 150 KB, no 50 KB minimum; using shared `readProfilePhoto` helper).
5. `npm run lint` still broken locally (pre-existing); project folder name `ESUT SMART LIBRARY` does not match the DWC registry slug `esut-smart-library`.


## Session status 2026-09-26 (reservations RLS, back buttons, Account edit mode)

Commits (pushed to `ceesam111/esut-smart-library` master, deployed to VPS):

- `4ead44f` — Digital Library ID surname fallback in `LibraryCard.tsx` (`formatCardName()` falls back to the last token of `full_name` when `profile.surname` is NULL).
- `9c0d395` — reservation visibility + back-button coverage: "My Reservations" nav (patrons), "Book Requests" nav (admins), RLS migration `20260926120000_fix_reservations_staff_rls.sql`, `BackButton` added to Dashboard, CourseReserves, ILLHistory, LecturerProfile, ReadingLists.
- `7efa360` — working Account edit mode; `EbookResponse` initial state includes all source buckets; `TurnstileVerifyResult` type fixes the signature the build had been ignoring.

Resolved in this session:

- **Reservation visibility (issue 22)**: the original `reservations_select_policy` / `reservations_update_policy` only checked the `librarians` table, so a super admin with no active librarian row could not see or approve reservations. New migration adds `or public.is_library_staff(auth.uid())`. Applied to the hosted Supabase database (not just committed) and verified live: the stored select policy now ends with `is_library_staff(auth.uid())`.
- **Reservation navigation**: patrons now have "My Reservations" → `/dashboard/requests`; admins now have "Book Requests" → `/admin/requests` (route and page already existed but nothing linked to it).
- **Back buttons (issue 22)**: `BackButton` added to the five dashboard pages that lacked any back affordance. `DashboardThesis` already has a "Back to Dashboard" link; `Wellbeing` (Take A Break) already has `BackButton`.
- **Account edit mode (issue 22)**: `Account.tsx` had a `handleSave` that referenced undefined `patron`, `setPatron`, `setProfileError`, `supabase`, `institutionConfig` and `useState` was never imported — with no edit UI at all, and invisible because `next.config.mjs` sets `typescript.ignoreBuildErrors: true`. Rebuilt with a real `Edit Profile` / `Cancel` / `Save Changes` flow, typed fields (identity, contact, academic, preferred branch, bio), update by `user_id`, then `reload()`. Library Number, Patron ID, status and email stay read-only with an explanatory notice.
- **Type-check drift**: `emptyEbookResponse()` was missing the 9 source buckets added by the search-bucketing fix; `verifyTurnstileToken` no longer matched the route that reads `result.error`. Both fixed.

Verification evidence (2026-09-26): `next build` OK; vitest 52/52; `verify-resource-pages.mjs` 18/18; `tsc --noEmit` = 64 errors, exactly the pre-existing baseline (no new errors); production E2E 13/13 passed after deploy; `GET /api/security/turnstile/config` 200 with site key; app container healthy after cutover; reservation RLS confirmed live via `pg_policies`.

Known gap (found while checking admin roles, not fixed here): `catalog_admin`, `ir_admin` and `dept_ir_officer` exist in the front-end `roles.config.ts` permission map but are **not** in the server-side `FoundationRole` / `LIBRARY_ADMIN_ROLES` in `src/server/auth/permissions.ts`, and are not in the assignable list in `Accounts.tsx`. A user granted one of them in the database would pass front-end gates but be rejected by `requireRole()` API calls.

Still open from the numbered list: issues 3, 5, 7, 9, 11-19, 21 (ILL submit, resource labels/3D overflow, student-only route guards, repository header, news dates, researchers page, hold checkout, barcode, statistics, duplicate staging, harvest, content engine, Take-A-Break extras, reserved-books visibility). Turnstile verification stays temporarily disabled by directive — re-enable in `src/server/security/turnstile.ts` once final keys are issued.
