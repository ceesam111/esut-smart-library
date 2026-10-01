/**
 * Pure derivation rules for thesis deposit fields.
 *
 * Kept free of server-only imports so both the API layer and the browser form
 * can share exactly one implementation of "what degree/year/role does this
 * submission actually mean".
 */

/** Submission types accepted by `theses_submission_type_check`. */
export const ALLOWED_SUBMISSION_TYPES: readonly string[] = [
  'thesis',
  'dissertation',
  'project',
  'NCE Long Essay',
  'Final Year Project',
  'M.Ed. Dissertation',
  'B.Ed. Project',
  'Undergraduate Long Essay',
];

const DEGREE_PROGRAMME_PREFIXES = ['Ph.D.', 'M.Ed.', 'B.Ed.', 'B.A.', 'B.Sc.', 'B.Eng.', 'NCE', 'PGDE'];

const TYPE_CODES: Record<string, string> = {
  'Undergraduate Long Essay': 'ULE',
  'Final Year Project': 'FYP',
  'M.Ed. Dissertation': 'MED',
  'B.Ed. Project': 'BED',
  thesis: 'THE',
  dissertation: 'DIS',
  project: 'PRJ',
  'NCE Long Essay': 'NCE',
};

/**
 * Degree is taken from the explicit value when the form supplies one, then
 * from the programme prefix ("Ph.D. Education" -> "Ph.D."). It is deliberately
 * NOT guessed from the submission type: "Undergraduate Long Essay" tells us
 * nothing about which degree is being awarded. Returns null when nothing can
 * be derived, which the caller turns into DEGREE_MISSING.
 */
export function deriveDegree(
  explicit: string | null | undefined,
  programme: string | null | undefined,
): string | null {
  const fromExplicit = (explicit ?? '').trim();
  if (fromExplicit) return fromExplicit;

  const trimmedProgramme = (programme ?? '').trim();
  for (const prefix of DEGREE_PROGRAMME_PREFIXES) {
    if (trimmedProgramme.toUpperCase().startsWith(prefix.toUpperCase())) return prefix;
  }

  return null;
}

/** "2025/2026" -> 2026. Also accepts a bare four digit year. */
export function deriveYearFromSession(session: string | null | undefined): number | null {
  const value = (session ?? '').trim();
  if (!value) return null;
  const bare = /^(19|20)\d{2}$/.exec(value);
  if (bare) return Number(value);
  const ranged = /^(19|20)\d{2}\s*\/\s*((19|20)\d{2})$/.exec(value);
  if (ranged) return Number(ranged[2]);
  return null;
}

/** The DB constraint allows primary/second/third only. */
export function mapSupervisorRole(role: string | null | undefined): 'primary' | 'second' | 'third' {
  const value = (role ?? '').trim().toLowerCase();
  if (value === 'second' || value === 'secondary' || value === 'co-supervisor') return 'second';
  if (value === 'third' || value === 'tertiary') return 'third';
  return 'primary';
}

export function buildReferenceNo(submissionType: string, year: number): string {
  const code = TYPE_CODES[submissionType] ?? 'THE';
  const seq = Math.floor(Math.random() * 90000) + 10000;
  return `${code}-${year}-${seq}`;
}
