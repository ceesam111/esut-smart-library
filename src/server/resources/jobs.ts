export type ResourceJobName =
  | 'resources.harvest'
  | 'resources.searchExternal'
  | 'resources.normalizeCandidate'
  | 'resources.deduplicate'
  | 'resources.downloadToB2'
  | 'resources.refreshMetadata'
  | 'resources.promoteCandidateToCatalogue';

export interface ResourceJob<T = Record<string, unknown>> {
  name: ResourceJobName;
  tenantId: string;
  payload: T;
  runAfter?: string;
}

export function createDownloadToB2Job(input: { tenantId: string; candidateId: string; downloadUrl: string }) {
  return {
    name: 'resources.downloadToB2' as const,
    tenantId: input.tenantId,
    payload: { candidateId: input.candidateId, downloadUrl: input.downloadUrl },
  };
}
