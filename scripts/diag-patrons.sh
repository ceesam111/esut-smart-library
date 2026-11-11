#!/bin/bash
set -euo pipefail
DB='postgres://postgres.rnnjspkdhojoigncdgmy:pxO1ABR4PFyz2q80@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require'

echo '=== patrons columns ==='
psql "$DB" -Atc "select column_name || ':' || data_type || case when is_nullable='NO' and column_default is null then ':NOTNULL' else '' end from information_schema.columns where table_name='patrons' order by ordinal_position"

echo '=== patrons RLS policies ==='
psql "$DB" -Atc "select policyname || ' | ' || cmd from pg_policies where tablename='patrons'"

echo '=== profile_photo / registration cols present? ==='
psql "$DB" -Atc "select 'profile_photo_url=' || count(*)::text from information_schema.columns where table_name='patrons' and column_name='profile_photo_url'"
psql "$DB" -Atc "select 'email_verified_at=' || count(*)::text from information_schema.columns where table_name='patrons' and column_name='email_verified_at'"
psql "$DB" -Atc "select 'registration_policy=' || count(*)::text from information_schema.columns where table_name='patrons' and column_name='registration_policy'"
psql "$DB" -Atc "select 'tenant_id=' || count(*)::text from information_schema.columns where table_name='patrons' and column_name='tenant_id'"
psql "$DB" -Atc "select 'branch_approved_at=' || count(*)::text from information_schema.columns where table_name='patrons' and column_name='branch_approved_at'"
psql "$DB" -Atc "select 'library_section=' || count(*)::text from information_schema.columns where table_name='patrons' and column_name='library_section'"
psql "$DB" -Atc "select 'professional_qualification=' || count(*)::text from information_schema.columns where table_name='patrons' and column_name='professional_qualification'"
psql "$DB" -Atc "select 'surname=' || count(*)::text from information_schema.columns where table_name='patrons' and column_name='surname'"

echo '=== recent patron inserts (last 5) ==='
psql "$DB" -Atc "select created_at::text || ' | ' || coalesce(email,'?') || ' | ' || coalesce(status,'?') || ' | ' || coalesce(account_role,'?') from patrons order by created_at desc limit 5"

echo '=== pending count ==='
psql "$DB" -Atc "select 'pending=' || count(*)::text from patrons where status='pending'"
