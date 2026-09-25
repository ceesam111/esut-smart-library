#!/bin/bash
set -euo pipefail
REPO=/tmp/esut-rebuild
IMAGE=ghcr.io/ceesam111/esut-smart-library:deploy-latest
CONTAINER=esut-app-new
NETWORK=coolify
OLD=esut-app-new-prev

cd "$REPO"
echo '== git pull =='
git fetch origin
git reset --hard origin/master
git log -1 --oneline

echo '== extract build args from running container =='
docker inspect "$CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' > /tmp/esut-env.txt
NEXT_PUBLIC_APP_URL=$(grep '^NEXT_PUBLIC_APP_BASE_URL=' /tmp/esut-env.txt | cut -d= -f2-)
NEXT_PUBLIC_APP_BASE_URL="$NEXT_PUBLIC_APP_URL"
NEXT_PUBLIC_SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' /tmp/esut-env.txt | cut -d= -f2-)
NEXT_PUBLIC_SUPABASE_ANON_KEY=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' /tmp/esut-env.txt | cut -d= -f2-)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$(grep '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' /tmp/esut-env.txt | cut -d= -f2-)
export NEXT_PUBLIC_APP_URL NEXT_PUBLIC_APP_BASE_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
export CACHE_BUST=$(date +%s)
echo "URL=$NEXT_PUBLIC_APP_URL SB=$NEXT_PUBLIC_SUPABASE_URL"

echo '== docker build (may take several minutes) =='
docker build \
  --build-arg NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL" \
  --build-arg NEXT_PUBLIC_APP_BASE_URL="$NEXT_PUBLIC_APP_BASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  --build-arg CACHE_BUST="$CACHE_BUST" \
  -t "$IMAGE" \
  -t ghcr.io/ceesam111/esut-smart-library:latest \
  "$REPO"

echo '== prepare runtime env from current container =='
docker inspect "$CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' > /tmp/esut-runtime.env
grep -v '^PATH=' /tmp/esut-runtime.env | grep -v '^NODE_VERSION=' | grep -v '^YARN_VERSION=' > /tmp/esut-run.env
wc -l /tmp/esut-run.env

echo '== swap containers =='
if docker inspect "$OLD" >/dev/null 2>&1; then
  docker rm -f "$OLD"
fi
docker rename "$CONTAINER" "$OLD"
docker stop "$OLD"
docker run -d \
  --name "$CONTAINER" \
  --network "$NETWORK" \
  --restart unless-stopped \
  --env-file /tmp/esut-run.env \
  "$IMAGE"

echo '== wait health =='
ok=0
for i in $(seq 1 40); do
  st=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CONTAINER" 2>/dev/null || echo missing)
  echo "try $i status=$st"
  if [ "$st" = "healthy" ]; then
    ok=1
    break
  fi
  running=$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || echo false)
  if [ "$running" = "false" ]; then
    docker logs --tail 80 "$CONTAINER" || true
    break
  fi
  sleep 5
done

if [ "$ok" != "1" ]; then
  echo 'NEW CONTAINER UNHEALTHY - ROLLING BACK'
  docker rm -f "$CONTAINER" || true
  docker rename "$OLD" "$CONTAINER"
  docker start "$CONTAINER"
  exit 1
fi

docker rm -f "$OLD" || true
echo 'CUTOVER_OK'
docker ps --filter name="$CONTAINER" --format '{{.Names}} {{.Status}} {{.Image}}'
