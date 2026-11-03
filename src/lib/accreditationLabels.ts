import type { AccessState, VerificationStatus } from '@/server/accreditation/types';

export type BadgeTone = 'open' | 'neutral' | 'restricted' | 'warn';

export interface AccessBadge {
  label: string;
  detail: string | null;
  tone: BadgeTone;
  allowsFullTextAction: boolean;
}

export const accessBadge = (
  state: AccessState | 'local_holdings',
  verification: { status: VerificationStatus; checkedAt: string | null } | null,
): AccessBadge => {
  if (state === 'local_holdings') {
    return {
      label: 'Library holdings',
      detail: 'Available through the library — open the catalogue record for shelf details.',
      tone: 'open',
      allowsFullTextAction: false,
    };
  }
  if (state === 'paywalled') {
    return {
      label: 'Publisher page',
      detail: 'Full text may require a subscription — confirm access with the library.',
      tone: 'restricted',
      allowsFullTextAction: false,
    };
  }
  if (state === 'metadata_only') {
    return {
      label: 'Record only',
      detail: 'No full-text link is available for this record.',
      tone: 'restricted',
      allowsFullTextAction: false,
    };
  }
  if (state === 'abstract_only') {
    return {
      label: 'Abstract only',
      detail: 'The provider supplies an abstract but no full-text link.',
      tone: 'neutral',
      allowsFullTextAction: false,
    };
  }
  if (verification && verification.status === 'failed') {
    return {
      label: 'Full-text link failed check',
      detail: 'The stored full-text link did not respond when last verified — treat it as unavailable.',
      tone: 'warn',
      allowsFullTextAction: false,
    };
  }
  if (verification && verification.status === 'verified') {
    const checked = verification.checkedAt ? verification.checkedAt.slice(0, 10) : null;
    return {
      label: 'Full text',
      detail: checked ? `Link verified ${checked}.` : 'Link verified.',
      tone: 'open',
      allowsFullTextAction: true,
    };
  }
  return {
    label: 'Full text (unverified link)',
    detail: 'Provider-supplied full-text link that has not been verified yet.',
    tone: 'neutral',
    allowsFullTextAction: true,
  };
};

export const recordSourceLabel = (recordSource: 'external' | 'catalogue' | 'repository'): string => {
  if (recordSource === 'catalogue') return 'Library catalogue';
  if (recordSource === 'repository') return 'Institutional repository';
  return 'Open external source';
};

export const resourceTypeLabel = (resourceType: string): string => {
  const labels: Record<string, string> = {
    ebook: 'E-book',
    ejournal: 'E-journal',
    research_article: 'Research article',
    report: 'Report',
    dataset: 'Dataset',
    thesis: 'Thesis',
    standard: 'Standard',
    course_material: 'Course material',
    print_holding: 'Print holding',
    local_holdings: 'Library holding',
  };
  return labels[resourceType] ?? resourceType;
};

export const verificationLabel = (
  verification: { status: VerificationStatus; checkedAt: string | null } | null,
): string | null => {
  if (!verification) return null;
  const checked = verification.checkedAt ? ` · ${verification.checkedAt.slice(0, 10)}` : '';
  if (verification.status === 'verified') return `Link verified${checked}`;
  if (verification.status === 'failed') return `Link check failed${checked}`;
  if (verification.status === 'stale') return `Link check stale${checked}`;
  return 'Link not verified yet';
};
