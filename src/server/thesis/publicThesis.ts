import { requestMemo } from '@/server/util/requestMemo';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import type { ScholarlyItem } from '@/server/seo/scholarlyMetadata';

export interface PublicThesis {
  id: string;
  title: string;
  abstract: string | null;
  keywords: string[];
  degree: string;
  department: string;
  faculty: string | null;
  programme: string | null;
  supervisor: string;
  co_supervisors: Array<{ name?: string }>;
  submission_type: string;
  language: string | null;
  year: number;
  pages: number | null;
  session: string | null;
  reference_no: string | null;
  doi: string | null;
  status: string;
  student_name: string | null;
  repository_item_id: string | null;
  created_at: string;
  updated_at: string;
  embargo_until: string | null;
  has_file: boolean;
  file_available: boolean;
}

interface RawThesisRow {
  id: string;
  title: string;
  abstract: string | null;
  keywords: unknown;
  degree: string;
  department: string;
  faculty: string | null;
  programme: string | null;
  supervisor: string;
  co_supervisors: unknown;
  submission_type: string;
  language: string | null;
  year: number;
  pages: number | null;
  session: string | null;
  reference_no: string | null;
  doi: string | null;
  status: string;
  repository_item_id: string | null;
  created_at: string;
  updated_at: string;
  approval_date: string | null;
  embargo_enabled: boolean;
  embargo_period_months: number | null;
  file_url: string | null;
  patron: { full_name: string | null } | null;
}

const PUBLIC_THESIS_COLUMNS =
  'id,title,abstract,keywords,degree,department,faculty,programme,supervisor,co_supervisors,' +
  'submission_type,language,year,pages,session,reference_no,doi,status,repository_item_id,' +
  'created_at,updated_at,approval_date,embargo_enabled,embargo_period_months,file_url,' +
  'patron:patrons!theses_patron_id_fkey(full_name)';

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry : String((entry as { name?: unknown })?.name ?? '')))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function coerceCoSupervisors(value: unknown): Array<{ name?: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const name = typeof entry === 'string' ? entry : String((entry as { name?: unknown })?.name ?? '');
      return { name: name.trim() };
    })
    .filter((entry) => entry.name.length > 0);
}

export function thesisEmbargoUntil(row: Pick<RawThesisRow, 'embargo_enabled' | 'embargo_period_months' | 'approval_date' | 'created_at'>): string | null {
  if (!row.embargo_enabled) return null;
  const months = row.embargo_period_months ?? 0;
  if (months <= 0) return null;
  const base = new Date(row.approval_date ?? row.created_at);
  if (Number.isNaN(base.getTime())) return null;
  base.setUTCMonth(base.getUTCMonth() + months);
  return base.toISOString();
}

export function isPubliclyVisibleThesis(row: Pick<RawThesisRow, 'status'>): boolean {
  return row.status === 'published';
}

export function isThesisFileEmbargoed(row: Pick<RawThesisRow, 'embargo_enabled' | 'embargo_period_months' | 'approval_date' | 'created_at'>): boolean {
  const until = thesisEmbargoUntil(row);
  return Boolean(until && new Date(until).getTime() > Date.now());
}

function pickEmbargoFields(row: RawThesisRow): Pick<RawThesisRow, 'embargo_enabled' | 'embargo_period_months' | 'approval_date' | 'created_at'> {
  return {
    embargo_enabled: row.embargo_enabled,
    embargo_period_months: row.embargo_period_months,
    approval_date: row.approval_date,
    created_at: row.created_at,
  };
}

function toPublicThesis(row: RawThesisRow): PublicThesis {
  const embargoUntil = thesisEmbargoUntil(pickEmbargoFields(row));
  return {
    id: row.id,
    title: row.title,
    abstract: row.abstract,
    keywords: stringList(row.keywords),
    degree: row.degree,
    department: row.department,
    faculty: row.faculty,
    programme: row.programme,
    supervisor: row.supervisor,
    co_supervisors: coerceCoSupervisors(row.co_supervisors),
    submission_type: row.submission_type,
    language: row.language,
    year: row.year,
    pages: row.pages,
    session: row.session,
    reference_no: row.reference_no,
    doi: row.doi,
    status: row.status,
    student_name: row.patron?.full_name ?? null,
    repository_item_id: row.repository_item_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    embargo_until: embargoUntil,
    has_file: Boolean(row.file_url),
    file_available: Boolean(row.file_url) && (!embargoUntil || new Date(embargoUntil).getTime() <= Date.now()),
  };
}

function sanitizeSearchTerm(term: string): string {
  return term.replace(/[%,_()',]/g, ' ').replace(/\s+/g, ' ').trim();
}

const DEGREE_FILTER_PATTERNS: Record<string, string[]> = {
  PhD: ['%ph.d%', '%phd%', '%doctorat%'],
  Masters: ['%m.ed%', '%m.sc%', '%m.a%', '%m.eng%', '%master%'],
  PGD: ['%pgd%'],
  'B.Ed': ['%b.ed%'],
  'B.Sc': ['%b.sc%'],
  'B.A': ['%b.a%'],
  Undergraduate: ['%b.ed%', '%b.sc%', '%b.a%', '%b.eng%', '%nce%', '%undergraduat%'],
};

export function degreeFilterConditions(degree: string | undefined): string[] | null {
  if (!degree) return null;
  const patterns = DEGREE_FILTER_PATTERNS[degree];
  return patterns ? patterns.map((pattern) => `degree.ilike.${pattern}`) : null;
}

export interface ThesisListOptions {
  q?: string;
  degree?: string;
  sort?: string;
  page?: number;
  size?: number;
}

export async function listPublicTheses(options: ThesisListOptions): Promise<{ items: PublicThesis[]; total: number }> {
  const page = Math.max(0, Math.min(options.page ?? 0, 500));
  const size = Math.max(1, Math.min(options.size ?? 25, 100));
  const db = getSupabaseAdminClient();

  let query = db
    .from('theses')
    .select(PUBLIC_THESIS_COLUMNS, { count: 'exact' })
    .eq('status', 'published');

  const term = options.q ? sanitizeSearchTerm(options.q) : '';
  if (term) {
    query = query.or(`title.ilike.%${term}%,abstract.ilike.%${term}%,supervisor.ilike.%${term}%,degree.ilike.%${term}%`);
  }
  const degreeConditions = degreeFilterConditions(options.degree);
  if (degreeConditions) {
    query = query.or(degreeConditions.join(','));
  }

  if (options.sort === 'year_asc') query = query.order('year', { ascending: true }).order('created_at', { ascending: true });
  else if (options.sort === 'title_asc') query = query.order('title', { ascending: true });
  else query = query.order('year', { ascending: false }).order('created_at', { ascending: false });

  const { data, count, error } = await query.range(page * size, page * size + size - 1);
  if (error) throw new Error(error.message);

  return {
    items: ((data ?? []) as unknown as RawThesisRow[]).map(toPublicThesis),
    total: count ?? 0,
  };
}

export const getPublicThesis = requestMemo(async (id: string): Promise<PublicThesis | null> => {
  const trimmed = id.trim();
  if (!trimmed || trimmed.length > 100) return null;
  const db = getSupabaseAdminClient();
  const { data, error } = await db
    .from('theses')
    .select(PUBLIC_THESIS_COLUMNS)
    .eq('id', trimmed)
    .eq('status', 'published')
    .maybeSingle();
  if (error || !data) return null;
  return toPublicThesis(data as unknown as RawThesisRow);
});

export function toScholarlyThesis(thesis: PublicThesis): ScholarlyItem {
  return {
    id: thesis.id,
    handle: thesis.reference_no ?? null,
    title: thesis.title,
    authors: thesis.student_name ? [thesis.student_name] : [],
    abstract: thesis.abstract,
    keywords: thesis.keywords,
    type: thesis.submission_type,
    item_type: 'thesis',
    doi: thesis.doi,
    license: null,
    year: thesis.year,
    department: thesis.department,
    faculty_code: thesis.faculty,
    language: thesis.language,
    file_url: null,
    created_at: thesis.created_at,
    landing_path: `/theses/${thesis.id}`,
  };
}
