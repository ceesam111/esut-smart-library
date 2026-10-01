/**
 * Live workflow end-to-end check against the hosted Supabase project.
 *
 * It creates its own fixture users, repository item and workflow instance,
 * drives the real `workflowService` through the full review chain, asserts the
 * database side effects, and removes every fixture row it created.
 *
 * Run: node_modules\.bin\tsx.cmd scripts/e2e-workflow-live.ts
 * Flags: --keep (leave fixtures behind for manual inspection)
 */
/* eslint-disable no-console -- CLI diagnostic tool: its printed report is the deliverable. */
import { loadDotEnv } from './demo-seed-lib';
import { randomUUID } from 'node:crypto';

loadDotEnv();

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

function check(name: string, ok: boolean, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -- ${detail}` : ''}`);
}

function assert(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  check(name, ok, ok ? `got ${JSON.stringify(actual)}` : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const KEEP = process.argv.includes('--keep');
const stamp = Date.now();
const submitterEmail = `e2e.submitter.${stamp}@esut.test`;
const reviewerEmail = `e2e.reviewer.${stamp}@esut.test`;
const secondReviewerEmail = `e2e.reviewer2.${stamp}@esut.test`;
const fixtureTitle = `E2E FIXTURE ${stamp}`;

async function main() {
  const { getSupabaseAdminClient } = await import('../src/server/supabase/adminClient');
  const workflow = await import('../src/server/workflow/workflowService');
  const supabase = getSupabaseAdminClient();

  // ---------------------------------------------------------------- fixtures
  const users: { label: string; email: string; id: string; role: string }[] = [];
  const createUser = async (label: string, email: string, role: string) => {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      password: `E2e!${randomUUID().replace(/-/g, '')}`,
    });
    if (error || !data.user) throw new Error(`could not create ${label}: ${error?.message}`);
    const id = data.user.id;
    const { error: roleError } = await supabase.from('user_roles').insert({ user_id: id, role });
    if (roleError) throw new Error(`could not grant ${role} to ${label}: ${roleError.message}`);
    users.push({ label, email, id, role });
    return id;
  };

  const cleanup = async (reason: string) => {
    if (KEEP) {
      console.log(`\n--keep set; fixtures retained (${reason}).`);
      return;
    }
    const { data: items } = await supabase
      .from('repository_items')
      .select('id')
      .eq('title', fixtureTitle);
    for (const item of items ?? []) {
      const { data: instances } = await supabase
        .from('workflow_instances')
        .select('id')
        .eq('repository_item_id', item.id);
      for (const instance of instances ?? []) {
        await supabase.from('workflow_tasks').delete().eq('workflow_instance_id', instance.id);
        await supabase.from('workflow_actions').delete().eq('workflow_instance_id', instance.id);
        await supabase.from('workflow_comments').delete().eq('workflow_instance_id', instance.id);
      }
      await supabase.from('workflow_instances').delete().eq('repository_item_id', item.id);
      await supabase.from('repository_items').delete().eq('id', item.id);
    }
    for (const user of users) {
      await supabase.from('user_notifications').delete().eq('user_id', user.id);
      await supabase.from('user_roles').delete().eq('user_id', user.id);
      await supabase.auth.admin.deleteUser(user.id);
    }
    const { data: leftovers } = await supabase
      .from('repository_items')
      .select('id')
      .eq('title', fixtureTitle);
    check('cleanup: no fixture rows remain', (leftovers ?? []).length === 0, `${(leftovers ?? []).length} left`);
  };

  let instanceId = '';
  let itemId = '';
  try {
    // ------------------------------------------------------------- 1. actors
    const submitterId = await createUser('submitter', submitterEmail, 'student');
    const reviewerId = await createUser('reviewer', reviewerEmail, 'librarian');
    const secondReviewerId = await createUser('second reviewer', secondReviewerEmail, 'faculty_librarian');
    check('fixture users created with roles', users.length === 3);

    // -------------------------------------------------------------- 2. item
    const { data: item, error: itemError } = await supabase
      .from('repository_items')
      .insert({
        title: fixtureTitle,
        authors: ['E2E Fixture'],
        type: 'Article',
        status: 'submitted',
        year: 2026,
        submitter_id: submitterId,
        visibility: 'private',
      })
      .select('id')
      .single();
    if (itemError || !item) throw new Error(`could not insert fixture item: ${itemError?.message}`);
    itemId = item.id;

    // ------------------------------------------------------- 3. start workflow
    instanceId = await workflow.createWorkflowInstance({
      createdBy: submitterId,
      repositoryItemId: itemId,
      actorRoles: ['student'],
    });
    check('createWorkflowInstance returned an id', !!instanceId, instanceId);

    const duplicateId = await workflow.createWorkflowInstance({
      createdBy: submitterId,
      repositoryItemId: itemId,
      actorRoles: ['student'],
    });
    check('createWorkflowInstance is idempotent', duplicateId === instanceId, `${duplicateId}`);

    let instance = await supabase.from('workflow_instances').select('*').eq('id', instanceId).single();
    assert('instance starts in DRAFT/active', {
      state: instance.data?.current_state,
      status: instance.data?.status,
    }, { state: 'DRAFT', status: 'active' });

    // -------------------------------------------------------------- 4. submit
    const submitResult = await workflow.transitionWorkflow(instanceId, 'submit', submitterId, {
      actorRoles: ['student'],
      comment: 'E2E submission.',
    });
    check('submit transitions DRAFT -> SUBMITTED', submitResult.success && submitResult.newState === 'SUBMITTED', JSON.stringify(submitResult));

    const { data: tasksAfterSubmit } = await supabase
      .from('workflow_tasks')
      .select('id, status')
      .eq('workflow_instance_id', instanceId);
    assert('one open review task exists after submit', {
      total: (tasksAfterSubmit ?? []).length,
      open: (tasksAfterSubmit ?? []).filter((t) => t.status === 'pending' || t.status === 'claimed').length,
    }, { total: 1, open: 1 });

    // ------------------------------------------------- 5. authorization guard
    const forbidden = await workflow.transitionWorkflow(instanceId, 'approve', submitterId, {
      actorRoles: ['student'],
    });
    check('submitter cannot approve their own item', !forbidden.success && forbidden.code === 'FORBIDDEN', JSON.stringify(forbidden));

    // ----------------------------------------------------- 6. single winner
    const race = await Promise.all([
      workflow.transitionWorkflow(instanceId, 'approve', reviewerId, { actorRoles: ['librarian'] }),
      workflow.transitionWorkflow(instanceId, 'approve', reviewerId, { actorRoles: ['librarian'] }),
    ]);
    const winners = race.filter((r) => r.success);
    const losers = race.filter((r) => !r.success);
    check(
      'concurrent approval keeps exactly one winner',
      winners.length === 1 && losers.length === 1 && ['CONFLICT', 'INVALID_TRANSITION'].includes(losers[0].code ?? ''),
      JSON.stringify(race.map((r) => ({ success: r.success, code: r.code, state: r.newState }))),
    );

    instance = await supabase.from('workflow_instances').select('*').eq('id', instanceId).single();
    const reached = instance.data?.current_state;
    check('state advanced exactly one step despite two approvals', reached === 'SUPERVISOR_REVIEW', `state=${reached}`);

    // ------------------------------------------------------- 7. claim/reassign
    const { data: openTask } = await supabase
      .from('workflow_tasks')
      .select('id')
      .eq('workflow_instance_id', instanceId)
      .in('status', ['pending', 'claimed'])
      .maybeSingle();
    if (openTask) {
      const claimed = await workflow.claimTask(openTask.id, reviewerId, ['librarian']);
      check('reviewer can claim the open task', claimed.success, JSON.stringify(claimed));
      const reassigned = await workflow.reassignTask(openTask.id, reviewerId, secondReviewerId, ['librarian']);
      check('manager can reassign the claimed task', reassigned.success, JSON.stringify(reassigned));
      const { data: afterReassign } = await supabase
        .from('workflow_tasks')
        .select('assigned_to, claimed_by, status')
        .eq('id', openTask.id)
        .maybeSingle();
      assert('task points at the new reviewer', {
        assigned_to: afterReassign?.assigned_to,
        claimed_by: afterReassign?.claimed_by,
      }, { assigned_to: secondReviewerId, claimed_by: null });
      const notMine = await workflow.reassignTask(openTask.id, reviewerId, submitterId, ['librarian']);
      check('reassignment by a non-holder reports CONFLICT', !notMine.success && notMine.code === 'CONFLICT', JSON.stringify(notMine));
    } else {
      check('open task available for claim/reassign', false, 'no task row found');
    }

    // ------------------------------------------------- 8. run the full chain
    // The hosted REST endpoint occasionally drops a socket mid-call, and the
    // service moves state before its side effects. Re-read the row before
    // deciding whether a transient INTERNAL actually blocked the step.
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const readState = async (): Promise<{ state: string; status: string }> => {
      const { data } = await supabase
        .from('workflow_instances')
        .select('current_state, status')
        .eq('id', instanceId)
        .maybeSingle();
      return { state: String(data?.current_state ?? ''), status: String(data?.status ?? '') };
    };
    const transient = (r: { code?: string; error?: string }): boolean =>
      r.code === 'INTERNAL' && /fetch failed|socket|ECONNRESET/i.test(r.error ?? '');

    const chain = [
      'DEPARTMENT_REVIEW',
      'FACULTY_REVIEW',
      'LIBRARY_METADATA_REVIEW',
      'COPYRIGHT_REVIEW',
      'FINAL_APPROVAL',
      'PUBLISHED',
    ];
    for (const expected of chain) {
      let advanced = false;
      let lastResult = '';
      for (let attempt = 0; attempt < 4 && !advanced; attempt++) {
        const before = await readState();
        if (before.state === expected) { advanced = true; lastResult = 'already-there'; break; }
        const result = await workflow.transitionWorkflow(instanceId, 'approve', secondReviewerId, {
          actorRoles: ['faculty_librarian'],
        });
        lastResult = JSON.stringify(result);
        const after = await readState();
        if (after.state === expected) { advanced = true; break; }
        if (!transient(result)) break;
        await sleep(500 * (attempt + 1));
      }
      check(`approve advances to ${expected}`, advanced, lastResult);

      const row = await readState();
      assert(`instance row reflects ${expected}`, {
        state: row.state,
        status: row.status,
      }, {
        state: expected,
        status: expected === 'PUBLISHED' ? 'completed' : 'active',
      });

      const expectedOpen = expected === 'PUBLISHED' ? 0 : 1;
      let openLen = -1;
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data: open } = await supabase
          .from('workflow_tasks')
          .select('id')
          .eq('workflow_instance_id', instanceId)
          .in('status', ['pending', 'claimed']);
        openLen = (open ?? []).length;
        if (openLen === expectedOpen) break;
        await sleep(400);
      }
      assert(`${expected}: open task count`, openLen, expectedOpen);
    }

    const { data: syncedItem } = await supabase
      .from('repository_items')
      .select('status')
      .eq('id', itemId)
      .maybeSingle();
    assert('repository item status synced to published', syncedItem?.status, 'published');

    const { data: history } = await supabase
      .from('workflow_actions')
      .select('action, previous_state, new_state')
      .eq('workflow_instance_id', instanceId)
      .order('created_at', { ascending: true });
    assert('history rows recorded', (history ?? []).length, 8);

    // ---------------------------------------------------- 9. terminal guards
    const afterPublish = await workflow.transitionWorkflow(instanceId, 'approve', secondReviewerId, {
      actorRoles: ['faculty_librarian'],
    });
    check('no approval step exists after PUBLISHED', !afterPublish.success, JSON.stringify(afterPublish));

    const badPublish = await workflow.transitionWorkflow(instanceId, 'publish', reviewerId, {
      actorRoles: ['librarian'],
    });
    check('re-publishing a published item is rejected', !badPublish.success && badPublish.code === 'INVALID_TRANSITION', JSON.stringify(badPublish));

    const unknownActor = await workflow.transitionWorkflow('00000000-0000-0000-0000-000000000000', 'approve', reviewerId, {
      actorRoles: ['librarian'],
    });
    check('unknown instance reports NOT_FOUND', !unknownActor.success && unknownActor.code === 'NOT_FOUND', JSON.stringify(unknownActor));
  } catch (error) {
    check('end-to-end run completed without an exception', false, error instanceof Error ? error.message : String(error));
  } finally {
    await cleanup('run finished');
    const { data: stillThere } = await supabase
      .from('workflow_instances')
      .select('id')
      .eq('repository_item_id', itemId || 'none');
    if (!KEEP) {
      check('cleanup: no workflow instances remain', (stillThere ?? []).length === 0, `${(stillThere ?? []).length} left`);
      const { data: usersLeft } = await supabase.auth.admin.listUsers();
      const leaked = (usersLeft?.users ?? []).filter((u) =>
        [submitterEmail, reviewerEmail, secondReviewerEmail].includes(u.email ?? ''),
      );
      check('cleanup: no fixture users remain', leaked.length === 0, `${leaked.length} left`);
    }
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`instance=${instanceId} item=${itemId}`);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.name}${f.detail ? ` -- ${f.detail}` : ''}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
