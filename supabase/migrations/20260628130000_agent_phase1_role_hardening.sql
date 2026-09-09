create or replace function public.is_library_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(_user_id, array['super_admin','librarian','faculty_librarian','admin']);
$$;
