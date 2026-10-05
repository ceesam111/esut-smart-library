# SIP2 Wire-Format Reference — 3M Standard Interchange Protocol Version 2.00

**Source:** plain-text extraction `3m-sip2.txt` (3M Standard Interchange Protocol Version 2.00, Document Revision 2.12, April 11, 2006, doc 78-8129-2375-9 Rev A).
All `L####` citations refer to line numbers in that file. This file is the implementation source; the spec text itself contains **no sampled wire lines** — the `<...>` layout templates quoted below are the only "example lines" that exist in the document.

---

## 0. Notation

- **Row order = required wire order** for fixed (no-ID) fields. Fields that carry a field ID may appear in **any order after the fixed block** (L2246–2247).
- **ID `(none)`** = fixed-length field with **no** field identifier (and therefore no delimiter).
- **Req/Opt** is shown at the start of the **Format** column (`REQ` / `OPT`).
- **Len** for variable-length fields = `0..255` data characters (L2289).
- **Terminator:** every ID'd field ends with `|` (0x7C) — **including fixed-length ID'd fields** (L2308–2310) — **except `AY` and `AZ`**, which never use the delimiter (L2371–2372).

---

## 1. Framing rules

| Rule | Spec statement | Cite |
|---|---|---|
| Packet layout | "The message packet begins with a command identifier. The command identifier is followed by fixed-length fields **without** field identifiers, and then by fixed- and variable-length fields **with** field identifiers. The message ends with a carriage return." | L2238–2242 |
| Command ID | 2 ASCII characters (two digits, e.g. `99`, `12`) | L2249 |
| Fixed-field order | "Fixed-length fields must appear in the order given in the specification for each message." | L2244 |
| ID'd-field order | "Fields with field identifiers may be sent in **any order** following the fixed-length fields. For some fields in some messages, multiple fields of the same type may be included in a single message." | L2246–2247 |
| Message terminator (CR) | "All messages must end in a carriage return (hexadecimal `0d`). This character is interpreted as the last character in a message and **cannot be used elsewhere** as a character in a message." | L2278–2280 |
| Nulls | "Null codes (hexadecimal `00`) **cannot appear anywhere** in a message." | L2282–2283 |
| Fixed fields | "Fixed-length required fields must contain specific information and cannot be left blank." | L2286 |
| Variable fields | `field = <2 field-id chars><0..255 chars><delimiter 0x7C>`; "The pipe is a delimiter so it cannot appear anywhere except as the last character of the field." | L2288–2295 |
| Unused optional/variable fields | "When variable-length or optional fields from the ACS are not used, they should be **left out entirely**." | L2297 |
| ID'd fields always delimited | "any field assigned a field identifier, whether fixed or variable in length, must end with a delimiter character." | L2308–2310 |
| Character set | ASCII; "The default character set will be English 850 ... If another character set is required, the SC and the ACS must mutually define the character set." | L2249–2254 |
| Printable output | "Only displayable characters (no control characters) should be included in print or display messages from the ACS." | L2314–2315 |
| Session | "This protocol does not define how a communications session between the SC and ACS is established." | L2317–2320 |

### 1.1 Sequence number `AY` position

- When error detection is enabled, "a sequence number field, followed by a checksum field, is appended to every message."
- "the sequence number field should always be the **second-to-last** field, the checksum field should be the **last** field, and they should be followed by a carriage return ... as the last character in the message." Wire tail: `...AY<n><AZ><xxxx>CR` (L2326–2330).
- `AY` = 1-char fixed-length field, single ASCII digit `'0'`–`'9'`; **no delimiter** (L2364, L2371–2372, L3758–3763).
- `AY` = "sequence number for the message, used for error detection and synchronization when error detection is enabled." (L3762–3763)

### 1.2 Checksum `AZ` position and definition

- `AZ` = "4-char, fixed-length message checksum, used for checksumming messages when error detection is enabled." (L2551–2556) — **no delimiter** (L2371–2372).

### 1.3 Protocol version field — request vs response — **no field ID exists**

> **Correction:** in this spec `AO` = **institution id** (L4129–4130) and `AP` = **current location** (L4131–4132). The protocol-version field has **no field identifier at all**; it is a plain fixed-length field inside messages `99` and `98` (consistent with the ID-assignment rule at L2305–2306: required fixed fields that are not general-purpose get no ID).

| Direction | Message | Position in message | Spec text |
|---|---|---|---|
| SC to ACS (request) | `99` SC Status | 3rd / last fixed field | `99<status code><max print width><protocol version>` — "4-char, fixed-length required field: x.xx" (L401, L412) |
| ACS to SC (response) | `98` ACS Status | 10th fixed field (after date/time sync, before institution id) | `98<...><date / time sync><protocol version><institution id>...` — "4-char, fixed-length required field: x.xx" (L1270–1273, L1300) |

Field definition: "protocol version — 4-char, fixed-length field: x.xx. The protocol version field contains the version number of the protocol that the software is currently using. The format ... should be expressed as a **single numeral followed by a period then followed by two more numerals**." (L3609–3611)

### 1.4 Message-length field — **does not exist**

There is **no message-length field in this protocol**, and `AL` is **not** a length field: `AL = blocked card msg` (L2504–2508, L4123–4124; used only by `01` Block Patron). Framing is done purely by the CR terminator plus the fixed/variable field structure.

### 1.5 When `AY` / `AZ` are required

| Condition | Requirement | Cite |
|---|---|---|
| Error detection **disabled** (default) | Neither `AY` nor `AZ` is sent. The protocol "allows extra error detection to be **enabled**". | L2324–2327 |
| Error detection **enabled** | "a sequence number field, followed by a checksum field, is appended to **every** message"; `AY` second-to-last, `AZ` last, then CR. | L2325–2330 |
| `97` Request ACS Resend (SC to ACS) | "should **never** include a 'sequence number' field, even when error detection is enabled ... but **would include** a 'checksum' field since checksums are in use." Wire form: `97` + `AZxxxx` + CR. | L414–421 |
| `96` Request SC Resend (ACS to SC) | Same rule as `97`. | L1406–1413 |

---

## 2. Checksum algorithm and sequence-number rules

### 2.1 Checksum (`AZ`) — exact steps (L2355–2362)

1. Scope: "four ASCII character digits representing the binary sum of the characters **including the first character of the transmission and up to and including the checksum field identifier characters**" — sum bytes of every character from the command ID through the `A` and `Z` of `AZ`. The 4 hex digits themselves are **not** in the sum. (L2355–2356)
2. "add each character as an **unsigned binary number**" (byte values). (L2358)
3. "take the **lower 16 bits** of the total". (L2358)
4. "perform a **2's complement**" on that 16-bit value: `checksum = (-(sum & 0xFFFF)) & 0xFFFF`. (L2358–2359)
5. "The checksum field is the result represented by **four hex digits**." (L2359) — 4 ASCII characters, fixed length, field ID `AZ`, no delimiter.
6. Verification: "To verify the correct checksum on received data, simply **add all the hex values including the checksum. It should equal zero.**" (L2361–2362)

**Spec-silent details (implementation must choose — see Appendix C):** letter case of the 4 hex digits; special handling when the computed checksum is `0000` (never mentioned).

### 2.2 Sequence number (`AY`) rules (L2364–2369)

- "The sequence number is a single ASCII digit, `'0'` to `'9'`." (L2364)
- "the **SC will increment** the sequence number field for each **new** message it transmits." (L2364–2365)
- "The **ACS should verify** that the sequence numbers increment as new messages are received from the 3M SelfCheck system." (L2365–2366)
- "the ACS response to a message should include a sequence number field also, where the sequence number field's value **matches** the sequence number value from the message being responded to." (L2367–2369) — the ACS does **not** increment; it echoes.
- Neither `AY` nor `AZ` uses the delimiter; both are fixed length. (L2371–2372)

### 2.3 Retry / resend behavior

**SC side (L2374–2394):**

| Event | Action | Cite |
|---|---|---|
| No response before timer expires | Re-transmit the message until max retries | L2375–2378 |
| Response has bad checksum | Send `97` Request ACS Resend; on further errors re-transmit `97` until max retries | L2380–2382 |
| ACS returns `96` Request SC Resend | Re-transmit the original message, provided max retries not exceeded **and** the last message sent was not itself a `97` | L2384–2386 |
| Max retries exhausted, **or** `96` received in response to a `97` | "conclude that communications with the ACS have failed" | L2388–2390 |
| Response checksum valid but `AY` mismatch | "discard the response and wait for another, valid response" (likely timeout) | L2392–2394 |

**ACS side (L2396–2406):**

| Event | Action | Cite |
|---|---|---|
| Received message has checksum error | Respond with `96` Request SC Resend | L2396–2398 |
| ACS sent a response, then receives `97` | "the previous response should be **retransmitted**, even if it was itself a `96`". If no response had been transmitted, send `96`. | L2400–2403 |
| Received message's **checksum and sequence number match the previous message** received from SC (duplicate) | "the ACS should **re-send its last response**" | L2405–2406 |

---
## 3. `99` SC Status request to `98` ACS Status response

### 3.1 `99` SC Status (L395–412)

> Verbatim layout: `99<status code><max print width><protocol version>`

"This message will be the first message sent by the SC to the ACS once a connection has been established (**exception: the Login Message may be sent first** to login to an ACS server program)." (L396–398)

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `99` | 2 | fixed | SC Status request |
| status code | (none) | 1 | REQ fixed 1-char: `0`/`1`/`2` | SC unit status: `0`=SC unit is OK, `1`=SC printer is out of paper, `2`=SC is about to shut down (L3787–3798) |
| max print width | (none) | 3 | REQ fixed 3-char | Max number of characters the SC printer can print in one line (L3343–3345) |
| protocol version | (none) | 4 | REQ fixed 4-char: `x.xx` (e.g. `2.00`) | Version of the protocol the SC software is currently using (L3609–3611) |

**Variable fields:** none defined in the spec for `99`.

### 3.2 `98` ACS Status response (L1264–1404)

> Verbatim layout:
> `98<on-line status><checkin ok><checkout ok><ACS renewal policy><status update ok><off-line ok><timeout period><retries allowed><date / time sync><protocol version><institution id><library name><supported messages ><terminal location><screen message><print line>`

"The ACS must send this message in response to a SC Status message. This message will be the first message sent by the ACS to the SC ... (exception: the Login Response Message may be sent first to complete login of the SC)." (L1265–1268)

**Fixed block (no field IDs, exact order):**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `98` | 2 | fixed | ACS Status response |
| on-line status | (none) | 1 | REQ fixed 1-char: `Y`/`N` | Whether the system is on/off-line; ACS can notify SC it is going off-line for maintenance (L3392–3394) |
| checkin ok | (none) | 1 | REQ fixed 1-char: `Y`/`N` | `Y` = SC is allowed to check in items (L2547) |
| checkout ok | (none) | 1 | REQ fixed 1-char: `Y`/`N` | `Y` = SC is allowed to check out items (L2549) |
| ACS renewal policy | (none) | 1 | REQ fixed 1-char: `Y`/`N` | `Y` = SC allowed by ACS to process patron renewals as a policy; called "renewal ok" in v1.00 (L2488–2490) |
| status update ok | (none) | 1 | REQ fixed 1-char: `Y`/`N` | ACS policy; `Y` = patron status updating by SC allowed (e.g. card can be blocked) (L3802–3803) |
| off-line ok | (none) | 1 | REQ fixed 1-char: `Y`/`N` | `Y` = ACS supports the SC off-line (store-and-forward) feature (L3383–3385) |
| timeout period | (none) | 3 | REQ fixed 3-char | Tenths of a second until a transaction is aborted; `000` = ACS is not on-line; `999` = time-out unknown (L3961–3963) |
| retries allowed | (none) | 3 | REQ fixed 3-char | Number of retries allowed for a transaction; `999` = retry number unknown (L3720–3721) |
| date / time sync | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Clock synchronization value; `000000000000000000` indicates an unsupported function; local time preferred (L2718–2721) |
| protocol version | (none) | 4 | REQ fixed 4-char: `x.xx` (e.g. `2.00`) | ACS protocol version in use (L3609–3611) |

**ID'd fields (any order after the fixed block):**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| institution id | `AO` | 0..255 | REQ var | The library's institution ID (L3108) |
| library name | `AM` | 0..255 | OPT var | The library's name (L3183) |
| supported messages | `BX` | 0..255 (16 chars used) | REQ var | Which message/response pairs the ACS supports; `Y`=supported, `N`=not supported — see section 20 for exact position order (L3903–3938) |
| terminal location | `AN` | 0..255 | OPT var | "The ACS could put the SC's location in this field." (L3944) |
| screen message | `AF` | 0..255 (repeatable) | OPT var | Text displayed on the SC screen; never required; multiple instances display on consecutive lines (L3730–3734) |
| print line | `AG` | 0..255 (repeatable) | OPT var | Text printed on the SC printer; never required; multiple instances print on consecutive lines (L3604–3607) |

---

## 4. `93` Login request to `94` Login Response

### 4.1 `93` Login (L425–456) — 2.00-new

> Verbatim layout: `93<UID algorithm><PWD algorithm><login user id><login password><location code>`

"This message can be used to login to an ACS server program ... **When this message is used, it will be the first message sent to the ACS.** Whether to use this message or to use some other mechanism to login ... is configurable on the SC." (L427–429)

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `93` | 2 | fixed | Login |
| UID algorithm | (none) | 1 | REQ fixed 1-char | Algorithm used to encrypt the login user id; `'0'` = not encrypted; SC and ACS must agree on value (L4035–4038) |
| PWD algorithm | (none) | 1 | REQ fixed 1-char | Algorithm used to encrypt the login password; `'0'` = not encrypted (L3613–3616) |
| login user id | `CN` | 0..255 | REQ var | User id for the SC to log in with; may be encrypted (L3189–3190) |
| login password | `CO` | 0..255 | REQ var | Password for the SC to log in with; may be encrypted (L3187–3188) |
| location code | `CP` | 0..255 | OPT var | "the location code of the SC unit. This code will be configurable on the SC." (L3185) |

### 4.2 `94` Login Response (L1417–1431) — 2.00-new

> Verbatim layout: `94<ok>`

"The ACS should send this message in response to the Login message. When this message is used, it will be the first message sent to the SC." (L1419–1420)

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `94` | 2 | fixed | Login Response |
| ok | (none) | 1 | REQ fixed 1-char: `0`/`1` | `1` = login accepted, `0` = not accepted (general `ok` definition L3387–3390) |

**Variable fields:** none.

---

## 5. `01` Block Patron request to `24` Patron Status Response

### 5.1 `01` Block Patron (L364–393)

> Verbatim layout: `01<card retained><transaction date><institution id><blocked card msg><patron identifier><terminal password>`

"This message requests that the patron card be blocked by the ACS ... **The ACS should invalidate the patron's card and respond with a Patron Status Response message.**" (L365–368)

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `01` | 2 | fixed | Block Patron |
| card retained | (none) | 1 | REQ fixed 1-char: `Y`/`N` | Notifies ACS the patron's card has been retained by the SC (L2518–2522) |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time of the event (L3971–3979) |
| institution id | `AO` | 0..255 | REQ var | Library institution ID (L3108) |
| blocked card msg | `AL` | 0..255 | REQ var | "This field indicates the reason the patron card was blocked." (L2504–2508) |
| patron identifier | `AA` | 0..255 | REQ var | Identifying value for the patron (L3433) |
| terminal password | `AC` | 0..255 | REQ var | Password for the SC unit; zero-length if unused but required (L3950–3952) |

### 5.2 Response is `24` Patron Status Response

- `24`'s own preamble: "The ACS **must** send this message in response to a Patron Status Request message **as well as in response to a Block Patron message**." (L975–976)
- There is **no separate error message** for `01`; the spec's response is `24` — full field list in section 6.2.

---

## 6. `23` Patron Status request to `24` Patron Status Response

### 6.1 `23` Patron Status Request (L189–215)

> Verbatim layout: `23<language><transaction date><institution id><patron identifier><terminal password><patron password>`

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `23` | 2 | fixed | Patron Status Request |
| language | (none) | 3 | REQ fixed 3-char | Language for screen/print formatting; `000` = not specified (L3120–3122) — see section 21 |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time of request (L3971–3979) |
| institution id | `AO` | 0..255 | REQ var | Library institution ID (L3108) |
| patron identifier | `AA` | 0..255 | REQ var | Identifying value for the patron (L3433) |
| terminal password | `AC` | 0..255 | REQ var | SC unit password (L3950–3952) |
| patron password | `AD` | 0..255 | REQ var | Patron PIN; send zero-length if feature unused (L3435–3438) |

### 6.2 `24` Patron Status Response (L974–1017)

> Verbatim layout:
> `24<patron status><language><transaction date><institution id><patron identifier><personal name><valid patron><valid patron password><currency type><fee amount><screen message><print line>`

**Fixed block:**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `24` | 2 | fixed | Patron Status Response |
| patron status | (none) | 14 | REQ fixed 14-char | NISO Z39.70-199x flag field: `Y` in a position = condition true, blank (`0x20`) = not true — position table in Appendix B.1 (L3440–3443, L3508–3540) |
| language | (none) | 3 | REQ fixed 3-char | Language code (L3120–3122) |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time of response (L3971–3979) |

**ID'd fields:**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| institution id | `AO` | 0..255 | REQ var | Library institution ID (L3108) |
| patron identifier | `AA` | 0..255 | REQ var | Patron id (L3433) |
| personal name | `AE` | 0..255 | REQ var | The patron's name (L3600) |
| valid patron | `BL` | 1 | OPT fixed 1-char: `Y`/`N` | `Y` = bar-code valid and on database; `N` = not a valid patron (L4065–4066) |
| valid patron password | `CQ` | 1 | OPT fixed 1-char: `Y`/`N` | `Y` = patron password valid; `N` = not valid (L4070–4071) |
| currency type | `BH` | 3 | OPT fixed 3-char | ISO 4217:1995 alphabetic code (e.g. `USD`) (L2668–2693) |
| fee amount | `BV` | 0..255 | OPT var | "The amount of fees owed by this patron." (L1013) |
| screen message | `AF` | 0..255 (repeatable) | OPT var | Screen text (L3730–3734) |
| print line | `AG` | 0..255 (repeatable) | OPT var | Printer text (L3604–3607) |

---
## 7. `63` Patron Information request to `64` Patron Information Response

### 7.1 `63` Patron Information (L493–537) — 2.00-new

> Verbatim layout: `63<language><transaction date><summary><institution id><patron identifier><terminal password><patron password><start item><end item>`

"This message is a superset of the Patron Status Request message." (L495)

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `63` | 2 | fixed | Patron Information |
| language | (none) | 3 | REQ fixed 3-char | Language code (L3120–3122) |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time of request (L3971–3979) |
| summary | (none) | 10 | REQ fixed 10-char | Request partial info; `Y` in a position = send detailed **and** summary info for that category, blank (`0x20`) = summary only. Positions 0–5: `0`=hold items, `1`=overdue items, `2`=charged items, `3`=fine items, `4`=recall items, `5`=unavailable holds. "Only one category ... at a time" — 6 messages to get all detail; all 6 responses contain summary info. (L3881–3901) |
| institution id | `AO` | 0..255 | REQ var | Library institution ID (L3108) |
| patron identifier | `AA` | 0..255 | REQ var | Patron id (L3433) |
| terminal password | `AC` | 0..255 | OPT var | SC unit password (L3950–3952) |
| patron password | `AD` | 0..255 | OPT var | Patron PIN (L3435–3438) |
| start item | `BP` | 0..255 | OPT var | Number of the **first** item to return in the requested list; 1-based (L3778–3785) |
| end item | `BQ` | 0..255 | OPT var | Number of the **last** item to return in the requested list; 1-based (L2735–2743) |

### 7.2 `64` Patron Information Response (L1433–1622) — 2.00-new

> Verbatim layout:
> `64<patron status><language><transaction date><hold items count><overdue items count><charged items count><fine items count><recall items count><unavailable holds count><institution id><patron identifier><personal name><hold items limit><overdue items limit><charged items limit><valid patron><valid patron password><currency type><fee amount><fee limit><items><home address><e-mail address><home phone number><screen message><print line>`

**Fixed block (9 fields, exact order):**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `64` | 2 | fixed | Patron Information Response |
| patron status | (none) | 14 | REQ fixed 14-char | NISO flag field (Appendix B.1) (L3440–3443) |
| language | (none) | 3 | REQ fixed 3-char | Language code (L3120–3122) |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time (L3971–3979) |
| hold items count | (none) | 4 | REQ fixed 4-char | `0000`–`9999`; if unavailable/unsupported → four blanks (`0x20`) (L2909–2913) |
| overdue items count | (none) | 4 | REQ fixed 4-char | `0000`–`9999` or four blanks (L3402–3406) |
| charged items count | (none) | 4 | REQ fixed 4-char | `0000`–`9999` or four blanks (L2530–2534) |
| fine items count | (none) | 4 | REQ fixed 4-char | `0000`–`9999` or four blanks (L2897–2901) |
| recall items count | (none) | 4 | REQ fixed 4-char | `0000`–`9999` or four blanks (L3624–3626) |
| unavailable holds count | (none) | 4 | REQ fixed 4-char | `0000`–`9999` or four blanks (L4040–4044) |

**ID'd fields (any order after the fixed block):**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| institution id | `AO` | 0..255 | REQ var | Library institution ID (L3108) |
| patron identifier | `AA` | 0..255 | REQ var | Patron id (L3433) |
| personal name | `AE` | 0..255 | REQ var | Patron's name (L3600) |
| hold items limit | `BZ` | 4 | OPT fixed 4-char | Limit number of hold items, `0000`–`9999` (L2915–2920) |
| overdue items limit | `CA` | 4 | OPT fixed 4-char | Limit number of overdue items, `0000`–`9999` (L3408–3413) |
| charged items limit | `CB` | 4 | OPT fixed 4-char | Limit number of charged items, `0000`–`9999` (L2536–2541) |
| valid patron | `BL` | 1 | OPT fixed 1-char: `Y`/`N` | Patron bar-code valid/on database (L4065–4066) |
| valid patron password | `CQ` | 1 | OPT fixed 1-char: `Y`/`N` | Patron password valid (L4070–4071) |
| currency type | `BH` | 3 | OPT fixed 3-char | ISO 4217 code (L2668–2693) |
| fee amount | `BV` | 0..255 | OPT var | Amount of fees owed by this patron (L1495) |
| fee limit | `CC` | 0..255 | OPT var | "The fee limit amount" — money limit the patron may accumulate (L1497, L2863–2866) |

**`<items>` repeating group** — "zero or more instances of **one** of the following, based on 'summary' field of the Patron Information message" (L1516):

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| hold items | `AS` | 0..255 (repeat) | OPT var | "sent for each hold item" (L2903–2907) |
| overdue items | `AT` | 0..255 (repeat) | OPT var | "sent for each overdue item" (L3396–3400) |
| charged items | `AU` | 0..255 (repeat) | OPT var | "sent for each charged item" (L2524–2528) |
| fine items | `AV` | 0..255 (repeat) | OPT var | "sent for each fine item" (L2891–2895) |
| recall items | `BU` | 0..255 (repeat) | OPT var | "sent for each recalled item" (L3588, L3622) |
| unavailable hold items | `CD` | 0..255 (repeat) | OPT var | "sent for each unavailable hold" (L4046–4048) |

**Remaining fields:**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| home address | `BD` | 0..255 | OPT var | The home address of the patron (L3064–3068) |
| e-mail address | `BE` | 0..255 | OPT var | The patron's e-mail address (L2733) |
| home phone number | `BF` | 0..255 | OPT var | The patron's home phone number (L3070–3072) |
| screen message | `AF` | 0..255 (repeatable) | OPT var | Screen text (L3730–3734) |
| print line | `AG` | 0..255 (repeatable) | OPT var | Printer text (L3604–3607) |

---

## 8. `25` Patron Enable to `26` Patron Enable Response

### 8.1 `25` Patron Enable (L741–764) — 2.00-new

> Verbatim layout: `25<transaction date><institution id><patron identifier><terminal password><patron password>`

"used by the SC to re-enable canceled patrons. **It should only be used for system testing and validation.**" (L741–742)

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `25` | 2 | fixed | Patron Enable |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time (L3971–3979) |
| institution id | `AO` | 0..255 | REQ var | Library institution ID (L3108) |
| patron identifier | `AA` | 0..255 | REQ var | Patron id (L3433) |
| terminal password | `AC` | 0..255 | OPT var | SC unit password (L3950–3952) |
| patron password | `AD` | 0..255 | OPT var | Patron PIN (L3435–3438) |

### 8.2 `26` Patron Enable Response (L1887–1929) — 2.00-new

> Verbatim layout: `26<patron status><language><transaction date><institution id><patron identifier><personal name><valid patron><valid patron password><screen message><print line>`

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `26` | 2 | fixed | Patron Enable Response |
| patron status | (none) | 14 | REQ fixed 14-char | NISO flag field (Appendix B.1) |
| language | (none) | 3 | REQ fixed 3-char | Language code |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time |
| institution id | `AO` | 0..255 | REQ var | Library institution ID |
| patron identifier | `AA` | 0..255 | REQ var | Patron id |
| personal name | `AE` | 0..255 | REQ var | Patron's name |
| valid patron | `BL` | 1 | OPT fixed 1-char: `Y`/`N` | Patron bar-code valid/on database (L4065–4066) |
| valid patron password | `CQ` | 1 | OPT fixed 1-char: `Y`/`N` | Patron password valid (L4070–4071) |
| screen message | `AF` | 0..255 (repeatable) | OPT var | Screen text |
| print line | `AG` | 0..255 (repeatable) | OPT var | Printer text |

Note: `26` has **no** currency type / fee amount fields (unlike `24`).

---

## 9. `17` Item Information to `18` Item Information Response

### 9.1 `17` Item Information (L625–645) — 2.00-new

> Verbatim layout: `17<transaction date><institution id>< item identifier ><terminal password>`

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `17` | 2 | fixed | Item Information |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time (L3971–3979) |
| institution id | `AO` | 0..255 | REQ var | Library institution ID (L3108) |
| item identifier | `AB` | 0..255 | REQ var | Article bar-code (L3110–3111) |
| terminal password | `AC` | 0..255 | OPT var | SC unit password (L3950–3952) |

### 9.2 `18` Item Information Response (L1699–1783) — 2.00-new

> Verbatim layout:
> `18<circulation status><hold queue length><security marker><fee type><transaction date><due date><recall date><hold pickup date><item identifier><title identifier><owner><currency type><fee amount><media type><permanent location><current location><item properties><screen message><print line>`
>
> NOTE: the layout line interleaves `<hold queue length>` (an ID'd field, `CF`) between two fixed fields; the **packet-format rule** (L2238–2246) and the field table (L1725–1783) govern: the four fixed fields go first, then all ID'd fields. See Appendix C.

**Fixed block (exact order per field table):**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `18` | 2 | fixed | Item Information Response |
| circulation status | (none) | 2 | REQ fixed 2-char: `00`–`99` | Circulation status of the item (enum, Appendix B.2) (L2558–2590) |
| security marker | (none) | 2 | REQ fixed 2-char: `00`–`99` | Enumerated security marker type (Appendix B.5) (L3743–3756) |
| fee type | (none) | 2 | REQ fixed 2-char: `01`–`99` | Type of fee associated with checking out this item (Appendix B.3) (L1752–1754, L2859–2889) |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time (L3971–3979) |

**ID'd fields (any order after fixed block):**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| hold queue length | `CF` | 0..255 | OPT var | "Number of patrons requesting this item." (L2940–2942) |
| due date | `AH` | 0..255 | OPT var | "This date field is not necessarily formatted with the ANSI standard X3.30 for date and X3.43 for time ... the ACS can send this date field in any format it wishes." (L2729–2731) |
| recall date | `CJ` | 18 | OPT fixed 18-char: `YYYYMMDDZZZZHHMMSS` | "The date that the recall was issued." (L3620) |
| hold pickup date | `CM` | 18 | OPT fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Spec text: "The date that the hold expires." (L2934–2938) |
| item identifier | `AB` | 0..255 | REQ var | Article bar-code (L3110–3111) |
| title identifier | `AJ` | 0..255 | REQ var | "Identifies a title; could be a bibliographic number or a title string." (L3965–3969) |
| owner | `BG` | 0..255 | OPT var | "the name of the institution or library that owns the item." (L3415–3432) |
| currency type | `BH` | 3 | OPT fixed 3-char | ISO 4217 code (L2668–2693) |
| fee amount | `BV` | 0..255 | OPT var | "The amount of the fee associated with this item." (L1771) |
| media type | `CK` | 3 | OPT fixed 3-char | Enumerated media type (Appendix B.6) (L3347–3372) |
| permanent location | `AQ` | 0..255 | OPT var | "The location where an item is normally stored after being checked in." (L3562–3566) |
| current location | `AP` | 0..255 | OPT var | "the current location of the item." (L2695–2700) |
| item properties | `CH` | 0..255 | OPT var | Item attributes (weight, size, security marker, etc.); ACSs encouraged to store (L3113–3115) |
| screen message | `AF` | 0..255 (repeatable) | OPT var | Screen text |
| print line | `AG` | 0..255 (repeatable) | OPT var | Printer text |

---
## 10. `11` Checkout to `12` Checkout Response

### 10.1 `11` Checkout (L217–269)

> Verbatim layout:
> `11<SC renewal policy><no block><transaction date><nb due date><institution id><patron identifier><item identifier><terminal password><patron password><item properties><fee acknowledged><cancel>`

"used by the SC to request to check out an item, and also to cancel a Checkin request that did not successfully complete. **The ACS must respond to this command with a Checkout Response message.**" (L218–220)

**Fixed block:**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `11` | 2 | fixed | Checkout |
| SC renewal policy | (none) | 1 | REQ fixed 1-char: `Y`/`N` | `Y` = SC has been configured by library staff to do renewals; `N` = not. Called "renewals allowed" in v1.00. (L3726–3728) |
| no block | (none) | 1 | REQ fixed 1-char: `Y`/`N` | "notifies the ACS that the article was already checked in or out while the ACS was not on-line. When `Y`, the ACS should not block this transaction because it has already been executed." (L3377–3381) |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | "The date and time that the patron checked out the item at the SC unit." (L231, L253) |
| nb due date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | No-block due date given during off-line (store and forward) operation (L3374–3375) |

**ID'd fields (any order):**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| institution id | `AO` | 0..255 | REQ var | Library institution ID (L3108) |
| patron identifier | `AA` | 0..255 | REQ var | Patron id (L3433) |
| item identifier | `AB` | 0..255 | REQ var | Article bar-code (L3110–3111) |
| terminal password | `AC` | 0..255 | REQ var | SC unit password; zero-length if feature unused (L3950–3952) |
| patron password | `AD` | 0..255 | OPT var | Patron PIN (L3435–3438) |
| item properties | `CH` | 0..255 | OPT var | Item attributes for identification/security (L3113–3115) |
| fee acknowledged | `BO` | 1 | OPT fixed 1-char: `Y`/`N` | `N` + fee exists → ACS must report fee and refuse checkout; re-send with `Y` after patron acknowledges (L2757–2767) |
| cancel | `BI` | 1 | OPT fixed 1-char: `Y`/`N` | `Y` = this Checkout is cancelling a **failed Checkin** (`N` for all other checkouts) (L2510–2516) |

(The spec's field table lists `item properties` before `patron password`; both are ID'd, so order is immaterial — L242–244 vs L222–225.)

### 10.2 `12` Checkout Response (L1024–1192)

> Verbatim layout:
> `12<ok><renewal ok><magnetic media><desensitize><transaction date><institution id><patron identifier><item identifier><title identifier><due date><fee type><security inhibit><currency type><fee amount><media type><item properties><transaction id><screen message><print line>`

"This message **must** be sent by the ACS in response to a Checkout message from the SC." (L1025)

**Fixed block:**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `12` | 2 | fixed | Checkout Response |
| ok | (none) | 1 | REQ fixed 1-char: `0`/`1` | `1` = action allowable and completed successfully; `0` = not allowable / did not complete (L3387–3390) |
| renewal ok | (none) | 1 | REQ fixed 1-char: `Y`/`N` | `Y` = patron already had this item checked out (i.e. it is a renewal); `N` = patron did not already have it (L3628–3631) |
| magnetic media | (none) | 1 | REQ fixed 1-char: `Y`/`N`/`U` | `Y` = article is magnetic media, SC handles security discharge; `N` = not; `U` = ACS does not identify magnetic-media articles (L3192–3194, L3340–3341) |
| desensitize | (none) | 1 | REQ fixed 1-char: `Y`/`N`/`U` | `Y` = SC should desensitize; `N` = should not; `U` (obsolete) = ACS does not know, treated as `N` (L2723–2727) |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time (L3971–3979) |

**ID'd fields (any order):**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| institution id | `AO` | 0..255 | REQ var | Library institution ID (L3108) |
| patron identifier | `AA` | 0..255 | REQ var | Patron id (L3433) |
| item identifier | `AB` | 0..255 | REQ var | Article bar-code (L3110–3111) |
| title identifier | `AJ` | 0..255 | REQ var | Bibliographic number or title string (L3965–3969) |
| due date | `AH` | 0..255 | REQ var | Due date; **variable-length and free-format** — "the ACS can send this date field in any format it wishes" (L2729–2731) |
| fee type | `BT` | 2 | OPT fixed 2-char: `01`–`99` | Type of fee associated with checking out this item (Appendix B.3) (L1060–1062, L2859–2889) |
| security inhibit | `CI` | 1 | OPT fixed 1-char: `Y`/`N` | `Y` notifies the SC to **ignore the security status** of the item (L3736–3741) |
| currency type | `BH` | 3 | OPT fixed 3-char | ISO 4217 code (L2668–2693) |
| fee amount | `BV` | 0..255 | OPT var | "The amount of the fee associated with checking out this item." (L1093–1095) |
| media type | `CK` | 3 | OPT fixed 3-char | Enumerated media type (Appendix B.6) (L3347–3372) |
| item properties | `CH` | 0..255 | OPT var | Item attributes (L3113–3115) |
| transaction id | `BK` | 0..255 | OPT var | "May be assigned by the ACS when checking out the item involves a fee." (L1103–1105); used for auditing cash flow (L3981–3986) |
| screen message | `AF` | 0..255 (repeatable) | OPT var | Screen text (L3730–3734) |
| print line | `AG` | 0..255 (repeatable) | OPT var | Printer text (L3604–3607) |

**Spec's value rules (verbatim, L1174–1192):**

| Field | Rule |
|---|---|
| OK | "should be set to `1` if the ACS checked out the item to the patron." / "should be set to `0` if the ACS did not check out the item to the patron." |
| Renewal OK | "should be set to `Y` if the patron requesting to check out the item already has the item checked out" / "should be set to `N` if the item is not already checked out to the requesting patron." |
| Desensitize | "should be set to `Y` if the SC should desensitize the article." / "should be set to `N` if the SC should not desensitize the article (for example, a closed reserve book, or the checkout was refused)." |
| Fee Amount | "should be set to the value of the fee associated with checking out the item" / "should be set to `0` if there is no fee associated with checking out the item." |
| Magnetic Media | Listed in the heading at L1174; per-field meaning at L3192–3194, L3340–3341. |

**NOT in this spec:** field IDs `XA`–`XJ`, `FF`, `QY`, and any "AE = item identifier" / "AF = title" / "AH = title" mapping. Those tokens do not appear anywhere in the document (verified by full-text search). Do not implement them from this spec.

---

## 11. `09` Checkin to `10` Checkin Response

### 11.1 `09` Checkin (L271–312)

> Verbatim layout: `09<no block><transaction date><return date><current location><institution id><item identifier><terminal password><item properties><cancel>`

"used by the SC to check in an item, and also to cancel a Checkout request that did not successfully complete. **The ACS must respond ... with a Checkin Response message.**" (L272–274)

**Fixed block:**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `09` | 2 | fixed | Checkin |
| no block | (none) | 1 | REQ fixed 1-char: `Y`/`N` | Already checked in/out while ACS off-line; `Y` = do not block (L3377–3381) |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time of check-in at SC (L3971–3979) |
| return date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | "The date that an item was returned to the library, which is not necessarily the same date that the item was checked back in." (L3723–3724) |

**ID'd fields:**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| current location | `AP` | 0..255 | REQ var | Current location of the item; "3M SelfCheck system software could set this field to the value of the 3M SelfCheck system terminal location on a Checkin message." (L2695–2700) |
| institution id | `AO` | 0..255 | REQ var | Library institution ID (L3108) |
| item identifier | `AB` | 0..255 | REQ var | Article bar-code — needed by SC to verify the checked-in article matches (L3110–3111) |
| terminal password | `AC` | 0..255 | REQ var | SC unit password; zero-length if unused (L3950–3952) |
| item properties | `CH` | 0..255 | OPT var | Item attributes (L3113–3115) |
| cancel | `BI` | 1 | OPT fixed 1-char: `Y`/`N` | `Y` = this Checkin is cancelling a **failed Checkout** (L2510–2516) |

### 11.2 `10` Checkin Response (L1194–1262)

> Verbatim layout:
> `10<ok><resensitize><magnetic media><alert><transaction date><institution id><item identifier><permanent location><title identifier><sort bin><patron identifier><media type><item properties><screen message><print line>`

"This message **must** be sent by the ACS in response to a SC Checkin message." (L1195)

**Fixed block:**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `10` | 2 | fixed | Checkin Response |
| ok | (none) | 1 | REQ fixed 1-char: `0`/`1` | `1` = ACS checked in the item; `0` = did not (L1253–1258) |
| resensitize | (none) | 1 | REQ fixed 1-char: `Y`/`N` | `Y` = SC should resensitize; `N` = should not (e.g. closed reserve book, or checkin refused) (L1255–1262, L3715–3718) |
| magnetic media | (none) | 1 | REQ fixed 1-char: `Y`/`N`/`U` | Magnetic-media identification (L3192–3194, L3340–3341) |
| alert | (none) | 1 | REQ fixed 1-char: `Y`/`N` | `Y` generates an audible sound at the SC (items on hold, other branch, etc.); alerts staff to special handling (L2492–2499) |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time (L3971–3979) |

**ID'd fields (spec's own table order):**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| institution id | `AO` | 0..255 | REQ var | Library institution ID (L3108) |
| item identifier | `AB` | 0..255 | REQ var | Article bar-code (L3110–3111) |
| permanent location | `AQ` | 0..255 | REQ var | Where the item is normally stored after check-in (L3562–3566) |
| title identifier | `AJ` | 0..255 | OPT var | Bibliographic number or title string (L3965–3969) |
| sort bin | `CL` | 0..255 | OPT var | Bin number indicating how items should be sorted (L3773–3776) |
| patron identifier | `AA` | 0..255 | OPT var | "ID of the patron who had the item checked out." (L1236) |
| media type | `CK` | 3 | OPT fixed 3-char | Enumerated media type (Appendix B.6) (L3347–3372) |
| item properties | `CH` | 0..255 | OPT var | Item attributes (L3113–3115) |
| screen message | `AF` | 0..255 (repeatable) | OPT var | Screen text |
| print line | `AG` | 0..255 (repeatable) | OPT var | Printer text |

---

## 12. `29` Renew to `30` Renew Response

### 12.1 `29` Renew (L823–920) — 2.00-new

> Verbatim layout:
> `29<third party allowed><no block><transaction date><nb due date><institution id><patron identifier><patron password><item identifier><title identifier><terminal password><item properties><fee acknowledged>`

"Either or both of the 'item identifier' and 'title identifier' fields must be present for the message to be useful." (L825–827)

**Fixed block:**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `29` | 2 | fixed | Renew |
| third party allowed | (none) | 1 | REQ fixed 1-char: `Y`/`N` | `N` → "the ACS should not allow third party renewals" from this terminal (L3956–3960) |
| no block | (none) | 1 | REQ fixed 1-char: `Y`/`N` | Already done while ACS off-line (L3377–3381) |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time (L3971–3979) |
| nb due date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | No-block due date from off-line operation (L3374–3375) |

**ID'd fields:**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| institution id | `AO` | 0..255 | REQ var | Library institution ID |
| patron identifier | `AA` | 0..255 | REQ var | Patron id |
| patron password | `AD` | 0..255 | OPT var | Patron PIN (L3435–3438) |
| item identifier | `AB` | 0..255 | OPT var | Article bar-code (L3110–3111) |
| title identifier | `AJ` | 0..255 | OPT var | Bibliographic number or title string (L3965–3969) |
| terminal password | `AC` | 0..255 | OPT var | SC unit password (L3950–3952) |
| item properties | `CH` | 0..255 | OPT var | Item attributes (L3113–3115) |
| fee acknowledged | `BO` | 1 | OPT fixed 1-char: `Y`/`N` | Fee acknowledgement for renewals (L2827–2833) |

### 12.2 `30` Renew Response (L2025–2107) — 2.00-new

> Verbatim layout (identical field list to `12`):
> `30<ok><renewal ok><magnetic media><desensitize><transaction date><institution id><patron identifier><item identifier><title identifier><due date><fee type><security inhibit><currency type><fee amount><media type><item properties><transaction id><screen message><print line>`

"This message **must** be sent by the ACS in response to a Renew message by the SC." (L2027) and: "See the description of the Checkout Response message for how the ok, renewal ok, desensitize, and fee amount fields will be interpreted." (L2106–2107)

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `30` | 2 | fixed | Renew Response |
| ok | (none) | 1 | REQ fixed 1-char: `0`/`1` | See section 10.2 rules (L1174–1192) |
| renewal ok | (none) | 1 | REQ fixed 1-char: `Y`/`N` | See section 10.2 rules |
| magnetic media | (none) | 1 | REQ fixed 1-char: `Y`/`N`/`U` | Magnetic-media identification (L3192–3194) |
| desensitize | (none) | 1 | REQ fixed 1-char: `Y`/`N`/`U` | See section 10.2 rules |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time |
| institution id | `AO` | 0..255 | REQ var | Library institution ID |
| patron identifier | `AA` | 0..255 | REQ var | Patron id |
| item identifier | `AB` | 0..255 | REQ var | Article bar-code |
| title identifier | `AJ` | 0..255 | REQ var | Title identifier (L2061) |
| due date | `AH` | 0..255 | REQ var | Due date, free format (L2729–2731) |
| fee type | `BT` | 2 | OPT fixed 2-char: `01`–`99` | Fee type for **renewing** this item (L2064–2065, "renewing this item" L2085) |
| security inhibit | `CI` | 1 | OPT fixed 1-char: `Y`/`N` | Ignore item security status (L3736–3741) |
| currency type | `BH` | 3 | OPT fixed 3-char | ISO 4217 code |
| fee amount | `BV` | 0..255 | OPT var | "The amount of the fee associated with this item." (L2096) |
| media type | `CK` | 3 | OPT fixed 3-char | Media type enum |
| item properties | `CH` | 0..255 | OPT var | Item attributes |
| transaction id | `BK` | 0..255 | OPT var | "May be assigned by the ACS when renewing the item involves a fee." (L2099–2101) |
| screen message | `AF` | 0..255 (repeatable) | OPT var | Screen text |
| print line | `AG` | 0..255 (repeatable) | OPT var | Printer text |

---
## 13. `65` Renew All to `66` Renew All Response

### 13.1 `65` Renew All (L924–954) — 2.00-new

> Verbatim layout: `65<transaction date><institution id><patron identifier><patron password><terminal password><fee acknowledged>`

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `65` | 2 | fixed | Renew All |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time |
| institution id | `AO` | 0..255 | REQ var | Library institution ID |
| patron identifier | `AA` | 0..255 | REQ var | Patron id |
| patron password | `AD` | 0..255 | OPT var | Patron PIN |
| terminal password | `AC` | 0..255 | OPT var | SC unit password |
| fee acknowledged | `BO` | 1 | OPT fixed 1-char: `Y`/`N` | "`Y` ... would mean that the patron had agreed to all fees associated with all items being renewed." (L2832–2833) |

### 13.2 `66` Renew All Response (L2111–2150) — 2.00-new

> Verbatim layout: `66<ok ><renewed count><unrenewed count><transaction date><institution id><renewed items><unrenewed items><screen message><print line>`

"The ACS **should** send this message in response to a Renew All message." (L2113)

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `66` | 2 | fixed | Renew All Response |
| ok | (none) | 1 | REQ fixed 1-char: `0`/`1` | Action allowable and completed (`1`) or not (`0`) (L3387–3390) |
| renewed count | (none) | 4 | REQ fixed 4-char | "A count of the number of items that were renewed." (L3695) |
| unrenewed count | (none) | 4 | REQ fixed 4-char | "a count of the number of items that were not renewed." (L4052) |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time |
| institution id | `AO` | 0..255 | REQ var | Library institution ID |
| renewed items | `BM` | 0..255 (repeat) | OPT var | "sent for each renewed item" (L3697–3701) |
| unrenewed items | `BN` | 0..255 (repeat) | OPT var | "sent for each unrenewed item. It could include a reason that the item was not renewed." (L4054–4059) |
| screen message | `AF` | 0..255 (repeatable) | OPT var | Screen text |
| print line | `AG` | 0..255 (repeatable) | OPT var | Printer text |

---

## 14. `35` End Patron Session to `36` End Session Response

### 14.1 `35` End Patron Session (L520–561) — 2.00-new

> Verbatim layout: `35<transaction date><institution id><patron identifier><terminal password><patron password>`

"The ACS **may**, upon receipt of this command, close any open files or deallocate data structures pertaining to that patron. The ACS should respond with an End Session Response message." (L539–541)

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `35` | 2 | fixed | End Patron Session |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time |
| institution id | `AO` | 0..255 | REQ var | Library institution ID |
| patron identifier | `AA` | 0..255 | REQ var | Patron id (spec prints this ID with a trailing period at L558) |
| terminal password | `AC` | 0..255 | OPT var | SC unit password |
| patron password | `AD` | 0..255 | OPT var | Patron PIN |

### 14.2 `36` End Session Response (L1626–1657) — 2.00-new

> Verbatim layout: `36<end session>< transaction date >< institution id >< patron identifier ><screen message><print line>`

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `36` | 2 | fixed | End Session Response |
| end session | (none) | 1 | REQ fixed 1-char: `Y`/`N` | `Y` = ACS ended the patron's session; "`N` would be an error condition." (L2745–2748) |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time |
| institution id | `AO` | 0..255 | REQ var | Library institution ID |
| patron identifier | `AA` | 0..255 | REQ var | Patron id |
| screen message | `AF` | 0..255 (repeatable) | OPT var | Screen text |
| print line | `AG` | 0..255 (repeatable) | OPT var | Printer text |

---

## 15. `15` Hold to `16` Hold Response

### 15.1 `15` Hold (L766–819) — 2.00-new

> Verbatim layout:
> `15<hold mode><transaction date><expiration date><pickup location><hold type><institution id><patron identifier><patron password><item identifier><title identifier><terminal password><fee acknowledged>`

"Either or both of the 'item identifier' and 'title identifier' fields must be present for the message to be useful." (L767–768)

**Fixed block:**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `15` | 2 | fixed | Hold |
| hold mode | (none) | 1 | REQ fixed 1-char: `+`/`-`/`*` | `+` = add patron to hold queue, `-` = delete patron from queue, `*` = change hold to match message parameters (L800, L2924–2932) |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time |

**ID'd fields:**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| expiration date | `BW` | 18 | OPT fixed 18-char: `YYYYMMDDZZZZHHMMSS` | "the date, if any, that the hold will expire." (L2754–2755) |
| pickup location | `BS` | 0..255 | OPT var | "the location where an item will be picked up." (L3602) |
| hold type | `BY` | 1 | OPT fixed 1-char: `1`–`9` | Type of hold (Appendix B.7) (L2944–3062) |
| institution id | `AO` | 0..255 | REQ var | Library institution ID |
| patron identifier | `AA` | 0..255 | REQ var | Patron id |
| patron password | `AD` | 0..255 | OPT var | Patron PIN |
| item identifier | `AB` | 0..255 | OPT var | Article bar-code |
| title identifier | `AJ` | 0..255 | OPT var | Title identifier |
| terminal password | `AC` | 0..255 | OPT var | SC unit password |
| fee acknowledged | `BO` | 1 | OPT fixed 1-char: `Y`/`N` | Acknowledges a charge to put a hold on an item (L2835–2838) |

### 15.2 `16` Hold Response (L1931–1978) — 2.00-new

> Verbatim layout:
> `16<ok><available><transaction date><expiration date><queue position><pickup location><institution id><patron identifier><item identifier><title identifier><screen message><print line>`

**Fixed block:**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `16` | 2 | fixed | Hold Response |
| ok | (none) | 1 | REQ fixed 1-char: `0`/`1` | Action allowable and completed / not (L3387–3390) |
| available | (none) | 1 | REQ fixed 1-char: `Y`/`N` | "`Y` indicates that the item is available; it is not checked out or on hold." (L2501–2502) |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time |

**ID'd fields:**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| expiration date | `BW` | 18 | OPT fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Hold expiration date (L2754–2755) |
| queue position | `BR` | 0..255 | OPT var | "numeric value for the patron's position in the hold queue for an item." (L3618–3619) |
| pickup location | `BS` | 0..255 | OPT var | Pickup location (L3602) |
| institution id | `AO` | 0..255 | REQ var | Library institution ID |
| patron identifier | `AA` | 0..255 | REQ var | Patron id |
| item identifier | `AB` | 0..255 | OPT var | Article bar-code |
| title identifier | `AJ` | 0..255 | OPT var | Title identifier |
| screen message | `AF` | 0..255 (repeatable) | OPT var | Screen text |
| print line | `AG` | 0..255 (repeatable) | OPT var | Printer text |

---

## 16. `19` Item Status Update to `20` Item Status Update Response

### 16.1 `19` Item Status Update (L709–739) — 2.00-new

> Verbatim layout: `19<transaction date><institution id><item identifier><terminal password><item properties>`

"can be used to send item information to the ACS, without having to do a Checkout or Checkin operation. The item properties could be stored on the ACS's database." (L709–711)

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `19` | 2 | fixed | Item Status Update |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time |
| institution id | `AO` | 0..255 | REQ var | Library institution ID |
| item identifier | `AB` | 0..255 | REQ var | Article bar-code |
| terminal password | `AC` | 0..255 | OPT var | SC unit password |
| item properties | `CH` | 0..255 | REQ var | Item properties to store (L738–739) |

### 16.2 `20` Item Status Update Response (L1853–1883) — 2.00-new

> Verbatim layout: `20<item properties ok><transaction date><item identifier><title identifier><item properties><screen message><print line>`

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `20` | 2 | fixed | Item Status Update Response |
| item properties ok | (none) | 1 | REQ fixed 1-char: `0`/`1` | "'1' indicates that the item properties have been stored on the ACS database. Any other value indicates that item properties were not stored." (L3117–3118) |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time |
| item identifier | `AB` | 0..255 | REQ var | Article bar-code |
| title identifier | `AJ` | 0..255 | OPT var | Title identifier |
| item properties | `CH` | 0..255 | OPT var | Item properties |
| screen message | `AF` | 0..255 (repeatable) | OPT var | Screen text |
| print line | `AG` | 0..255 (repeatable) | OPT var | Printer text |

---

## 17. `37` Fee Paid to `38` Fee Paid Response

### 17.1 `37` Fee Paid (L565–623) — 2.00-new

> Verbatim layout:
> `37<transaction date><fee type><payment type><currency type><fee amount><institution id><patron identifier><terminal password><patron password><fee identifier><transaction id>`

**Fixed block:**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `37` | 2 | fixed | Fee Paid |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time |
| fee type | (none) | 2 | REQ fixed 2-char: `01`–`99` | "identifies a fee type to apply the payment to." (L605–607) — Appendix B.3 |
| payment type | (none) | 2 | REQ fixed 2-char: `00`–`99` | Enumerated payment type (Appendix B.4) (L609, L3548–3560) |
| currency type | (none) | 3 | REQ fixed 3-char | ISO 4217 code (L610, L2668–2693) |

**ID'd fields:**

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| fee amount | `BV` | 0..255 | REQ var | "the amount paid." (L611) |
| institution id | `AO` | 0..255 | REQ var | Library institution ID |
| patron identifier | `AA` | 0..255 | REQ var | Patron id |
| terminal password | `AC` | 0..255 | OPT var | SC unit password |
| patron password | `AD` | 0..255 | OPT var | Patron PIN |
| fee identifier | `CG` | 0..255 | OPT var | "identifies a specific fee to apply the payment to" possibly with fee type; user-selected from a fee list (L622, L2852–2853) |
| transaction id | `BK` | 0..255 | OPT var | "a transaction id assigned by the payment device." (L623); auditing cash flow (L3981–3986) |

### 17.2 `38` Fee Paid Response (L1645–1695) — 2.00-new

> Verbatim layout: `38<payment accepted><transaction date><institution id><patron identifier><transaction id><screen message><print line>`

| Field | ID | Len | Format | Meaning |
|---|---|---|---|---|
| (command) | `38` | 2 | fixed | Fee Paid Response |
| payment accepted | (none) | 1 | REQ fixed 1-char: `Y`/`N` | "`Y` indicates that the ACS has accepted the payment from the patron and the patron's account will be adjusted accordingly." (L3544–3546) |
| transaction date | (none) | 18 | REQ fixed 18-char: `YYYYMMDDZZZZHHMMSS` | Date/time |
| institution id | `AO` | 0..255 | REQ var | Library institution ID |
| patron identifier | `AA` | 0..255 | REQ var | Patron id |
| transaction id | `BK` | 0..255 | OPT var | "May be assigned by the ACS to acknowledge that the payment was received." (L1686, L1695) |
| screen message | `AF` | 0..255 (repeatable) | OPT var | Screen text |
| print line | `AG` | 0..255 (repeatable) | OPT var | Printer text |

---

## 17b. `97` Request ACS Resend / `96` Request SC Resend (framing-only messages)

| Direction | Code | Verbatim layout | Rules | Cite |
|---|---|---|---|---|
| SC to ACS | `97` | `97` (no other fields) | "requests the ACS to re-transmit its last message ... sent by the SC to the ACS when the checksum in a received message does not match ... should **never** include a 'sequence number' field, even when error detection is enabled, ... but **would include** a 'checksum' field since checksums are in use." | L414–421 |
| ACS to SC | `96` | `96` (no other fields) | Mirror rule for the ACS side. | L1406–1413 |

Effective wire form with error detection on: `97AZxxxx<CR>` / `96AZxxxx<CR>`.

---
## 18. Complete message-code table (spec lines 4340–4421)

### 18.1 Command messages sent by the SC to the ACS

| Code | Message name | Introduced |
|---|---|---|
| `23` | Patron Status Request | 1.00 |
| `11` | Checkout | 1.00 |
| `09` | Checkin | 1.00 |
| `01` | Block Patron | 1.00 |
| `99` | SC Status | 1.00 |
| `97` | Request ACS Resend | 1.00 |
| `93` | Login | 2.00 |
| `63` | Patron Information | 2.00 |
| `35` | End Patron Session | 2.00 |
| `37` | Fee Paid | 2.00 |
| `17` | Item Information | 2.00 |
| `19` | Item Status Update | 2.00 |
| `25` | Patron Enable | 2.00 |
| `15` | Hold | 2.00 |
| `29` | Renew | 2.00 |
| `65` | Renew All | 2.00 |

### 18.2 Response messages sent by the ACS to the SC

| Code | Message name | Introduced |
|---|---|---|
| `24` | Patron Status Response | 1.00 |
| `12` | Checkout Response | 1.00 |
| `10` | Checkin Response | 1.00 |
| `98` | ACS Status | 1.00 |
| `96` | Request SC Resend | 1.00 |
| `94` | Login Response | 2.00 |
| `64` | Patron Information Response | 2.00 |
| `36` | End Session Response | 2.00 |
| `38` | Fee Paid Response | 2.00 |
| `18` | Item Information Response | 2.00 |
| `20` | Item Status Update Response | 2.00 |
| `26` | Patron Enable Response | 2.00 |
| `16` | Hold Response | 2.00 |
| `30` | Renew Response | 2.00 |
| `66` | Renew All Response | 2.00 |

The "Introduced" column is corroborated by the `2.00` markers printed beside each message definition (requests: L423, L491, L518, L563, L647, L722/L753, L821, L922; responses: L1415, L1431, L1624, L1643, L1697, L1785, L1885, L1910, L2023, L2109).

### 18.3 Verbatim source dump, lines 4340–4421

```
Message identifiers
Command messages sent by the SC to the ACS:
Patron Status Request  
= 23 
Checkout 
= 11 
Checkin  
= 09 
Block Patron  
= 01 
SC Status 
= 99 
Request ACS Resend   
= 97 
2.00 
= 93 
Login 
2.00 
Patron Information  = 63 
2.00 
End Patron Session  = 35 
2.00 
Fee Paid 
= 37 
2.00 
= 17 
Item Information 
2.00 
Item Status Update  = 19 
2.00 
= 25 
Patron Enable 
2.00  Hold 
= 15 
2.00 
= 29 
2.00 
= 65 

Renew 
Renew All 

= 24 
= 12 
= 10 
= 98 
= 96 

Response messages sent by the ACS to the SC: 
Patron Status Response 
Checkout Response 
Checkin Response 
ACS Status 
Request SC Resend 
2.00 
2.00 
2.00 
2.00 
2.00 
2.00 
2.00 
2.00  Hold Response 
2.00 
2.00 

Login Response 
    = 94 
Patron Information Response  = 64 
    = 36 
End Session Response  
Fee Paid Response 
    = 38 
Item Information Response    = 18 
Item Status Update Response  = 20 
    = 26 
Patron Enable Response 
    = 16 
    = 30 
    = 66 

Renew Response 
Renew All Response 
```

(The extraction interleaves the name and code columns; the tables in 18.1/18.2 are the correctly paired result.)

---

## 19. Supported-messages `BX` field — exact 16-position order

Definition (L3903–3905): "variable-length field. This field is used to notify the SC about which messages the ACS supports. **A `Y` in a position means that the associated message/response is supported. An `N` means the message/response pair is not supported.**"

**Spec's ordering, quoted verbatim (positions are 0-based, L3906–3938):**

| Position (as printed in spec) | 1-based index | Message Command/Response pair |
|---|---|---|
| `0` | 1 | Patron Status Request |
| `1` | 2 | Checkout |
| `2` | 3 | Checkin |
| `3` | 4 | Block Patron |
| `4` | 5 | SC/ACS Status |
| `5` | 6 | Request SC/ACS Resend |
| `6` | 7 | Login |
| `7` | 8 | Patron Information |
| `8` | 9 | End Patron Session |
| `9` | 10 | Fee Paid |
| `10` | 11 | Item Information |
| `11` | 12 | Item Status Update |
| `12` | 13 | Patron Enable |
| `13` | 14 | Hold |
| `14` | 15 | Renew |
| `15` | 16 | Renew All |

Verbatim source lines (L3906–3938):

```
Position  Message Command/Response pair 
Patron Status Request 
     0   
Checkout 
     1   
Checkin 
     2   
Block Patron 
     3   
SC/ACS Status 
     4   
Request SC/ACS Resend 
     5   
Login 
     6   
Patron Information 
     7   
End Patron Session 
     8   
Fee Paid 
     9   
Item Information 
     10  
Item Status Update 
     11  
Patron Enable 
     12  
Hold 
     13  
Renew 
     14  
Renew All 
     15  
```

Note: `BX` is declared variable-length but carries exactly these 16 characters in practice; it is a **required** field of `98` (L1399–1400).

---

## 20. Protocol version, date/time format, and language statements

### 20.1 Required protocol version values

| Statement | Cite |
|---|---|
| Version field format is `x.xx` — "a single numeral followed by a period then followed by two more numerals" (4 chars) | L3609–3611, L412, L1300 |
| "This document describes Version 2.00 ... All new messages and fields are indicated by having **'2.00'** in front of them in the message definitions. Any messages and fields that are not prefixed by '2.00' existed in earlier versions." | L170–173 |
| SC sends its version in `99`; ACS sends its version in `98` (section 1.3) | L401–412, L1270–1300 |
| SC version > ACS version: "SC will take responsibility for deciding if it can operate in a mode compatible with an older version ACS system." | L2438–2440 |
| SC version < ACS version: "Each version ... will include ... the minimum version of the SC Protocol with which it is compatible. The ACS system should **refuse to talk** to a version of the protocol which is older than the specified minimum. The minimum compatible version of the Standard Protocol release 1.00 is 1.00." | L2442–2446 |
| Example: "V3.00 ... might have as its minimum compatible version V2.50." | L2448–2449 |
| "If the ACS system detects an incompatible version it should send an ACS system status message indicating that the ACS system is **not on-line**, with an appropriate error message for the SC screen." | L2451–2452 |

The spec never literally writes "the field must contain `2.00`"; for a 2.00-only implementation the transmitted value is `2.00`.

### 20.2 Date/time format

**Transaction date / all fixed 18-char date fields:** `YYYYMMDDZZZZHHMMSS` = 8 date chars + 4 zone chars (`ZZZZ`) + 6 time chars (i.e. `yyyyMMdd` + `    ` + `HHmmss`).

| Statement | Cite |
|---|---|
| "All dates and times are expressed according to the ANSI standard X3.30 for date and X3.43 for time." | L3973–3974 |
| "The `ZZZZ` field should contain **blanks (code $20)** to represent **local time**." | L3974–3975 |
| "To represent **universal time**, a `Z` character (code $5A) should be put in the **last (right hand) position** of the `ZZZZ` field." | L3975–3976 |
| "To represent other time zones the appropriate character should be used; a `Q` character (code $51) should be put in the last (right hand) position of the `ZZZZ` field to represent **Atlantic Standard Time**." | L3976–3978 |
| "When possible **local time is the preferred format**." | L3978–3979 |
| `due date` (`AH`) is variable-length and "not necessarily formatted with the ANSI standard ... the ACS can send this date field in any format it wishes." | L2729–2731 |
| `date / time sync` (in `98`): 18-char same format; "**`000000000000000000` indicates a unsupported function**"; "May be used to synchronize clocks." | L2718–2721 |

### 20.3 Language

| Statement | Cite |
|---|---|
| "language — 3-char, fixed-length field. The ACS may use this field's information to format screen and print messages in the language as requested by the Patron. **Code `000` in this field means the language is not specified.**" | L3120–3122 |
| Numeric code table `000`–`027` (Appendix B.8); `000` = "Unknown (default)" | L3123–3181 |
| Language is a **fixed-length field without a field ID** (absent from the field-identifier list, L4105–4338) | L4105–4338 |

**Not present anywhere in this specification:** the string `eng` as a language value, and the code `084`. The 3M SIP2 spec uses only the 3-digit numeric codes in Appendix B.8.

---

## 21. Server (ACS) behavior statements

| Topic | Spec statement | Cite |
|---|---|---|
| Unknown / unrecognized message code | "**Command identifiers that are unrecognized should be ignored.** This allows new commands to be added to the protocol in the future, without adversely affecting software written for earlier versions of the protocol." — no response is defined for an unknown command. | L2222–2225 |
| Recognized message, no response? | "**All recognized commands sent by the SC to the ACS require a response from the ACS.**" | L2227 |
| Unknown field ID | "**Fields with unrecognized field identifiers should be ignored.**" | L2234–2236 |
| Unsolicited status push | "The ACS Status Message Response will **not** be sent by the ACS unsolicited. When the ACS wishes a change of status, it will send an ACS Status message **as the response to the next message sent to it by the SC**. The SC will accept the new status and then send its command again (unless it happened to be an SC Status message)." | L2229–2232 |
| Messages before login | **Not specified.** The spec only orders the start of the session: SC Status "will be the first message sent by the SC ... (**exception: the Login Message may be sent first**)" (L396–398); Login "will be the first message sent to the ACS" when used (L429); Login Response "will be the first message sent to the SC" (L1419–1420); ACS Status "will be the first message sent by the ACS ... (exception: the Login Response Message may be sent first)" (L1265–1268). No error code / response is defined for operating before login. | L395–400, L425–429, L1264–1268, L1417–1420 |
| Pair independence | "Each message/response pair should stand on its own, irrespective of any previous or future message/response pair." | L2210–2220 |
| ACS date-time sync | `98` carries `date / time sync` (18-char); "May be used to synchronize clocks ... `000000000000000000` indicates a unsupported function. When possible local time is the preferred format." | L2718–2721 |
| Version incompatibility response | ACS "should send an ACS system status message indicating that the ACS system is **not on-line**, with an appropriate error message for the SC screen." | L2451–2452 |
| Bad checksum from SC | ACS responds `96` Request SC Resend | L2396–2398 |
| Duplicate SC message (same checksum + `AY`) | ACS "should re-send its last response" | L2405–2406 |
| ACS offline | `98.on-line status = N` "can use this field to notify the SC that it is going off-line for routine maintenance"; `98.timeout period = 000` "indicates that the ACS is not on-line" | L3392–3394, L3961–3963 |

---
## Appendix A. Field-identifier master table (spec L4105–4338)

| ID | Field name | ID | Field name |
|---|---|---|---|
| `AA` | patron identifier | `BV` | fee amount (2.00) |
| `AB` | item identifier | `BW` | expiration date (2.00) |
| `AC` | terminal password | `BX` | supported messages (2.00) |
| `AD` | patron password | `BY` | hold type (2.00) |
| `AE` | personal name | `BZ` | hold items limit (2.00) |
| `AF` | screen message | `CA` | overdue items limit (2.00) |
| `AG` | print line | `CB` | charged items limit (2.00) |
| `AH` | due date | `CC` | fee limit (2.00) |
| `AJ` | title identifier | `CD` | unavailable hold items (2.00) |
| `AL` | blocked card msg | `CF` | hold queue length (2.00) |
| `AM` | library name | `CG` | fee identifier (2.00) |
| `AN` | terminal location | `CH` | item properties (2.00) |
| `AO` | institution id | `CI` | security inhibit (2.00) |
| `AP` | current location | `CJ` | recall date (2.00) |
| `AQ` | permanent location | `CK` | media type (2.00) |
| `AS` | hold items (2.00) | `CL` | sort bin (2.00) |
| `AT` | overdue items (2.00) | `CM` | hold pickup date (2.00) |
| `AU` | charged items (2.00) | `CN` | login user id (2.00) |
| `AV` | fine items (2.00) | `CO` | login password (2.00) |
| `AY` | sequence number (only when error detection enabled) | `CP` | location code (2.00) |
| `AZ` | checksum (only when error detection enabled) | `CQ` | valid patron password (2.00) |
| `BD` | home address (2.00) | | |
| `BE` | e-mail address (2.00) | | |
| `BF` | home phone number (2.00) | | |
| `BG` | owner (2.00) | | |
| `BH` | currency type | | |
| `BI` | cancel | | |
| `BK` | transaction id (2.00) | | |
| `BL` | valid patron | | |
| `BM` | renewed items (2.00) | | |
| `BN` | unrenewed items (2.00) | | |
| `BO` | fee acknowledged | | |
| `BP` | start item (2.00) | | |
| `BQ` | end item (2.00) | | |
| `BR` | queue position (2.00) | | |
| `BS` | pickup location (2.00) | | |
| `BT` | fee type (2.00) | | |
| `BU` | recall items (2.00) | | |

Unassigned IDs (not in the list): `AI`, `AK`, `AR`, `AW`, `AX`, `BA`, `BB`, `BC`, `CE` — "Revision History 2.11: Removed unused field identifiers for variable-length or optional fields section." (L4483)

**Fields with NO field ID** (fixed-length only): language, summary, patron status, status code, max print width, protocol version, on-line status, checkin ok, checkout ok, ACS renewal policy, status update ok, off-line ok, timeout period, retries allowed, date/time sync, card retained, SC renewal policy, no block, return date, nb due date, third party allowed, hold mode, item properties ok, ok, renewal ok, magnetic media, desensitize, alert, available, end session, payment accepted, payment type, circulation status, security marker, fee type (in `18` and `37`), the six `64` item counts, renewed/unrenewed counts, UID algorithm, PWD algorithm.

---

## Appendix B. Enumerations and multi-position fields

### B.1 `patron status` — 14-char fixed, `Y` = true, blank `0x20` = false (L3511–3540)

| Pos | Definition | Pos | Definition |
|---|---|---|---|
| 0 | charge privileges denied | 7 | too many renewals |
| 1 | renewal privileges denied | 8 | too many claims of items returned |
| 2 | recall privileges denied | 9 | too many items lost |
| 3 | hold privileges denied | 10 | excessive outstanding fines |
| 4 | card reported lost | 11 | excessive outstanding fees |
| 5 | too many items charged | 12 | recall overdue |
| 6 | too many items overdue | 13 | too many items billed |

### B.2 `circulation status` — 2-char `00`–`99` (L2562–2590)

| Value (as printed) | Status |
|---|---|
| 1 | other |
| 2 | on order |
| 3 | available |
| 4 | charged |
| 5 | charged; not to be recalled until earliest recall date |
| 6 | in process |
| 7 | recalled |
| 8 | waiting on hold shelf |
| 9 | waiting to be re-shelved |
| 10 | in transit between library locations |
| 11 | claimed returned |
| 12 | lost |
| 13 | missing |

Values `14`–`99` are undefined in the spec.

### B.3 `fee type` — 2-char `01`–`99` (L2869–2889)

| Value | Fee Type |
|---|---|
| 01 | other/unknown |
| 02 | administrative |
| 03 | damage |
| 04 | overdue |
| 05 | processing |
| 06 | rental |
| 07 | replacement |
| 08 | computer access charge |
| 09 | hold fee |

### B.4 `payment type` — 2-char `00`–`99` (L3552–3560)

| Value | Payment Type |
|---|---|
| 00 | cash |
| 01 | VISA |
| 02 | credit card |

### B.5 `security marker` — 2-char `00`–`99` (L3746–3756)

| Value | Security Marker Type |
|---|---|
| 00 | other |
| 01 | None |
| 02 | 3M Tattle-Tape Security Strip |
| 03 | 3M Whisper Tape |

### B.6 `media type` — 3-char (L3348–3372)

| Value | Media Type |
|---|---|
| 000 | other |
| 001 | book |
| 002 | magazine |
| 003 | bound journal |
| 004 | audio tape |
| 005 | video tape |
| 006 | CD/CDROM |
| 007 | diskette |
| 008 | book with diskette |
| 009 | book with CD |
| 010 | book with audio tape |

### B.7 `hold type` — 1-char `1`–`4` (L3054–3062)

| Value | Hold Type |
|---|---|
| 1 | other |
| 2 | any copy of a title |
| 3 | a specific copy of a title |
| 4 | any copy at a single branch or sublocation |

### B.8 `language` — 3-char (L3120–3181)

`000` = Unknown (default) / "the language is not specified".

| Code | Language | Code | Language | Code | Language |
|---|---|---|---|---|---|
| 000 | Unknown (default) | 010 | Portuguese | 020 | Korean |
| 001 | English | 011 | Canadian-French | 021 | North American Spanish |
| 002 | French | 012 | Norwegian | 022 | Tamil |
| 003 | German | 013 | Hebrew | 023 | Malay |
| 004 | Italian | 014 | Japanese | 024 | United Kingdom |
| 005 | Dutch | 015 | Russian | 025 | Icelandic |
| 006 | Swedish | 016 | Arabic | 026 | Belgian |
| 007 | Finnish | 017 | Polish | 027 | Taiwanese |
| 008 | Spanish | 018 | Greek | | |
| 009 | Danish | 019 | Chinese | | |

### B.9 `status code` (in `99`) — 1-char (L3790–3798)

| Value | Definition |
|---|---|
| 0 | SC unit is OK |
| 1 | SC printer is out of paper |
| 2 | SC is about to shut down |

### B.10 `summary` (in `63`) — 10-char fixed, positions (L3889–3901)

| Position | Definition |
|---|---|
| 0 | hold items |
| 1 | overdue items |
| 2 | charged items |
| 3 | fine items |
| 4 | recall items |
| 5 | unavailable holds |

Positions 6–9 are not defined (send blanks, `0x20`).

### B.11 `currency type` — 3-char ISO 4217:1995 examples (L2668–2693)

`USD` US Dollar, `CAD` Canadian Dollar, `GBP` Pound Sterling, `FRF` French Franc, `DEM` Deutsche Mark, `ITL` Italian Lira, `ESP` Spanish Peseta, `JPY` Yen.

### B.12 `ok` semantics (all `ok` fields, 1-char `0`/`1`)

"A '1' in this field indicates that the requested action was allowable and completed successfully. A '0' indicates that the requested action was not allowable or did not complete successfully. This field is described in the preliminary NISO standard Z39.70-199x." (L3387–3390)

---

## Appendix C. Ambiguities, gaps, and extraction artifacts in the source text

1. **No sampled wire lines exist.** The document contains zero example packets (no `AY`/`AZ` samples, no complete message examples). The `<...>` templates are the only "example lines". (e.g. L193, L401, L1270)
2. **Checksum hex-letter case unspecified** — "four hex digits" / "four ASCII character digits" with no statement of upper vs lower case (L2355–2359). Implementations conventionally use uppercase.
3. **Checksum value `0000` never discussed** — the two's complement of a low-16 sum of `0x0000` is `0000`; the spec gives no rule for treating `0000` as absent/invalid (L2358–2362).
4. **Message-length field does not exist**; `AL` = blocked card msg (L2504–2508, L4123–4124). Nothing in the spec fills the role expected of an `AL` length field.
5. **Protocol version has no field ID.** `AO` = institution id, `AP` = current location (L4129–4132). A premise that the version field is `AO`/`AP` is not supported by this spec.
6. **`18` layout vs field table ordering conflict:** the layout line places `<hold queue length>` (ID'd, `CF`) second, between `circulation status` and `security marker` (L1703–1704), while the field table puts it after `transaction date` (L1725–1758). Resolved by the packet-format rule (L2238–2246): fixed fields first, ID'd fields after, any order.
7. **`11` field-table order differs from layout order** for `item properties` / `patron password` (L222–225 vs L242–244) — immaterial because both are ID'd (L2246–2247).
8. **Column-flattening artifacts** throughout: the Field/ID/Format three-column tables are interleaved inconsistently (e.g. L1053–1060, L1228–1244, L1757–1783, L4342–4421). ID-to-name mapping was cross-checked against the authoritative field-identifier list (L4105–4338) and the field-definitions section (L2478–4071).
9. **`circulation status` values printed as `1`–`13`** (L2563–2575) although the field is declared "2-char ... (00 thru 99)" — the spec does not say whether to transmit `01` or `1`; the 2-char declaration implies zero-padded (`01`).
10. **`hold pickup date` (`CM`) definition reads "The date that the hold expires"** (L2934–2938), duplicating `expiration date` (`BW`, L2754–2755) — likely a spec copy/paste error; no clarification is given.
11. **`BX` is declared variable-length** (L3903) but describes exactly 16 positions; the spec does not say whether to pad to 16 or what to send for unsupported positions beyond `Y`/`N`.
12. **`summary` is 10-char** but only positions 0–5 are defined (L3881–3901); positions 6–9 undefined.
13. **Behavior for messages received before login is not defined** anywhere (section 21); likewise there is **no error/unknown-command response code** — unrecognized command IDs are simply ignored (L2222–2225).
14. **No `eng` or `084` language code exists in this spec** (L3120–3181); ISO-639-style codes and code `084` come from other/derived SIP2 documents, not from Document Rev. 2.12.
15. **Fields `XA`–`XJ`, `FF`, `QY` do not exist** anywhere in this document (verified by full-text search).
16. **`01` Block Patron has no dedicated error response** — the spec directs the ACS to answer with `24` Patron Status Response (L366–368, L975–976).
17. **Header/footer drift:** cover says "Document Revision 2.12" (L6) while the page-i footer says "Document Rev. 2.11" (L76) and body pages say "Document Rev. 2.12"; field-definition pages are headed "September 17, 1998" (L2476 etc.) while message pages are headed "April 11, 2006".
18. **`12`/`30` title identifier `AJ` and due date `AH` are marked "variable-length required"** (L1057–1059, L2059–2061) even though many implementations treat them as optional; `18` marks the same two fields optional (L1759, L1765–1766). Follow the per-message table above.
19. **Line count artifact:** the text file reports 4498 lines (many blank spacer lines); `Measure-Object -Line` counts 3639 non-empty lines.
