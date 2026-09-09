import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type MigTab = 'dspace' | 'koha' | 'csv' | 'history';

interface ParsedItem {
  title: string;
  authors: string[];
  year: number;
  abstract: string;
  subjects: string[];
  type: string;
  language: string;
  identifier?: string;
  isbn?: string;
  keywords?: string[];
}

interface MigLog {
  id: string; migration_type: string; items_count: number;
  imported_by: string | null; status: string; error_message: string | null;
  batch_id: string; created_at: string;
}

// ── ZIP reader (PKZIP local file headers, stored + deflate) ──────────────────
async function readZipEntries(buffer: ArrayBuffer): Promise<Map<string, string>> {
  const view = new DataView(buffer);
  const decoder = new TextDecoder('utf-8');
  const result = new Map<string, string>();
  let offset = 0;

  while (offset + 30 < buffer.byteLength) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break;

    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const fileNameBytes = new Uint8Array(buffer, offset + 30, fileNameLen);
    const fileName = decoder.decode(fileNameBytes);
    const dataOffset = offset + 30 + fileNameLen + extraLen;

    if (compressedSize > 0 && (fileName.endsWith('.xml') || fileName.endsWith('.txt'))) {
      const raw = new Uint8Array(buffer, dataOffset, compressedSize);
      try {
        if (method === 0) {
          result.set(fileName, decoder.decode(raw));
        } else if (method === 8) {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          const reader = ds.readable.getReader();
          writer.write(raw);
          writer.close();
          const chunks: Uint8Array[] = [];
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          const total = chunks.reduce((n, c) => n + c.length, 0);
          const merged = new Uint8Array(total);
          let pos = 0;
          for (const c of chunks) { merged.set(c, pos); pos += c.length; }
          result.set(fileName, decoder.decode(merged));
        }
      } catch { /* skip unreadable entries */ }
    }

    offset = dataOffset + compressedSize;
  }

  return result;
}

function parseDublinCore(xml: string): ParsedItem {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const vals = (el: string) =>
    Array.from(doc.querySelectorAll(`dcvalue[element="${el}"]`)).map(n => n.textContent?.trim() ?? '').filter(Boolean);
  const first = (el: string) => vals(el)[0] ?? '';

  const dateStr = first('date');
  const year = parseInt(dateStr.substring(0, 4)) || new Date().getFullYear();

  return {
    title: first('title') || 'Untitled',
    authors: vals('contributor').concat(vals('creator')),
    year,
    abstract: vals('description').find(d => d.length > 30) ?? '',
    subjects: vals('subject'),
    type: first('type') || 'Article',
    language: first('language') || 'English',
    identifier: vals('identifier').find(i => i.startsWith('http')) ?? '',
    keywords: [],
  };
}

async function parseDSpaceSAF(file: File): Promise<ParsedItem[]> {
  const buffer = await file.arrayBuffer();
  const entries = await readZipEntries(buffer);
  const items: ParsedItem[] = [];
  for (const [name, content] of entries) {
    if (name.includes('dublin_core.xml')) {
      try { items.push(parseDublinCore(content)); } catch { /* skip */ }
    }
  }
  return items;
}

// ── MARC21 binary parser ─────────────────────────────────────────────────────
async function parseMARCBinary(file: File): Promise<ParsedItem[]> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const dec = new TextDecoder('utf-8');
  const items: ParsedItem[] = [];
  let pos = 0;

  while (pos + 24 < bytes.length) {
    const leaderBytes = bytes.slice(pos, pos + 24);
    const leaderStr = dec.decode(leaderBytes);
    const recordLength = parseInt(leaderStr.substring(0, 5));
    const baseAddr = parseInt(leaderStr.substring(12, 17));
    if (isNaN(recordLength) || recordLength <= 24 || pos + recordLength > bytes.length) break;

    const dirCount = Math.floor((baseAddr - 25) / 12);
    const fields = new Map<string, string[]>();

    for (let i = 0; i < dirCount; i++) {
      const dp = pos + 24 + i * 12;
      if (dp + 12 > bytes.length) break;
      const tag = dec.decode(bytes.slice(dp, dp + 3));
      const flen = parseInt(dec.decode(bytes.slice(dp + 3, dp + 7)));
      const foff = parseInt(dec.decode(bytes.slice(dp + 7, dp + 12)));
      const fstart = pos + baseAddr + foff;
      const fend = fstart + flen - 1;
      if (fend > bytes.length) break;

      let text = dec.decode(bytes.slice(fstart, fend));
      if (tag >= '010') {
        text = text.substring(2).split('\x1f').slice(1).map(sf => sf.substring(1)).join(' ');
      }
      if (!fields.has(tag)) fields.set(tag, []);
      fields.get(tag)!.push(text.trim());
    }

    const title = fields.get('245')?.[0] ?? '';
    if (title) {
      const authors = [...(fields.get('100') ?? []), ...(fields.get('700') ?? [])];
      const subjects = fields.get('650') ?? [];
      const pub260 = fields.get('260')?.[0] ?? '';
      const pub264 = fields.get('264')?.[0] ?? '';
      const ym = (pub260 + pub264).match(/\d{4}/);
      items.push({
        title,
        authors,
        year: ym ? parseInt(ym[0]) : new Date().getFullYear(),
        abstract: fields.get('520')?.[0] ?? '',
        subjects,
        type: 'Book',
        language: fields.get('041')?.[0] ?? 'English',
        isbn: fields.get('020')?.[0] ?? '',
        keywords: [],
      });
    }
    pos += recordLength;
  }
  return items;
}

async function parseMARCXML(xml: string): Promise<ParsedItem[]> {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const records = Array.from(doc.querySelectorAll('record'));
  return records.map(rec => {
    const getField = (tag: string, codes: string[] = []) => {
      const field = rec.querySelector(`datafield[tag="${tag}"]`);
      if (!field) return '';
      if (codes.length === 0) return field.textContent?.trim() ?? '';
      return codes.map(c => field.querySelector(`subfield[code="${c}"]`)?.textContent?.trim() ?? '').filter(Boolean).join(' ');
    };
    const getAllFields = (tag: string, code = 'a') =>
      Array.from(rec.querySelectorAll(`datafield[tag="${tag}"] subfield[code="${code}"]`))
        .map(n => n.textContent?.trim() ?? '').filter(Boolean);

    const title245 = getField('245', ['a', 'b', 'n', 'p']).trim().replace(/ \/$/, '');
    const year = (getField('260', ['c']) + getField('264', ['c'])).match(/\d{4}/)?.[0];
    return {
      title: title245 || 'Untitled',
      authors: getAllFields('100', 'a').concat(getAllFields('700', 'a')),
      year: year ? parseInt(year) : new Date().getFullYear(),
      abstract: getField('520', ['a']),
      subjects: getAllFields('650', 'a'),
      type: 'Book',
      language: getField('041', ['a']) || 'English',
      isbn: getField('020', ['a']),
      keywords: [],
    };
  }).filter(item => item.title !== 'Untitled' || item.authors.length > 0);
}

function parseCSV(text: string): ParsedItem[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
  return lines.slice(1).map(line => {
    const cols = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) ?? [];
    const val = (key: string) => (cols[headers.indexOf(key)] ?? '').replace(/^"|"$/g, '').trim();
    const authStr = val('authors');
    const subjStr = val('subjects');
    const kwStr = val('keywords');
    return {
      title: val('title') || 'Untitled',
      authors: authStr ? authStr.split(';').map(s => s.trim()).filter(Boolean) : [],
      year: parseInt(val('year')) || new Date().getFullYear(),
      abstract: val('abstract'),
      subjects: subjStr ? subjStr.split(';').map(s => s.trim()).filter(Boolean) : [],
      type: val('type') || 'Article',
      language: val('language') || 'English',
      keywords: kwStr ? kwStr.split(';').map(s => s.trim()).filter(Boolean) : [],
    };
  }).filter(item => item.title !== 'Untitled');
}

const CSV_TEMPLATE =
  'title,authors,year,type,subjects,keywords,abstract,department,language,file_url\n' +
  '"Sample Title","Author One;Author Two",2024,"Research Paper","Education;Science","learning;research","Abstract text here.","Education","English",""\n';

export default function AdminMigration() {
  const [activeTab, setActiveTab] = useState<MigTab>('dspace');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedItem[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [logs, setLogs] = useState<MigLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (activeTab === 'history') loadLogs(); }, [activeTab]);

  const loadLogs = async () => {
    setLogsLoading(true);
    const { data } = await supabase.from('migration_logs').select('*').order('created_at', { ascending: false }).limit(50);
    setLogs(data ?? []);
    setLogsLoading(false);
  };

  const reset = () => { setFile(null); setPreview([]); setError(''); setSuccess(''); setProgress(0); };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview([]);
    setError('');
    setSuccess('');
  };

  const handleParse = async () => {
    if (!file) { setError('Select a file first.'); return; }
    setParsing(true);
    setError('');
    setPreview([]);

    try {
      let parsed: ParsedItem[] = [];

      if (activeTab === 'dspace') {
        if (!file.name.endsWith('.zip')) throw new Error('DSpace SAF requires a .zip file.');
        parsed = await parseDSpaceSAF(file);
      } else if (activeTab === 'koha') {
        if (file.name.endsWith('.mrc')) {
          parsed = await parseMARCBinary(file);
        } else if (file.name.endsWith('.xml')) {
          const text = await file.text();
          parsed = await parseMARCXML(text);
        } else {
          throw new Error('Koha MARC21 requires a .mrc or .xml file.');
        }
      } else if (activeTab === 'csv') {
        if (!file.name.endsWith('.csv')) throw new Error('Please upload a .csv file.');
        const text = await file.text();
        parsed = parseCSV(text);
      }

      if (parsed.length === 0) throw new Error('No valid records found in the file.');
      setPreview(parsed);
    } catch (e: any) {
      setError(e.message ?? 'Parse error.');
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);
    setProgress(0);
    setError('');
    setSuccess('');

    const { data: { user } } = await supabase.auth.getUser();
    const batchId = crypto.randomUUID();

    const logRes = await supabase.from('migration_logs').insert({
      migration_type: activeTab.toUpperCase(),
      items_count: preview.length,
      imported_by: user?.id ?? null,
      status: 'pending',
      batch_id: batchId,
    }).select('id').single();

    const logId = logRes.data?.id;

    try {
      const CHUNK = 20;
      let done = 0;

      for (let i = 0; i < preview.length; i += CHUNK) {
        const batch = preview.slice(i, i + CHUNK);
        const rows = batch.map(item => ({
          title: item.title,
          authors: item.authors.map(name => ({ name })),
          abstract: item.abstract || null,
          item_type: item.type,
          type: item.type,
          subjects: item.subjects,
          keywords: item.keywords ?? [],
          year: item.year,
          language: item.language,
          status: 'submitted',
          visibility: 'global',
          submitter_id: user?.id ?? null,
        }));

        const { error: insertErr } = await supabase.from('repository_items').insert(rows);
        if (insertErr) throw new Error(insertErr.message);

        done += batch.length;
        setProgress(Math.round((done / preview.length) * 100));
      }

      if (logId) {
        await supabase.from('migration_logs').update({ status: 'complete', items_count: preview.length }).eq('id', logId);
      }

      setSuccess(`Successfully imported ${preview.length} items.`);
      setPreview([]);
      setFile(null);
    } catch (e: any) {
      if (logId) {
        await supabase.from('migration_logs').update({ status: 'failed', error_message: e.message }).eq('id', logId);
      }
      setError(e.message ?? 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleRollback = async (log: MigLog) => {
    if (!confirm(`Rollback this migration? This will delete ${log.items_count} items imported in batch ${log.batch_id.slice(0, 8)}…`)) return;
    const { error } = await supabase.rpc('rollback_migration_batch', { p_batch_id: log.batch_id });
    if (error) {
      alert('Rollback not available via RPC — contact the database administrator.');
      return;
    }
    await supabase.from('migration_logs').update({ status: 'failed', error_message: 'Rolled back by admin' }).eq('id', log.id);
    loadLogs();
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'adlp_repository_import_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const accept: Record<MigTab, string> = {
    dspace: '.zip', koha: '.mrc,.xml', csv: '.csv', history: '',
  };

  const tabLabels: Record<MigTab, string> = {
    dspace: 'DSpace SAF', koha: 'Koha MARC21', csv: 'CSV Import', history: 'Migration History',
  };

  const previewCols = activeTab === 'koha'
    ? ['title', 'authors', 'year', 'isbn', 'subjects']
    : ['title', 'authors', 'year', 'type', 'subjects'];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Migration Tool</h1>
        <p className="text-neutral-600 mt-1">Import records from legacy library systems into ADLP.</p>
      </div>

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="flex border-b overflow-x-auto">
          {(['dspace', 'koha', 'csv', 'history'] as MigTab[]).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); reset(); }}
              className={`px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? 'border-primary-700 text-primary-700' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {activeTab !== 'history' && (
          <div className="p-6 space-y-6">
            {/* Instructions */}
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 text-sm text-primary-800">
              {activeTab === 'dspace' && (
                <>
                  <p className="font-semibold mb-1">DSpace Simple Archive Format (SAF)</p>
                  <p>Export your DSpace collection as SAF ZIP. Each item folder must contain <code>dublin_core.xml</code>. Supported compression: stored and deflate.</p>
                </>
              )}
              {activeTab === 'koha' && (
                <>
                  <p className="font-semibold mb-1">Koha MARC21 Records</p>
                  <p>Upload a <code>.mrc</code> binary MARC file or MARC XML (<code>.xml</code>) exported from Koha. Fields mapped: 245→title, 100/700→authors, 020→ISBN, 650→subjects, 260/264→year, 520→abstract, 041→language.</p>
                </>
              )}
              {activeTab === 'csv' && (
                <>
                  <p className="font-semibold mb-1">CSV Template Import</p>
                  <p>Download the template, fill it in, then upload the completed CSV. Authors and subjects should be separated by semicolons within a field.</p>
                  <button onClick={downloadTemplate} className="mt-2 btn-outline text-xs py-1 px-3">
                    Download CSV Template
                  </button>
                </>
              )}
            </div>

            {/* File drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-neutral-300 rounded-xl p-12 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
            >
              <input ref={fileRef} type="file" accept={accept[activeTab]} onChange={handleFile} className="hidden" />
              {file ? (
                <div>
                  <p className="text-3xl mb-2">📄</p>
                  <p className="font-semibold">{file.name}</p>
                  <p className="text-sm text-neutral-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  <button onClick={e => { e.stopPropagation(); reset(); }} className="text-xs text-red-500 hover:text-red-700 mt-2">Remove</button>
                </div>
              ) : (
                <div>
                  <p className="text-3xl mb-2">☁️</p>
                  <p className="font-semibold text-neutral-700">Click to upload</p>
                  <p className="text-xs text-neutral-400 mt-1">{accept[activeTab]}</p>
                </div>
              )}
            </div>

            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
            {success && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">{success}</div>}

            <div className="flex gap-2">
              <button onClick={handleParse} disabled={!file || parsing}
                className="btn-outline disabled:opacity-50">
                {parsing ? 'Parsing…' : 'Preview (first 10)'}
              </button>
              {preview.length > 0 && (
                <button onClick={handleImport} disabled={importing}
                  className="btn-primary disabled:opacity-50">
                  {importing ? `Importing… ${progress}%` : `Confirm & Import ${preview.length} records`}
                </button>
              )}
            </div>

            {importing && (
              <div>
                <div className="w-full bg-neutral-200 rounded-full h-3">
                  <div className="bg-primary-700 h-3 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-neutral-500 mt-1">{progress}% — importing…</p>
              </div>
            )}
          </div>
        )}

        {/* Preview table */}
        {preview.length > 0 && activeTab !== 'history' && (
          <div className="px-6 pb-6">
            <h3 className="font-semibold text-sm mb-3 text-neutral-700">
              Preview — first {Math.min(10, preview.length)} of {preview.length} records
            </h3>
            <div className="overflow-x-auto border border-neutral-200 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-neutral-50 border-b">
                  <tr>
                    {previewCols.map(col => (
                      <th key={col} className="text-left p-2 font-semibold capitalize">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-b hover:bg-neutral-50">
                      {previewCols.map(col => {
                        const val = (row as any)[col];
                        const display = Array.isArray(val) ? val.join('; ') : String(val ?? '');
                        return (
                          <td key={col} className="p-2 max-w-xs">
                            <p className="line-clamp-2">{display || '—'}</p>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Migration History */}
        {activeTab === 'history' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">All Migrations</h3>
              <button onClick={loadLogs} className="btn-ghost text-xs">Refresh</button>
            </div>

            {logsLoading ? (
              <div className="text-center py-8 text-neutral-400">Loading…</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-neutral-400">No migration history yet.</div>
            ) : (
              <div className="space-y-3">
                {logs.map(log => {
                  const ageMs = Date.now() - new Date(log.created_at).getTime();
                  const canRollback = ageMs < 24 * 60 * 60 * 1000 && log.status === 'complete';

                  return (
                    <div key={log.id} className="border border-neutral-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-semibold text-sm">{log.migration_type} Import</p>
                          <p className="text-xs text-neutral-400">{new Date(log.created_at).toLocaleString('en-GB')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`badge text-xs ${log.status === 'complete' ? 'badge-success' : log.status === 'failed' ? 'badge-error' : 'badge-warning'}`}>
                            {log.status}
                          </span>
                          {canRollback && (
                            <button onClick={() => handleRollback(log)}
                              className="text-xs text-red-600 border border-red-200 rounded px-2 py-0.5 hover:bg-red-50">
                              Rollback
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <p className="text-neutral-400">Items Imported</p>
                          <p className="font-semibold">{log.items_count}</p>
                        </div>
                        <div>
                          <p className="text-neutral-400">Batch ID</p>
                          <p className="font-mono">{log.batch_id.slice(0, 8)}…</p>
                        </div>
                        <div>
                          <p className="text-neutral-400">Status</p>
                          <p className="font-semibold capitalize">{log.status}</p>
                        </div>
                      </div>
                      {log.error_message && (
                        <p className="text-xs text-red-600 bg-red-50 rounded p-2">{log.error_message}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
