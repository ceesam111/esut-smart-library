#!/bin/bash
set -euo pipefail
IP=$(docker inspect esut-app-new -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
echo "container_ip=$IP"

echo '=== health via container ==='
curl -sS -o /tmp/h.json -w 'HTTP %{http_code}\n' "http://$IP:3000/api/health"
cat /tmp/h.json; echo

echo '=== routes via container ==='
for p in / /subscribed-databases /open-access-databases; do
  code=$(curl -sS -o /tmp/p.html -w '%{http_code}' "http://$IP:3000$p")
  bytes=$(wc -c < /tmp/p.html)
  echo "$p -> $code (${bytes}B)"
done

echo '=== public routes ==='
curl -sSk -o /dev/null -w 'home %{http_code}\n' https://virtuallibrary.esut.edu.ng/
curl -sSk -o /tmp/sub_pub.html -w 'subscribed %{http_code}\n' https://virtuallibrary.esut.edu.ng/subscribed-databases
curl -sSk -o /tmp/oa_pub.html -w 'open-access %{http_code}\n' https://virtuallibrary.esut.edu.ng/open-access-databases
curl -sSk -o /dev/null -w 'health %{http_code}\n' https://virtuallibrary.esut.edu.ng/api/health

echo '=== built asset markers (client bundle) ==='
docker exec esut-app-new sh -c '
  echo -n "Subscribed Databases: "; grep -RIl "Subscribed Databases" .next/static 2>/dev/null | wc -l
  echo -n "Research4Life/Hinari: "; grep -RIl "Hinari" .next/static 2>/dev/null | wc -l
  echo -n "WhatsApp 2348039473344: "; grep -RIl "2348039473344" .next/static 2>/dev/null | wc -l
  echo -n "OPAC lbrarika: "; grep -RIl "esutlibrary.librarika.com" .next/static 2>/dev/null | wc -l
  echo -n "Open Access Databases: "; grep -RIl "Open Access Databases" .next/static 2>/dev/null | wc -l
  echo -n "DOAJ: "; grep -RIl "DOAJ" .next/static 2>/dev/null | wc -l
'

echo '=== route ids in HTML ==='
grep -oE 'subscribed-databases|open-access-databases' /tmp/sub_pub.html | sort | uniq -c || true
grep -oE 'subscribed-databases|open-access-databases' /tmp/oa_pub.html | sort | uniq -c || true

echo '=== OPAC ==='
curl -sSk -o /dev/null -w 'opac %{http_code}\n' -L --max-time 20 https://esutlibrary.librarika.com || echo 'opac_unreachable'

echo '=== prev leftover ==='
docker ps -a --filter name=esut-app-new-prev --format '{{.Names}}' || true

echo '=== images ==='
docker images --format '{{.Repository}}:{{.Tag}} {{.CreatedSince}}' | grep esut-smart-library || true

echo VERIFY_DONE
