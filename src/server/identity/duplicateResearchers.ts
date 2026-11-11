import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { nameMatchKey } from '@/lib/identity/nameMatching';
import { normalizeOrcidId, validateOrcidId } from '@/lib/identity/orcid';

export interface ResearcherIdentityRow {
  id: string;
  patron_id: string | null;
  first_name: string;
  middle_name: string | null;
  surname: string;
  department: string | null;
  institutional_email: string | null;
  orcid_id: string | null;
  orcid_verified: boolean;
  status: string | null;
}

export interface IdentityDuplicateMember {
  id: string;
  name: string;
  orcid_id: string | null;
  orcid_verified: boolean;
  department: string | null;
  status: string | null;
}

export interface DuplicateGroup {
  key: string;
  kind: 'orcid' | 'name';
  members: IdentityDuplicateMember[];
}

export interface InvalidOrcidRow {
  id: string;
  name: string;
  orcid_id: string;
}

export interface IdentityDuplicateReport {
  generatedAt: string;
  scanned: number;
  orcidDuplicates: DuplicateGroup[];
  nameDuplicates: DuplicateGroup[];
  invalidOrcids: InvalidOrcidRow[];
}

export function researcherDisplayName(row: Pick<ResearcherIdentityRow, 'first_name' | 'middle_name' | 'surname'>): string {
  return [row.first_name, row.middle_name, row.surname].filter((part) => Boolean(part && String(part).trim())).join(' ');
}

function toMember(row: ResearcherIdentityRow): IdentityDuplicateMember {
  return {
    id: row.id,
    name: researcherDisplayName(row),
    orcid_id: row.orcid_id,
    orcid_verified: row.orcid_verified,
    department: row.department,
    status: row.status,
  };
}

function groupRows(rows: ResearcherIdentityRow[], kind: DuplicateGroup['kind'], keyOf: (row: ResearcherIdentityRow) => string): DuplicateGroup[] {
  const byKey = new Map<string, ResearcherIdentityRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) existing.push(row);
    else byKey.set(key, [row]);
  }
  const groups: DuplicateGroup[] = [];
  for (const [key, members] of byKey) {
    if (members.length < 2) continue;
    groups.push({ key, kind, members: members.map(toMember) });
  }
  return groups.sort((left, right) => right.members.length - left.members.length || left.key.localeCompare(right.key));
}

export function groupDuplicateOrcids(rows: ResearcherIdentityRow[]): DuplicateGroup[] {
  return groupRows(rows.filter((row) => Boolean(row.orcid_id && row.orcid_id.trim())), 'orcid', (row) => {
    const normalized = normalizeOrcidId(row.orcid_id ?? '');
    return normalized ?? (row.orcid_id ?? '').trim();
  });
}

export function groupDuplicateNames(rows: ResearcherIdentityRow[]): DuplicateGroup[] {
  return groupRows(rows, 'name', (row) => nameMatchKey(researcherDisplayName(row)));
}

export function findInvalidOrcids(rows: ResearcherIdentityRow[]): InvalidOrcidRow[] {
  const invalid: InvalidOrcidRow[] = [];
  for (const row of rows) {
    const orcid = row.orcid_id?.trim();
    if (!orcid) continue;
    if (validateOrcidId(orcid) === null) {
      invalid.push({ id: row.id, name: researcherDisplayName(row), orcid_id: orcid });
    }
  }
  return invalid.sort((left, right) => left.name.localeCompare(right.name));
}

export function buildIdentityReport(rows: ResearcherIdentityRow[]): IdentityDuplicateReport {
  return {
    generatedAt: new Date().toISOString(),
    scanned: rows.length,
    orcidDuplicates: groupDuplicateOrcids(rows),
    nameDuplicates: groupDuplicateNames(rows),
    invalidOrcids: findInvalidOrcids(rows),
  };
}

export async function findResearcherIdentityDuplicates(options: { limit?: number } = {}): Promise<IdentityDuplicateReport> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('researcher_profiles')
    .select('id, patron_id, first_name, middle_name, surname, department, institutional_email, orcid_id, orcid_verified, status')
    .limit(options.limit ?? 5000);
  if (error) throw new Error(error.message);
  return buildIdentityReport((data ?? []) as unknown as ResearcherIdentityRow[]);
}
