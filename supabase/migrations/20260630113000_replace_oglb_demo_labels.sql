do $$
begin
  if to_regclass('public.tenants') is null then
    return;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tenants' and column_name = 'code') then
    execute $sql$update public.tenants set code = 'AFUED-DEMO' where lower(coalesce(code, '')) = 'oglb'$sql$;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tenants' and column_name = 'name') then
    execute $sql$update public.tenants set name = 'AFUED Demo Library' where lower(coalesce(name, '')) like '%oglb%' or lower(coalesce(name, '')) like '%ogun state library board%'$sql$;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tenants' and column_name = 'library_name') then
    execute $sql$update public.tenants set library_name = 'AFUED Demo Library' where lower(coalesce(library_name, '')) like '%oglb%' or lower(coalesce(library_name, '')) like '%ogun state library board%'$sql$;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tenants' and column_name = 'domain') then
    execute $sql$update public.tenants set domain = 'afuedlibrary.org.ng' where lower(coalesce(domain, '')) like '%oglb%'$sql$;
  end if;
end $$;
