alter table public.reservations
  add column if not exists request_type text not null default 'reserve',
  add column if not exists loan_id uuid null references public.loans(id) on delete set null,
  add column if not exists approved_by uuid null references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz null,
  add column if not exists admin_note text null;

update public.fines set status = 'unpaid' where status = 'outstanding';

alter table public.reservations
  drop constraint if exists reservations_request_type_check;

alter table public.reservations
  add constraint reservations_request_type_check
  check (request_type in ('reserve', 'borrow', 'return'));

insert into public.app_settings(key, value, description)
values (
  'circulation_rules',
  '{"reservation_expiry_days":7,"undergraduate_loan_days":14,"postgraduate_loan_days":30,"academic_staff_loan_days":90,"non_academic_staff_loan_days":21,"default_loan_days":14,"fine_rate_per_day":50,"fine_grace_days":0,"fine_max_amount":0,"fines_suspended":false}'::jsonb,
  'Editable circulation rules for reservation expiry and loan periods.'
)
on conflict (key) do nothing;

drop policy if exists settings_staff_select on public.app_settings;
create policy settings_staff_select on public.app_settings for select to authenticated
  using (public.is_library_staff(auth.uid()) or exists (select 1 from public.librarians where user_id = auth.uid() and is_active = true));

drop policy if exists settings_staff_update on public.app_settings;
create policy settings_staff_update on public.app_settings for update to authenticated
  using (public.is_library_staff(auth.uid()) or exists (select 1 from public.librarians where user_id = auth.uid() and is_active = true))
  with check (public.is_library_staff(auth.uid()) or exists (select 1 from public.librarians where user_id = auth.uid() and is_active = true));

create or replace function public.get_circulation_rules()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select value from public.app_settings where key = 'circulation_rules'),
    '{"reservation_expiry_days":7,"default_loan_days":14,"fine_rate_per_day":50,"fine_grace_days":0,"fine_max_amount":0,"fines_suspended":false}'::jsonb
  );
$$;

create or replace function public.calculate_loan_fine(loan_due_date timestamptz, as_of timestamptz default now())
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rules jsonb := public.get_circulation_rules();
  v_days int;
  v_amount numeric;
  v_max numeric := coalesce((v_rules->>'fine_max_amount')::numeric, 0);
begin
  if coalesce((v_rules->>'fines_suspended')::boolean, false) then
    return 0;
  end if;

  v_days := greatest(ceil(extract(epoch from (as_of - loan_due_date)) / 86400)::int - coalesce((v_rules->>'fine_grace_days')::int, 0), 0);
  v_amount := v_days * coalesce((v_rules->>'fine_rate_per_day')::numeric, 50);
  if v_max > 0 then
    v_amount := least(v_amount, v_max);
  end if;
  return greatest(v_amount, 0);
end;
$$;

create or replace function public.create_catalogue_item_request(item_id uuid, request_action text)
returns table(reservation_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patron_id uuid;
  v_request_type text := lower(coalesce(request_action, 'reserve'));
  v_expiry_days int := coalesce((public.get_circulation_rules()->>'reservation_expiry_days')::int, 7);
  v_expiry timestamptz := now() + make_interval(days => v_expiry_days);
  v_active_loan uuid;
  v_reservation_id uuid;
begin
  if v_request_type not in ('reserve', 'borrow', 'return') then
    raise exception 'Unsupported catalogue request type.';
  end if;

  update public.reservations
  set status = 'expired', updated_at = now()
  where status = 'pending' and expiry_date < now();

  select id into v_patron_id from public.patrons where user_id = auth.uid() limit 1;
  if v_patron_id is null then
    raise exception 'No patron profile found for the signed-in user.';
  end if;

  if not exists (select 1 from public.catalogue_items where id = item_id) then
    raise exception 'Catalogue item not found.';
  end if;

  if v_request_type = 'return' then
    select id into v_active_loan
    from public.loans
    where patron_id = v_patron_id and catalogue_item_id = item_id and status = 'active'
    order by checkout_date desc
    limit 1;
    if v_active_loan is null then
      raise exception 'No active loan found for this item on your account.';
    end if;
  elsif exists (
    select 1 from public.reservations
    where patron_id = v_patron_id and catalogue_item_id = item_id and status in ('pending','ready_for_collection') and request_type in ('reserve','borrow')
  ) then
    raise exception 'You already have an open request for this item.';
  end if;

  insert into public.reservations (
    patron_id, catalogue_item_id, reservation_date, expiry_date, status, priority, request_type, loan_id
  ) values (
    v_patron_id, item_id, now(), v_expiry, 'pending', 1, v_request_type, v_active_loan
  ) returning id into v_reservation_id;

  reservation_id := v_reservation_id;
  expires_at := v_expiry;
  return next;
end;
$$;

create or replace function public.process_catalogue_item_request(request_id uuid, request_action text, note text default null)
returns table(reservation_id uuid, status text, loan_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.reservations%rowtype;
  v_days int;
  v_due timestamptz;
  v_loan_id uuid;
  v_fine numeric;
  v_title text;
begin
  if not (public.is_library_staff(auth.uid()) or exists (select 1 from public.librarians where user_id = auth.uid() and is_active = true)) then
    raise exception 'Library staff access required.';
  end if;

  update public.reservations
  set status = 'expired', updated_at = now()
  where status = 'pending' and expiry_date < now();

  select * into v_request
  from public.reservations
  where id = request_id
  for update;

  if not found then
    raise exception 'Request not found.';
  end if;

  if lower(request_action) = 'cancel' then
    update public.reservations set status = 'cancelled', admin_note = note, updated_at = now() where id = request_id;
  elsif v_request.request_type = 'reserve' and lower(request_action) = 'approve' then
    update public.reservations set status = 'ready_for_collection', approved_by = auth.uid(), approved_at = now(), admin_note = note, updated_at = now() where id = request_id;
  elsif v_request.request_type in ('reserve', 'borrow') and lower(request_action) in ('approve','fulfill','loan') then
    if coalesce((select available_copies from public.catalogue_items where id = v_request.catalogue_item_id), 0) <= 0 then
      raise exception 'No copies are currently available to loan.';
    end if;
    v_days := coalesce((public.get_circulation_rules()->>'default_loan_days')::int, 14);
    v_due := now() + make_interval(days => v_days);
    insert into public.loans(patron_id, catalogue_item_id, checkout_date, due_date, status)
    values (v_request.patron_id, v_request.catalogue_item_id, now(), v_due, 'active')
    returning id into v_loan_id;
    update public.catalogue_items set available_copies = greatest(coalesce(available_copies, 0) - 1, 0) where id = v_request.catalogue_item_id;
    update public.reservations set status = 'fulfilled', loan_id = v_loan_id, approved_by = auth.uid(), approved_at = now(), admin_note = note, updated_at = now() where id = request_id;
  elsif v_request.request_type = 'return' and lower(request_action) in ('approve','fulfill','return') then
    select public.calculate_loan_fine(due_date, now()) into v_fine from public.loans where id = v_request.loan_id;
    update public.loans set status = 'returned', return_date = now(), updated_at = now() where id = v_request.loan_id and status = 'active';
    update public.catalogue_items set available_copies = coalesce(available_copies, 0) + 1 where id = v_request.catalogue_item_id;
    select title into v_title from public.catalogue_items where id = v_request.catalogue_item_id;
    if coalesce(v_fine, 0) > 0 then
      insert into public.fines(patron_id, amount, reason, reference_type, reference_id, status)
      values (v_request.patron_id, v_fine, 'Overdue fine - ' || coalesce(v_title, 'library item'), 'loan', v_request.loan_id, 'unpaid')
      on conflict do nothing;
    end if;
    update public.reservations set status = 'fulfilled', approved_by = auth.uid(), approved_at = now(), admin_note = note, updated_at = now() where id = request_id;
  else
    raise exception 'Unsupported staff action for this request.';
  end if;

  select r.id, r.status, r.loan_id into reservation_id, status, loan_id
  from public.reservations r where r.id = request_id;
  return next;
end;
$$;

revoke all on function public.create_catalogue_item_request(uuid, text) from public;
grant execute on function public.create_catalogue_item_request(uuid, text) to authenticated;
revoke all on function public.process_catalogue_item_request(uuid, text, text) from public;
grant execute on function public.process_catalogue_item_request(uuid, text, text) to authenticated;
revoke all on function public.get_circulation_rules() from public;
grant execute on function public.get_circulation_rules() to authenticated;
revoke all on function public.calculate_loan_fine(timestamptz, timestamptz) from public;
grant execute on function public.calculate_loan_fine(timestamptz, timestamptz) to authenticated;

drop policy if exists fines_staff_all on public.fines;
create policy fines_staff_all on public.fines for all to authenticated
  using (public.is_library_staff(auth.uid()) or exists (select 1 from public.librarians where user_id = auth.uid() and is_active = true))
  with check (public.is_library_staff(auth.uid()) or exists (select 1 from public.librarians where user_id = auth.uid() and is_active = true));

drop policy if exists reservations_insert_policy on public.reservations;
create policy reservations_insert_policy on public.reservations for insert to authenticated
  with check (patron_id in (select id from public.patrons where user_id = auth.uid()));
