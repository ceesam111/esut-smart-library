import { safeResourcePathPart } from './normalize';

export function tenantResourceFileKey(input: { tenantId: string; sourceName: string; year?: number | null; sourceRecordId?: string | null; filename: string }) {
  const source = safeResourcePathPart(input.sourceName);
  const year = input.year || new Date().getFullYear();
  const id = safeResourcePathPart(input.sourceRecordId || 'unknown');
  const filename = safeResourcePathPart(input.filename);
  return `tenants/${input.tenantId}/resources/${source}/${year}/${id}/${filename}`;
}
