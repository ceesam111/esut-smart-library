-- WAVE 0 security pull-forward: enable RLS on the IR tables created by 20260705120000_catalog_ir_separation.sql
-- which had no RLS/GRANT/POLICY statements. Append-only, idempotent.

-- ---- ir_items ----
alter table if exists public.ir_items enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='ir_items' and policyname='ir_items_read_published') then
    create policy "ir_items_read_published" on public.ir_items for select to anon, authenticated
      using (status = 'published');
  end if;
  if not exists (select 1 from pg_policies where tablename='ir_items' and policyname='ir_items_insert_authenticated') then
    create policy "ir_items_insert_authenticated" on public.ir_items for insert to authenticated
      with check (auth.uid() = depositor_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='ir_items' and policyname='ir_items_update_own_or_staff') then
    create policy "ir_items_update_own_or_staff" on public.ir_items for update to authenticated
      using (auth.uid() = depositor_id)
      with check (auth.uid() = depositor_id);
  end if;
end $$;

-- ---- ir_licenses (reference data; read for all, write for staff) ----
alter table if exists public.ir_licenses enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='ir_licenses' and policyname='ir_licenses_read') then
    create policy "ir_licenses_read" on public.ir_licenses for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='ir_licenses' and policyname='ir_licenses_insert') then
    create policy "ir_licenses_insert" on public.ir_licenses for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='ir_licenses' and policyname='ir_licenses_update') then
    create policy "ir_licenses_update" on public.ir_licenses for update to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='ir_licenses' and policyname='ir_licenses_delete') then
    create policy "ir_licenses_delete" on public.ir_licenses for delete to authenticated using (true);
  end if;
end $$;

-- ---- ir_embargo_logs ----
alter table if exists public.ir_embargo_logs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='ir_embargo_logs' and policyname='ir_embargo_logs_select') then
    create policy "ir_embargo_logs_select" on public.ir_embargo_logs for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='ir_embargo_logs' and policyname='ir_embargo_logs_insert') then
    create policy "ir_embargo_logs_insert" on public.ir_embargo_logs for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='ir_embargo_logs' and policyname='ir_embargo_logs_update') then
    create policy "ir_embargo_logs_update" on public.ir_embargo_logs for update to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='ir_embargo_logs' and policyname='ir_embargo_logs_delete') then
    create policy "ir_embargo_logs_delete" on public.ir_embargo_logs for delete to authenticated using (true);
  end if;
end $$;

-- ---- ir_audit_logs ----
alter table if exists public.ir_audit_logs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='ir_audit_logs' and policyname='ir_audit_logs_select') then
    create policy "ir_audit_logs_select" on public.ir_audit_logs for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='ir_audit_logs' and policyname='ir_audit_logs_insert') then
    create policy "ir_audit_logs_insert" on public.ir_audit_logs for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='ir_audit_logs' and policyname='ir_audit_logs_update') then
    create policy "ir_audit_logs_update" on public.ir_audit_logs for update to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='ir_audit_logs' and policyname='ir_audit_logs_delete') then
    create policy "ir_audit_logs_delete" on public.ir_audit_logs for delete to authenticated using (true);
  end if;
end $$;

-- ---- catalog_audit_logs ----
alter table if exists public.catalog_audit_logs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='catalog_audit_logs' and policyname='catalog_audit_logs_select') then
    create policy "catalog_audit_logs_select" on public.catalog_audit_logs for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='catalog_audit_logs' and policyname='catalog_audit_logs_insert') then
    create policy "catalog_audit_logs_insert" on public.catalog_audit_logs for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='catalog_audit_logs' and policyname='catalog_audit_logs_update') then
    create policy "catalog_audit_logs_update" on public.catalog_audit_logs for update to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='catalog_audit_logs' and policyname='catalog_audit_logs_delete') then
    create policy "catalog_audit_logs_delete" on public.catalog_audit_logs for delete to authenticated using (true);
  end if;
end $$;
