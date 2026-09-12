import type { AgentJobHandler } from '../types';
import { enrichCatalogue } from './catalogue';
import { harvestResources, downloadResourceToB2 } from './resources';
import { extractRepositoryMetadata } from './repository';
import { draftNewsletter, overdueReminders, sendOverdueEmails, sendDueSoonEmails } from './communications';
import { weeklyTenantReport, systemHealthCheck } from './reports';

export const handlers: Record<string, AgentJobHandler> = {
  'catalogue.enrich': enrichCatalogue,
  'resources.harvest': harvestResources,
  'resources.downloadToB2': downloadResourceToB2,
  'repository.extractMetadata': extractRepositoryMetadata,
  'communications.draftNewsletter': draftNewsletter,
  'reports.weeklyTenantReport': weeklyTenantReport,
  'system.healthCheck': systemHealthCheck,
  'circulation.overdueReminders': overdueReminders,
  'circulation.sendOverdueEmails': sendOverdueEmails,
  'circulation.sendDueSoonEmails': sendDueSoonEmails,
};

export function getHandler(jobType: string) {
  return handlers[jobType];
}
