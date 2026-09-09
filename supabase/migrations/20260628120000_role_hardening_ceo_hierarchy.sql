alter table if exists public.user_roles
  add column if not exists super_admin_level text;

alter table if exists public.user_roles
  drop constraint if exists user_roles_super_admin_level_check;

alter table if exists public.user_roles
  add constraint user_roles_super_admin_level_check
  check (super_admin_level is null or super_admin_level in ('ceo', 'aceo'));

create or replace function public.is_library_account_manager(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and role in ('super_admin','librarian')
  );
$$;

create or replace function public.super_admin_level(_user_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select ur.super_admin_level from public.user_roles ur where ur.user_id = _user_id and ur.role = 'super_admin' limit 1),
    case when public.is_super_admin(_user_id) then 'ceo' else null end
  );
$$;

drop policy if exists user_roles_superadmin_all on public.user_roles;
create policy user_roles_superadmin_all on public.user_roles
  for all to authenticated
  using (
    public.is_super_admin(auth.uid())
    and (role <> 'super_admin' or public.super_admin_level(auth.uid()) = 'ceo')
  )
  with check (
    public.is_super_admin(auth.uid())
    and (role <> 'super_admin' or public.super_admin_level(auth.uid()) = 'ceo')
  );

drop policy if exists user_roles_select_account_managers on public.user_roles;
create policy user_roles_select_account_managers on public.user_roles
  for select to authenticated
  using (public.is_library_account_manager(auth.uid()));

drop policy if exists user_roles_librarian_manage_non_super on public.user_roles;
create policy user_roles_librarian_manage_non_super on public.user_roles
  for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'librarian')
    and role <> 'super_admin'
  );

drop policy if exists user_roles_librarian_delete_non_super on public.user_roles;
create policy user_roles_librarian_delete_non_super on public.user_roles
  for delete to authenticated
  using (
    public.has_role(auth.uid(), 'librarian')
    and role <> 'super_admin'
  );

drop policy if exists patrons_select_account_managers on public.patrons;
create policy patrons_select_account_managers on public.patrons
  for select to authenticated
  using (public.is_library_account_manager(auth.uid()));

drop policy if exists patrons_update_account_managers_non_super on public.patrons;
create policy patrons_update_account_managers_non_super on public.patrons
  for update to authenticated
  using (
    public.is_library_account_manager(auth.uid())
    and not exists (
      select 1 from public.user_roles ur
      where ur.user_id = patrons.user_id
        and ur.role = 'super_admin'
    )
  )
  with check (
    public.is_library_account_manager(auth.uid())
    and not exists (
      select 1 from public.user_roles ur
      where ur.user_id = patrons.user_id
        and ur.role = 'super_admin'
    )
  );

create or replace function public.prevent_self_patron_approval_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = old.user_id then
    if new.status is distinct from old.status
      or new.approved_at is distinct from old.approved_at
      or new.approved_by is distinct from old.approved_by
      or new.library_number is distinct from old.library_number then
      raise exception 'Patron approval fields cannot be changed by the patron.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_patron_approval_changes on public.patrons;
create trigger trg_prevent_self_patron_approval_changes
  before update on public.patrons
  for each row execute function public.prevent_self_patron_approval_changes();
