# SIP2 Self-Check Service — Deployment Guide

The SIP2 service is a standalone TCP/TLS server. It does **not** run inside the Next.js app process; it talks to the same Supabase project directly. You can run it on the app host, in its own container, or on a dedicated kiosk-network host.

## What it needs

- Node.js 20+ (Node 22 in the container image)
- Outbound HTTPS to the Supabase project (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
- No inbound database access required (PostgREST over HTTPS only)

Credentials are read from `.env.local` / `.env` in the project root when the process starts. Variables already present in the environment win over files, so container orchestration can inject them.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `SIP2_PORT` | `6000` | SIP2 wire port (TCP, or TLS when certs are set) |
| `SIP2_HEALTH_PORT` | `8788` | HTTP health/metrics endpoint (plain HTTP, localhost-oriented) |
| `SIP2_MAX_CONNECTIONS` | `32` | Concurrent kiosk connection cap |
| `SIP2_IDLE_TIMEOUT_MS` | `300000` | Idle connection drain (5 min) |
| `SIP2_MAX_MESSAGE_BYTES` | `8192` | Oversize-frame guard; offending socket is closed |
| `SIP2_TLS_CERT` | *(unset)* | Path to PEM certificate — enables TLS |
| `SIP2_TLS_KEY` | *(unset)* | Path to PEM private key — enables TLS |
| `SUPABASE_URL` | *(required)* | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | *(required)* | Service-role key for terminal auth + audit writes |

Fixed (compile-time) security behavior: bcrypt cost 12, lockout after 5 failed logins for 15 minutes, login rate limit 10 attempts/minute per institution+username.

## Run locally

```bash
npm run sip2            # = tsx sip2/index.ts
# or
node --import tsx sip2/index.ts
```

Expected startup line on stderr:

```
[sip2] listening tcp :6000 (maxConn=32, idle=300000ms, maxMsg=8192B); health=:8788/health
```

Stop with `Ctrl+C` (SIGINT) or `SIGTERM`: the listener drains connections, closes, then exits 0.

## Health endpoint

`GET http://127.0.0.1:8788/health` returns:

```json
{
  "status": "ok",
  "startedAt": "2026-10-05T22:47:02.473Z",
  "port": 6000,
  "healthPort": 8788,
  "tls": false,
  "shuttingDown": false,
  "connections": 0,
  "connectionsTotal": 0,
  "messagesProcessed": 0,
  "responsesSent": 0,
  "ignoredFrames": 0,
  "oversizeFrames": 0,
  "rejectedConnections": 0,
  "lastMessageAt": null
}
```

HTTP 200 + `"status":"ok"` means ready. Counters reset when the process restarts (the service is stateless; kiosk sessions re-login).

## TLS

Generate or install a certificate, then set both variables:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -keyout sip2-key.pem -out sip2-cert.pem -days 365 -subj "/CN=your-kiosk-host"
SIP2_TLS_CERT=/path/sip2-cert.pem SIP2_TLS_KEY=/path/sip2-key.pem npm run sip2
```

With certs set, port `SIP2_PORT` serves TLS (`tls: true` in health) — SIP2 clients connect with TLS instead of plain TCP. Use the same port for both modes; health port stays plain HTTP.

## Docker

Image: `Dockerfile.sip2` (multi-stage, non-root `sip2` user, `CMD npm run sip2`).

```bash
docker build -f Dockerfile.sip2 -t esut-sip2 .
docker run --env-file .env -p 6000:6000 -p 8788:8788 esut-sip2
```

Or via Compose (service is behind the `sip2` profile so normal app deployments are unaffected):

```bash
docker compose -f docker-compose.prod.yml --profile sip2 up -d sip2
```

Compose passes `SIP2_*` + `SUPABASE_*` from the host environment (`.env`), maps `${SIP2_HOST_PORT:-6000}` and `${SIP2_HOST_HEALTH_PORT:-8788}`, sets `restart: unless-stopped`, and health-checks `/health` from inside the container.

## Observability

- **Health counters** (above): per-process traffic and rejection counts.
- **Audit trail**: every login, denial, checksum failure, duplicate, circulation action, and handler error is inserted into the `sip2_audit_log` table (event name, success flag, non-secret details JSON, client IP, terminal id). Terminal deletion keeps history (`terminal_id` goes NULL).
- **Stdout/stderr**: startup, oversize-frame closes, and shutdown events only.

## Security notes

- Kiosk passwords are bcrypt-hashed (`sip2_terminals.password_hash`); plaintext is shown once in the admin UI at creation/reset.
- The health endpoint exposes counters only — no credentials, no patron data.
- Lock down port 8788 with a firewall or reverse proxy so only monitoring can reach it.
- Put the SIP2 port on the kiosk/library network segment; use `permitted_ip_cidr` per terminal to pin sources.


## Production deployment record - 2026-10-06

**Commits:** `52ab2ba` (AFUED->ESUT rebrand, 60 hits/14 files), `9c9f07e` (lazy admin client in z3950 stage-import - Docker build blocker), `0199fd3` (COPY config/ into sip2+worker images - runtime blocker).

**Images (VPS 153.92.210.52, built from master clone /tmp/esut-build):**
- `ghcr.io/ceesam111/esut-smart-library:deploy-latest` (rollback: `deploy-prev`)
- `ghcr.io/ceesam111/esut-smart-library:worker-latest` (rollback: `worker-prev`)
- `ghcr.io/ceesam111/esut-smart-library:sip2-latest`

**Containers (network coolify, restart unless-stopped):** `esut-app-new` (env-file /tmp/app-new.env, 51 lines, healthy), `esut-worker` (/tmp/worker.env, 49 lines), `esut-sip2` (-p 6000:6000, -p 127.0.0.1:8788:8788, SIP2_* + /tmp/sip2.env).

**Verification evidence (command -> outcome):**
- `tsc --noEmit` 0; `eslint` 0; `vitest run` 657/657 (83 files).
- `curl https://virtuallibrary.esut.edu.ng/api/health` -> 200; `/` -> 200; `/api/admin/sip2/terminals` -> 401 JSON (proves new build; old build served 200 HTML).
- Traefik: container re-assigned the same IP 172.16.1.11, `esut-afued-routing.yaml` unchanged and correct.
- SIP2 loopback E2E: `sip2-client.py --host 127.0.0.1 login` -> `941AY1` (AY1 success, checksum ok, exit 0); health counters connectionsTotal=3, messagesProcessed=1.
- DB: indexes `loans_one_active_per_patron_item` + `idx_sip2_terminals_institution` present; `sip2_audit_log` rows `credential_migrated` + `login_success` for terminal DEPLOYVERIFY (sha256-legacy auto-migrated to bcrypt).
- Worker health via app container fetch `http://esut-worker:8787/health` -> 200 JSON.
- Prod env scan: no AFUED/`FROM_NAME`; `RESEND_FROM_EMAIL=send@esutlibrary.edu.ng` (unchanged, verified sender).

**Limitations / pending:**
- External TCP 6000 is blocked by the Hostinger cloud firewall (VPS-side ufw inactive; loopback + own-IP connect OK; 22/443/8000 open). Open inbound TCP 6000 in the Hostinger console, then re-test from outside.
- Domain is Cloudflare-proxied (188.114.96.x): SIP2 clients must target the origin IP `153.92.210.52:6000` (or add an unproxied DNS name).
- TLS not enabled (no certificate for the kiosk host); health port 8788 bound to 127.0.0.1 only.
- Test terminal `DEPLOYVERIFY` (institution ESUT) left active for external verification; remove with: `delete from public.sip2_terminals where login_username='DEPLOYVERIFY';`
