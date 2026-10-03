import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { validateMarcRecord, validateISBN, validateISSN, type MarcRecord, type ValidationResult } from './marcValidation';
import { getFrameworkFields } from './frameworks';

export interface StagedRecord {
  id: string;
  batch_id: string;
  record_position: number;
  raw_marcxml: string | null;
  parsed_marc: MarcRecord | null;
  title: string | null;
  authors: string[];
  isbn: string | null;
  issn: string | null;
  validation_result: ValidationResult;
  duplicate_status: 'NO_MATCH' | 'POSSIBLE_MATCH' | 'STRONG_MATCH';
  duplicate_candidates: Array<{ id: string; title: string; isbn: string | null }>;
  status: 'PENDING' | 'VALID' | 'WARNING' | 'ERROR' | 'READY' | 'IMPORTED' | 'SKIPPED' | 'REJECTED';
  error_detail: string | null;
}

export interface ImportBatch {
  id: string;
  source: string;
  filename: string | null;
  status: string;
  record_count: number;
  valid_count: number;
  warning_count: number;
  error_count: number;
  created_by: string | null;
  created_at: string;
}

export async function createImportBatch(input: { source: string; filename?: string; createdBy?: string }): Promise<ImportBatch> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('marc_import_batches').insert({
    source: input.source,
    filename: input.filename ?? null,
    created_by: input.createdBy ?? null,
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function stageMarcRecord(input: {
  batchId: string;
  position: number;
  rawMarcxml: string;
  parsedMarc: MarcRecord;
  frameworkCode?: string;
}): Promise<StagedRecord> {
  const supabase = getSupabaseAdminClient();

  const title = input.parsedMarc.fields.find(f => f.tag === '245')?.subfields?.find(s => s.code === 'a')?.value ?? null;
  const authors = input.parsedMarc.fields
    .filter(f => f.tag === '100' || f.tag === '700')
    .flatMap(f => f.subfields?.filter(s => s.code === 'a').map(s => s.value) ?? []);
  const isbn = input.parsedMarc.fields.find(f => f.tag === '020')?.subfields?.find(s => s.code === 'a')?.value ?? null;
  const issn = input.parsedMarc.fields.find(f => f.tag === '022')?.subfields?.find(s => s.code === 'a')?.value ?? null;

  let requiredFields: Array<{ tag: string; subfield: string }> = [];
  if (input.frameworkCode) {
    const { getFramework } = await import('./frameworks');
    const framework = await getFramework(input.frameworkCode);
    if (framework) {
      const fields = await getFrameworkFields(framework.id);
      requiredFields = fields.filter(f => f.is_required).map(f => ({ tag: f.tag, subfield: f.subfield_code }));
    }
  }

  const validation = validateMarcRecord(input.parsedMarc, requiredFields);

  if (isbn) {
    const isbnIssue = validateISBN(isbn);
    if (isbnIssue) validation.warnings.push(isbnIssue);
  }
  if (issn) {
    const issnIssue = validateISSN(issn);
    if (issnIssue) validation.warnings.push(issnIssue);
  }

  const duplicateStatus = await checkDuplicate(title, authors, isbn, issn);

  const status = validation.errors.length > 0 ? 'ERROR' : validation.warnings.length > 0 ? 'WARNING' : 'VALID';

  const { data, error } = await supabase.from('marc_import_records').insert({
    batch_id: input.batchId,
    record_position: input.position,
    raw_marcxml: input.rawMarcxml,
    parsed_marc: input.parsedMarc as unknown as Record<string, unknown>,
    title,
    authors,
    isbn,
    issn,
    validation_result: validation as any,
    duplicate_status: duplicateStatus.status,
    duplicate_candidates: duplicateStatus.candidates as unknown as Record<string, unknown>[],
    status,
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getImportBatch(batchId: string): Promise<ImportBatch | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('marc_import_batches').select('*').eq('id', batchId).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getStagedRecords(batchId: string): Promise<StagedRecord[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('marc_import_records').select('*').eq('batch_id', batchId).order('record_position');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateRecordStatus(recordId: string, status: StagedRecord['status'], errorDetail?: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('marc_import_records').update({
    status,
    error_detail: errorDetail ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', recordId);
  if (error) throw new Error(error.message);
}

export async function importRecord(recordId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data: record, error: fetchError } = await supabase.from('marc_import_records').select('*').eq('id', recordId).single();
  if (fetchError) throw new Error(fetchError.message);
  if (!record.parsed_marc) throw new Error('No parsed MARC data');

  const marc = record.parsed_marc as MarcRecord;
  const title = marc.fields.find(f => f.tag === '245')?.subfields?.find(s => s.code === 'a')?.value ?? 'Untitled';
  const authors = marc.fields
    .filter(f => f.tag === '100' || f.tag === '700')
    .flatMap(f => f.subfields?.filter(s => s.code === 'a').map(s => s.value) ?? []);
  const subjects = marc.fields
    .filter(f => f.tag === '650' || f.tag === '600')
    .flatMap(f => f.subfields?.filter(s => s.code === 'a').map(s => s.value) ?? []);
  const isbn = marc.fields.find(f => f.tag === '020')?.subfields?.find(s => s.code === 'a')?.value ?? null;
  const issn = marc.fields.find(f => f.tag === '022')?.subfields?.find(s => s.code === 'a')?.value ?? null;
  const publisher = marc.fields.find(f => f.tag === '260' || f.tag === '264')?.subfields?.find(s => s.code === 'b')?.value ?? null;
  const yearStr = marc.fields.find(f => f.tag === '260' || f.tag === '264')?.subfields?.find(s => s.code === 'c')?.value ?? '';
  const yearMatch = yearStr.match(/(18|19|20)\d{2}/);

  const { error: insertError } = await supabase.from('catalogue_items').insert({
    title,
    authors,
    subjects,
    isbn,
    issn,
    publisher,
    year: yearMatch ? parseInt(yearMatch[0], 10) : null,
    marc21_fields: { leader: marc.leader, fields: marc.fields } as unknown as Record<string, unknown>,
    marc21_leader: marc.leader,
    visibility: 'global',
  });
  if (insertError) throw new Error(insertError.message);

  await updateRecordStatus(recordId, 'IMPORTED');
}

async function checkDuplicate(
  title: string | null,
  authors: string[],
  isbn: string | null,
  issn: string | null,
): Promise<{ status: 'NO_MATCH' | 'POSSIBLE_MATCH' | 'STRONG_MATCH'; candidates: Array<{ id: string; title: string; isbn: string | null }> }> {
  const supabase = getSupabaseAdminClient();
  const candidates: Array<{ id: string; title: string; isbn: string | null }> = [];

  if (isbn) {
    const { data } = await supabase.from('catalogue_items').select('id,title,isbn').eq('isbn', isbn).limit(5);
    if (data && data.length > 0) {
      return { status: 'STRONG_MATCH', candidates: data };
    }
  }

  if (issn) {
    const { data } = await supabase.from('catalogue_items').select('id,title,isbn').eq('issn', issn).limit(5);
    if (data && data.length > 0) {
      return { status: 'STRONG_MATCH', candidates: data };
    }
  }

  if (title && title.length > 3) {
    const titleNorm = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const { data } = await supabase.from('catalogue_items').select('id,title,isbn').ilike('title', `%${title.slice(0, 30)}%`).limit(10);
    if (data && data.length > 0) {
      for (const item of data) {
        const itemNorm = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (itemNorm === titleNorm) {
          return { status: 'STRONG_MATCH', candidates: [item] };
        }
        candidates.push(item);
      }
      if (candidates.length > 0) {
        return { status: 'POSSIBLE_MATCH', candidates: candidates.slice(0, 5) };
      }
    }
  }

  return { status: 'NO_MATCH', candidates: [] };
}
