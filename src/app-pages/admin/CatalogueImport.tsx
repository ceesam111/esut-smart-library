import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/lib/supabase';
import {
  CATALOGUE_TEMPLATE_COLUMNS,
  findDuplicateIsbns,
  toTemplateCsv,
  validateCatalogueRow,
  type CatalogueTemplateColumn,
} from '@/server/catalogue/importValidation';

type CsvRow = Record<string, string>;
type Mapping = Partial<Record<CatalogueTemplateColumn, string>>;

interface ImportBatch {
  id: string;
  filename: string | null;
  total_rows: number;
  valid_rows: number;
  clean_matches: number;
  needs_review: number;
  error_rows: number;
  status: string;
  created_at: string;
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

async function authFetch(url: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in.');
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed with ${res.status}`);
  return json;
}

export default function CatalogueImport() {
  const navigate = useNavigate();
  const [filename, setFilename] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [includeWarnings, setIncludeWarnings] = useState(true);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const loadBatches = useCallback(async () => {
    try {
      const json = await authFetch('/api/admin/catalogue/import');
      setBatches(json.batches ?? []);
    } catch {
      // Batch history is helpful but should not block uploading.
    }
  }, []);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setFilename(file.name);
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsedRows = result.data.filter((row) => Object.values(row).some(Boolean));
        const parsedHeaders = result.meta.fields ?? [];
        const auto: Mapping = {};
        for (const column of CATALOGUE_TEMPLATE_COLUMNS) {
          const match = parsedHeaders.find((header) => normalizeHeader(header) === column);
          if (match) auto[column] = match;
        }
        setHeaders(parsedHeaders);
        setRows(parsedRows);
        setMapping(auto);
        setMessage('');
      },
      error: (error) => setMessage(error.message),
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'] }, multiple: false });

  const normalizedRows = useMemo(() => rows.map((row) => {
    const mapped: Record<string, unknown> = {};
    for (const column of CATALOGUE_TEMPLATE_COLUMNS) mapped[column] = mapping[column] ? row[mapping[column]!] : '';
    return mapped;
  }), [mapping, rows]);

  const validation = useMemo(() => {
    const dupes = findDuplicateIsbns(normalizedRows);
    const results = normalizedRows.map((row) => validateCatalogueRow(row, dupes));
    return {
      results,
      valid: results.filter((r) => r.errors.length === 0).length,
      warnings: results.filter((r) => r.errors.length === 0 && r.warnings.length > 0).length,
      errors: results.filter((r) => r.errors.length > 0).length,
    };
  }, [normalizedRows]);

  const mappingValid = useMemo(() => {
    return !!mapping.isbn || !!mapping.title;
  }, [mapping]);

  function updateCell(index: number, column: CatalogueTemplateColumn, value: string) {
    const source = mapping[column] || column;
    if (!headers.includes(source)) setHeaders((current) => [...current, source]);
    setMapping((current) => ({ ...current, [column]: source }));
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [source]: value } : row));
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function downloadErrors() {
    const lines = ['row,errors,warnings,isbn,title'];
    validation.results.forEach((result, index) => {
      if (!result.errors.length && !result.warnings.length) return;
      lines.push([
        index + 2,
        `"${result.errors.join('; ').replace(/"/g, '""')}"`,
        `"${result.warnings.join('; ').replace(/"/g, '""')}"`,
        result.row.isbn ?? '',
        `"${(result.row.title ?? '').replace(/"/g, '""')}"`,
      ].join(','));
    });
    download('catalogue-import-errors.csv', `${lines.join('\n')}\n`);
  }

  async function stageImport() {
    setBusy(true); setMessage('');
    try {
      const validRows = validation.results
        .filter((result) => result.errors.length === 0 && (includeWarnings || result.warnings.length === 0))
        .map((_, index) => normalizedRows[index]);
      const result = await authFetch('/api/admin/catalogue/import', {
        method: 'POST',
        body: JSON.stringify({ filename, rows: validRows, includeWarnings }),
      });
      setMessage(`${result.stagedRows} rows staged — ${result.cleanMatches} clean matches ready to approve, ${result.needsReview} need review.`);
      navigate(`/admin/catalogue/import/${result.batch.id}`);
      await loadBatches();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-primary-800">Catalogue CSV Import</h1>
          <p className="text-sm text-neutral-500">Upload resources into staging for review. Nothing is written to the live catalogue until approval.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => download('catalogue-import-template.csv', toTemplateCsv())} className="btn-outline text-sm">Download template</button>
          <Link to="/admin/catalogue/staging" className="btn-outline text-sm">Review staging</Link>
        </div>
      </div>

      <div {...getRootProps()} className={`rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer bg-white ${isDragActive ? 'border-primary-600' : 'border-neutral-300'}`}>
        <input {...getInputProps()} />
        <div className="text-4xl mb-3">CSV</div>
        <p className="font-medium text-neutral-800">Drag and drop a CSV file, or click to browse</p>
        <p className="text-sm text-neutral-500 mt-1">Required per row: ISBN or title.</p>
      </div>

      {message && <div className="rounded-lg border border-primary-200 bg-primary-50 text-primary-900 px-4 py-3 text-sm">{message}</div>}

      {rows.length > 0 && (
        <>
          <section className="card p-5">
            <h2 className="font-semibold text-neutral-800 mb-3">Column Mapping</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {CATALOGUE_TEMPLATE_COLUMNS.map((column) => (
                <label key={column} className="text-xs font-medium text-neutral-600">
                  {column}{column === 'isbn' || column === 'title' ? ' *' : ''}
                  <select value={mapping[column] ?? ''} onChange={(e) => setMapping((current) => ({ ...current, [column]: e.target.value || undefined }))} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm">
                    <option value="">Not mapped</option>
                    {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {!mappingValid && <p className="text-sm text-red-600 mt-3">Map at least ISBN or title before continuing.</p>}
          </section>

          <section className="grid grid-cols-3 gap-3">
            <Stat label="Valid" value={validation.valid} tone="green" />
            <Stat label="Warnings" value={validation.warnings} tone="amber" />
            <Stat label="Errors" value={validation.errors} tone="red" />
          </section>

          <section className="card overflow-hidden">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="font-semibold text-neutral-800">Preview first 10 rows</h2>
              <button onClick={downloadErrors} className="text-sm text-primary-700 hover:underline">Download error report</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-xs text-neutral-500 uppercase"><tr>{['Status', 'ISBN', 'Title', 'Authors', 'Year', 'Type', 'Actions'].map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
                <tbody>
                  {validation.results.slice(0, 10).map((result, index) => (
                    <tr key={index} className="border-t border-neutral-100 align-top">
                      <td className="px-3 py-2"><Badge errors={result.errors.length} warnings={result.warnings.length} /></td>
                      {(['isbn', 'title', 'authors', 'year', 'item_type'] as CatalogueTemplateColumn[]).map((column) => (
                        <td key={column} className="px-3 py-2"><input value={String(normalizedRows[index][column] ?? '')} onChange={(e) => updateCell(index, column, e.target.value)} className="w-36 rounded border border-neutral-200 px-2 py-1" /></td>
                      ))}
                      <td className="px-3 py-2"><button onClick={() => removeRow(index)} className="text-red-600 text-xs">Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <label className="text-sm text-neutral-600"><input type="checkbox" checked={includeWarnings} onChange={(e) => setIncludeWarnings(e.target.checked)} className="mr-2" /> Include warning rows when staging</label>
            <button onClick={stageImport} disabled={busy || !mappingValid || validation.valid === 0} className="btn-primary disabled:opacity-50">
              {busy ? 'Staging…' : `Stage ${validation.valid} valid row(s)`}
            </button>
          </div>
        </>
      )}

      <section className="card overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="font-semibold text-neutral-800">Recent import batches</h2>
          <button onClick={loadBatches} className="text-sm text-primary-700 hover:underline">Refresh</button>
        </div>
        {batches.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">No import batches yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-500 uppercase">
                <tr>{['File', 'Rows', 'Clean', 'Review', 'Errors', 'Status', 'Created'].map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id} className="border-t border-neutral-100">
                    <td className="px-3 py-3"><Link to={`/admin/catalogue/import/${batch.id}`} className="font-medium text-primary-700 hover:underline">{batch.filename || batch.id}</Link></td>
                    <td className="px-3 py-3">{batch.valid_rows}/{batch.total_rows}</td>
                    <td className="px-3 py-3">{batch.clean_matches}</td>
                    <td className="px-3 py-3">{batch.needs_review}</td>
                    <td className="px-3 py-3">{batch.error_rows}</td>
                    <td className="px-3 py-3">{batch.status}</td>
                    <td className="px-3 py-3 text-neutral-500">{new Date(batch.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Badge({ errors, warnings }: { errors: number; warnings: number }) {
  if (errors) return <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs">{errors} error</span>;
  if (warnings) return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs">{warnings} warning</span>;
  return <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">valid</span>;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'green' | 'amber' | 'red' }) {
  const colors = { green: 'text-green-700 bg-green-50', amber: 'text-amber-700 bg-amber-50', red: 'text-red-700 bg-red-50' };
  return <div className={`rounded-xl p-4 ${colors[tone]}`}><div className="text-2xl font-bold">{value}</div><div className="text-xs font-medium">{label}</div></div>;
}
