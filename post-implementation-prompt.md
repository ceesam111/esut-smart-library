The previous implementation project is now reportedly complete.

According to:

`docs/implementation-progress.md`

all Waves 0–6 have been delivered, deployed and verified.

I now want you to perform a completely NEW, evidence-based competitive audit of the CURRENT application against the CURRENT stable/latest documented versions of:

1. Koha
2. DSpace

DO NOT reuse the old comparison.

DO NOT assume that because `docs/implementation-progress.md` says a feature is complete that it actually achieves feature parity with Koha or DSpace.

This is a fresh verification exercise.

==================================================
PRIMARY QUESTION
==================================================

After all recent implementations:

WHERE IS ESUT LIBRARY NOW:

- genuinely ahead of Koha?
- genuinely behind Koha?
- approximately at parity with Koha?
- genuinely ahead of DSpace?
- genuinely behind DSpace?
- approximately at parity with DSpace?
- uniquely capable because it combines functionality normally split between both systems?

I want a deep technical comparison backed by:

1. current repository code;
2. actual database schema;
3. actual APIs;
4. actual running endpoints where available;
5. tests;
6. configuration;
7. current official Koha documentation;
8. current official DSpace documentation.

Do not base the answer on marketing language.

==================================================
RULE 1 — RESEARCH CURRENT COMPETITORS FIRST
==================================================

Before comparing anything, research the CURRENT official releases and documentation.

Identify:

- latest/current stable Koha release
- latest/current stable DSpace release
- release date/version
- significant capabilities relevant to this comparison

Use primarily official sources:

Koha:

- koha-community.org
- official Koha manual
- official Koha release notes
- official API documentation

DSpace:

- dspace.org
- official DSpace documentation/wiki
- official DSpace GitHub/release notes
- official REST API documentation

Do not rely primarily on old blog posts or third-party comparison articles.

Put the exact versions used in the report.

Example:

Comparison date: [current date]
Koha baseline: [version]
DSpace baseline: [version]
ESUT Library commit/build: [commit hash/version]

==================================================
RULE 2 — VERIFY OUR FEATURES FROM CODE
==================================================

Do NOT treat these documents as sufficient proof:

`docs/implementation-progress.md`
`docs/platform-audit.md`

They may guide the investigation, but verify implementation directly.

For every major claim inspect:

- routes
- services
- controllers
- database migrations
- schema
- workers
- tests
- frontend
- configuration
- Docker/deployment files
- external adapters

Where practical actually exercise the endpoint or run the relevant test.

For every ESUT claim provide evidence such as:

file path
function/class
API endpoint
database table
test file

Example:

OAI-PMH:
`src/...`
`GET /oai`
tests: `...`

==================================================
RULE 3 — USE A STRICT FEATURE STATUS SYSTEM
==================================================

For every capability assign ESUT one of:

AHEAD
PARITY
BEHIND
PARTIAL
NOT APPLICABLE
UNVERIFIED

But use these labels ONLY at individual capability level.

Do not simply give the entire platforms one arbitrary score.

Define them as:

AHEAD
ESUT demonstrably provides useful capability that the competitor lacks, integrates more deeply, or combines with other capabilities in a materially stronger workflow.

PARITY
Both systems provide substantially equivalent production functionality even if implementation differs.

BEHIND
Competitor functionality is materially deeper, more mature or more complete.

PARTIAL
ESUT has implemented the area but significant portions remain weaker/incomplete.

UNVERIFIED
Code/documentation exists but you cannot prove production behavior.

NOT APPLICABLE
Capability is genuinely outside ESUT institutional requirements.

==================================================
RULE 4 — MATURITY MATTERS
==================================================

Do NOT equate:

"we implemented feature X"

with:

"we now equal a system that has used X in thousands of libraries for many years."

Separate:

FEATURE CAPABILITY

from:

OPERATIONAL MATURITY

For every important module consider:

- feature depth
- standards compliance
- interoperability
- test coverage
- operational deployment
- edge cases
- scale
- extensibility
- documentation
- ecosystem
- real-world integrations
- years of production exposure

For example:

If ESUT has SIP2 code and tests but no production self-check hardware has ever connected to it, say so.

If ESUT has EDIFACT adapters but has not exchanged production orders with a real supplier, say so.

If ESUT has DataCite integration but no production credentials/DOIs minted, distinguish CODE COMPLETE from PRODUCTION VERIFIED.

==================================================
SECTION A — KOHA COMPARISON
==================================================

Compare ESUT Library against Koha systematically.

At minimum cover:

---

1. CATALOGUING

---

Compare:

MARC21
MARCXML
advanced MARC editor
frameworks/templates
MARC validation
record overlay
import
batch editing
duplicate detection
bibliographic relationships

---

2. AUTHORITY CONTROL

---

Compare:

authority records
bibliographic linkage
heading management
merge
automatic relinking
authority types
external authority lookup

ORCID
VIAF
ISNI
LC authorities
ROR where relevant

---

3. Z39.50 / SRU

---

Be extremely strict here.

Check whether ESUT now has:

actual Z39.50 CLIENT

not merely relabelling an Open Library REST API.

Check:

configurable targets
MARC retrieval
authority retrieval
encoding
authentication
timeouts
rank
overlay workflow

Check SRU:

client
server
CQL
Explain
searchRetrieve
schema mappings

If Z39.50 is still only honestly relabelled rather than actually implemented, ESUT remains BEHIND Koha in that capability.

Do not hide that fact.

---

4. CIRCULATION

---

Compare:

checkout
check-in
renewal
holds
reserves
restrictions
loan rules
fine rules
calendar
overdues
lost items
transfers
branch handling
recalls if available
offline circulation

---

5. SELF SERVICE

---

Compare:

SIP2
self-check integration
security model
production hardware interoperability

---

6. PATRON MANAGEMENT

---

Compare:

patron categories
permissions
registration
expiry
guarantors
restrictions
privacy
import/export
authentication integrations

---

7. ACQUISITIONS

---

Compare deeply:

vendors
budgets
funds
fiscal periods
suggestions
purchase orders
basket/order workflow
receiving
partial receiving
invoices
claims
cancellations
encumbrance
expenditure
tax
shipping

---

8. EDI / EDIFACT

---

Determine whether ESUT's EDI implementation is:

test fixture only

or:

real supplier-compatible EDIFACT.

Compare:

orders
responses
invoices
claims
vendor configuration
message tracking
error recovery

Do not declare parity if no production supplier interoperability exists unless justified carefully.

---

9. MULTI-CURRENCY

---

Compare:

exchange rates
base currency
historical transaction rates
supplier currency

---

10. POS

---

Compare:

cash transactions
fine payments
refunds
waivers
receipts
cash-up/reconciliation
permissions
audit

---

11. SERIALS

---

Compare:

subscription management
publication patterns
issue prediction
receiving
late/missing issues
claims
routing lists
vendor linkage
renewal

---

12. ERM

---

Check Koha's current Electronic Resource Management capabilities.

Compare:

agreements
licenses
packages
platforms
titles
holdings
coverage
providers
usage

This may still be an area where Koha is deeper.

Verify.

---

13. NOTICES AND SLIPS

---

Compare:

templating
print
email
checkout slip
overdue
hold
serial claim
acquisition claim
branch-specific configuration
translations

---

14. ILL

---

Compare:

request lifecycle
backend/provider integrations
statuses
patron interaction
staff management
notifications

---

15. REPORTING

---

Compare ESUT's new report writer against Koha.

Check:

saved reports
SQL reports
parameterization
permissions
scheduling
exports
visual builder
report catalogue

Determine whether ESUT's safer read-only report architecture provides an advantage or merely less flexibility.

---

16. ANALYTICS

---

Compare:

traditional reports
live dashboards
search analytics
circulation analytics
repository analytics

ESUT may now have an advantage if its analytics are genuinely live and integrated.

Verify.

---

17. SEARCH / DISCOVERY

---

Compare:

catalogue search
facets
relevance
authority-aware search
federated discovery
external scholarly sources
full text

ESUT reportedly searches 14 external OA sources.

Verify the current number from code.

Do not repeat "14" if code now differs.

---

18. OPAC

---

Compare:

patron account
renewals
holds
lists
saved searches
history
suggestions
privacy
ratings/comments where applicable
responsive design

---

19. APIs

---

Compare:

REST coverage
authentication
OpenAPI documentation
webhooks
integration surface

---

20. MULTILINGUAL

---

Compare:

number/depth of translated interfaces
metadata multilingualism
localization architecture

Koha has long-standing translation infrastructure.

Do not declare parity simply because ESUT has i18n files.

---

21. ACCESSIBILITY

---

Compare current accessibility capabilities and known compliance work.

---

22. PLUGIN / EXTENSION ECOSYSTEM

---

Compare:

plugin architecture
community plugins
custom integrations
upgrade stability

This is likely still a Koha strength.

---

23. COMMUNITY / MATURITY

---

Compare objectively:

age
number of deployments
community contributors
documentation maturity
vendor ecosystem
real-world integrations
upgrade history

ESUT should probably not be called ahead here.

---

24. AI

---

Compare:

AI librarian
tool calling
catalogue-aware AI
repository-aware AI
research support

If Koha lacks equivalent native functionality, mark ESUT ahead, but verify current Koha ecosystem before claiming this.

---

25. INTEGRATED IR / CRIS

---

Determine whether native repository + CRIS functionality gives ESUT a meaningful architectural advantage over Koha.

==================================================
SECTION B — DSPACE COMPARISON
==================================================

Now repeat with DSpace, but focus on repository/research functionality.

---

1. REPOSITORY OBJECT MODEL

---

Compare:

community
collection
item
file/bitstream
metadata
relationships

---

2. OAI-PMH

---

Compare:

protocol implementation
metadata formats
sets
deletions
resumption tokens
crosswalks
validator results

---

3. PERSISTENT IDENTIFIERS

---

Compare:

Handle
DOI
local persistent identifiers
DataCite workflows
identifier lifecycle

Differentiate installed adapters from credentials/production operation.

---

4. VERSIONING

---

Compare:

object versions
history
citation persistence
relationship between versions

---

5. FILE-LEVEL ACCESS

---

Compare:

public
restricted
group
embargo
bitstream/file-level permissions

---

6. WORKFLOW

---

Compare:

submission
review
multiple reviewers
collection-specific workflows
roles
supervision
return-for-correction
approval history

ESUT's thesis supervision chain may be a differentiator.

Verify.

---

7. PRESERVATION

---

Compare:

checksums
fixity
scheduled verification
preservation events
AIPs
backup
restore
format metadata
bitstream integrity

Determine whether ESUT actually exceeds DSpace in any operational preservation functionality or merely implements equivalent pieces.

---

8. FULL-TEXT INDEXING

---

Compare:

PDF extraction
OCR if available
DOCX
metadata
facets
search engine
permission-aware indexing

---

9. DISCOVERY

---

Compare:

repository discovery
facets
full text
external discovery
federated OA sources

ESUT may be ahead in cross-source discovery.

Verify.

---

10. ITEM USAGE STATISTICS

---

Compare:

views
downloads
file downloads
bots
date filters
COUNTER model

---

11. COUNTER / SUSHI

---

Strictly distinguish:

architecture-ready
implemented
validated compliance

---

12. SWORD

---

Verify exact version implemented.

Compare to current DSpace support.

Test actual endpoints.

---

13. RESOURCE SYNC

---

Compare capabilities.

---

14. SIGNPOSTING

---

Compare:

cite-as
describedby
item
author
license
type

---

15. COAR NOTIFY

---

Compare current implementation and DSpace support/ecosystem.

---

16. ORCID

---

Compare:

identifier field
OAuth
verified connection
metadata import
record synchronization
authorization

---

17. ROR / AUTHORITIES

---

Compare researcher and institutional authority functionality.

---

18. CRIS / RESEARCH ENTITIES

---

This needs special attention.

Compare:

researchers
publications
projects
grants
organizations
departments
datasets
supervision
relationships

Check modern DSpace 10 entity capabilities and any incorporated DSpace-CRIS functionality before making claims.

---

19. METADATA

---

Compare:

Dublin Core
qualified DC
DataCite
MODS
custom schemas
metadata registry
crosswalks
multilingual metadata

---

20. IMPORT/EXPORT

---

Compare:

CSV
metadata export
SWORD
AIP
METS or other archival structures
bulk import
batch editing

---

21. WITHDRAWAL/TOMBSTONES

---

Compare.

---

22. EMBARGO

---

Compare item/file embargo workflows.

---

23. RIGHTS/LICENSES

---

Compare:

Creative Commons
rights statements
deposit agreements
reuse rights

---

24. SEO/SCHOLARLY DISCOVERY

---

Compare:

Google Scholar support
citation metadata
schema.org
sitemaps
canonical URLs
Signposting

---

25. MULTILINGUAL

---

Remember that DSpace has mature multilingual support.

Do not treat ESUT's recent architecture alone as equal to a mature translation ecosystem.

---

26. ACCESSIBILITY

---

Compare current implementations.

---

27. REST/API

---

Compare:

API breadth
HAL/HATEOAS if relevant
documentation
authentication
integration maturity

---

28. PLUGINS/COMMUNITY/ECOSYSTEM

---

Compare maturity.

---

29. AI

---

Compare:

native conversational research assistant
tool use
catalogue interactions
repository search
research discovery

This may be an ESUT differentiator.

---

30. ILS CAPABILITIES

---

Compare all functionality DSpace normally does NOT aim to provide:

circulation
holds
reserves
patrons
ILL
acquisitions
serials
SIP2
POS

This is important because ESUT combines repository functionality with library operations.

==================================================
SECTION C — FEATURES BEYOND BOTH
==================================================

After separate comparisons, investigate capabilities where ESUT's architecture may genuinely be unusual.

Examples to investigate, NOT assume:

AI librarian with many callable tools

combined:
ILS + IR + CRIS

federated OA discovery

thesis-supervision workflow

QR digital library card

student-facing engagement pages

blog
events
forum
CMS
wellbeing resources

one unified identity layer

one deployment

unified analytics

researcher entities + catalogue + circulation

automated worker agents

Backblaze B2 integration

cross-module notifications

domain events/webhooks

Ask:

Is this actually one integrated workflow?

Or just several unrelated features in the same repository?

Only call integration an advantage if data and workflows genuinely connect.

==================================================
SECTION D — CHECK FOR NEW GAPS
==================================================

Do not limit investigation to my old gap list.

Look for important capabilities in CURRENT Koha or DSpace that we have overlooked.

Specifically investigate whether we are missing or weak in areas such as:

KOHA:

- ERM depth
- course reserves
- bookings
- rotating collections
- inventory/stocktaking
- label/barcode generation
- patron clubs
- patron card creator
- staged MARC imports
- advanced MARC modification templates
- batch record modification
- batch item modification
- item transfer workflows
- stock rotation
- recall functionality
- curbside pickup if still applicable
- advanced ILL backends
- preservation module
- authentication providers
- SAML/OIDC/CAS/LDAP
- REST API coverage
- plugins
- self-registration
- holds policies
- advanced fines/fees
- cash register management

DSpace:

- entities/relationships
- configurable entities
- authority framework
- ORCID synchronization
- Google Scholar optimization
- metadata quality workflows
- batch metadata editing
- browse indexes
- Solr discovery depth
- statistics architecture
- authentication providers
- submission forms
- controlled vocabularies
- duplicate detection
- identifiers
- IIIF
- REST API breadth
- configurable submission
- groups/EPeople model
- integrations
- export formats
- preservation integrations

Also identify relevant functionality NEITHER platform handles especially well that ESUT could build strategically.

==================================================
SECTION E — STANDARDS CONFORMANCE
==================================================

Read:

`docs/standards-conformance.md`

But independently validate where feasible:

OAI-PMH
SRU
Z39.50
MARC21
SIP2
SWORD
ResourceSync
Signposting
COAR Notify
OpenURL
KBART
COUNTER/SUSHI
ORCID
ROR
DataCite

For each report:

IMPLEMENTED
INTEROPERABILITY TESTED
PRODUCTION VERIFIED
EXTERNAL CREDENTIALS REQUIRED
PARTIAL
FAILED

This table is important.

==================================================
SECTION F — TEST PRODUCTION REALITY
==================================================

Determine whether each feature is:

LEVEL 0 — UI/demo only

LEVEL 1 — code implemented

LEVEL 2 — automated tests pass

LEVEL 3 — running locally/staging

LEVEL 4 — deployed production endpoint

LEVEL 5 — interoperated successfully with an independent external implementation

Use this particularly for:

Z39.50
SRU
SIP2
EDI
OAI-PMH
SWORD
ResourceSync
COAR Notify
ORCID
DOI/DataCite
COUNTER/SUSHI

This prevents us from confusing "implemented" with "proven."

==================================================
SECTION G — ARCHITECTURAL QUALITY
==================================================

Compare architecture, not only features.

Evaluate ESUT on:

modularity
maintainability
schema quality
migration safety
event-driven design
queue architecture
failure recovery
idempotency
observability
configuration management
security
RBAC
RLS
storage abstraction
search abstraction
provider adapters
testing
API design
documentation

Identify architectural debt introduced during the rapid Wave 0–6 implementation.

Specifically search for:

duplicated logic
massive service files
unsafe casts
TODO
FIXME
suppressed TypeScript errors
eslint disables
disabled tests
skipped tests
hard-coded URLs
hard-coded credentials
mock production adapters
dead routes
duplicate migrations
N+1 queries
unindexed foreign keys
unbounded queries
catch blocks swallowing errors
console logs
temporary fallbacks
feature flags permanently bypassed

==================================================
SECTION H — INVESTIGATE THE TSC CLAIM
==================================================

The progress report says:

"TSC=64 (0 new)"

Explain exactly what this means.

If this means 64 pre-existing TypeScript errors remain, do NOT present the application as clean.

Identify all remaining TypeScript errors and classify:

legacy
new
critical
non-critical

Target should ultimately be:

TSC = 0 total errors

unless there is a documented technical reason.

Similarly investigate:

lint warnings/errors
test skips
test TODOs
build warnings
security audit warnings

==================================================
SECTION I — DATABASE QUALITY
==================================================

Inspect database after all Waves.

Check:

foreign keys
indexes
unique constraints
cascade behavior
soft deletes
RLS
audit coverage
duplicate columns
legacy tables
orphan records
migration consistency

Run query-plan analysis on major workflows where appropriate.

Look especially at:

search
analytics
circulation
repository
OAI
reports
usage statistics
full-text indexing

==================================================
SECTION J — SCALE TEST
==================================================

Do not only report that performance tests pass.

Estimate/test behavior at realistic university scale.

Test or model:

100k catalogue records
500k catalogue records
1m catalogue records

10k repository items
100k repository items
500k repository items

10k patrons
50k patrons
100k patrons

millions of analytics events

Report:

p50
p95
p99

where meaningful.

Test:

search
catalogue page
repository page
checkout
analytics
OAI harvesting
SRU
report generation

Do not invent scale results if fixtures cannot simulate them.

==================================================
SECTION K — SECURITY REVIEW
==================================================

After the huge implementation campaign, perform another security review.

Check especially:

report writer SQL safety
SIP2 exposure
OAI data leakage
ResourceSync access
file downloads
embargo
RLS
signed URLs
COAR Notify
webhooks
SWORD deposits
ORCID OAuth
identifier APIs
EDI uploads
offline circulation sync
admin APIs

Confirm restricted repository full text cannot leak through:

search snippets
OAI
ResourceSync
AIP download
analytics
Signposting
SWORD

==================================================
FINAL OUTPUT 1
KOHA MATRIX
==================================================

Create:

`docs/current-koha-comparison.md`

Use columns:

Capability
ESUT
Koha
ESUT status
Evidence
Maturity difference
Remaining gap
Recommended action

Use:

AHEAD
PARITY
BEHIND
PARTIAL
UNVERIFIED

==================================================
FINAL OUTPUT 2
DSPACE MATRIX
==================================================

Create:

`docs/current-dspace-comparison.md`

Same format.

==================================================
FINAL OUTPUT 3
EXECUTIVE SUMMARY
==================================================

Create:

`docs/competitive-position-2026.md`

I want the summary structured exactly as follows:

# ESUT Library Competitive Position

## Versions Compared

Koha:
DSpace:
ESUT commit:

## Where ESUT Is Clearly Ahead of Koha

Only include substantiated differences.

## Where ESUT Is at Parity with Koha

## Where ESUT Is Still Behind Koha

## Where ESUT Is Clearly Ahead of DSpace

## Where ESUT Is at Parity with DSpace

## Where ESUT Is Still Behind DSpace

## Where ESUT Combines Capabilities Neither Platform Provides Together

## Features That Exist But Still Lack Real-World Validation

## Newly Discovered Gaps

## Technical Debt Created During Waves 0–6

## Most Important Next Engineering Priorities

==================================================
FINAL OUTPUT 4
TOP REMAINING GAPS
==================================================

Create a prioritized engineering backlog.

Use:

P0 — critical correctness/security/interoperability issue

P1 — important competitive/maturity gap

P2 — valuable enhancement

P3 — optional/niche enhancement

For each include:

feature
competitor
current ESUT state
exact missing capability
reason
estimated architecture impact
dependencies
recommended implementation

Do NOT prioritize simply because Koha or DSpace has the feature.

Prioritize according to ESUT's university-library requirements.

==================================================
FINAL OUTPUT 5
PRODUCTION MATURITY MATRIX
==================================================

Create:

`docs/production-maturity-matrix.md`

Columns:

Feature
Implemented
Tests
Deployed
External interoperability tested
Production usage
Status

Examples:

OAI-PMH
Z39.50
SRU
SIP2
EDI
SWORD
ResourceSync
COAR Notify
DOI
ORCID
COUNTER/SUSHI

This report should make it impossible to confuse implementation with operational maturity.

==================================================
CRITICAL HONESTY RULES
==================================================

Do NOT tell me what you think I want to hear.

If Koha is still better in acquisitions, say so.

If DSpace is still stronger in repository maturity, say so.

If our implementation is genuinely deeper, prove it.

If we have code but no real-world interoperability, explicitly say:

"Implemented but not yet production-proven."

If a feature cannot be verified, use:

UNVERIFIED.

Do not convert unknowns into AHEAD/PARITY.

Do not award ESUT an advantage merely because its UI looks more modern.

Do not penalize Koha or DSpace for intentionally having different product scope.

For example:

DSpace lacking circulation does not mean DSpace is "bad."

Instead say ESUT provides an integrated ILS capability outside DSpace's normal repository scope.

Likewise, Koha lacking an institutional repository does not mean Koha has failed at being an ILS.

==================================================
NO SINGLE OVERALL SCORE
==================================================

DO NOT produce:

ESUT 95/100
Koha 80/100
DSpace 82/100

DO NOT rank the three platforms as first/second/third.

Their scope differs too significantly.

Instead compare functional domains.

==================================================
VERY IMPORTANT: VERIFY "ALL WAVES COMPLETE"
==================================================

Finally, audit the statement:

"All Waves Complete"

against the original implementation specification.

For every Wave item determine:

COMPLETE
PARTIAL
CODE COMPLETE BUT EXTERNALLY UNVERIFIED
NOT ACTUALLY COMPLETE
REGRESSED

If anything was marked Done prematurely, correct:

`docs/implementation-progress.md`

Do not preserve an inaccurate Done status merely because previous work declared it complete.

==================================================
RUN EVERYTHING
==================================================

Before finalizing:

run full test suite
run TypeScript checking
run lint
run production build
run database/migration checks
run security checks available in repository
run interoperability tests
inspect Docker/container health

Report exact results.

Do not say "tests passed" without giving:

number passed
number failed
number skipped

where the test runner exposes these values.

Do the same with TypeScript:

total errors

not:

"0 new errors."

==================================================
FINAL RESPONSE TO ME
==================================================

After completing the audit, give me a concise response containing:

1. Koha version compared.
2. DSpace version compared.
3. ESUT commit/version compared.
4. Five strongest ESUT advantages over Koha.
5. Five strongest remaining Koha advantages.
6. Five strongest ESUT advantages over DSpace.
7. Five strongest remaining DSpace advantages.
8. Features currently at true parity.
9. Features implemented but not externally proven.
10. Newly discovered gaps.
11. Exact total TypeScript errors.
12. Exact test results.
13. Highest-priority next engineering work.
14. Links/paths to all comparison documents you created.

Do the investigation now.

Do not rely on the old audit.

Prove every important claim from current code and current official competitor documentation.
