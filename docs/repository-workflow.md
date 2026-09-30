# Repository Workflow Engine

Batch 6 closure — the review workflow that runs every thesis and repository deposit through supervised approval.

## Model

Six tables (`supabase/migrations/20260930030000_workflow_engine.sql`, extended by `20260930060000_workflow_engine_closure.sql`):

| Table | Purpose |
|---|---|
| `workflow_definitions` | Named pipeline (`thesis`, `repository`) with a title |
| `workflow_steps` | Ordered stages inside a definition |
| `workflow_instances` | One active review run per `thesis_id` **or** `repository_item_id` |
| `workflow_actions` | Append-only audit of every action taken |
| `workflow_tasks` | Reviewer queue rows (pending / claimed / completed) |
| `workflow_comments` | Reviewer and submitter comments (`is_private` for internal notes) |

`workflow_instances.status` stores lifecycle (`active` / `completed` / `withdrawn` / `rejected`), `current_state` stores the pipeline stage:

```
DRAFT → SUBMITTED → SUPERVISOR_REVIEW → DEPARTMENT_REVIEW → FACULTY_REVIEW
      → LIBRARY_METADATA_REVIEW → COPYRIGHT_REVIEW → FINAL_APPROVAL → PUBLISHED
```

Off-ramps: `RETURNED` (back to submitter), `REJECTED`, `WITHDRAWN`. Terminal states are `REJECTED` and `WITHDRAWN`.

## State machine

Defined in `src/server/workflow/workflowService.ts`:

- `CHAIN` — the ordered stage progression above.
- `VALID_TRANSITIONS` — allowed actions per current state (`submit`, `resubmit`, `approve`, `return_for_correction`, `reject`, `publish`, `withdraw`).
- `STATE_ACTIONS` — which action is required to leave each state, so `publish` can only fire from `FINAL_APPROVAL`.
- `TERMINAL_STATES` — after `REJECTED` / `WITHDRAWN` no further action is accepted.
- `BLOCKED_INSTANCE_STATUSES` — an instance whose row `status` is `rejected` or `withdrawn` refuses transitions even if `current_state` still looks open.

## Concurrency

Every transition is a **conditional update**:

```ts
.update({ current_state: next, status: statusForState(next) })
.eq('id', instanceId)
.eq('current_state', currentState)   // optimistic lock
.select('id')
```

Zero rows → `CONFLICT` ("This submission changed while you were reviewing it") and nothing is written. History and task updates are written only after that commit point; if a later insert fails the history row is compensated so the instance never claims an action that was not audited.

## Authorization

`requireUser()` returns only `{ id, email }` — roles are resolved separately by `getUserRoles(userId)` (`user_roles` + `patrons`), falling back to `guest`.

Pure rules in `src/server/workflow/workflowAuth.ts`:

| Rule | Roles |
|---|---|
| `WORKFLOW_REVIEWER_ROLES` — approve / return / reject | `super_admin`, `catalog_admin`, `ir_admin`, `dept_ir_officer`, `librarian`, `faculty_librarian` |
| `WORKFLOW_MANAGER_ROLES` — publish / reassign / see all | `super_admin`, `catalog_admin`, `ir_admin`, `librarian` |
| `canCreateWorkflow` | signed-in user, and only for their own thesis / deposit |
| `canViewPrivateComments` | reviewer or manager |
| `canReassignTasks` | manager |

Mismatch between caller and required role returns **403**, missing instance **404**, optimistic-lock clash **409**, unknown action **422**.

Workflow tables have **no authenticated RLS policies**. Every read/write goes through the API using the service-role client, so the UI can never bypass these checks.

## API

| Route | Method | Purpose |
|---|---|---|
| `/api/workflows` | GET | List — staff see all, others only their own; `?state=`, `?status=`, `?thesisId=`, `?repositoryItemId=` |
| `/api/workflows` | POST | Create instance (`thesisId` or `repositoryItemId`, `submit: true` to enter the chain immediately) |
| `/api/workflows/[id]` | GET | Instance + joined tasks and definition (scoped) |
| `/api/workflows/[id]/transition` | POST | `submit`, `resubmit`, `approve`, `return_for_correction`, `reject`, `publish`, `withdraw`, `claim`, `unclaim`, `reassign` |
| `/api/workflows/[id]/tasks` | GET | Reviewer queue (managers see all pending) |
| `/api/workflows/[id]/tasks` | POST | `claim` / `unclaim` |
| `/api/workflows/[id]/comments` | GET / POST | Comments; `is_private` requires reviewer/manager |
| `/api/workflows/[id]/history` | GET | Audit trail (scoped) |

All routes require `Authorization: Bearer <supabase access token>`.

## UI

| Route | Audience |
|---|---|
| `/dashboard/workflows` | Submitter — their submissions and stages |
| `/dashboard/workflows/:id` | Submitter — progress timeline, comments, submit / resubmit / withdraw |
| `/admin/workflows` | Reviewers — claim queue + all workflows |
| `/admin/workflows/:id` | Reviewers — approve, return with required notes, reject, publish, reassign, internal notes |

Components: `src/app-pages/WorkflowDashboard.tsx`, `src/app-pages/dashboard/Workflows.tsx`, `src/app-pages/admin/Workflows.tsx`.

## Integration

- `src/app-pages/ThesisSubmit.tsx` — after the `theses` insert it posts `{resourceType:'thesis', thesisId, submit:true}`.
- `src/app-pages/RepositorySubmit.tsx` — after the `repository_items` insert it posts `{resourceType:'repository', repositoryItemId, submit:true}`.
- `src/app-pages/supervisor/Theses.tsx` — *Approve* / *Return for revisions* also fires `approve` / `return_for_correction` at the workflow instance.

Both client calls are **non-fatal**: a failed workflow start logs a warning and the deposit still succeeds.

## Side effects of a transition

1. `workflow_actions` audit row.
2. `workflow_tasks` created / completed for the next stage.
3. `workflow_comments` mirror when a comment is supplied.
4. Thesis state sync — `theses.status` plus an inserted `thesis_workflow` row (the supervisor portal reads these).
5. Repository state sync — `repository_items.status`.
6. `user_notifications` rows for reviewers and the submitter (never for the actor, never fatal).

## Tests

`src/server/workflow/workflowService.test.ts` (46) + `src/server/workflow/workflowAuth.test.ts` (14) = **60 tests**, running against `fakeSupabase.ts` — an in-memory PostgREST double with conditional-update semantics, failure injection, and statement logging so race conditions and authorization paths are exercised without a database.

Full suite: **270 tests / 55 files, 0 failures.**

## Known limitations

- Reassignment is by user id (no user picker yet).
- RLS on the six workflow tables remains closed to authenticated users by design; enabling direct table reads would need per-table policies.
- The seeded `workflow_definitions` cover a single thesis pipeline and a single repository pipeline; per-faculty variants are not modelled.
