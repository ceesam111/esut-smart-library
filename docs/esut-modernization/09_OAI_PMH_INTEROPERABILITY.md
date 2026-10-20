# ESUT Virtual Library — OAI-PMH Interoperability (T07)

Endpoint: `https://virtuallibrary.esut.edu.ng/api/oai` (enabled only when `OAI_ENABLED=true`; currently disabled in production → 404 by design).

## Conformance status after fixes

| OAI-PMH requirement | Status | Evidence |
|---|---|---|
| Six verbs (Identify, ListMetadataFormats, ListSets, ListIdentifiers, ListRecords, GetRecord) | PASS | `src/server/oai/service.ts`; `service.test.ts` |
| `responseDate`/`earliestDatestamp`/token `expiration` in UTCdatetime granularity | PASS (fixed) | `oaiXml.ts:41-46`; route earliestDatestamp query |
| Missing/illegal verb → `badVerb` without `verb` attribute on `<request>` | PASS (fixed) | `service.ts:48-49`; test |
| Strict `badArgument`: stray args per verb, `resumptionToken` alone, `GetRecord` rejects from/until/set, `ListIdentifiers`/`ListRecords` reject `identifier`, unknown query params rejected | PASS (fixed this session) | `service.ts` argument checks; route unknown-param check; 3 new tests |
| Resumption tokens: HMAC-SHA256 signed, TTL 30 min, expired → `badResumptionToken`, works across ListIdentifiers/ListRecords | PASS | `service.test.ts` (expiry, forgery, round-trip incl. non-Latin-1 values — UTF-8-safe base64) |
| UTF-8 safety (XML escaping incl. control-char stripping; UTF-8 token encoding) | PASS (fixed) | `oaiXml.ts` `stripControlChars`, `toBase64Utf8` |
| `oai_dc` minimum + datacite/marcxml crosswalks | PASS | `crosswalks.ts`; ListMetadataFormats test |
| Public-gated records only (published + global + not embargoed) | PASS | `isPublicItem` + list filters; access-control tests |
| `dc:identifier` URL resolvability | PASS (code) | identifiers are canonical landing URLs; live resolution = production smoke item |
| Rate limiting for harvesters | PASS | route limiter (120/min) + middleware `/api/oai` sensitive prefix; Arcjet bot-filter deliberately excluded so legitimate harvesters aren't blocked |
| No auth leak | PASS | endpoint serves only public metadata; audit §A |

## Standards references used

- OAI-PMH 2.0: https://www.openarchives.org/OAI/openarchivesprotocol.html
- Dublin Core: https://www.dublincore.org/

## Known items

- Duplicate legacy edge function `supabase/functions/oai-pmh/` is **deprecated documentation** — not referenced by `supabase/config.toml`, not deployed; scheduled for removal after owner confirmation.
- Production enablement actions: set `OAI_ENABLED=true`, and set a dedicated `OAI_TOKEN_SECRET` (falls back to the service-role key if unset — acceptable but not ideal).
- External validator run (e.g., OAI validator against a harvester) is a production smoke-test item — not claimable offline.
