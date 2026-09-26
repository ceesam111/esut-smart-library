-- Fix reservations RLS so super admins / library staff can see and approve
-- reservations even when they have no active `librarians` row (issue 22).
-- The original policies (20260620202651) only checked the `librarians` table.

drop policy if exists "reservations_select_policy" on public.reservations;
create policy "reservations_select_policy" on public.reservations for select
  to authenticated
  using (
    exists (select 1 from patrons where patrons.user_id = auth.uid() and patrons.id = reservations.patron_id)
    or exists (select 1 from librarians where user_id = auth.uid() and is_active = true)
    or public.is_library_staff(auth.uid())
  );

drop policy if exists "reservations_update_policy" on public.reservations;
create policy "reservations_update_policy" on public.reservations for update
  to authenticated
  using (
    exists (select 1 from librarians where user_id = auth.uid() and is_active = true)
    or public.is_library_staff(auth.uid())
  )
  with check (
    exists (select 1 from librarians where user_id = auth.uid() and is_active = true)
    or public.is_library_staff(auth.uid())
  );
