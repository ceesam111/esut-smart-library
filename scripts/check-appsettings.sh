#!/bin/bash
set -euo pipefail
DB='postgres://postgres.rnnjspkdhojoigncdgmy:pxO1ABR4PFyz2q80@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require'

chmod 600 /root/esut-extra.env
echo -n 'extra keys: '
grep -c '=' /root/esut-extra.env

echo '=== app_settings columns ==='
psql "$DB" -Atc "select column_name || ':' || data_type from information_schema.columns where table_name='app_settings' order by ordinal_position"
echo '=== app_settings unique indexes ==='
psql "$DB" -Atc "select indexdef from pg_indexes where tablename='app_settings' and indexdef like '%UNIQUE%'"
echo '=== library_manual exists? ==='
psql "$DB" -Atc "select count(*) from app_settings where key='library_manual'"
