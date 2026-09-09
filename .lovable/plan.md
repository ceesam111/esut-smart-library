
## Goal

Bring the uploaded Bolt project (`project-bolt-sb1-8nbq9pcx.zip`) into this Lovable workspace as the active app, then layer on the AFUED Smart Library changes from your previous brief (branding rename, Lyria upgrades, Reference Services page, etc.).

## 1. Stack swap

The uploaded project is a different stack than the current Lovable template:

- Uploaded: Vite 5 + React + React Router DOM 6 + Supabase + Tailwind v3 (~80 pages, Supabase Edge Function for Lyria).
- Current Lovable template: TanStack Start + Tailwind v4 (blank).

Plan:
- Replace the current `src/`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `tsconfig*.json`, `index.html`, `package.json` with the uploaded project's versions.
- Move `supabase/` (migrations + `ai-librarian` edge function) into the project root.
- Remove TanStack Start files (`src/routes/`, `src/router.tsx`, `src/start.ts`, `src/server.ts`, `routeTree.gen.ts`).
- Run `bun install` against the imported `package.json`.
- Reuse the existing Lovable Cloud (Supabase) project; re-apply the imported migrations against it.

If anything in the uploaded `.env` references the original Bolt Supabase project, I'll switch those to this workspace's Lovable Cloud credentials.

## 2. Branding: "AFUED Digital Library" → "AFUED Smart Library"

Global text replace across all UI strings, page metadata, `<title>`, og tags, aria-labels, footer, navbar, admin layout, and seed/migration display strings. Files (not renamed):
- `index.html`, `src/App.tsx`, `src/components/layout/{Navbar,Footer,DashboardLayout,AdminLayout}.tsx`
- All `src/pages/**` that reference the old name
- Edge function and SQL display strings only — no table renames

## 3. Lyria upgrades (`src/pages/AILibrarian.tsx`, `src/components/ai/AILibrarianWidget.tsx`, `supabase/functions/ai-librarian/index.ts`)

- **Greeting:** initial assistant message becomes exactly:
  > Hello, I am Lyria, your AFUED Reference (AI) Librarian. I am here to answer any question you have for me.
- **System prompt:** replace existing prompt with:
  > You are Lyria, AI Reference Librarian of AFUED Smart Library. Answer all library and academic questions across all disciplines. Include APA 7th edition in-text citations and full references for academic answers. Only cite sources from 2015–present. Never fabricate citations.
- **Output sanitization:** add a `stripMarkdown(text)` util that removes `#`, `##`, `*`, `**`, `_`, `__`, `~`, `` ` ``, ```` ``` ````, `>`, `|`. Apply before rendering and before passing text to TTS.
- **Voice input:** add a mic button using the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`). Pulsing red indicator while recording, a stop button, transcript auto-submits to Lyria, response is spoken via `speechSynthesis` (after stripping markdown). Graceful fallback message if the browser lacks the API.
- **Referral:** add a "Refer to Human Librarian" button always visible in the chat panel. Also, when Lyria's answer indicates low confidence (e.g. contains "I don't know", "not sure", "cannot confirm", or no citations were produced for an academic question), automatically append a referral suggestion to the response. Button opens `https://wa.me/<number>` in a new tab; a sibling `tel:` link is shown. Number is pulled from the existing app contacts (Footer/Contact constant) — I'll centralize it into one `src/lib/contacts.ts` if it's currently inline.

## 4. Home banner

`src/pages/Home.tsx`:
- Update the Lyria banner copy to: **"Lyria — Your AFUED Reference (AI) Librarian"**.
- Remove the word "Research" from that banner.
- Fix sizing/colour/visibility so it sits clearly below the navbar (add top padding equal to navbar height, ensure contrast against background, constrain width, responsive font sizes).

## 5. "Course Reserve" → "Reference Services"

Rename in UI only (not in DB, route filenames, or table names):
- All menus, breadcrumbs, links, page titles, and aria-labels in `Navbar.tsx`, `Footer.tsx`, `DashboardLayout.tsx`, `AdminLayout.tsx`, `App.tsx` (route labels), `Home.tsx`, etc.
- Keep route paths working; I'll add an optional alias route `/reference-services` pointing at the same component if you want a friendlier URL — say so and I'll include it.

Rewrite `src/pages/CourseReserves.tsx` content to:
- Hero with intro to Reference Services (professional copy).
- Prominent **"Ask Lyria"** CTA that opens the Lyria chat (`/ai-librarian` or the existing AILibrarian route).
- Sections: Reader Advisory, Subject Guides, Citation Help, Research Consultations, Document Delivery, Interlibrary Loans.
- **Contact a Human Librarian** section with WhatsApp (wa.me) and `tel:` links from the shared `contacts.ts`.

The admin/dashboard variants (`admin/CourseReserves.tsx`, `dashboard/DashboardCourseReserves.tsx`) get the label rename only — their existing functionality is preserved.

## 6. Verification

- `bun install`, then a build/typecheck pass.
- Open the preview and confirm: branding rename in navbar/footer/home, Home Lyria banner copy + layout, Lyria greeting, markdown-stripped output, mic + stop buttons appear and recording indicator pulses, referral buttons open WhatsApp and tel links, Reference Services page renders with all sections.

## Open questions (please confirm before I build)

1. **WhatsApp / phone number** for the referral and contact sections — what's the canonical number? If one already lives in the uploaded code I'll detect it and reuse it; if you have a preferred one, share it now.
2. **Reference Services route alias** — keep the existing `/course-reserves` URL only, or also add `/reference-services` as an alias? (DB/table names stay either way.)
3. **TTS provider** — fine with the browser's built‑in `speechSynthesis` (zero cost, no key), or do you want me to wire it through the Lovable AI gateway TTS endpoint instead?
