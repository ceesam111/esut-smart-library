-- Recovery lookup used when a sign-up is interrupted by the email provider's
-- rate limit: the auth user exists but no patron profile was created yet.
-- Callable only by the service role; never exposed to anon/authenticated.
create or replace function public.auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select u.id from auth.users u where lower(u.email) = lower(p_email) limit 1;
$$;

revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;
