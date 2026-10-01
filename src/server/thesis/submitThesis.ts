import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import {
  ALLOWED_SUBMISSION_TYPES,
  buildReferenceNo,
  deriveDegree,
  deriveYearFromSession,
  mapSupervisorRole,
} from '@/lib/thesisFields';

export { ALLOWED_SUBMISSION_TYPES, buildReferenceNo, deriveDegree, deriveYearFromSession, mapSupervisorRole };

/**
 * Server-side thesis submission.
 *
 * The old client-side insert failed against the live schema because the
 * `theses` table requires patron_id, degree, department, supervisor and year —
 * none of which the form collected — and it sent columns that do not exist.
 * Everything that must be derived from server-owned data is derived here, so
 * the browser can no longer send a payload the database will reject.
 */

export type ThesisSubmissionErrorCode =
  | 'TITLE_MISSING'
  | 'ABSTRACT_TOO_SHORT'
  | 'SUBMISSION_TYPE_INVALID'
  | 'PROGRAMME_MISSING'
  | 'DEGREE_MISSING'
  | 'DEPARTMENT_MISSING'
  | 'SESSION_YEAR_MISSING'
  | 'SUPERVISOR_MISSING'
  | 'SUPERVISOR_EMAIL_MISSING'
  | 'PATRON_MISSING'
  | 'PATRON_LOOKUP_FAILED'
  | 'THESIS_INSERT_FAILED'
  | 'SUPERVISOR_INSERT_FAILED'
  | 'WORKFLOW_INSERT_FAILED';

export interface ThesisSupervisorInput {
  name: string;
  email?: string | null;
  orcid?: string | null;
  role?: string | null;
}

export interface ThesisSubmissionInput {
  title: string;
  abstract?: string | null;
  submissionType: string;
  programme?: string | null;
  degree?: string | null;
  department?: string | null;
  session?: string | null;
  faculty?: string | null;
  keywords?: string[];
  subjects?: string[];
  fileUrl?: string | null;
  fileSize?: number | null;
  declarationTimestamp?: string | null;
  embargoEnabled?: boolean;
  embargoPeriodMonths?: number | null;
  supervisors: ThesisSupervisorInput[];
}

export type ThesisWorkflowStart = (thesisId: string) => Promise<{ started: boolean; error?: string }>;

export interface SubmitThesisContext {
  userId: string;
  /** Injectable for tests; defaults to the service-role client. */
  supabase?: SupabaseLike;
  /** Injectable for tests; defaults to creating + submitting a workflow instance. */
  startWorkflow?: ThesisWorkflowStart;
}

export type SubmitThesisResult =
  | {
      ok: true;
      thesisId: string;
      referenceNo: string;
      status: string;
      degree: string;
      department: string;
      year: number;
      workflowStarted: boolean;
      workflowWarning?: string;
    }
  | { ok: false; code: ThesisSubmissionErrorCode; error: string };

export interface SupabaseLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- injected PostgREST client; each call site narrows its own chain.
  from(table: string): any;
}

const MIN_ABSTRACT = 100;

function fail(code: ThesisSubmissionErrorCode, error: string): SubmitThesisResult {
  return { ok: false, code, error };
}

export async function submitThesis(
  input: ThesisSubmissionInput,
  ctx: SubmitThesisContext,
): Promise<SubmitThesisResult> {
  const supabase = ctx.supabase ?? getSupabaseAdminClient();

  const title = (input.title ?? '').trim();
  if (!title) return fail('TITLE_MISSING', 'A title is required.');

  const abstract = (input.abstract ?? '').trim();
  if (abstract.length < MIN_ABSTRACT) {
    return fail('ABSTRACT_TOO_SHORT', `The abstract must be at least ${MIN_ABSTRACT} characters.`);
  }

  const submissionType = (input.submissionType ?? '').trim();
  if (!ALLOWED_SUBMISSION_TYPES.includes(submissionType)) {
    return fail('SUBMISSION_TYPE_INVALID', `Unsupported submission type: ${submissionType || '(empty)'}.`);
  }

  const programme = (input.programme ?? '').trim();
  if (!programme) return fail('PROGRAMME_MISSING', 'Select the programme this work belongs to.');

  const { data: patron, error: patronError } = await supabase
    .from('patrons')
    .select('id, department, programme, faculty_name')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (patronError) {
    return fail('PATRON_LOOKUP_FAILED', 'Your library profile could not be read.');
  }
  if (!patron?.id) {
    return fail(
      'PATRON_MISSING',
      'This account has no library patron profile, so the thesis cannot be deposited. Register as a patron first.',
    );
  }

  const degree = deriveDegree(input.degree, programme);
  if (!degree) {
    return fail(
      'DEGREE_MISSING',
      'Could not determine the degree this work is submitted for. Choose a degree-specific programme (or enter the degree) before submitting.',
    );
  }

  const department = (input.department ?? '').trim() || (patron.department ?? '').trim();
  if (!department) {
    return fail(
      'DEPARTMENT_MISSING',
      'Could not determine your department. Add it to your patron profile or select it in the form.',
    );
  }

  const year = deriveYearFromSession(input.session);
  if (!year) {
    return fail('SESSION_YEAR_MISSING', 'Select an academic session so the deposit year can be recorded.');
  }

  const supervisors = (input.supervisors ?? [])
    .map((s) => ({
      name: (s.name ?? '').trim(),
      email: (s.email ?? '').trim(),
      orcid: (s.orcid ?? '').trim() || null,
      role: mapSupervisorRole(s.role),
    }))
    .filter((s) => s.name.length > 0);

  if (supervisors.length === 0) {
    return fail('SUPERVISOR_MISSING', 'At least one named supervisor is required before submission.');
  }
  const withoutEmail = supervisors.findIndex((s) => !s.email);
  if (withoutEmail >= 0) {
    return fail(
      'SUPERVISOR_EMAIL_MISSING',
      `Supervisor ${withoutEmail + 1} needs an email address so review notifications can reach them.`,
    );
  }

  const referenceNo = buildReferenceNo(submissionType, year);

  const { data: thesis, error: thesisError } = await supabase
    .from('theses')
    .insert({
      // Starts as draft: it only becomes 'submitted' when a workflow actually
      // accepts it, so a failed workflow start never leaves a false status.
      status: 'draft',
      visibility: 'private',
      patron_id: patron.id,
      submitter_id: ctx.userId,
      title,
      abstract,
      keywords: input.keywords ?? [],
      subjects: input.subjects ?? [],
      degree,
      department,
      supervisor: supervisors[0].name,
      co_supervisors: supervisors.slice(1).map((s) => ({ name: s.name, email: s.email, orcid: s.orcid })),
      submission_type: submissionType,
      programme,
      session: input.session ?? null,
      faculty: (input.faculty ?? '').trim() || null,
      year,
      file_url: input.fileUrl ?? null,
      file_size: input.fileSize ?? null,
      declaration_timestamp: input.declarationTimestamp ?? null,
      embargo_enabled: !!input.embargoEnabled,
      embargo_period_months: input.embargoEnabled ? input.embargoPeriodMonths ?? null : null,
      reference_no: referenceNo,
      submission_date: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (thesisError || !thesis?.id) {
    return fail('THESIS_INSERT_FAILED', thesisError?.message ?? 'The thesis record could not be saved.');
  }

  const thesisId = thesis.id as string;

  const { error: supervisorError } = await supabase.from('thesis_supervisors').insert(
    supervisors.map((s) => ({
      thesis_id: thesisId,
      supervisor_name: s.name,
      supervisor_email: s.email,
      supervisor_orcid: s.orcid,
      role: s.role,
    })),
  );
  if (supervisorError) {
    return fail('SUPERVISOR_INSERT_FAILED', supervisorError.message);
  }

  const startWorkflow: ThesisWorkflowStart =
    ctx.startWorkflow ??
    (async (id) => {
      const { createWorkflowInstance, transitionWorkflow } = await import('@/server/workflow/workflowService');
      try {
        const instanceId = await createWorkflowInstance({ createdBy: ctx.userId, thesisId: id });
        const result = await transitionWorkflow(instanceId, 'submit', ctx.userId);
        return result.success
          ? { started: true }
          : { started: false, error: result.error ?? 'The review workflow rejected the submission.' };
      } catch (error) {
        return { started: false, error: error instanceof Error ? error.message : 'Workflow could not start.' };
      }
    });

  let workflow: { started: boolean; error?: string };
  try {
    workflow = await startWorkflow(thesisId);
  } catch (error) {
    workflow = { started: false, error: error instanceof Error ? error.message : 'Workflow could not start.' };
  }

  const { error: historyError } = await supabase.from('thesis_workflow').insert({
    thesis_id: thesisId,
    stage: workflow.started ? 'submitted' : 'draft',
    action: workflow.started ? 'submitted' : 'workflow_deferred',
    acted_by: ctx.userId,
    notes: workflow.started
      ? 'Initial submission'
      : `Saved as a draft; the review workflow did not start. ${workflow.error ?? ''}`.trim(),
  });
  if (historyError) {
    return fail('WORKFLOW_INSERT_FAILED', historyError.message);
  }

  return {
    ok: true,
    thesisId,
    referenceNo,
    status: workflow.started ? 'submitted' : 'draft',
    degree,
    department,
    year,
    workflowStarted: workflow.started,
    ...(workflow.started ? {} : { workflowWarning: workflow.error }),
  };
}
