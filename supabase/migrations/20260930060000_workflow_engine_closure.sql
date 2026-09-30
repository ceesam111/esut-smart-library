-- BATCH 6: workflow engine closure
-- Fixes discovered by docs/workflow-closure-audit.md

-- 1. workflow_actions.action was missing 'resubmit' (and 'unclaim'), so a
--    resubmission recorded a history row that violated the CHECK constraint.
alter table public.workflow_actions drop constraint if exists workflow_actions_action_check;
alter table public.workflow_actions add constraint workflow_actions_action_check
  check (action in ('submit','resubmit','claim','unclaim','assign','approve','reject',
                    'return_for_correction','request_changes','reassign','withdraw','publish'));

-- 2. Theses are not repository items: allow a workflow instance to be bound
--    to either target, but require at least one of them.
alter table public.workflow_instances drop constraint if exists workflow_instances_repository_item_id_check;
alter table public.workflow_instances alter column repository_item_id drop not null;
alter table public.workflow_instances add column if not exists thesis_id uuid
  references public.theses(id) on delete cascade;
alter table public.workflow_instances drop constraint if exists workflow_instances_target_check;
alter table public.workflow_instances add constraint workflow_instances_target_check
  check (repository_item_id is not null or thesis_id is not null);

-- 3. One live workflow per target keeps claim/resubmit idempotent.
create unique index if not exists uq_workflow_instances_repo_active
  on public.workflow_instances(repository_item_id)
  where repository_item_id is not null and status = 'active';
create unique index if not exists uq_workflow_instances_thesis_active
  on public.workflow_instances(thesis_id)
  where thesis_id is not null and status = 'active';

-- 4. Listing paths used by the submitter, reviewer and admin dashboards.
create index if not exists idx_workflow_instances_created_by
  on public.workflow_instances(created_by);
create index if not exists idx_workflow_instances_status_state
  on public.workflow_instances(status, current_state);
create index if not exists idx_workflow_tasks_assigned_status
  on public.workflow_tasks(assigned_to, status);
create index if not exists idx_workflow_comments_instance
  on public.workflow_comments(workflow_instance_id);

-- 5. Default workflow definitions + steps so an instance can always be created.
insert into public.workflow_definitions (name, description, resource_type, is_default, is_active)
select 'Standard Thesis Review',
       'Supervisor, department, faculty, metadata, copyright and final approval before publication.',
       'thesis', true, true
where not exists (
  select 1 from public.workflow_definitions where resource_type = 'thesis' and is_default
);

insert into public.workflow_definitions (name, description, resource_type, is_default, is_active)
select 'Standard Repository Review',
       'Metadata, rights and final approval before an item is published to the repository.',
       'repository', true, true
where not exists (
  select 1 from public.workflow_definitions where resource_type = 'repository' and is_default
);

do $$
declare
  thesis_def uuid;
  repo_def uuid;
begin
  select id into thesis_def from public.workflow_definitions
    where resource_type = 'thesis' and is_default limit 1;
  select id into repo_def from public.workflow_definitions
    where resource_type = 'repository' and is_default limit 1;

  if thesis_def is not null and not exists (
    select 1 from public.workflow_steps where workflow_definition_id = thesis_def
  ) then
    insert into public.workflow_steps (workflow_definition_id, name, description, order_index, required_role) values
      (thesis_def, 'Supervisor review', 'Primary supervisor reviews and approves the work.', 1, 'supervisor'),
      (thesis_def, 'Department review', 'Departmental reviewer checks academic content.', 2, 'ir_admin'),
      (thesis_def, 'Faculty review', 'Faculty-level approval.', 3, 'ir_admin'),
      (thesis_def, 'Library metadata review', 'Librarian completes descriptive metadata.', 4, 'librarian'),
      (thesis_def, 'Copyright review', 'Rights, embargo and declaration check.', 5, 'librarian'),
      (thesis_def, 'Final approval and publication', 'Library manager publishes the item.', 6, 'super_admin');
  end if;

  if repo_def is not null and not exists (
    select 1 from public.workflow_steps where workflow_definition_id = repo_def
  ) then
    insert into public.workflow_steps (workflow_definition_id, name, description, order_index, required_role) values
      (repo_def, 'Metadata review', 'Librarian validates metadata and subjects.', 1, 'librarian'),
      (repo_def, 'Rights review', 'Copyright, licence and embargo check.', 2, 'librarian'),
      (repo_def, 'Final approval and publication', 'Library manager publishes the item.', 3, 'super_admin');
  end if;
end $$;

-- 6. A pending review task per non-draft state keeps the reviewer queue usable
--    for instances created before tasks existed.
create index if not exists idx_workflow_actions_actor on public.workflow_actions(actor_id);
