#!/bin/bash
set -euo pipefail
REPO=/tmp/esut-rebuild
IMAGE=ghcr.io/ceesam111/esut-smart-library:worker-latest
CONTAINER=esut-worker
NETWORK=coolify

cd "$REPO"
echo '== git pull =='
git fetch origin
git reset --hard origin/master
git log -1 --oneline

echo '== build worker image =='
docker build -f Dockerfile.worker -t "$IMAGE" "$REPO"

echo '== worker env =='
if [ ! -f /root/esut-extra.env ]; then
  echo 'MISSING /root/esut-extra.env' >&2
  exit 1
fi
# base env from app container if present, else extra only
if docker inspect esut-app-new >/dev/null 2>&1; then
  docker inspect esut-app-new --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | grep -v '^PATH=' | grep -v '^NODE_VERSION=' | grep -v '^YARN_VERSION=' > /tmp/esut-worker.env
else
  : > /tmp/esut-worker.env
fi
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|'#'*) continue ;; esac
  key=${line%%=*}
  grep -v "^${key}=" /tmp/esut-worker.env > /tmp/esut-worker.tmp || true
  mv /tmp/esut-worker.tmp /tmp/esut-worker.env
done < /root/esut-extra.env
cat /root/esut-extra.env >> /tmp/esut-worker.env
grep -q '^WORKER_ID=' /tmp/esut-worker.env || echo 'WORKER_ID=esut-worker-1' >> /tmp/esut-worker.env
echo "env lines: $(wc -l < /tmp/esut-worker.env)"

echo '== swap worker container =='
if docker inspect "$CONTAINER" >/dev/null 2>&1; then
  docker rm -f "$CONTAINER"
fi
docker run -d \
  --name "$CONTAINER" \
  --network "$NETWORK" \
  --restart unless-stopped \
  --env-file /tmp/esut-worker.env \
  "$IMAGE"

echo '== wait worker health =='
ok=0
for i in $(seq 1 30); do
  st=$(docker inspect -f '{{.State.Status}}' "$CONTAINER" 2>/dev/null || echo missing)
  if [ "$st" = "running" ]; then
    if docker exec "$CONTAINER" node -e "fetch('http://127.0.0.1:'+(process.env.WORKER_HEALTH_PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      ok=1
      break
    fi
  fi
  echo "try $i status=$st"
  if [ "$st" = "exited" ] || [ "$st" = "missing" ]; then
    docker logs --tail 60 "$CONTAINER" || true
    break
  fi
  sleep 3
done

if [ "$ok" != "1" ]; then
  echo 'WORKER_UNHEALTHY'
  docker logs --tail 80 "$CONTAINER" || true
  exit 1
fi
echo 'WORKER_OK'
docker ps --filter name="$CONTAINER" --format '{{.Names}} {{.Status}} {{.Image}}'
