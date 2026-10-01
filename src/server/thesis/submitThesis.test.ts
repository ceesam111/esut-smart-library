import { describe, it, expect } from 'vitest';
import {
  buildReferenceNo,
  deriveDegree,
  deriveYearFromSession,
  mapSupervisorRole,
  submitThesis,
  type ThesisSubmissionInput,
} from './submitThesis';
import { FakeSupabase } from '@/server/workflow/fakeSupabase';

const USER_ID = 'user-1';
const PATRON_ID = 'patron-1';

function baseInput(overrides: Partial<ThesisSubmissionInput> = {}): ThesisSubmissionInput {
  return {
    title: 'Digital Library Adoption in South-East Nigeria',
    abstract: 'A'.repeat(140),
    submissionType: 'Undergraduate Long Essay',
    programme: 'B.Ed. English',
    session: '2025/2026',
    faculty: 'Faculty of Education',
    keywords: ['library', 'adoption', 'digital'],
    subjects: ['Education'],
    supervisors: [
      { name: 'Dr. A. Okonkwo', email: 'a.okonkwo@esut.edu.ng', role: 'primary' },
      { name: 'Dr. B. Eze', email: 'b.eze@esut.edu.ng', role: 'secondary' },
    ],
    ...overrides,
  };
}

function setup() {
  const db = new FakeSupabase();
  db.seed('patrons', [
    { id: PATRON_ID, user_id: USER_ID, department: 'Arts Education', programme: 'B.Ed. English' },
  ]);
  return db;
}

describe('submitThesis', () => {
  it('creates a thesis with every field the database requires', async () => {
    const db = setup();
    const workflowCalls: string[] = [];

    const result = await submitThesis(baseInput(), {
      userId: USER_ID,
      supabase: db.client(),
      startWorkflow: async (id) => {
        workflowCalls.push(id);
        // Mirror what the real workflow does to the thesis row.
        db.table('theses').forEach((row) => {
          if (row.id === id) row.status = 'submitted';
        });
        return { started: true };
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const theses = db.rows('theses');
    expect(theses).toHaveLength(1);
    const thesis = theses[0];
    expect(thesis.patron_id).toBe(PATRON_ID);
    expect(thesis.degree).toBe('B.Ed.');
    expect(thesis.department).toBe('Arts Education');
    expect(thesis.supervisor).toBe('Dr. A. Okonkwo');
    expect(thesis.year).toBe(2026);
    expect(thesis.submission_type).toBe('Undergraduate Long Essay');
    expect(thesis.submitter_id).toBe(USER_ID);
    expect(thesis.status).toBe('submitted');
    expect(thesis.faculty).toBe('Faculty of Education');
    expect(thesis.subjects).toEqual(['Education']);
    expect(thesis.embargo_enabled).toBe(false);
    expect(result.referenceNo).toMatch(/^ULE-2026-\d{5}$/);
    expect(workflowCalls).toEqual([result.thesisId]);

    const supervisors = db.rows('thesis_supervisors');
    expect(supervisors).toHaveLength(2);
    expect(supervisors.map((s) => s.role)).toEqual(['primary', 'second']);
    expect(supervisors.every((s) => s.supervisor_email)).toBe(true);
  });

  it('rejects the submission when the account has no patron profile', async () => {
    const db = new FakeSupabase();

    const result = await submitThesis(baseInput(), {
      userId: USER_ID,
      supabase: db.client(),
      startWorkflow: async () => ({ started: true }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('PATRON_MISSING');
    expect(db.rows('theses')).toHaveLength(0);
  });

  it('rejects the submission when no supervisor is named', async () => {
    const db = setup();

    const result = await submitThesis(baseInput({ supervisors: [{ name: '   ', email: '' }] }), {
      userId: USER_ID,
      supabase: db.client(),
      startWorkflow: async () => ({ started: true }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('SUPERVISOR_MISSING');
    expect(db.rows('theses')).toHaveLength(0);
  });

  it('rejects a supervisor without an email address', async () => {
    const db = setup();

    const result = await submitThesis(
      baseInput({ supervisors: [{ name: 'Dr. A. Okonkwo', email: '', role: 'primary' }] }),
      { userId: USER_ID, supabase: db.client(), startWorkflow: async () => ({ started: true }) },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('SUPERVISOR_EMAIL_MISSING');
    expect(db.rows('theses')).toHaveLength(0);
  });

  it('rejects missing degree and programme data', async () => {
    const noProgramme = setup();
    const programmeResult = await submitThesis(baseInput({ programme: '  ' }), {
      userId: USER_ID,
      supabase: noProgramme.client(),
      startWorkflow: async () => ({ started: true }),
    });
    expect(programmeResult.ok).toBe(false);
    if (!programmeResult.ok) expect(programmeResult.code).toBe('PROGRAMME_MISSING');
    expect(noProgramme.rows('theses')).toHaveLength(0);

    const noDegree = setup();
    const degreeResult = await submitThesis(baseInput({ programme: 'History' }), {
      userId: USER_ID,
      supabase: noDegree.client(),
      startWorkflow: async () => ({ started: true }),
    });
    expect(degreeResult.ok).toBe(false);
    if (!degreeResult.ok) expect(degreeResult.code).toBe('DEGREE_MISSING');
    expect(noDegree.rows('theses')).toHaveLength(0);

    expect(deriveDegree(null, null)).toBeNull();
    expect(deriveDegree('', '')).toBeNull();
    expect(deriveDegree(null, 'History')).toBeNull();
  });

  it('starts the review workflow after a successful insert', async () => {
    const db = setup();
    let startedFor: string | null = null;

    const result = await submitThesis(baseInput(), {
      userId: USER_ID,
      supabase: db.client(),
      startWorkflow: async (id) => {
        startedFor = id;
        // Mirror what the real workflow does to the thesis row.
        db.table('theses').forEach((row) => {
          if (row.id === id) row.status = 'submitted';
        });
        return { started: true };
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(startedFor).toBe(result.thesisId);
    expect(result.workflowStarted).toBe(true);
    expect(result.workflowWarning).toBeUndefined();
    expect(db.rows('theses')[0].status).toBe('submitted');

    const history = db.rows('thesis_workflow');
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ thesis_id: result.thesisId, stage: 'submitted', action: 'submitted' });
  });

  it('keeps the thesis as a draft and reports a warning when the workflow fails', async () => {
    const db = setup();

    const result = await submitThesis(baseInput(), {
      userId: USER_ID,
      supabase: db.client(),
      startWorkflow: async () => ({ started: false, error: 'No active thesis workflow definition is configured.' }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workflowStarted).toBe(false);
    expect(result.status).toBe('draft');
    expect(result.workflowWarning).toMatch(/workflow definition/i);

    const thesis = db.rows('theses')[0];
    expect(thesis.status).toBe('draft');

    const history = db.rows('thesis_workflow');
    expect(history[0]).toMatchObject({ stage: 'draft', action: 'workflow_deferred' });
    expect(history[0].notes).toMatch(/did not start/);
  });

  it('propagates a workflow start that throws as a warning, not a failure', async () => {
    const db = setup();

    const result = await submitThesis(baseInput(), {
      userId: USER_ID,
      supabase: db.client(),
      startWorkflow: async () => {
        throw new Error('connection reset');
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workflowStarted).toBe(false);
    expect(result.workflowWarning).toBe('connection reset');
    expect(db.rows('theses')[0].status).toBe('draft');
  });

  it('fails when the thesis insert is rejected by the database', async () => {
    const db = setup();
    db.failOnce('insert', 'theses', 'null value in column "patron_id"');

    const result = await submitThesis(baseInput(), {
      userId: USER_ID,
      supabase: db.client(),
      startWorkflow: async () => ({ started: true }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('THESIS_INSERT_FAILED');
    expect(result.error).toMatch(/patron_id/);
    expect(db.rows('thesis_supervisors')).toHaveLength(0);
  });
});

describe('thesis submission helpers', () => {
  it('derives the year from a session string', () => {
    expect(deriveYearFromSession('2025/2026')).toBe(2026);
    expect(deriveYearFromSession('2024/2025')).toBe(2025);
    expect(deriveYearFromSession('2030')).toBe(2030);
    expect(deriveYearFromSession('')).toBeNull();
    expect(deriveYearFromSession(null)).toBeNull();
    expect(deriveYearFromSession('third term')).toBeNull();
  });

  it('maps supervisor roles onto the values the check constraint allows', () => {
    expect(mapSupervisorRole('secondary')).toBe('second');
    expect(mapSupervisorRole('tertiary')).toBe('third');
    expect(mapSupervisorRole('primary')).toBe('primary');
    expect(mapSupervisorRole(undefined)).toBe('primary');
  });

  it('builds a typed reference number', () => {
    expect(buildReferenceNo('Undergraduate Long Essay', 2026)).toMatch(/^ULE-2026-\d{5}$/);
    expect(buildReferenceNo('thesis', 2025)).toMatch(/^THE-2025-\d{5}$/);
    expect(buildReferenceNo('unknown type', 2024)).toMatch(/^THE-2024-\d{5}$/);
  });
});
