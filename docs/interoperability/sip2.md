# SIP2 Interoperability Profile — ESUT SMART LIBRARY

Authority: **3M Standard Interchange Protocol Version 2.00**, Document Revision 2.12 (April 11, 2006, 78-8129-2375-9 Rev A), publicly hosted by Ex Libris. Implementation-level field tables, checksum rules, and message-code tables are extracted verbatim into [`sip2-field-reference.md`](./sip2-field-reference.md) (1,343 lines, generated from the spec PDF text). That reference is the sole wire-format source for this implementation.

## 1. Pre-change state (Batch 15.1 audit)

The SIP2 code written in earlier waves was **orphaned internal code**: no HTTP route, no worker, no process ever opened a socket or called `handleSip2Message` — only unit tests imported it. The files and their defects:

| File | Lines | Defects found |
|---|---:|---|
| `src/server/sip2/messages.ts` | 54 | Wrong message codes (`SIP2_CODES.PATRON_STATUS = '35'` and `END_SESSION = '35'` collide — Patron Status is `23`/`24`, End Session is `35`/`36`; `RENEW = '17'` is actually Item Information, Renew is `29`/`30`). Parser assumes every request has a 24-char fixed block of language(3)+date(16)+location(5) starting at byte 2 — real requests start with different fixed blocks per message. Regex requires `AY<n>AZ` but **never validates the checksum** (`checksum` always `''`). Response builder emits `'00eng' + ts + '00000'`: version must be `2.00`, `eng` is not a SIP2 language value (numeric `000`–`027` only), and there is no `00000` field. |
| `src/server/sip2/server.ts` | 86 | `CHECKOUT` inserts columns that do not exist on `circulation_transactions` (`action`, `item_id`, `patron_id`, `due_date`) — would fail at runtime. Checkout uses a hardcoded 14-day due date instead of `circulationRules`. End-session response code wrong (see above). Unsupported/default messages answer with `94 AF`, but the spec says **unrecognized command identifiers must be ignored** (no response). No `99`/`98` status handling, no `09`/`10` checkin, no `63`/`64`, no `17`/`18`, no `29`/`30`. |
| `src/server/sip2/auth.ts` | 177 | Sound foundations kept: bcryptjs (12 rounds) with `timingSafeEqual`, lockout 5 fails / 15 min, rate limit 10/min (in-memory Map), CIDR check, `logSip2Event` audit. Caveats: unparsable/absent CIDR falls open (allow), rate-limit state is per-process only. |
| `supabase/migrations/20260929010000_sip2_terminals.sql` | 41 | Schema is good and **already applied LIVE** (`sip2_terminals`, `sip2_audit_log` exist; `sip2_terminals` empty). No `sip2_idempotency` table yet. |
| `src/server/sip2/{auth.test.ts, sip2.test.ts}` | 81 | Tests pass against the non-compliant parser/builder — they lock in wrong formats and are rewritten with the message layer. |

Historical SIP2 commits: `9e51e0c` (wave4), `dfb36f9` (checksum fix — added the checksum *emitter* only), `6602563` (credential validation), `91564fd` (bcrypt closeout). No socket/timeout tests exist in git history either.

## 2. Profile — supported message pairs (Batch 15 target)

| SC → ACS | ACS → SC | Operation | Terminal permission |
|---|---|---|---|
| `99` SC Status | `98` ACS Status | Status/heartbeat | none (always answered) |
| `93` Login | `94` Login Response | Terminal authentication | — |
| `97` Request ACS Resend | `96` Request SC Resend | Resend control | — |
| `63` Patron Information | `64` Patron Information Response | Patron lookup + loans/fines summary | `patron_info` |
| `23` Patron Status | `24` Patron Status Response | Patron summary | `patron_info` |
| `35` End Patron Session | `36` End Session Response | Close session | — |
| `17` Item Information | `18` Item Information Response | Item lookup | `item_info` |
| `11` Checkout | `12` Checkout Response | Loan | `checkout` |
| `09` Checkin | `10` Checkin Response | Return (+ fine calc) | `checkin` |
| `29` Renew | `30` Renew Response | Renew loan | `checkout` |

**Deliberately unsupported** (advertised `N` in `98.BX`, spec-compatible silence for `25`/`65`/`15`/`19`/`37`/`01` handling below): Block Patron (`01`), Hold (`15`), Item Status Update (`19`), Patron Enable (`25`), Fee Paid (`37`), Renew All (`65`). The spec mandates **ignoring unrecognized command identifiers**; for recognized-but-unsupported pairs we respond with the pair's own response code in its failure form (e.g. `12` with `ok = 0`, `AF` message) because "all recognized commands require a response".

## 3. Wire rules this implementation follows

(From `sip2-field-reference.md` §1–§2, §18–§21.)

- **Framing:** messages are CR-terminated (`0x0D`), CR cannot appear inside, no NULs anywhere, no message-length field exists. Fixed fields appear in spec order at the head of the message; ID'd fields (2 chars + data + `|`) follow in any order; unused optional fields are omitted entirely. `AY` and `AZ` never use the `|` delimiter.
- **Checksum (`AZ`):** sum unsigned bytes from the command ID through the `A`/`Z` of `AZ`, keep lower 16 bits, two's complement, 4 hex digits. Verification = everything including the checksum sums to `0x0000`. **Chosen resolutions for spec-silent details:** uppercase hex; a computed `0000` is transmitted and treated as valid.
- **Sequence (`AY`):** SC increments per new message; ACS **echoes** the request's digit in its response (never increments). Bad checksum → ACS answers `96` Request SC Resend; `97` from SC → retransmit last response; duplicate (same checksum + `AY` as previous request) → resend last response.
- **Protocol version:** fixed 4-char `2.00` — 3rd fixed field of `99`, 10th fixed field of `98`. No field ID exists for it.
- **Date/time:** 18-char `YYYYMMDDZZZZHHMMSS` (`yyyyMMdd` + 4 spaces for local time + `HHmmss`).
- **Language:** numeric `000`–`027`; `000` = unspecified. `eng` is not a valid value.
- **BX (supported messages) position order** (0-based, from the spec): 0 Patron Status, 1 Checkout, 2 Checkin, 3 Block Patron, 4 SC/ACS Status, 5 Resend, 6 Login, 7 Patron Information, 8 End Patron Session, 9 Fee Paid, 10 Item Information, 11 Item Status Update, 12 Patron Enable, 13 Hold, 14 Renew, 15 Renew All.

## 4. Server-behavior decisions (spec is silent — documented choices)

| Situation | Decision |
|---|---|
| Unrecognized command ID | Ignore (no response), per spec L2222–2225. |
| Unrecognized field ID | Ignore, per spec. |
| Checksum present and invalid | Reply `96` Request SC Resend; audit-log. |
| Checksum absent | Accepted (error detection optional); answered normally. |
| `AY` absent | Accepted; response omits `AY`/`AZ` only if error detection disabled for that message — **we always emit `AY`+`AZ`** because our profile runs with error detection enabled (documented in deployment doc so SC config matches). |
| Message before login | Spec undefined. Allowed pre-login: `99`, `93`, `97`. Every other recognized command gets its pair's response code in failure form (`ok = 0` + `AF` reason), and the event is audited as `pre_login_blocked`. |
| Session state | Per-connection: terminal id, authenticated flag, allowed operations, last request (for `97`/duplicate resend), sequence of last request. Cleared on `35` and on disconnect. |
| Institution id | `AO = ESUT`; `94`/`98`/`24`/`64`/`10`/`12`/`30` echo `AO` when replying. |

## 5. Business logic

All circulation decisions flow through `src/lib/circulationRules.ts` (loan rules by patron category, `computeDueDate`, `calculateFine`) via the shared server-side `src/server/circulation/circulationService.ts`. SIP2 never re-implements policy, and checkout idempotency (same patron + item + active loan) and concurrency guards live at the service/DB layer, not in the protocol layer.

## 6. Related documents

- `docs/sip2-deployment.md` — listener process, ports, TLS, Docker, health, observability.
- `docs/standards-conformance.md` — conformance notes for SIP2 plus OAI-PMH/SRU/Z39.50.
- `docs/interoperability/sip2-field-reference.md` — extracted 3M v2.00 field tables (implementation source).
