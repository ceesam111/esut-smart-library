import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/server/supabase/adminClient', async () => {
  const { fakeDb } = await import('./fakeSupabase');
  return { getSupabaseAdminClient: () => fakeDb.client() };
});

import { fakeDb } from './fakeSupabase';
import {
  transitionWorkflow,
  claimTask,
  unclaimTask,
  reassignTask,
  addWorkflowComment,
  getWorkflowHistory,
  getWorkflowComments,
  createWorkflowInstance,
  listWorkflowInstances,
  listReviewerTasks,
} from './workflowService';

const STUDENT = ['student'];
const LIBRARIAN = ['librarian'];
const SUPER_ADMIN = ['super_admin'];

function seedInstance(overrides: Record<string, unknown> = {}) {
  fakeDb.seed('workflow_instances', [
    {
      id: 'wf-1',
      workflow_definition_id: 'def-1',
      repository_item_id: 'item-1',
      thesis_id: null,
      current_state: 'DRAFT',
      status: 'active',
      created_by: 'user-1',
      updated_at: new Date().toISOString(),
      ...overrides,
    },
  ]);
}

function instanceRow() {
  return fakeDb.rows('workflow_instances')[0];
}

describe('workflowService', () => {
  beforeEach(() => {
    fakeDb.reset();
  });

  describe('transitionWorkflow — happy paths', () => {
    it('moves DRAFT to SUBMITTED when the submitter submits', async () => {
      seedInstance();
      const result = await transitionWorkflow('wf-1', 'submit', 'user-1', { actorRoles: STUDENT });
      expect(result).toEqual({ success: true, newState: 'SUBMITTED' });
      expect(instanceRow().current_state).toBe('SUBMITTED');
      expect(instanceRow().status).toBe('active');
    });

    it('moves SUBMITTED to SUPERVISOR_REVIEW when a librarian approves', async () => {
      seedInstance({ current_state: 'SUBMITTED' });
      const result = await transitionWorkflow('wf-1', 'approve', 'reviewer-1', { actorRoles: LIBRARIAN });
      expect(result.success).toBe(true);
      expect(result.newState).toBe('SUPERVISOR_REVIEW');
    });

    it('moves SUPERVISOR_REVIEW to REJECTED on reject', async () => {
      seedInstance({ current_state: 'SUPERVISOR_REVIEW' });
      const result = await transitionWorkflow('wf-1', 'reject', 'reviewer-1', { actorRoles: LIBRARIAN });
      expect(result.newState).toBe('REJECTED');
      expect(instanceRow().status).toBe('rejected');
    });

    it('moves SUPERVISOR_REVIEW to RETURNED on return_for_correction', async () => {
      seedInstance({ current_state: 'SUPERVISOR_REVIEW' });
      const result = await transitionWorkflow('wf-1', 'return_for_correction', 'reviewer-1', {
        actorRoles: LIBRARIAN,
        comment: 'Chapter 3 needs data.',
      });
      expect(result.newState).toBe('RETURNED');
      expect(fakeDb.rows('workflow_comments')).toHaveLength(1);
      expect(fakeDb.rows('workflow_comments')[0].is_private).toBe(false);
    });

    it('moves RETURNED back to SUBMITTED on resubmit', async () => {
      seedInstance({ current_state: 'RETURNED' });
      const result = await transitionWorkflow('wf-1', 'resubmit', 'user-1', { actorRoles: STUDENT });
      expect(result.newState).toBe('SUBMITTED');
    });

    it('moves FINAL_APPROVAL to WITHDRAWN on withdraw by the submitter', async () => {
      seedInstance({ current_state: 'FINAL_APPROVAL' });
      const result = await transitionWorkflow('wf-1', 'withdraw', 'user-1', { actorRoles: STUDENT });
      expect(result.newState).toBe('WITHDRAWN');
      expect(instanceRow().status).toBe('withdrawn');
    });

    it('withdraws a published item (PUBLISHED is not terminal for withdrawal)', async () => {
      seedInstance({ current_state: 'PUBLISHED', status: 'completed' });
      const result = await transitionWorkflow('wf-1', 'withdraw', 'manager-1', { actorRoles: SUPER_ADMIN });
      expect(result.newState).toBe('WITHDRAWN');
    });

    it('publishes the linked repository item on publish', async () => {
      seedInstance({ current_state: 'FINAL_APPROVAL', repository_item_id: 'item-1' });
      fakeDb.seed('repository_items', [{ id: 'item-1', title: 'A', status: 'under_review' }]);

      const result = await transitionWorkflow('wf-1', 'publish', 'manager-1', {
        actorRoles: SUPER_ADMIN,
        repositoryItemId: 'item-1',
      });

      expect(result.newState).toBe('PUBLISHED');
      expect(instanceRow().status).toBe('completed');
      expect(fakeDb.rows('repository_items')[0].status).toBe('published');
    });
  });

  describe('transitionWorkflow — validation', () => {
    it('rejects an action that is not valid from the current state', async () => {
      seedInstance({ current_state: 'DRAFT' });
      const result = await transitionWorkflow('wf-1', 'approve', 'reviewer-1', { actorRoles: LIBRARIAN });
      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_ACTION');
    });

    it('rejects a transition that the state model does not allow', async () => {
      seedInstance({ current_state: 'DRAFT' });
      const result = await transitionWorkflow('wf-1', 'publish', 'manager-1', { actorRoles: SUPER_ADMIN });
      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_TRANSITION');
    });

    it('refuses to act on a terminal state', async () => {
      seedInstance({ current_state: 'REJECTED', status: 'active' });
      const result = await transitionWorkflow('wf-1', 'submit', 'user-1', { actorRoles: STUDENT });
      expect(result.success).toBe(false);
      expect(result.code).toBe('TERMINAL');
    });

    it('refuses to act on a closed instance', async () => {
      seedInstance({ current_state: 'SUBMITTED', status: 'withdrawn' });
      const result = await transitionWorkflow('wf-1', 'approve', 'reviewer-1', { actorRoles: LIBRARIAN });
      expect(result.success).toBe(false);
      expect(result.code).toBe('INACTIVE');
    });

    it('returns NOT_FOUND for an unknown instance', async () => {
      const result = await transitionWorkflow('missing', 'submit', 'user-1', { actorRoles: STUDENT });
      expect(result.code).toBe('NOT_FOUND');
    });

    it('routes claim/unclaim/assign to the task endpoints instead', async () => {
      seedInstance();
      const result = await transitionWorkflow('wf-1', 'claim', 'reviewer-1', { actorRoles: LIBRARIAN });
      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_ACTION');
    });
  });

  describe('transitionWorkflow — authorization', () => {
    it('forbids a student from approving', async () => {
      seedInstance({ current_state: 'SUBMITTED' });
      const result = await transitionWorkflow('wf-1', 'approve', 'user-1', { actorRoles: STUDENT });
      expect(result.code).toBe('FORBIDDEN');
    });

    it('forbids a student from publishing', async () => {
      seedInstance({ current_state: 'FINAL_APPROVAL' });
      const result = await transitionWorkflow('wf-1', 'publish', 'user-1', { actorRoles: STUDENT });
      expect(result.code).toBe('FORBIDDEN');
      expect(result.error).toMatch(/managers/i);
    });

    it('forbids a non-creator from submitting someone else’s workflow', async () => {
      seedInstance();
      const result = await transitionWorkflow('wf-1', 'submit', 'user-2', { actorRoles: STUDENT });
      expect(result.code).toBe('FORBIDDEN');
      expect(result.error).toMatch(/submitter/i);
    });

    it('resolves roles from the database when the caller does not pass them', async () => {
      seedInstance({ current_state: 'SUBMITTED' });
      fakeDb.seed('user_roles', [{ user_id: 'reviewer-1', role: 'librarian' }]);
      const result = await transitionWorkflow('wf-1', 'approve', 'reviewer-1');
      expect(result.success).toBe(true);
      expect(result.newState).toBe('SUPERVISOR_REVIEW');
    });
  });

  describe('transitionWorkflow — concurrency and history', () => {
    it('reports CONFLICT instead of overwriting a concurrent transition', async () => {
      seedInstance({ current_state: 'DRAFT' });
      fakeDb.beforeUpdate = (table) => {
        if (table !== 'workflow_instances') return;
        const row = fakeDb.rows('workflow_instances')[0];
        if (row && row.current_state === 'DRAFT') row.current_state = 'SUPERVISOR_REVIEW';
      };

      const result = await transitionWorkflow('wf-1', 'submit', 'user-1', { actorRoles: STUDENT });

      expect(result.success).toBe(false);
      expect(result.code).toBe('CONFLICT');
      expect(instanceRow().current_state).toBe('SUPERVISOR_REVIEW');
      expect(fakeDb.rows('workflow_actions')).toHaveLength(0);
    });

    it('records previous_state and new_state in history on success', async () => {
      seedInstance();
      await transitionWorkflow('wf-1', 'submit', 'user-1', { actorRoles: STUDENT });
      const history = await getWorkflowHistory('wf-1');
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        action: 'submit',
        previous_state: 'DRAFT',
        new_state: 'SUBMITTED',
        actor_id: 'user-1',
      });
    });

    it('writes no history when the transition is rejected', async () => {
      seedInstance({ current_state: 'SUBMITTED' });
      await transitionWorkflow('wf-1', 'approve', 'user-1', { actorRoles: STUDENT });
      expect(fakeDb.rows('workflow_actions')).toHaveLength(0);
      expect(instanceRow().current_state).toBe('SUBMITTED');
    });

    it('never updates or deletes history rows', async () => {
      seedInstance();
      await transitionWorkflow('wf-1', 'submit', 'user-1', { actorRoles: STUDENT });
      const historyWrites = fakeDb.log.filter(
        (entry) => entry.table === 'workflow_actions' && entry.op !== 'insert',
      );
      expect(historyWrites).toHaveLength(0);
    });

    it('rolls the state back if the history insert fails', async () => {
      seedInstance();
      fakeDb.failOnce('insert', 'workflow_actions', 'history write failed');

      const result = await transitionWorkflow('wf-1', 'submit', 'user-1', { actorRoles: STUDENT });

      expect(result.success).toBe(false);
      expect(result.code).toBe('INTERNAL');
      expect(instanceRow().current_state).toBe('DRAFT');
      expect(fakeDb.rows('workflow_actions')).toHaveLength(0);
    });
  });

  describe('transitionWorkflow — thesis integration', () => {
    it('marks a thesis published and writes the thesis audit trail', async () => {
      seedInstance({ current_state: 'FINAL_APPROVAL', repository_item_id: null, thesis_id: 'thesis-1' });
      fakeDb.seed('theses', [{ id: 'thesis-1', status: 'committee_review' }]);

      const result = await transitionWorkflow('wf-1', 'publish', 'manager-1', {
        actorRoles: SUPER_ADMIN,
        thesisId: 'thesis-1',
      });

      expect(result.newState).toBe('PUBLISHED');
      expect(fakeDb.rows('theses')[0].status).toBe('published');
      const trail = fakeDb.rows('thesis_workflow');
      expect(trail).toHaveLength(1);
      expect(trail[0]).toMatchObject({ thesis_id: 'thesis-1', stage: 'published', action: 'publish' });
    });

    it('returns a thesis to the student with the reviewer comment', async () => {
      seedInstance({ current_state: 'SUPERVISOR_REVIEW', repository_item_id: null, thesis_id: 'thesis-1' });
      fakeDb.seed('theses', [{ id: 'thesis-1', status: 'supervisor_review' }]);

      await transitionWorkflow('wf-1', 'return_for_correction', 'reviewer-1', {
        actorRoles: LIBRARIAN,
        thesisId: 'thesis-1',
        comment: 'Rewrite the literature review.',
      });

      const thesis = fakeDb.rows('theses')[0];
      expect(thesis.status).toBe('returned_to_student');
      expect(thesis.revision_notes).toBe('Rewrite the literature review.');
      expect(fakeDb.rows('thesis_workflow')[0].stage).toBe('returned_to_student');
    });
  });

  describe('transitionWorkflow — notifications', () => {
    it('notifies the submitter and not the actor', async () => {
      seedInstance({ current_state: 'SUPERVISOR_REVIEW', created_by: 'user-1' });
      await transitionWorkflow('wf-1', 'return_for_correction', 'reviewer-1', {
        actorRoles: LIBRARIAN,
        comment: 'Needs work',
      });

      const notifications = fakeDb.rows('user_notifications');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].user_id).toBe('user-1');
      expect(notifications[0].title).toMatch(/returned/i);
    });

    it('never notifies the actor about their own action', async () => {
      seedInstance({ current_state: 'SUBMITTED', created_by: 'reviewer-1' });
      await transitionWorkflow('wf-1', 'approve', 'reviewer-1', { actorRoles: LIBRARIAN });
      expect(fakeDb.rows('user_notifications')).toHaveLength(0);
    });
  });

  describe('claim / unclaim / reassign', () => {
    function seedTask(overrides: Record<string, unknown> = {}) {
      fakeDb.seed('workflow_tasks', [
        {
          id: 'task-1',
          workflow_instance_id: 'wf-1',
          status: 'pending',
          assigned_to: 'reviewer-1',
          claimed_by: null,
          claimed_at: null,
          ...overrides,
        },
      ]);
    }

    it('lets a librarian claim a pending task', async () => {
      seedTask();
      const result = await claimTask('task-1', 'reviewer-1', LIBRARIAN);
      expect(result.success).toBe(true);
      expect(fakeDb.rows('workflow_tasks')[0]).toMatchObject({ status: 'claimed', claimed_by: 'reviewer-1' });
    });

    it('reports CONFLICT when the task is already claimed', async () => {
      seedTask({ status: 'claimed', claimed_by: 'someone-else' });
      const result = await claimTask('task-1', 'reviewer-1', LIBRARIAN);
      expect(result.success).toBe(false);
      expect(result.code).toBe('CONFLICT');
    });

    it('refuses to let a student claim a task', async () => {
      seedTask();
      const result = await claimTask('task-1', 'reviewer-1', STUDENT);
      expect(result.code).toBe('FORBIDDEN');
    });

    it('returns NOT_FOUND for an unknown task', async () => {
      const result = await claimTask('nope', 'reviewer-1', LIBRARIAN);
      expect(result.code).toBe('NOT_FOUND');
    });

    it('lets the holder unclaim their own task', async () => {
      seedTask({ status: 'claimed', claimed_by: 'reviewer-1' });
      const result = await unclaimTask('task-1', 'reviewer-1', LIBRARIAN);
      expect(result.success).toBe(true);
      expect(fakeDb.rows('workflow_tasks')[0]).toMatchObject({ status: 'pending', claimed_by: null });
    });

    it('blocks unclaiming a task you do not hold', async () => {
      seedTask({ status: 'claimed', claimed_by: 'other' });
      const result = await unclaimTask('task-1', 'reviewer-1', LIBRARIAN);
      expect(result.code).toBe('CONFLICT');
    });

    it('lets a manager reassign and notifies the new holder', async () => {
      seedTask();
      const result = await reassignTask('task-1', 'reviewer-1', 'reviewer-2', SUPER_ADMIN);
      expect(result.success).toBe(true);
      expect(fakeDb.rows('workflow_tasks')[0].assigned_to).toBe('reviewer-2');
      expect(fakeDb.rows('user_notifications')[0].user_id).toBe('reviewer-2');
    });

    it('lets a manager reassign a claimed task that was never assigned', async () => {
      seedTask({ assigned_to: null, status: 'claimed', claimed_by: 'reviewer-1' });
      const result = await reassignTask('task-1', 'reviewer-1', 'reviewer-2', SUPER_ADMIN);
      expect(result.success).toBe(true);
      expect(fakeDb.rows('workflow_tasks')[0]).toMatchObject({ assigned_to: 'reviewer-2', claimed_by: null });
    });

    it('blocks reassigning a task held by somebody else', async () => {
      seedTask({ assigned_to: null, status: 'claimed', claimed_by: 'someone-else' });
      const result = await reassignTask('task-1', 'reviewer-1', 'reviewer-2', SUPER_ADMIN);
      expect(result.code).toBe('CONFLICT');
    });

    it('blocks reassignment by a non-manager', async () => {
      seedTask();
      const result = await reassignTask('task-1', 'reviewer-1', 'reviewer-2', ['faculty_librarian']);
      expect(result.code).toBe('FORBIDDEN');
    });
  });

  describe('comments', () => {
    it('lets library staff write an internal note', async () => {
      const comment = await addWorkflowComment('wf-1', 'reviewer-1', 'internal only', true, LIBRARIAN);
      expect(comment.is_private).toBe(true);
      expect(fakeDb.rows('workflow_comments')).toHaveLength(1);
    });

    it('blocks a student from writing an internal note', async () => {
      await expect(addWorkflowComment('wf-1', 'user-1', 'internal only', true, STUDENT)).rejects.toThrow(
        /library staff/i,
      );
      expect(fakeDb.rows('workflow_comments')).toHaveLength(0);
    });

    it('hides private notes from submitters', async () => {
      fakeDb.seed('workflow_comments', [
        { id: 'c1', workflow_instance_id: 'wf-1', body: 'public', is_private: false, created_at: '1' },
        { id: 'c2', workflow_instance_id: 'wf-1', body: 'private', is_private: true, created_at: '2' },
      ]);
      const visible = await getWorkflowComments('wf-1', false);
      expect(visible.map((c) => c.id)).toEqual(['c1']);
    });

    it('shows private notes to library staff', async () => {
      fakeDb.seed('workflow_comments', [
        { id: 'c1', workflow_instance_id: 'wf-1', body: 'public', is_private: false, created_at: '1' },
        { id: 'c2', workflow_instance_id: 'wf-1', body: 'private', is_private: true, created_at: '2' },
      ]);
      const visible = await getWorkflowComments('wf-1', true);
      expect(visible).toHaveLength(2);
    });
  });

  describe('createWorkflowInstance', () => {
    it('requires a repository item or a thesis', async () => {
      await expect(createWorkflowInstance({ createdBy: 'user-1', actorRoles: STUDENT })).rejects.toThrow(
        /repository item or a thesis/i,
      );
    });

    it('returns the existing active instance instead of creating a duplicate', async () => {
      seedInstance({ thesis_id: 'thesis-1' });
      const id = await createWorkflowInstance({ createdBy: 'user-1', thesisId: 'thesis-1', actorRoles: STUDENT });
      expect(id).toBe('wf-1');
      expect(fakeDb.rows('workflow_instances')).toHaveLength(1);
    });

    it('creates a DRAFT instance against the default definition', async () => {
      fakeDb.seed('workflow_definitions', [
        { id: 'def-thesis', resource_type: 'thesis', is_default: true, is_active: true },
      ]);
      const id = await createWorkflowInstance({ createdBy: 'user-1', thesisId: 'thesis-9', actorRoles: STUDENT });
      expect(id).toBeTruthy();
      const created = fakeDb.rows('workflow_instances')[0];
      expect(created).toMatchObject({
        current_state: 'DRAFT',
        status: 'active',
        thesis_id: 'thesis-9',
        workflow_definition_id: 'def-thesis',
      });
    });

    it('refuses a guest from starting a workflow', async () => {
      await expect(
        createWorkflowInstance({ createdBy: 'user-1', thesisId: 'thesis-9', actorRoles: ['guest'] }),
      ).rejects.toThrow(/not allowed/i);
    });
  });

  describe('listing', () => {
    it('scopes non-staff to the instances they created', async () => {
      seedInstance({ created_by: 'user-1' });
      fakeDb.seed('workflow_instances', [
        { id: 'wf-2', current_state: 'DRAFT', status: 'active', created_by: 'user-2', repository_item_id: 'item-2' },
      ]);

      const mine = await listWorkflowInstances({ createdBy: 'user-1', actorRoles: STUDENT });
      const staff = await listWorkflowInstances({ createdBy: 'user-1', actorRoles: LIBRARIAN });

      expect(mine).toHaveLength(1);
      expect(staff).toHaveLength(2);
    });

    it('returns no reviewer queue to a student', async () => {
      fakeDb.seed('workflow_tasks', [
        { id: 'task-1', workflow_instance_id: 'wf-1', status: 'pending', assigned_to: 'reviewer-1' },
      ]);
      const tasks = await listReviewerTasks('user-1', STUDENT);
      expect(tasks).toHaveLength(0);
    });

    it('returns only your own tasks to a reviewer and every task to a manager', async () => {
      fakeDb.seed('workflow_tasks', [
        { id: 'task-1', workflow_instance_id: 'wf-1', status: 'pending', assigned_to: 'reviewer-1' },
        { id: 'task-2', workflow_instance_id: 'wf-2', status: 'pending', assigned_to: 'reviewer-2' },
      ]);
      const mine = await listReviewerTasks('reviewer-1', ['faculty_librarian']);
      const all = await listReviewerTasks('reviewer-1', SUPER_ADMIN);
      expect(mine).toHaveLength(1);
      expect(all).toHaveLength(2);
    });

    it('shows unassigned work to a reviewer whose role matches the task', async () => {
      fakeDb.seed('workflow_tasks', [
        {
          id: 'task-1',
          workflow_instance_id: 'wf-1',
          status: 'pending',
          assigned_to: null,
          assigned_role: 'faculty_librarian',
        },
        { id: 'task-2', workflow_instance_id: 'wf-2', status: 'pending', assigned_to: null, assigned_role: 'ir_admin' },
      ]);
      const reviewerQueue = await listReviewerTasks('reviewer-1', ['faculty_librarian']);
      expect(reviewerQueue.map((task) => task.id)).toEqual(['task-1']);
    });
  });

  describe('reviewer task lifecycle', () => {
    it('opens a pending reviewer task as soon as the submission is submitted', async () => {
      seedInstance();

      const result = await transitionWorkflow('wf-1', 'submit', 'user-1', { actorRoles: STUDENT });

      expect(result.success).toBe(true);
      const tasks = fakeDb.rows('workflow_tasks');
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        workflow_instance_id: 'wf-1',
        status: 'pending',
        assigned_to: null,
        claimed_by: null,
      });
    });

    it('never leaves more than one open task across several stages', async () => {
      seedInstance();
      fakeDb.seed('workflow_steps', [
        { id: 'step-1', workflow_definition_id: 'def-1', order_index: 0, required_role: 'librarian' },
      ]);

      await transitionWorkflow('wf-1', 'submit', 'user-1', { actorRoles: STUDENT });
      await transitionWorkflow('wf-1', 'approve', 'reviewer-1', { actorRoles: LIBRARIAN });
      await transitionWorkflow('wf-1', 'approve', 'reviewer-1', { actorRoles: LIBRARIAN });

      const open = fakeDb
        .rows('workflow_tasks')
        .filter((task) => task.status === 'pending' || task.status === 'claimed');
      expect(open).toHaveLength(1);
      expect(open[0].workflow_step_id).toBe('step-1');
      expect(open[0].assigned_role).toBe('librarian');
    });

    it('completes the open task when the submission is withdrawn', async () => {
      seedInstance({ current_state: 'FINAL_APPROVAL' });
      fakeDb.seed('workflow_tasks', [
        { id: 'task-9', workflow_instance_id: 'wf-1', status: 'pending', assigned_to: null },
      ]);

      const result = await transitionWorkflow('wf-1', 'withdraw', 'user-1', { actorRoles: STUDENT });

      expect(result.success).toBe(true);
      expect(fakeDb.rows('workflow_tasks')[0]).toMatchObject({
        status: 'completed',
        completed_at: expect.any(String),
      });
    });

    it('keeps an already claimed task open instead of duplicating it', async () => {
      seedInstance({ current_state: 'SUBMITTED' });
      fakeDb.seed('workflow_tasks', [
        { id: 'task-5', workflow_instance_id: 'wf-1', status: 'claimed', claimed_by: 'reviewer-1' },
      ]);

      await transitionWorkflow('wf-1', 'approve', 'reviewer-1', { actorRoles: LIBRARIAN });

      expect(fakeDb.rows('workflow_tasks')).toHaveLength(1);
      expect(fakeDb.rows('workflow_tasks')[0]).toMatchObject({ status: 'claimed', claimed_by: 'reviewer-1' });
    });
  });
});
