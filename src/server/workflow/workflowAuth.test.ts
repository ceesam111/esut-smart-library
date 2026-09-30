import { describe, it, expect } from 'vitest';
import {
  canPerformAction,
  canCreateWorkflow,
  canListAllInstances,
  canManageTasks,
  canReassignTasks,
  canViewPrivateComments,
} from './workflowAuth';

const STUDENT = ['student'];
const LECTURER = ['researcher_lecturer'];
const LIBRARIAN = ['librarian'];
const FACULTY_LIBRARIAN = ['faculty_librarian'];
const SUPER_ADMIN = ['super_admin'];
const GUEST = ['guest'];

describe('workflowAuth', () => {
  describe('submitter actions', () => {
    it('lets the creator submit and resubmit', () => {
      expect(canPerformAction('submit', STUDENT, { isCreator: true }).allowed).toBe(true);
      expect(canPerformAction('resubmit', STUDENT, { isCreator: true }).allowed).toBe(true);
    });

    it('blocks a different student from submitting someone else’s work', () => {
      expect(canPerformAction('submit', STUDENT, { isCreator: false }).allowed).toBe(false);
    });

    it('lets the creator withdraw their own item', () => {
      expect(canPerformAction('withdraw', STUDENT, { isCreator: true }).allowed).toBe(true);
    });

    it('blocks the creator from approving their own item', () => {
      expect(canPerformAction('approve', STUDENT, { isCreator: true }).allowed).toBe(false);
    });
  });

  describe('reviewer actions', () => {
    it('lets librarians review, return and reject', () => {
      for (const action of ['approve', 'reject', 'return_for_correction', 'request_changes'] as const) {
        expect(canPerformAction(action, LIBRARIAN, { isCreator: false }).allowed).toBe(true);
      }
    });

    it('blocks students and lecturers from reviewing', () => {
      expect(canPerformAction('approve', STUDENT, { isCreator: false }).allowed).toBe(false);
      expect(canPerformAction('approve', LECTURER, { isCreator: false }).allowed).toBe(false);
      expect(canPerformAction('reject', STUDENT, { isCreator: false }).allowed).toBe(false);
    });

    it('grants claim/unclaim to reviewers only', () => {
      expect(canPerformAction('claim', FACULTY_LIBRARIAN, { isCreator: false }).allowed).toBe(true);
      expect(canPerformAction('claim', STUDENT, { isCreator: false }).allowed).toBe(false);
    });
  });

  describe('manager actions', () => {
    it('restricts publish to library managers', () => {
      expect(canPerformAction('publish', SUPER_ADMIN, { isCreator: false }).allowed).toBe(true);
      expect(canPerformAction('publish', LIBRARIAN, { isCreator: false }).allowed).toBe(true);
      expect(canPerformAction('publish', FACULTY_LIBRARIAN, { isCreator: false }).allowed).toBe(false);
      expect(canPerformAction('publish', STUDENT, { isCreator: false }).allowed).toBe(false);
    });

    it('restricts reassignment to library managers', () => {
      expect(canPerformAction('reassign', SUPER_ADMIN, { isCreator: false }).allowed).toBe(true);
      expect(canPerformAction('reassign', FACULTY_LIBRARIAN, { isCreator: false }).allowed).toBe(false);
    });
  });

  describe('role helpers', () => {
    it('treats an empty role list as unauthenticated', () => {
      expect(canCreateWorkflow([])).toBe(false);
      expect(canPerformAction('submit', [], { isCreator: true }).allowed).toBe(false);
    });

    it('refuses workflow creation to pure guests', () => {
      expect(canCreateWorkflow(GUEST)).toBe(false);
      expect(canCreateWorkflow(STUDENT)).toBe(true);
    });

    it('scopes full listing to reviewers and managers', () => {
      expect(canListAllInstances(STUDENT)).toBe(false);
      expect(canListAllInstances(LIBRARIAN)).toBe(true);
      expect(canListAllInstances(SUPER_ADMIN)).toBe(true);
    });

    it('keeps private notes and task management away from submitters', () => {
      expect(canViewPrivateComments(STUDENT)).toBe(false);
      expect(canManageTasks(STUDENT)).toBe(false);
      expect(canReassignTasks(STUDENT)).toBe(false);
      expect(canViewPrivateComments(LIBRARIAN)).toBe(true);
      expect(canManageTasks(LIBRARIAN)).toBe(true);
      expect(canReassignTasks(FACULTY_LIBRARIAN)).toBe(false);
      expect(canReassignTasks(SUPER_ADMIN)).toBe(true);
    });

    it('rejects unknown actions', () => {
      expect(canPerformAction('teleport' as never, SUPER_ADMIN, { isCreator: true }).allowed).toBe(false);
    });
  });
});
