import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getUserRoles } from '@/server/auth/requireRole';
import { submitThesis, type ThesisSubmissionErrorCode } from '@/server/thesis/submitThesis';

export const dynamic = 'force-dynamic';

const ERROR_STATUS: Record<ThesisSubmissionErrorCode, number> = {
  TITLE_MISSING: 400,
  ABSTRACT_TOO_SHORT: 400,
  SUBMISSION_TYPE_INVALID: 400,
  PROGRAMME_MISSING: 400,
  DEGREE_MISSING: 422,
  DEPARTMENT_MISSING: 422,
  SESSION_YEAR_MISSING: 400,
  SUPERVISOR_MISSING: 422,
  SUPERVISOR_EMAIL_MISSING: 422,
  PATRON_MISSING: 422,
  PATRON_LOOKUP_FAILED: 500,
  THESIS_INSERT_FAILED: 500,
  SUPERVISOR_INSERT_FAILED: 500,
  WORKFLOW_INSERT_FAILED: 500,
};

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireUser(request);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const raw = body as Record<string, unknown>;
    const supervisors = Array.isArray(raw.supervisors) ? (raw.supervisors as unknown[]) : [];
    const keywords = Array.isArray(raw.keywords) ? (raw.keywords as unknown[]) : [];
    const subjects = Array.isArray(raw.subjects) ? (raw.subjects as unknown[]) : [];

    const result = await submitThesis(
      {
        title: asString(raw.title) ?? '',
        abstract: asString(raw.abstract),
        submissionType: asString(raw.submissionType) ?? '',
        programme: asString(raw.programme),
        degree: asString(raw.degree),
        department: asString(raw.department),
        session: asString(raw.session),
        faculty: asString(raw.faculty),
        keywords: keywords.filter((k): k is string => typeof k === 'string'),
        subjects: subjects.filter((s): s is string => typeof s === 'string'),
        fileUrl: asString(raw.fileUrl),
        fileSize: typeof raw.fileSize === 'number' ? raw.fileSize : null,
        declarationTimestamp: asString(raw.declarationTimestamp),
        embargoEnabled: raw.embargoEnabled === true,
        embargoPeriodMonths: typeof raw.embargoPeriodMonths === 'number' ? raw.embargoPeriodMonths : null,
        supervisors: supervisors.map((s) => {
          const sup = (s ?? {}) as Record<string, unknown>;
          return {
            name: asString(sup.name) ?? '',
            email: asString(sup.email),
            orcid: asString(sup.orcid),
            role: asString(sup.role),
          };
        }),
      },
      { userId: ctx.user.id },
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: ERROR_STATUS[result.code] });
    }

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /Authentication required|Invalid or expired session/.test(error.message)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/** Role probe used by the form to explain a PATRON_MISSING rejection early. */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireUser(request);
    const roles = await getUserRoles(ctx.user.id);
    return NextResponse.json({ data: { userId: ctx.user.id, roles } });
  } catch (error) {
    if (error instanceof Error && /Authentication required|Invalid or expired session/.test(error.message)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
