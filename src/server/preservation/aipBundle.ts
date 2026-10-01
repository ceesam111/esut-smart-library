import { createHash } from 'crypto';

export const BAGIT_VERSION = '1.0';
export const TAG_ENCODING = 'UTF-8';
export const METADATA_FILES = [
  'descriptive',
  'administrative',
  'rights',
  'provenance',
  'versions',
] as const;

export type MetadataFileName = (typeof METADATA_FILES)[number];

export interface AIPPayloadFile {
  path: string;
  bytes: Buffer;
  contentType?: string;
  role?: string;
}

export interface AIPMetadata {
  descriptive: Record<string, unknown>;
  administrative: Record<string, unknown>;
  rights: Record<string, unknown>;
  provenance: Record<string, unknown>;
  versions: Record<string, unknown>;
}

export interface BuildAIPInput {
  bagName: string;
  payload: AIPPayloadFile[];
  metadata: AIPMetadata;
  bagInfo?: Record<string, string>;
}

export interface AIPBundle {
  bagName: string;
  files: Map<string, Buffer>;
}

export interface AIPValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function sha256Bytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * BagIt payloads are stored as relative POSIX paths. Anything absolute,
 * parent-traversing, or Windows-unsafe is rejected before it can be written
 * or read back out of storage.
 */
export function isSafeRelativePath(input: string): boolean {
  if (typeof input !== 'string') return false;
  if (!input || input.includes('\0')) return false;
  if (input.includes('\\')) return false;
  if (input.startsWith('/') || /^[a-zA-Z]:/.test(input)) return false;
  const segments = input.split('/');
  return segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

export function sanitizePayloadPath(filename: string): string {
  const base = (filename || 'file').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  const safe = base || 'file';
  return `files/${safe}`;
}

export function parseManifest(text: string): { entries: Array<{ sha256: string; path: string }>; errors: string[] } {
  const entries: Array<{ sha256: string; path: string }> = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const match = /^([0-9a-fA-F]{64})\s+(\S.*)$/.exec(raw);
    if (!match) {
      errors.push(`manifest line ${i + 1} is malformed.`);
      continue;
    }
    const path = match[2].trim();
    if (!isSafeRelativePath(path)) {
      errors.push(`manifest line ${i + 1} has an unsafe path: ${path}`);
      continue;
    }
    entries.push({ sha256: match[1].toLowerCase(), path });
  }
  return { entries, errors };
}

export function parseBagIt(text: string): { fields: Record<string, string>; errors: string[] } {
  const fields: Record<string, string> = {};
  const errors: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx <= 0) {
      errors.push(`bagit.txt line is malformed: ${line}`);
      continue;
    }
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  if (!fields['BagIt-Version']) errors.push('bagit.txt is missing BagIt-Version.');
  if (!fields['Tag-File-Character-Encoding']) errors.push('bagit.txt is missing Tag-File-Character-Encoding.');
  return { fields, errors };
}

export function parseBagInfo(text: string): { fields: Record<string, string>; errors: string[] } {
  const fields: Record<string, string> = {};
  const errors: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx <= 0) {
      errors.push(`bag-info.txt line is malformed: ${line}`);
      continue;
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    fields[key] = fields[key] ? `${fields[key]}, ${value}` : value;
  }
  return { fields, errors };
}

export function buildManifest(entries: Array<{ path: string; sha256: string }>): string {
  return entries.map((entry) => `${entry.sha256}  ${entry.path}`).join('\n') + '\n';
}

function buildBagItTxt(): string {
  return `BagIt-Version: ${BAGIT_VERSION}\nTag-File-Character-Encoding: ${TAG_ENCODING}\n`;
}

function buildBagInfoTxt(fields: Record<string, string>): string {
  return Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && String(value).length > 0)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n') + '\n';
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

const SECRET_KEY_PATTERN = /(password|passwd|secret|token|api[-_]?key|private[-_]?key|credential|authorization|signature)/i;
const SIGNED_URL_PATTERN = /(X-Amz-Signature|X-Amz-Credential|X-Goog-Signature|token=[A-Za-z0-9._-]{16,}|sig[nature]*=[A-Za-z0-9._-]{16,})/i;

function findSecretLeaks(bundle: AIPBundle): string[] {
  const leaks: string[] = [];
  for (const [path, bytes] of bundle.files) {
    if (!path.startsWith('metadata/')) continue;
    const text = bytes.toString('utf8');
    if (SIGNED_URL_PATTERN.test(text)) leaks.push(`${path} appears to contain a signed URL.`);
    try {
      const parsed: unknown = JSON.parse(text);
      const keys: string[] = [];
      const walk = (node: unknown, depth: number) => {
        if (depth > 8 || !node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          node.forEach((child) => walk(child, depth + 1));
          return;
        }
        for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
          if (SECRET_KEY_PATTERN.test(key)) keys.push(key);
          walk(value, depth + 1);
        }
      };
      walk(parsed, 0);
      if (keys.length) leaks.push(`${path} contains sensitive keys: ${[...new Set(keys)].join(', ')}.`);
    } catch {
      // malformed JSON is reported separately by the validator.
    }
  }
  return leaks;
}

export function buildAIP(input: BuildAIPInput): AIPBundle {
  const files = new Map<string, Buffer>();
  const payloadEntries: Array<{ path: string; sha256: string }> = [];
  let totalBytes = 0;

  for (const file of input.payload) {
    if (!isSafeRelativePath(file.path)) {
      throw new Error(`Unsafe AIP payload path: ${file.path}`);
    }
    // BagIt stores every payload under data/.
    const payloadPath = file.path.startsWith('data/') ? file.path : `data/${file.path}`;
    if (files.has(payloadPath)) {
      throw new Error(`Duplicate AIP payload path: ${payloadPath}`);
    }
    if (payloadPath.split('/').includes('..')) {
      throw new Error(`Unsafe AIP payload path: ${payloadPath}`);
    }
    files.set(payloadPath, file.bytes);
    payloadEntries.push({ path: payloadPath, sha256: sha256Bytes(file.bytes) });
    totalBytes += file.bytes.byteLength;
  }

  const payloadOxum = `${totalBytes}.${payloadEntries.length}`;
  const manifestTxt = buildManifest(payloadEntries);
  const bagItTxt = buildBagItTxt();
  const bagInfoTxt = buildBagInfoTxt({
    'External-Description': String(input.metadata.descriptive.title ?? input.bagName),
    'Bagging-Date': new Date().toISOString().slice(0, 10),
    'Bag-Count': `${payloadEntries.length}/${payloadEntries.length}`,
    'Source-Organization': 'ESUT Smart Library',
    'Internal-Sender-Identifier': String(input.bagInfo?.['Internal-Sender-Identifier'] ?? 'ESUT-SMART-LIBRARY'),
    'Payload-Oxum': payloadOxum,
    ...(input.bagInfo ?? {}),
  });

  const metadataPaths: string[] = [];
  for (const name of METADATA_FILES) {
    const path = `metadata/${name}.json`;
    files.set(path, Buffer.from(stableJson(input.metadata[name]), 'utf8'));
    metadataPaths.push(path);
  }

  files.set('bagit.txt', Buffer.from(bagItTxt, 'utf8'));
  files.set('bag-info.txt', Buffer.from(bagInfoTxt, 'utf8'));
  files.set('manifest-sha256.txt', Buffer.from(manifestTxt, 'utf8'));

  const tagEntries = ['bagit.txt', 'bag-info.txt', 'manifest-sha256.txt', ...metadataPaths]
    .map((path) => ({ path, sha256: sha256Bytes(files.get(path) as Buffer) }));
  files.set('tagmanifest-sha256.txt', Buffer.from(buildManifest(tagEntries), 'utf8'));

  return { bagName: input.bagName, files };
}

export function validateAIP(bundle: AIPBundle): AIPValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const bagItRaw = bundle.files.get('bagit.txt');
  if (!bagItRaw) {
    errors.push('Missing bagit.txt.');
  } else {
    const parsed = parseBagIt(bagItRaw.toString('utf8'));
    errors.push(...parsed.errors);
    if (parsed.fields['BagIt-Version'] && parsed.fields['BagIt-Version'] !== BAGIT_VERSION) {
      warnings.push(`BagIt-Version is ${parsed.fields['BagIt-Version']}, expected ${BAGIT_VERSION}.`);
    }
  }

  const bagInfoRaw = bundle.files.get('bag-info.txt');
  let payloadOxum: string | null = null;
  if (!bagInfoRaw) {
    errors.push('Missing bag-info.txt.');
  } else {
    const parsed = parseBagInfo(bagInfoRaw.toString('utf8'));
    errors.push(...parsed.errors);
    payloadOxum = parsed.fields['Payload-Oxum'] ?? null;
    if (!payloadOxum) warnings.push('bag-info.txt has no Payload-Oxum.');
    if (!parsed.fields['Bagging-Date']) warnings.push('bag-info.txt has no Bagging-Date.');
  }

  const manifestRaw = bundle.files.get('manifest-sha256.txt');
  let manifestEntries: Array<{ sha256: string; path: string }> = [];
  if (!manifestRaw) {
    errors.push('Missing manifest-sha256.txt.');
  } else {
    const parsed = parseManifest(manifestRaw.toString('utf8'));
    errors.push(...parsed.errors);
    manifestEntries = parsed.entries;
    if (manifestEntries.length === 0) errors.push('manifest-sha256.txt lists no payload files.');
  }

  const manifestPaths = new Set(manifestEntries.map((entry) => entry.path));
  for (const entry of manifestEntries) {
    const bytes = bundle.files.get(entry.path);
    if (!bytes) {
      errors.push(`Manifest lists a payload that is not in the bag: ${entry.path}`);
      continue;
    }
    if (sha256Bytes(bytes) !== entry.sha256) {
      errors.push(`Checksum mismatch for payload: ${entry.path}`);
    }
  }

  const payloadPaths = [...bundle.files.keys()].filter((path) => path.startsWith('data/'));
  for (const path of payloadPaths) {
    if (!manifestPaths.has(path)) errors.push(`Payload missing from manifest-sha256.txt: ${path}`);
  }
  if (payloadPaths.length === 0) warnings.push('Bag contains no data/ payload files.');

  const tagManifestRaw = bundle.files.get('tagmanifest-sha256.txt');
  if (!tagManifestRaw) {
    errors.push('Missing tagmanifest-sha256.txt.');
  } else {
    const parsed = parseManifest(tagManifestRaw.toString('utf8'));
    errors.push(...parsed.errors);
    const tagPaths = new Set(parsed.entries.map((entry) => entry.path));
    for (const required of ['bagit.txt', 'bag-info.txt', 'manifest-sha256.txt']) {
      if (!tagPaths.has(required)) errors.push(`tagmanifest-sha256.txt does not cover ${required}.`);
    }
    for (const entry of parsed.entries) {
      const bytes = bundle.files.get(entry.path);
      if (!bytes) {
        errors.push(`tagmanifest-sha256.txt lists a tag file that is not in the bag: ${entry.path}`);
        continue;
      }
      if (sha256Bytes(bytes) !== entry.sha256) errors.push(`Checksum mismatch for tag file: ${entry.path}`);
    }
  }

  for (const name of METADATA_FILES) {
    const path = `metadata/${name}.json`;
    const raw = bundle.files.get(path);
    if (!raw) {
      errors.push(`Missing ${path}.`);
      continue;
    }
    try {
      JSON.parse(raw.toString('utf8'));
    } catch {
      errors.push(`Malformed JSON in ${path}.`);
    }
  }

  if (payloadOxum) {
    const [sizeText, countText] = payloadOxum.split('.');
    const declaredBytes = Number(sizeText);
    const declaredCount = Number(countText);
    const actualBytes = payloadPaths.reduce((sum, path) => sum + (bundle.files.get(path)?.byteLength ?? 0), 0);
    if (!Number.isFinite(declaredBytes) || !Number.isFinite(declaredCount)) {
      errors.push('Payload-Oxum in bag-info.txt is malformed.');
    } else {
      if (declaredBytes !== actualBytes) {
        errors.push(`Payload-Oxum byte count ${declaredBytes} does not match payload ${actualBytes}.`);
      }
      if (declaredCount !== payloadPaths.length) {
        errors.push(`Payload-Oxum file count ${declaredCount} does not match payload ${payloadPaths.length}.`);
      }
    }
  }

  for (const path of bundle.files.keys()) {
    if (!isSafeRelativePath(path)) errors.push(`Bag contains an unsafe path: ${path}`);
  }

  errors.push(...findSecretLeaks(bundle));

  const descriptive = bundle.files.get('metadata/descriptive.json');
  if (descriptive) {
    try {
      const parsed = JSON.parse(descriptive.toString('utf8')) as Record<string, unknown>;
      if (!parsed.title) warnings.push('descriptive metadata has no title.');
      if (!parsed.id) warnings.push('descriptive metadata has no identifier.');
    } catch {
      // already reported
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
