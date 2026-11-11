#!/bin/bash
set -euo pipefail
DB='postgres://postgres.rnnjspkdhojoigncdgmy:pxO1ABR4PFyz2q80@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require'

echo '=== insert policies full definition ==='
psql "$DB" -Atc "select policyname || E'\n  cmd=' || cmd || E'\n  roles=' || array_to_string(roles, ',') || E'\n  qual=' || coalesce(qual::text,'-') || E'\n  with_check=' || coalesce(with_check::text,'-') || E'\n---' from pg_policies where tablename='patrons' and cmd='INSERT'"

echo '=== auth config: email confirmations ==='
psql "$DB" -Atc "select id || ' | ' || coalesce((raw_app_meta_data->>'provider'),'?') from auth.users limit 0"
curl -sS -o /tmp/sbconf.json -w 'auth config http=%{http_code}\n' "https://rnnjspkdhojoigncdgmy.supabase.co/auth/v1/settings" -H "apikey: sb_publishable_g_qPBuwhIOs3Z3GJ66OZnw_ZgUvxWKP"
head -c 400 /tmp/sbconf.json; echo
