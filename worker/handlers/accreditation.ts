import type { AgentJobHandler } from '../types';
import { requireTenant, safeResult, textPayload } from './utils';
import { programmeBySlug } from '@/data/accreditation/programmes';
import { accreditationProviderById } from '@/server/accreditation/providers';
import { runAccreditationSync } from '@/server/accreditation/sync';
import { runLinkVerification } from '@/server/accreditation/verification';

const numberPayload = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export const accreditationSync: AgentJobHandler = async (job) => {
  requireTenant(job);
  const programmeSlug = textPayload(job, 'programme');
  const providerId = textPayload(job, 'provider');
  const maxPer = numberPayload(job.payload?.maxPerProgrammePerProvider);
  if (programmeSlug && !programmeBySlug(programmeSlug)) {
    throw new Error(`Unknown programme slug: ${programmeSlug}`);
  }
  if (providerId && !accreditationProviderById(providerId)) {
    throw new Error(`Unknown provider id: ${providerId}`);
  }
  const outcome = await runAccreditationSync({
    programmeSlugs: programmeSlug ? [programmeSlug] : undefined,
    providerIds: providerId ? [providerId] : undefined,
    maxPerProgrammePerProvider: maxPer,
  });
  return safeResult('accreditation sync completed', {
    runs: outcome.summaries,
    requestsMade: outcome.requestsMade,
    elapsedMs: outcome.elapsedMs,
  });
};

export const accreditationVerify: AgentJobHandler = async (job) => {
  requireTenant(job);
  const rawLimit = numberPayload(job.payload?.limit);
  const limit = rawLimit === undefined ? 25 : Math.min(Math.max(Math.floor(rawLimit), 1), 100);
  const summary = await runLinkVerification({ limit });
  return safeResult('link verification completed', {
    checked: summary.checked,
    verified: summary.verified,
    failed: summary.failed,
    unverifiable: summary.unverifiable,
  });
};
