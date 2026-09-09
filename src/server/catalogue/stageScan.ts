import { createApprovalItem } from '@/server/approvals/createApprovalItem';
import { writeAuditLog } from '@/server/audit/writeAuditLog';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { enrichCatalogueRow, mergeEnrichment } from './enrichCatalogue';
import { validateCatalogueRow } from './importValidation';

export async function stageScannedCatalogueRow(input: {
  uploadedBy: string;
  source: 'scan' | 'manual';
  row: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdminClient();
  const tenant = await resolveTenant(input.uploadedBy);
  const validation = validateCatalogueRow(input.row);
  if (validation.errors.length) throw new Error(validation.errors.join(' '));

  if (validation.row.isbn) {
    const { data: duplicate, error } = await supabase
      .from('catalogue_items')
      .select('id')
      .eq('tenant_id', tenant.tenantId)
      .eq('isbn', validation.row.isbn)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (duplicate) throw new Error('Duplicate ISBN against existing live catalogue.');
  }

  const enrichment = await enrichCatalogueRow(validation.row);
  const merged = mergeEnrichment(validation.row, enrichment.data);

  const { data: batch, error: batchError } = await supabase
    .from('catalogue_import_batches')
    .insert({
      tenant_id: tenant.tenantId,
      uploaded_by: input.uploadedBy,
      filename: `${input.source}-barcode-entry`,
      source: input.source,
      total_rows: 1,
      valid_rows: 1,
      warning_rows: validation.warnings.length ? 1 : 0,
      error_rows: 0,
      clean_matches: enrichment.confidence === 'clean_match' ? 1 : 0,
      needs_review: enrichment.confidence === 'clean_match' ? 0 : 1,
      status: 'staged',
    })
    .select('*')
    .single();
  if (batchError) throw new Error(batchError.message);

  const { data: staged, error: stagedError } = await supabase
    .from('catalogue_staging')
    .insert({
      tenant_id: tenant.tenantId,
      batch_id: batch.id,
      uploaded_by: input.uploadedBy,
      source: input.source,
      status: 'pending',
      confidence: enrichment.confidence,
      isbn: merged.isbn,
      title: merged.title,
      authors: merged.authors,
      publisher: merged.publisher,
      year: merged.year,
      edition: merged.edition,
      language: merged.language,
      category: merged.category,
      subjects: merged.subjects,
      copies: merged.copies,
      shelf_location: merged.shelf_location,
      item_type: merged.item_type,
      source_url: merged.source_url,
      cover_url: enrichment.data.cover_url ?? null,
      notes: merged.notes,
      raw_row: validation.row.raw_row,
      enriched_data: enrichment.data,
      validation_errors: [],
      validation_warnings: validation.warnings,
    })
    .select('*')
    .single();
  if (stagedError) throw new Error(stagedError.message);

  await createApprovalItem({
    tenantId: tenant.tenantId,
    sourceTable: 'catalogue_staging',
    sourceId: staged.id,
    contentType: 'catalogue_scan',
    actionType: 'review_scanned_resource',
    riskTier: enrichment.confidence === 'clean_match' ? 'auto' : 'human',
    title: staged.title || staged.isbn || 'Scanned catalogue resource',
    summary: `Scanned ${input.source} row staged with ${enrichment.confidence} confidence.`,
    payload: { batchId: batch.id, stagingId: staged.id, confidence: enrichment.confidence },
    submittedBy: input.uploadedBy,
  });

  await writeAuditLog({
    tenantId: tenant.tenantId,
    actorUserId: input.uploadedBy,
    action: 'catalogue_scan_staged',
    entityType: 'catalogue_staging',
    entityId: staged.id,
    afterData: staged,
    metadata: { source: input.source, batchId: batch.id },
  });

  return { batch, staged };
}
