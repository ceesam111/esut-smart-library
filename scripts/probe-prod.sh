#!/bin/bash
B=https://virtuallibrary.esut.edu.ng
req() {
  local method="$1" path="$2" data="${3:-}"
  local out code
  if [ -n "$data" ]; then
    out=$(curl -sS -X "$method" -H 'Content-Type: application/json' -d "$data" -w '\n%{http_code}' "$B$path" 2>&1)
  else
    out=$(curl -sS -X "$method" -w '\n%{http_code}' "$B$path" 2>&1)
  fi
  code=$(printf '%s' "$out" | tail -n1)
  body=$(printf '%s' "$out" | sed '$d' | head -c 220)
  printf '%-6s %-45s %s  %s\n' "$method" "$path" "$code" "$body"
}
echo '=== core ==='
req GET /api/health
req GET /api/health/supabase
req GET /api/health/schema
req GET '/api/catalog?limit=1'
req GET /api/catalog/legacy/x
req GET /api/repository
req GET '/api/search/resources?q=library'
req GET /api/resource-requests
req POST /api/resource-requests '{"type":"probe"}'
req GET /api/registration/policy
req GET /api/security/turnstile/config
req GET /api/library-manual
req GET /api/academic-integrity
req GET /api/manifest
echo '=== ai ==='
req POST /api/ai/reference-librarian '{"message":"hello"}'
req GET /api/ai/lyria-voice
echo '=== admin unauth (expect 401) ==='
req GET /api/admin/audit-logs
req GET /api/admin/agents/health
req GET /api/admin/harvest
req GET /api/admin/approvals
req GET /api/admin/catalogue/staging
echo '=== auth ==='
req POST /api/registration/send-verification '{"email":"probe@example.com"}'
echo '=== public pages ==='
for p in / /subscribed-databases /open-access-databases /catalogue /repository /contact /faq /login /register /dashboard; do
  code=$(curl -sSk -o /dev/null -w '%{http_code}' "$B$p")
  printf 'GET %-30s %s\n' "$p" "$code"
done
