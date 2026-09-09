drop policy if exists loans_staff_insert_role_compat on public.loans;
create policy loans_staff_insert_role_compat on public.loans for insert to authenticated
  with check (public.is_library_admin(auth.uid()));

drop policy if exists loans_staff_update_role_compat on public.loans;
create policy loans_staff_update_role_compat on public.loans for update to authenticated
  using (public.is_library_admin(auth.uid()))
  with check (public.is_library_admin(auth.uid()));

drop policy if exists circulation_transactions_staff_insert_role_compat on public.circulation_transactions;
create policy circulation_transactions_staff_insert_role_compat on public.circulation_transactions for insert to authenticated
  with check (public.is_library_admin(auth.uid()));

drop policy if exists circulation_transactions_staff_select_role_compat on public.circulation_transactions;
create policy circulation_transactions_staff_select_role_compat on public.circulation_transactions for select to authenticated
  using (public.is_library_admin(auth.uid()));

drop policy if exists catalogue_copies_staff_manage_role_compat on public.catalogue_copies;
create policy catalogue_copies_staff_manage_role_compat on public.catalogue_copies for all to authenticated
  using (public.is_library_admin(auth.uid()))
  with check (public.is_library_admin(auth.uid()));
