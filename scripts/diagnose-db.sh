#!/bin/bash
set -euo pipefail
DB='postgres://postgres.rnnjspkdhojoigncdgmy:pxO1ABR4PFyz2q80@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require'

echo '=== catalogue_items columns ==='
psql "$DB" -Atc "select column_name from information_schema.columns where table_schema='public' and table_name='catalogue_items' order by 1"

echo '=== repository_items columns ==='
psql "$DB" -Atc "select column_name from information_schema.columns where table_schema='public' and table_name='repository_items' order by 1"

echo '=== test anon vs publishable on rest root ==='
ANON=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' /tmp/esut-env-full.txt 2>/dev/null | cut -d= -f2- || true)
PUB=$(grep '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' /tmp/esut-env-full.txt 2>/dev/null | cut -d= -f2- || true)
if [ -z "${ANON:-}" ]; then
  ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubmpzcGtkaG9qb2lnbmNkZ215Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MTQ3NTEsImV4cCI6MjEwNDM5MDc1MX0.AQB1LBmLVuvMFT66ez-9LTLj5R8jofXhc5GGR8tKsBY'
fi
PUB='sb_publishable_g_qPBuwhIOs3Z3GJ66OZnw_ZgUvxWKP'
echo -n 'anon /rest/v1/ -> '
curl -sS -o /dev/null -w '%{http_code}\n' -H "apikey: $ANON" -H "Authorization: Bearer $ANON" https://rnnjspkdhojoigncdgmy.supabase.co/rest/v1/
echo -n 'pub  /rest/v1/ -> '
curl -sS -o /dev/null -w '%{http_code}\n' -H "apikey: $PUB" -H "Authorization: Bearer $PUB" https://rnnjspkdhojoigncdgmy.supabase.co/rest/v1/
echo -n 'anon /rest/v1/catalogue_items?select=id&limit=1 -> '
curl -sS -o /tmp/c.json -w '%{http_code}\n' -H "apikey: $ANON" -H "Authorization: Bearer $ANON" 'https://rnnjspkdhojoigncdgmy.supabase.co/rest/v1/catalogue_items?select=id&limit=1'
head -c 200 /tmp/c.json; echo

echo '=== counts ==='
psql "$DB" -Atc "select 'catalogue='||count(*) from catalogue_items"
psql "$DB" -Atc "select 'repository='||count(*) from repository_items"
