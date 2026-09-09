import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const tenantIdSchema = uuidSchema;

export const nonEmptyStringSchema = z.string().trim().min(1);

export const csvImportKindSchema = z.enum(['catalogue', 'patrons']);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const approvalStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'needs_changes',
  'auto_published',
  'cancelled',
]);

export const auditActionSchema = z.string().trim().min(3).max(120);

export const safeObjectKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(1024)
  .regex(/^[a-zA-Z0-9!_.*'()\/-]+$/, 'Object key contains unsupported characters.');

export function stripPatronPii(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[redacted-phone]')
    .replace(/\b(?:matric|staff|library)\s*(?:no|number|id)?\s*[:#-]?\s*[a-z0-9/-]+/gi, '[redacted-id]');
}
