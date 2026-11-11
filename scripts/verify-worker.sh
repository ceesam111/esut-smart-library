#!/bin/bash
set -euo pipefail
echo '=== app env keys (values masked) ==='
docker inspect esut-app-new --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -E '^(AI_GATEWAY_API_KEY|AI_GATEWAY_BASE_URL|RESEND_API_KEY|RESEND_FROM_EMAIL|FROM_EMAIL|WORKER_HEALTH_URL)=' \
  | sed 's/=.*/=<set>/'

echo '=== worker logs (tail 15) ==='
docker logs --tail 15 esut-worker 2>&1 || true

echo '=== worker health from app container ==='
docker exec esut-app-new node -e "fetch('http://esut-worker:8787/health').then(r=>r.text()).then(t=>console.log(t)).catch(e=>console.log('ERR '+e.message))"

echo '=== containers ==='
docker ps --filter name=esut --format '{{.Names}} {{.Status}} {{.Image}}'
