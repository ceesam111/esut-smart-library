import { createApprovalItem } from '@/server/approvals/createApprovalItem';
import { writeAuditLog } from '@/server/audit/writeAuditLog';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { enrichCatalogueRow, mergeEnrichment, type CatalogueEnrichment } from './enrichCatalogue';
import { findDuplicateIsbns, validateCatalogueRow, type NormalizedCatalogueRow } from './importValidation';

export interface StageCatalogueImportInput {
  uploadedBy: string;
  filename?: string | null;
  rows: Record<string, unknown>[];
  includeWarnings?: boolean;
}

export async function stageCatalogueImport(input: StageCatalogueImportInput) {
  const supabase = getSupabaseAdminClient();
  const tenant = await resolveTenant(input.uploadedBy);
  const duplicateIsbns = findDuplicateIsbns(input.rows);
  const normalized = input.rows.map((raw) => validateCatalogueRow(raw, duplicateIsbns));
  const candidateRows = normalized.filter((result) => result.errors.length === 0 && (input.includeWarnings || result.warnings.length === 0));
  const candidateIsbns = candidateRows.map((result) => result.row.isbn).filter(Boolean) as string[];

  const liveDuplicates = new Set<string>();
  if (candidateIsbns.length) {
    const { data, error } = await supabase
      .from('catalogue_items')
      .select('isbn')
      .eq('tenant_id', tenant.tenantId)
      .in('isbn', candidateIsbns);
    if (error) throw new Error(error.message);
    (data ?? []).forEach((item: { isbn: string | null }) => { if (item.isbn) liveDuplicates.add(item.isbn); });
  }

  const stagedRows: Array<ReturnType<typeof toStagingInsert>> = [];
  let cleanMatches = 0;
  let needsReview = 0;
  let errorRows = 0;
  let warningRows = 0;

  for (const result of normalized) {
    const errors = [...result.errors];
    if (result.row.isbn && liveDuplicates.has(result.row.isbn)) errors.push('Duplicate ISBN against existing live catalogue.');
    if (errors.length) { errorRows++; continue; }
    if (result.warnings.length) warningRows++;
    if (!input.includeWarnings && result.warnings.length) continue;

    const enrichment = await enrichCatalogueRow(result.row);
    const merged = mergeEnrichment(result.row, enrichment.data);
    if (enrichment.confidence === 'clean_match') cleanMatches++;
    else needsReview++;
    stagedRows.push(toStagingInsert(tenant.tenantId, input.uploadedBy, merged, result.row, enrichment.data, result.warnings, enrichment.confidence));
  }

  const { data: batch, error: batchError } = await supabase
    .from('catalogue_import_batches')
    .insert({
      tenant_id: tenant.tenantId,
      uploaded_by: input.uploadedBy,
      filename: input.filename ?? null,
      total_rows: input.rows.length,
      valid_rows: stagedRows.length,
      warning_rows: warningRows,
      error_rows: errorRows,
      clean_matches: cleanMatches,
      needs_review: needsReview,
      status: 'staged',
    })
    .select('*')
    .single();
  if (batchError) throw new Error(batchError.message);

  const rowsWithBatch = stagedRows.map((row) => ({ ...row, batch_id: batch.id }));
  if (rowsWithBatch.length) {
    const { error } = await supabase.from('catalogue_staging').insert(rowsWithBatch);
    if (error) throw new Error(error.message);
  }

  await createApprovalItem({
    tenantId: tenant.tenantId,
    sourceTable: 'catalogue_import_batches',
    sourceId: batch.id,
    contentType: 'catalogue_import',
    actionType: 'review_batch',
    riskTier: needsReview > 0 || errorRows > 0 ? 'human' : 'auto',
    title: `Catalogue CSV import: ${input.filename ?? 'uploaded file'}`,
    summary: `${stagedRows.length} rows staged — ${cleanMatches} clean matches ready to approve, ${needsReview} need review.`,
    payload: { batchId: batch.id, totalRows: input.rows.length, stagedRows: stagedRows.length, cleanMatches, needsReview, errorRows },
    submittedBy: input.uploadedBy,
  });

  await writeAuditLog({
    tenantId: tenant.tenantId,
    actorUserId: input.uploadedBy,
    action: 'catalogue_csv_import_staged',
    entityType: 'catalogue_import_batches',
    entityId: batch.id,
    afterData: batch,
    metadata: { stagedRows: stagedRows.length, cleanMatches, needsReview, errorRows },
  });

  return { batch, stagedRows: stagedRows.length, cleanMatches, needsReview, errorRows, warningRows };
}

function toStagingInsert(
  tenantId: string,
  uploadedBy: string,
  row: NormalizedCatalogueRow,
  rawNormalized: NormalizedCatalogueRow,
  enrichedData: CatalogueEnrichment,
  warnings: string[],
  confidence: string,
) {
  return {
    tenant_id: tenantId,
    uploaded_by: uploadedBy,
    source: 'csv_bulk',
    status: 'pending',
    confidence,
    isbn: row.isbn,
    title: row.title,
    authors: row.authors,
    publisher: row.publisher,
    year: row.year,
    edition: row.edition,
    language: row.language,
    category: row.category,
    subjects: row.subjects,
    copies: row.copies,
    shelf_location: row.shelf_location,
    item_type: row.item_type,
    source_url: row.source_url,
    cover_url: (enrichedData.cover_url as string | undefined) ?? null,
    notes: row.notes,
    raw_row: rawNormalized.raw_row,
    enriched_data: enrichedData,
    validation_errors: [],
    validation_warnings: warnings,
  };
}
