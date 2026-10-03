import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ImportBatch {
  id: string;
  source: string;
  filename: string | null;
  status: string;
  record_count: number;
  valid_count: number;
  warning_count: number;
  error_count: number;
  created_at: string;
}

interface StagedRecord {
  id: string;
  record_position: number;
  title: string | null;
  authors: string[];
  isbn: string | null;
  issn: string | null;
  validation_result: { valid: boolean; errors: unknown[]; warnings: unknown[] };
  duplicate_status: 'NO_MATCH' | 'POSSIBLE_MATCH' | 'STRONG_MATCH';
  duplicate_candidates: Array<{ id: string; title: string; isbn: string | null }>;
  status: string;
  error_detail: string | null;
}

export default function MarcImportPreview() {
  const navigate = useNavigate();
  const { loading: authLoading, hasRole } = useAuth();
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null);
  const [records, setRecords] = useState<StagedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/api/catalogue/marc-import')
      .then(r => r.ok ? r.json() : { batches: [] })
      .then(data => setBatches(data.batches ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedBatch) return;
    setLoading(true);
    fetch(`/api/catalogue/marc-import?batchId=${selectedBatch.id}`)
      .then(r => r.ok ? r.json() : { records: [] })
      .then(data => setRecords(data.records ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedBatch]);

  if (authLoading) return <div className="p-8 text-sm text-neutral-500">Loading...</div>;
  if (!hasRole('super_admin', 'catalog_admin', 'librarian', 'faculty_librarian')) {
    return <div className="p-8"><div className="card p-8 max-w-lg"><h1 className="font-semibold text-lg mb-2">Catalog access required</h1></div></div>;
  }

  const filteredRecords = filter
    ? records.filter(r => r.status === filter || r.duplicate_status === filter)
    : records;

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Staged MARC Import</h1>
          <p className="text-neutral-500 mt-1">Review and import staged MARC records</p>
        </div>
        <button onClick={() => navigate('/admin/catalogue')} className="btn-ghost">Back to Catalogue</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-4 space-y-3">
          <h2 className="font-semibold text-neutral-800">Import Batches</h2>
          {batches.length === 0 ? (
            <p className="text-sm text-neutral-400">No import batches yet.</p>
          ) : (
            <div className="space-y-2">
              {batches.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBatch(b)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${selectedBatch?.id === b.id ? 'border-primary-400 bg-primary-50' : 'border-neutral-200 hover:border-primary-200'}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{b.source}</span>
                    <span className="text-xs text-neutral-400">{b.record_count} records</span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {b.valid_count} valid · {b.warning_count} warnings · {b.error_count} errors
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-neutral-800">Records</h2>
            <select className="input max-w-[140px] text-xs" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="">All</option>
              <option value="VALID">Valid</option>
              <option value="WARNING">Warning</option>
              <option value="ERROR">Error</option>
              <option value="STRONG_MATCH">Strong Match</option>
              <option value="POSSIBLE_MATCH">Possible Match</option>
            </select>
          </div>
          {loading ? (
            <p className="text-sm text-neutral-400">Loading...</p>
          ) : filteredRecords.length === 0 ? (
            <p className="text-sm text-neutral-400">No records in this batch.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredRecords.map(r => (
                <div key={r.id} className="border border-neutral-200 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800 truncate">{r.title ?? '(no title)'}</p>
                      <p className="text-xs text-neutral-500">{r.authors?.join(', ') || '—'}</p>
                      <div className="flex gap-2 mt-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${r.status === 'VALID' ? 'bg-green-100 text-green-700' : r.status === 'WARNING' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {r.status}
                        </span>
                        {r.duplicate_status !== 'NO_MATCH' && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${r.duplicate_status === 'STRONG_MATCH' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {r.duplicate_status === 'STRONG_MATCH' ? 'Duplicate' : 'Possible'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button onClick={() => {}} className="btn-primary text-xs px-2 py-1">Import</button>
                      <button onClick={() => {}} className="btn-ghost text-xs px-2 py-1">Skip</button>
                      <button onClick={() => {}} className="btn-ghost text-xs px-2 py-1">Reject</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
