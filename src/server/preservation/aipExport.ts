import { getSupabaseAdminClient } from '../supabase/adminClient';
import { buildAIP, sanitizePayloadPath, sha256Bytes, validateAIP, type AIPBundle, type AIPValidation } from './aipBundle';
import { readStoredObject, supabaseStore } from './objectStore';

const AIP_BUCKET = 'aip-exports';

export interface AIPExportResult {
  success: boolean;
  aipPath?: string;
  manifest?: string;
  checksum?: string;
  fileCount?: number;
  validation?: AIPValidation;
  warnings?: string[];
  error?: string;
}

export interface ExportOptions {
  versionId?: string | null;
  bagName?: string;
}

export interface FileRow {
  id: string;
  repository_item_id: string;
  original_filename: string;
  display_filename: string | null;
  mime_type: string | null;
  role: string;
  display_order: number;
  storage_provider: string | null;
  storage_bucket: string;
  storage_key: string;
  checksum: string | null;
  checksum_algorithm: string;
  repository_version_id: string | null;
  created_at: string;
}

interface VersionRow {
  id: string;
  repository_item_id: string;
  version_number: number;
  change_note: string | null;
  created_by: string | null;
  created_at: string;
}

export type VersionSelector = 'all-files' | 'version-tag' | 'version-snapshot';

/**
 * B11: a version-scoped export must contain only that version's files.
 * Files explicitly tagged with the version win; otherwise an as-of snapshot
 * (files created on or before the version) is used and reported as a warning.
 */
export function resolveVersionFiles(input: {
  tagged: FileRow[];
  snapshot: FileRow[];
  version: { id: string; created_at: string } | null;
}): { files: FileRow[]; selector: VersionSelector; warning: string | null } {
  if (!input.version) {
    return { files: input.tagged, selector: 'all-files', warning: null };
  }
  if (input.tagged.length > 0) {
    return { files: input.tagged, selector: 'version-tag', warning: null };
  }
  return {
    files: input.snapshot,
    selector: 'version-snapshot',
    warning: 'No files were tagged to this version; an as-of snapshot of files created on or before the version was exported.',
  };
}

function safeBagName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '') || 'bag';
}

export async function exportItemAIP(itemId: string, userId: string, options: ExportOptions = {}): Promise<AIPExportResult> {
  const supabase = getSupabaseAdminClient();
  const warnings: string[] = [];

  const { data: item, error: itemError } = await supabase
    .from('repository_items')
    .select('*')
    .eq('id', itemId)
    .maybeSingle();
  if (itemError) return { success: false, error: itemError.message };
  if (!item) return { success: false, error: 'Item not found.' };

  let version: VersionRow | null = null;
  if (options.versionId) {
    const { data: versionRow, error: versionError } = await supabase
      .from('repository_versions')
      .select('id, repository_item_id, version_number, change_note, created_by, created_at')
      .eq('id', options.versionId)
      .eq('repository_item_id', itemId)
      .maybeSingle();
    if (versionError) return { success: false, error: versionError.message };
    if (!versionRow) return { success: false, error: 'Version not found for this item.' };
    version = versionRow as VersionRow;
  }

  let filesQuery = supabase
    .from('repository_files')
    .select('id, original_filename, display_filename, mime_type, role, display_order, storage_provider, storage_bucket, storage_key, checksum, checksum_algorithm, repository_version_id, created_at')
    .eq('repository_item_id', itemId);

  if (version) {
    filesQuery = filesQuery.eq('repository_version_id', version.id);
  }
  const tagged = await filesQuery.order('display_order', { ascending: true });

  const taggedFiles = (tagged.data ?? []) as unknown as FileRow[];
  if (tagged.error) return { success: false, error: tagged.error.message };

  let snapshotFiles: FileRow[] = [];
  if (version && taggedFiles.length === 0) {
    const { data: snapshot, error: snapshotError } = await supabase
      .from('repository_files')
      .select('id, original_filename, display_filename, mime_type, role, display_order, storage_provider, storage_bucket, storage_key, checksum, checksum_algorithm, repository_version_id, created_at')
      .eq('repository_item_id', itemId)
      .lte('created_at', version.created_at)
      .order('display_order', { ascending: true });
    if (snapshotError) return { success: false, error: snapshotError.message };
    snapshotFiles = (snapshot ?? []) as unknown as FileRow[];
  }

  const resolved = resolveVersionFiles({ tagged: taggedFiles, snapshot: snapshotFiles, version });
  const selector = resolved.selector;
  const files = resolved.files;
  if (resolved.warning) warnings.push(resolved.warning);
  if (files.length === 0) return { success: false, error: 'No repository files to export.' };

  const payload: Array<{ path: string; bytes: Buffer; contentType?: string; role?: string }> = [];
  const fileDescriptors: Array<Record<string, unknown>> = [];
  const skipped: Array<Record<string, unknown>> = [];

  for (const file of files) {
    const path = 'data/' + sanitizePayloadPath(file.original_filename);
    if (payload.some((entry) => entry.path === path)) {
      return { success: false, error: `Duplicate payload path after sanitisation: ${path}` };
    }
    const read = await readStoredObject({
      provider: (file.storage_provider as 'supabase' | 'b2') || 'supabase',
      bucket: file.storage_bucket,
      key: file.storage_key,
    });
    if (read.status !== 'ok' || !read.bytes) {
      skipped.push({ fileId: file.id, path, reason: read.status, detail: read.error ?? null });
      warnings.push(`Skipped ${file.original_filename}: ${read.status}${read.error ? ` (${read.error})` : ''}`);
      continue;
    }
    if (file.checksum && sha256Bytes(read.bytes) !== file.checksum.toLowerCase()) {
      skipped.push({ fileId: file.id, path, reason: 'checksum_mismatch_at_export', detail: 'Stored bytes do not match the recorded checksum.' });
      warnings.push(`Skipped ${file.original_filename}: stored bytes do not match the recorded checksum.`);
      continue;
    }
    payload.push({ path, bytes: read.bytes, contentType: file.mime_type ?? undefined, role: file.role });
    fileDescriptors.push({
      path,
      fileId: file.id,
      role: file.role,
      originalFilename: file.original_filename,
      mimeType: file.mime_type,
      checksum: sha256Bytes(read.bytes),
      size: read.bytes.byteLength,
      storageProvider: file.storage_provider,
      createdAt: file.created_at,
    });
  }

  if (payload.length === 0) return { success: false, error: 'No exportable payload: every source file was skipped.', warnings };

  const { data: versions, error: versionsError } = await supabase
    .from('repository_versions')
    .select('id, version_number, change_note, created_by, created_at')
    .eq('repository_item_id', itemId)
    .order('version_number', { ascending: false });
  if (versionsError) return { success: false, error: versionsError.message };

  const bagName = safeBagName(options.bagName ?? (version ? `item-${itemId}-v${String(version.version_number).padStart(4, '0')}` : `item-${itemId}`));
  const exportedAt = new Date().toISOString();

  const bundle = buildAIP({
    bagName,
    payload,
    bagInfo: {
      'ESUT-Item-Id': itemId,
      'ESUT-Item-Version': version ? String(version.version_number) : 'current',
      'ESUT-File-Selector': selector,
      'Internal-Sender-Description': String(item.title ?? ''),
    },
    metadata: {
      descriptive: {
        id: item.id,
        title: item.title,
        authors: item.authors,
        abstract: item.abstract,
        keywords: item.keywords,
        year: item.year,
        item_type: item.item_type,
        type: item.type,
        doi: item.doi,
        license: item.license,
        visibility: item.visibility,
        status: item.status,
        department: item.department,
        supervisor: item.supervisor,
        handle: item.handle,
        language: item.language,
        subjects: item.subjects,
        contributors: item.contributors,
        orcid_ids: item.orcid_ids,
        faculty_code: item.faculty_code,
        community_id: item.community_id,
        collection_id: item.collection_id,
        authority_id: item.authority_id,
      },
      administrative: {
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        submitterId: item.submitter_id,
        exportedAt,
        exportedBy: userId,
        versionId: version?.id ?? null,
        versionNumber: version?.version_number ?? null,
        fileSelector: selector,
        sourceFileCount: files.length,
        skippedFiles: skipped,
        files: fileDescriptors,
      },
      rights: {
        visibility: item.visibility,
        accessLevel: 'PUBLIC',
        embargoUntil: item.embargo_until,
        license: item.license ?? null,
      },
      provenance: {
        source: 'ESUT Smart Library',
        system: 'ESUT Smart Library Preservation',
        aipFormat: 'BagIt-1.0',
        bagName,
        exportedAt,
        exportedBy: userId,
        selector,
         handlingPolicy: 'No credentials, API keys, tokens or signed URLs are written into AIP metadata.',
      },
      versions: {
        itemId,
        currentVersionId: version?.id ?? null,
        currentVersionNumber: version?.version_number ?? null,
        versionCount: (versions ?? []).length,
        versions: (versions ?? []).map((row) => ({
          id: row.id,
          versionNumber: row.version_number,
          changeNote: row.change_note,
          createdBy: row.created_by,
          createdAt: row.created_at,
        })),
      },
    },
  });

  const manifestTxt = bundle.files.get('manifest-sha256.txt');
  const manifestChecksum = manifestTxt ? sha256Bytes(manifestTxt) : '';
  const validation = validateAIP(bundle);

  if (!validation.valid) {
    const { error: rejectedEventError } = await supabase.from('preservation_events').insert({
      repository_item_id: itemId,
      event_type: 'AIP_VALIDATED',
      details: { aipPath: bagName, valid: false, exported: false, errors: validation.errors, warnings: validation.warnings, selector },
      actor_id: userId,
    });
    if (rejectedEventError) return { success: false, aipPath: bagName, error: rejectedEventError.message };
    return { success: false, aipPath: bagName, manifest: manifestTxt?.toString('utf8'), checksum: manifestChecksum, fileCount: payload.length, validation, warnings, error: `AIP failed validation: ${validation.errors[0]}` };
  }

  const store = supabaseStore();
  for (const [path, bytes] of bundle.files) {
    const written = await store.write({ bucket: AIP_BUCKET, key: `${bagName}/${path}` }, bytes, contentTypeFor(path));
    if (written.status !== 'ok') {
      return { success: false, aipPath: bagName, error: `Failed to write ${path}: ${written.error}` , warnings };
    }
  }

  const { error: eventError } = await supabase.from('preservation_events').insert({
    repository_item_id: itemId,
    event_type: 'AIP_EXPORTED',
    details: {
      aipPath: bagName,
      fileCount: payload.length,
      payloadChecksum: manifestChecksum,
      selector,
      versionId: version?.id ?? null,
      validation: { valid: validation.valid, errorCount: validation.errors.length, warningCount: validation.warnings.length },
    },
    actor_id: userId,
  });
  if (eventError) return { success: false, aipPath: bagName, error: eventError.message };

  const { error: validationEventError } = await supabase.from('preservation_events').insert({
    repository_item_id: itemId,
    event_type: 'AIP_VALIDATED',
    details: { aipPath: bagName, valid: validation.valid, exported: true, errors: validation.errors, warnings: validation.warnings },
    actor_id: userId,
  });
  if (validationEventError) return { success: false, aipPath: bagName, error: validationEventError.message };

  return {
    success: true,
    aipPath: bagName,
    manifest: manifestTxt?.toString('utf8'),
    checksum: manifestChecksum,
    fileCount: payload.length,
    validation,
    warnings,
  };
}

function contentTypeFor(path: string): string {
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.txt')) return 'text/plain';
  return 'application/octet-stream';
}

export { buildAIP, validateAIP, sanitizePayloadPath, sha256Bytes };
export type { AIPBundle, AIPValidation };
