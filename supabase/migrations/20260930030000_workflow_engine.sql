-- BATCH 6: Repository workflow engine
create table if not exists public.workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  collection_id uuid references public.repository_collections(id) on delete cascade,
  resource_type text not null default 'thesis',
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_definition_id uuid not null references public.workflow_definitions(id) on delete cascade,
  name text not null,
  description text,
  order_index int not null,
  required_role text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_instances (
  id uuid primary key default gen_random_uuid(),
  workflow_definition_id uuid not null references public.workflow_definitions(id),
  repository_item_id uuid not null references public.repository_items(id) on delete cascade,
  current_state text not null default 'DRAFT',
  status text not null default 'active' check (status in ('active', 'completed', 'withdrawn', 'rejected')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_tasks (
  id uuid primary key default gen_random_uuid(),
  workflow_instance_id uuid not null references public.workflow_instances(id) on delete cascade,
  workflow_step_id uuid references public.workflow_steps(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_role text,
  status text not null default 'pending' check (status in ('pending', 'claimed', 'completed', 'rejected', 'returned')),
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_actions (
  id uuid primary key default gen_random_uuid(),
  workflow_instance_id uuid not null references public.workflow_instances(id) on delete cascade,
  workflow_task_id uuid references public.workflow_tasks(id) on delete set null,
  action text not null check (action in ('submit', 'claim', 'assign', 'approve', 'reject', 'return_for_correction', 'request_changes', 'reassign', 'withdraw', 'publish')),
  actor_id uuid references auth.users(id) on delete set null,
  previous_state text,
  new_state text,
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_comments (
  id uuid primary key default gen_random_uuid(),
  workflow_instance_id uuid not null references public.workflow_instances(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_workflow_instances_item on public.workflow_instances(repository_item_id);
create index if not exists idx_workflow_tasks_instance on public.workflow_tasks(workflow_instance_id);
create index if not exists idx_workflow_actions_instance on public.workflow_actions(workflow_instance_id);

alter table public.workflow_definitions enable row level security;
alter table public.workflow_steps enable row level security;
alter table public.workflow_instances enable row level security;
alter table public.workflow_tasks enable row level security;
alter table public.workflow_actions enable row level security;
alter table public.workflow_comments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='workflow_instances' and policyname='workflow_service_all') then
    create policy "workflow_service_all" on public.workflow_instances for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='workflow_tasks' and policyname='workflow_tasks_service_all') then
    create policy "workflow_tasks_service_all" on public.workflow_tasks for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='workflow_actions' and policyname='workflow_actions_service_all') then
    create policy "workflow_actions_service_all" on public.workflow_actions for all to service_role using (true) with check (true);
  end if;
end $$;
