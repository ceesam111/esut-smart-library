import { validateOrcidId } from './orcid';

export interface CompletenessProfile {
  academic_rank?: string | null;
  department?: string | null;
  institutional_email?: string | null;
  biography?: string | null;
  orcid_id?: string | null;
  profile_photo_url?: string | null;
  research_keywords?: string[] | null;
  highest_qualification?: unknown | null;
}

export interface CompletenessField {
  key: string;
  weight: number;
  met: boolean;
}

export interface CompletenessResult {
  score: number;
  totalWeight: number;
  missing: string[];
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasList(value: unknown): boolean {
  return Array.isArray(value) && value.some((entry) => hasText(entry));
}

function hasQualification(value: unknown): boolean {
  if (hasText(value)) return true;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.values(value as Record<string, unknown>).some((entry) => hasText(entry));
  }
  return false;
}

export function completenessFields(profile: CompletenessProfile): CompletenessField[] {
  return [
    { key: 'academic_rank', weight: 10, met: hasText(profile.academic_rank) },
    { key: 'department', weight: 15, met: hasText(profile.department) },
    { key: 'institutional_email', weight: 10, met: hasText(profile.institutional_email) },
    { key: 'biography', weight: 15, met: hasText(profile.biography) },
    { key: 'orcid', weight: 20, met: validateOrcidId(profile.orcid_id ?? '') !== null },
    { key: 'profile_photo', weight: 10, met: hasText(profile.profile_photo_url) },
    { key: 'research_keywords', weight: 10, met: hasList(profile.research_keywords) },
    { key: 'qualifications', weight: 10, met: hasQualification(profile.highest_qualification) },
  ];
}

export function profileCompleteness(profile: CompletenessProfile): CompletenessResult {
  const fields = completenessFields(profile);
  const totalWeight = fields.reduce((sum, field) => sum + field.weight, 0);
  const score = fields.reduce((sum, field) => sum + (field.met ? field.weight : 0), 0);
  return { score, totalWeight, missing: fields.filter((field) => !field.met).map((field) => field.key) };
}
