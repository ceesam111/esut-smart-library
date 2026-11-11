import { validateOrcidId } from '@/lib/identity/orcid';
import { namesMatch } from '@/lib/identity/nameMatching';

export interface OrcidPublicRecord {
  orcid: string;
  givenName: string;
  familyName: string;
  fullName: string;
  employments: string[];
}

export type OrcidVerifyFailure = 'invalid_format' | 'not_found' | 'fetch_failed' | 'no_profile_name' | 'name_mismatch';

export interface OrcidVerifyResult {
  ok: boolean;
  orcid: string | null;
  record: OrcidPublicRecord | null;
  nameMatch: boolean;
  failure?: OrcidVerifyFailure;
}

interface OrcidRecordJson {
  person?: {
    name?: {
      'given-names'?: { value?: string };
      'family-name'?: { value?: string };
    };
  };
  'activities-summary'?: {
    employments?: {
      'affiliation-group'?: Array<Record<string, unknown>>;
    };
  };
}

export async function fetchOrcidRecord(orcid: string): Promise<OrcidPublicRecord | null> {
  const response = await fetch(`https://pub.orcid.org/v3.0/${orcid}/record`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as OrcidRecordJson;
  const givenName = data.person?.name?.['given-names']?.value || '';
  const familyName = data.person?.name?.['family-name']?.value || '';
  const fullName = `${givenName} ${familyName}`.trim();
  const groups = data['activities-summary']?.employments?.['affiliation-group'] ?? [];
  const employments = groups
    .map((group) => {
      const summaries = group.summaries as Array<Record<string, unknown>> | undefined;
      const summary = summaries?.[0];
      const employment = summary?.['employment-summary'] as Record<string, unknown> | undefined;
      const organization = employment?.organization as Record<string, unknown> | undefined;
      return typeof organization?.name === 'string' ? organization.name : '';
    })
    .filter(Boolean);
  return { orcid, givenName, familyName, fullName, employments };
}

export async function verifyOrcidClaim(input: { orcid: string; profileName: string }): Promise<OrcidVerifyResult> {
  const normalized = validateOrcidId(input.orcid);
  if (!normalized) return { ok: false, orcid: null, record: null, nameMatch: false, failure: 'invalid_format' };

  let record: OrcidPublicRecord | null;
  try {
    record = await fetchOrcidRecord(normalized);
  } catch {
    return { ok: false, orcid: normalized, record: null, nameMatch: false, failure: 'fetch_failed' };
  }
  if (!record) return { ok: false, orcid: normalized, record: null, nameMatch: false, failure: 'not_found' };

  const profileName = input.profileName.trim();
  if (!profileName) return { ok: false, orcid: normalized, record, nameMatch: false, failure: 'no_profile_name' };

  const nameMatch = namesMatch(record.fullName, profileName);
  if (!nameMatch) return { ok: false, orcid: normalized, record, nameMatch: false, failure: 'name_mismatch' };
  return { ok: true, orcid: normalized, record, nameMatch: true };
}
