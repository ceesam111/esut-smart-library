import { describe, expect, it } from 'vitest';
import { getHandler, handlers } from './index';

describe('worker handler registry', () => {
  it('registers required production job handlers', () => {
    for (const jobType of ['catalogue.enrich', 'resources.harvest', 'resources.downloadToB2', 'repository.extractMetadata', 'communications.draftNewsletter', 'reports.weeklyTenantReport', 'system.healthCheck', 'circulation.overdueReminders']) {
      expect(getHandler(jobType)).toBe(handlers[jobType]);
    }
  });
});
