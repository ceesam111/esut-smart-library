import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface CatalogueRecord {
  id: string;
  title: string;
  isbn: string | null;
  authors: string[];
}

interface BatchOperation {
  type: 'ADD_FIELD' | 'DELETE_FIELD' | 'REPLACE_FIELD' | 'ADD_SUBFIELD' | 'DELETE_SUBFIELD' | 'REPLACE_SUBFIELD';
  tag: string;
  subfield?: string;
  newTag?: string;
  newSubfield?: string;
  newValue?: string;
  newInd1?: string;
  newInd2?: string;
}

interface PreviewResult {
  recordId: string;
  title: string;
  operations: Array<{
    operation: BatchOperation;
    before: string;
    after: string;
    status: 'ok' | 'warning' | 'error';
    message?: string;
  }>;
}

const OPERATIONS: Array<{ value: BatchOperation['type']; label: string }> = [
  { value: 'ADD_FIELD', label: 'Add Field' },
  { value: 'DELETE_FIELD', label: 'Delete Field' },
  { value: 'REPLACE_FIELD', label: 'Replace Field' },
  { value: 'ADD_SUBFIELD', label: 'Add Subfield' },
  { value: 'DELETE_SUBFIELD', label: 'Delete Subfield' },
  { value: 'REPLACE_SUBFIELD', label: 'Replace Subfield' },
];

export default function BatchModification() {
  const navigate = useNavigate();
  const { loading: authLoading, hasRole } = useAuth();
  const [records, setRecords] = useState<CatalogueRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [operation, setOperation] = useState<BatchOperation>({ type: 'REPLACE_FIELD', tag: '245', subfield: 'a' });
  const [preview, setPreview] = useState<PreviewResult[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ success: number; failure: number } | null>(null);

  useEffect(() => {
    fetch('/api/catalogue/frameworks')
      .then(r => r.ok ? r.json() : { frameworks: [] })
      .then(() => fetch('/api/catalogue/marc-import?batchId=all'))
      .then(r => r.ok ? r.json() : { records: [] })
      .then(data => setRecords(data.records ?? []))
      .catch(() => {});
  }, []);

  if (authLoading) return <div className="p-8 text-sm text-neutral-500">Loading...</div>;
  if (!hasRole('super_admin', 'catalog_admin', 'librarian', 'faculty_librarian')) {
    return <div className="p-8"><div className="card p-8 max-w-lg"><h1 className="font-semibold text-lg mb-2">Catalog access required</h1></div></div>;
  }

  const toggleRecord = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(records.map(r => r.id)));
  const clearAll = () => setSelectedIds(new Set());

  const doPreview = async () => {
    setPreviewing(true);
    setPreview([]);
    try {
      const res = await fetch('/api/catalogue/batch-modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', recordIds: [...selectedIds], operations: [operation] }),
      });
      const data = await res.json();
      setPreview(data.preview ?? []);
    } catch { /* silent */ } finally { setPreviewing(false); }
  };

  const doApply = async () => {
    setApplying(true);
    setResult(null);
    try {
      const res = await fetch('/api/catalogue/batch-modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', recordIds: [...selectedIds], operations: [operation] }),
      });
      const data = await res.json();
      setResult({ success: data.success ?? 0, failure: data.failure ?? 0 });
    } catch { /* silent */ } finally { setApplying(false); }
  };

  const errors = preview.flatMap(p => p.operations.filter(o => o.status === 'error'));
  const warnings = preview.flatMap(p => p.operations.filter(o => o.status === 'warning'));

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Batch Modification</h1>
          <p className="text-neutral-500 mt-1">Select records and apply controlled MARC modifications</p>
        </div>
        <button onClick={() => navigate('/admin/catalogue')} className="btn-ghost">Back</button>
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">Select Records ({selectedIds.size} selected)</h2>
          <div className="flex gap-2">
            <button onClick={selectAll} className="btn-outline text-xs">Select All</button>
            <button onClick={clearAll} className="btn-outline text-xs">Clear</button>
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {records.map(r => (
            <label key={r.id} className="flex items-center gap-2 p-2 rounded hover:bg-neutral-50 cursor-pointer">
              <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleRecord(r.id)} />
              <span className="text-sm">{r.title}</span>
              {r.isbn && <span className="text-xs text-neutral-400 font-mono">{r.isbn}</span>}
            </label>
          ))}
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <h2 className="font-semibold">Operation</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Operation</label>
            <select className="input" value={operation.type} onChange={e => setOperation({ ...operation, type: e.target.value as BatchOperation['type'] })}>
              {OPERATIONS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tag</label>
            <input className="input" value={operation.tag} onChange={e => setOperation({ ...operation, tag: e.target.value })} placeholder="245" />
          </div>
          <div>
            <label className="label">Subfield</label>
            <input className="input" value={operation.subfield ?? ''} onChange={e => setOperation({ ...operation, subfield: e.target.value })} placeholder="a" />
          </div>
          {operation.type === 'REPLACE_FIELD' && (
            <>
              <div>
                <label className="label">New Value</label>
                <input className="input" value={operation.newValue ?? ''} onChange={e => setOperation({ ...operation, newValue: e.target.value })} />
              </div>
              <div>
                <label className="label">New Ind1</label>
                <input className="input" value={operation.newInd1 ?? ''} onChange={e => setOperation({ ...operation, newInd1: e.target.value })} />
              </div>
              <div>
                <label className="label">New Ind2</label>
                <input className="input" value={operation.newInd2 ?? ''} onChange={e => setOperation({ ...operation, newInd2: e.target.value })} />
              </div>
            </>
          )}
          {operation.type === 'ADD_FIELD' && (
            <>
              <div>
                <label className="label">New Tag</label>
                <input className="input" value={operation.newTag ?? ''} onChange={e => setOperation({ ...operation, newTag: e.target.value })} />
              </div>
              <div>
                <label className="label">New Subfield</label>
                <input className="input" value={operation.newSubfield ?? ''} onChange={e => setOperation({ ...operation, newSubfield: e.target.value })} />
              </div>
              <div>
                <label className="label">New Value</label>
                <input className="input" value={operation.newValue ?? ''} onChange={e => setOperation({ ...operation, newValue: e.target.value })} />
              </div>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => void doPreview()} disabled={previewing || selectedIds.size === 0} className="btn-outline disabled:opacity-50">
            {previewing ? 'Previewing...' : 'Preview'}
          </button>
          <button onClick={() => void doApply()} disabled={applying || selectedIds.size === 0 || errors.length > 0} className="btn-primary disabled:opacity-50">
            {applying ? 'Applying...' : 'Apply'}
          </button>
        </div>
      </div>

      {preview.length > 0 && (
        <div className="card p-4 space-y-4">
          <h2 className="font-semibold">Preview</h2>
          <div className="flex gap-4 text-sm">
            <span className="text-green-600">{preview.flatMap(p => p.operations).filter(o => o.status === 'ok').length} changes</span>
            <span className="text-amber-600">{warnings.length} warnings</span>
            <span className="text-red-600">{errors.length} errors</span>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {preview.map(p => (
              <div key={p.recordId} className="border border-neutral-200 rounded-lg p-3">
                <p className="text-sm font-medium">{p.title}</p>
                {p.operations.map((op, i) => (
                  <div key={i} className="text-xs mt-1">
                    <span className={`inline-block w-16 ${op.status === 'ok' ? 'text-green-600' : op.status === 'warning' ? 'text-amber-600' : 'text-red-600'}`}>
                      {op.status.toUpperCase()}
                    </span>
                    <span className="text-neutral-500">{op.before}</span>
                    <span className="text-neutral-400"> → </span>
                    <span className="text-neutral-700">{op.after}</span>
                    {op.message && <span className="text-red-500 ml-2">{op.message}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="card p-4">
          <h2 className="font-semibold">Result</h2>
          <p className="text-sm mt-2">
            <span className="text-green-600">{result.success} succeeded</span>
            {' · '}
            <span className="text-red-600">{result.failure} failed</span>
          </p>
        </div>
      )}
    </div>
  );
}
