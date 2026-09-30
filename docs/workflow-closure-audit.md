# Workflow Closure Audit — ESUT Smart Library

Date: 2026-09-30 · Batch: 6 · Baseline commit: `dacbeed` · Closure commit: see `git log`

## Before Batch 6

### Schema
Six tables existed in migrations (`20260930030000_workflow_engine.sql`) but **were never applied to the hosted database**, and the schema itself could not represent the product:

- `workflow_instances.repository_item_id` was `NOT NULL` with no thesis link — theses could not enter the engine.
- `workflow_actions.action` CHECK had no `resubmit` / `unclaim`.
- `workflow_instances.status` allowed only `active|completed|withdrawn|rejected`, so `PUBLISHED` had nowhere to live.
- No active `workflow_definitions` / `workflow_steps` seeds — `createWorkflowInstance` always failed with "No active … definition".

### Service
- No transactional update: state, history, task, and item status could diverge.
- No optimistic locking — two reviewers could approve the same item.
- No authorization layer; role checks were ad hoc.
- No thesis sync; no notifications; no comments; no queue/task creation (**nothing ever inserted a `workflow_tasks` row**, so the reviewer queue could never be non-empty).
- No API routes; no submitter/reviewer/admin UI.

### Verification
- 0 workflow tests.

## After Batch 6

### Schema — applied to the hosted DB
Migration `20260930060000_workflow_engine_closure.sql` applied after `20260930030000_workflow_engine.sql` (both run against the live database via `psql`, exit 0):

| Check | Result |
|---|---|
| Workflow tables | `workflow_actions,workflow_comments,workflow_definitions,workflow_instances,workflow_steps,workflow_tasks` |
| Seed definitions / steps | 2 / 9 |
| `workflow_actions_action_check` | includes `resubmit`, `unclaim` |
| `workflow_instances_target_check` | `(repository_item_id IS NOT NULL) OR (thesis_id IS NOT NULL)` |
| Indexes `idx_workflow%` | 8 |

### Service
- **Conditional commit point** — `.eq('id').eq('current_state', seen)`; zero rows ⇒ `CONFLICT`, history written only after the state moves, compensating rollback if it fails.
- **Authorization** — pure, unit-tested rules in `workflowAuth.ts` (`canPerformAction`, `canCreateWorkflow`, `canListAllInstances`, `canViewPrivateComments`, `canManageTasks`, `canReassignTasks`); role resolution via `getUserRoles()`.
- **Thesis sync** — `theses.status` + `thesis_workflow` audit row on every transition; `repository_items.status` sync on publish/withdraw.
- **Reviewer task lifecycle** — exactly one open task per instance in a review state; completed when the workflow returns, rejects, withdraws, or publishes; `assigned_role` derived from `workflow_steps.required_role`; role-aware queue scoping for non-managers.
- **Comments** — reviewer/submitter comments with `is_private` internal notes mirrored from transition comments.
- **Notifications** — `user_notifications` rows for the submitter and open assignees, never the actor, never fatal.

### API (all Bearer-authenticated)
`GET/POST /api/workflows`, `GET /api/workflows/[id]`, `POST …/transition`, `GET/POST …/tasks`, `GET/POST …/comments`, `GET …/history`.
Status mapping: 401 auth · 403 role · 404 missing or out-of-scope · 409 stale state · 422 invalid action.

### UI
| Route | Role |
|---|---|
| `/dashboard/workflows` | Submitter list |
| `/dashboard/workflows/:id` | Submitter detail, progress timeline, submit/resubmit/withdraw, comments |
| `/admin/workflows` | Reviewer claim queue + all workflows |
| `/admin/workflows/:id` | Approve / return with required notes / reject / publish / reassign / internal notes |

Nav entries added to `DashboardLayout` ("My Submissions") and `AdminLayout` ("Submission Workflows").

### Integration
- `ThesisSubmit.tsx` → `POST /api/workflows {resourceType:'thesis', thesisId, submit:true}` (non-fatal).
- `RepositorySubmit.tsx` → `POST /api/workflows {resourceType:'repository', repositoryItemId, submit:true}` (non-fatal).
- `supervisor/Theses.tsx` → *Approve* / *Return* also fire `approve` / `return_for_correction` at the instance (non-fatal).

### Verification
| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Workflow tests | 65 passed / 0 failed (51 service + 14 authorization) |
| Full test suite | 275 passed / 55 files / 0 failed |
| `next build` | exit 0, all six `/api/workflows/**` routes registered |
| ESLint on Batch 6 files | 0 errors, 13 warnings (`no-explicit-any` in the test double) |
| Live DB | migrations applied and verified by `information_schema` / `pg_constraint` queries |

## Closed gaps
- Transactional/concurrent transitions, authorization, UI for all three audiences, thesis integration, comments, notifications, task queue, API endpoints, tests.

## Known gaps / follow-ups
1. **`theses` insert contract is broken** — the table requires `patron_id`, `degree`, `department`, `supervisor`, `year` (all `NOT NULL`, no defaults) but `ThesisSubmit.tsx` sends `programme`, `session`, `submission_type`, `submitter_id` and `patron_id: null`. Any thesis submission fails at the database until either the form or the columns are reconciled. Workflow start for theses cannot be exercised live until this is fixed.
2. **Batch 5 DB migrations were never applied** — `repository_files`, `repository_files_version`, `preservation_*`, `oai_test_data` are absent from the hosted database (0 rows for `repository_versions` / `repository_files`).
3. RLS on the six workflow tables is closed to authenticated users by design; all access goes through the API.
4. Reassignment takes a raw user id (no user picker).
5. One thesis pipeline and one repository pipeline are seeded; per-faculty variants are not modelled.
6. Legacy `src/views/**` (a stale duplicate of `src/app-pages/**`) still fails lint with parser errors — pre-existing, outside this batch.
