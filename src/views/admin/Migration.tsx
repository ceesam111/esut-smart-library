import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface MigrationLog {
  id: string;
  type: string;
  source_system: string;
  records_processed: number;
  records_successful: number;
  status: string;
  started_at: string;
  completed_at?: string;
  error_log: string;
}

type TabType = 'dspace' | 'eprints' | 'koha' | 'csv';

export default function Migration() {
  const [activeTab, setActiveTab] = useState<TabType>('dspace');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationLogs, setMigrationLogs] = useState<MigrationLog[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setShowPreview(false);
      setErrors([]);
    }
  };

  const validateFile = async () => {
    if (!uploadedFile) {
      setErrors(['Please select a file first']);
      return;
    }

    setErrors([]);
    const mockPreviewData = [
      { id: '1', title: 'Sample Record 1', type: 'book' },
      { id: '2', title: 'Sample Record 2', type: 'journal' },
      { id: '3', title: 'Sample Record 3', type: 'thesis' },
    ];

    setPreviewData(mockPreviewData);
    setShowPreview(true);
  };

  const startMigration = async () => {
    if (!uploadedFile) return;

    setIsMigrating(true);
    setMigrationProgress(0);

    try {
      for (let i = 0; i <= 100; i += 10) {
        setMigrationProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const migrationRecord: MigrationLog = {
        id: Math.random().toString(),
        type: activeTab,
        source_system: activeTab === 'dspace' ? 'DSpace' : activeTab === 'eprints' ? 'EPrints' : activeTab === 'koha' ? 'Koha' : 'CSV',
        records_processed: previewData.length,
        records_successful: previewData.length,
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        error_log: '',
      };

      setMigrationLogs((prev) => [migrationRecord, ...prev]);
      setMigrationProgress(100);
      setUploadedFile(null);
      setShowPreview(false);
      setPreviewData([]);
    } catch (error) {
      setErrors(['Migration failed. Please try again.']);
    } finally {
      setIsMigrating(false);
      setTimeout(() => setMigrationProgress(0), 2000);
    }
  };

  const downloadTemplate = (type: string) => {
    const templates: Record<string, string> = {
      csv: 'title,authors,year,isbn\nSample Book,Author Name,2023,123-456-789\n',
    };

    const content = templates[type] || 'Template not available';
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migration_template_${type}.csv`;
    a.click();
  };

  const rollbackMigration = async (logId: string) => {
    if (!confirm('Rollback migrations within the last 24 hours?')) return;
    console.log('Rolling back migration:', logId);
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Migration Tool</h1>
        <p className="text-gray-600 mt-2">Migrate data from legacy library systems</p>
      </div>

      <div className="card">
        <div className="flex gap-2 border-b mb-6 overflow-x-auto">
          {(['dspace', 'eprints', 'koha', 'csv'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium border-b-2 whitespace-nowrap ${
                activeTab === tab
                  ? 'border-primary-700 text-primary-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'dspace'
                ? 'DSpace SAF'
                : tab === 'eprints'
                ? 'EPrints XML'
                : tab === 'koha'
                ? 'Koha MARC21'
                : 'CSV Template'}
            </button>
          ))}
        </div>

        {activeTab === 'dspace' && (
          <div className="space-y-6">
            <div className="bg-primary-50 border border-primary-200 rounded p-4 text-sm">
              <p className="font-semibold mb-2">DSpace Simple Archive Format</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-700">
                <li>Upload DSpace SAF export (ZIP format)</li>
                <li>System validates against DSpace schema</li>
                <li>Preview imported items before confirming</li>
                <li>Import completes with progress indicator</li>
              </ol>
            </div>
          </div>
        )}

        {activeTab === 'eprints' && (
          <div className="space-y-6">
            <div className="bg-primary-50 border border-primary-200 rounded p-4 text-sm">
              <p className="font-semibold mb-2">EPrints XML Export</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-700">
                <li>Upload EPrints XML export file</li>
                <li>Validate XML structure</li>
                <li>Map EPrints fields to ADLP schema</li>
                <li>Import with full metadata preservation</li>
              </ol>
            </div>
          </div>
        )}

        {activeTab === 'koha' && (
          <div className="space-y-6">
            <div className="bg-primary-50 border border-primary-200 rounded p-4 text-sm">
              <p className="font-semibold mb-2">Koha MARC21 Records</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-700">
                <li>Export MARC21 records from Koha</li>
                <li>Upload MRC or XML file</li>
                <li>Validate MARC21 record structure</li>
                <li>Import with holdings and item data</li>
              </ol>
            </div>
          </div>
        )}

        {activeTab === 'csv' && (
          <div className="space-y-4">
            <div className="bg-primary-50 border border-primary-200 rounded p-4 text-sm">
              <p className="font-semibold mb-2">CSV Template Import</p>
              <p className="text-gray-700">
                Import bibliographic data from CSV. Download the template to see required columns.
              </p>
            </div>
            <button
              onClick={() => downloadTemplate('csv')}
              className="btn-outline"
            >
              Download CSV Template
            </button>
          </div>
        )}

        <div className="border-2 border-dashed rounded-lg p-12 text-center hover:bg-gray-50 mt-6">
          <input
            type="file"
            accept={
              activeTab === 'dspace'
                ? '.zip'
                : activeTab === 'eprints'
                ? '.xml'
                : activeTab === 'koha'
                ? '.mrc,.xml'
                : '.csv'
            }
            onChange={handleFileUpload}
            className="hidden"
            id="migration-file-upload"
          />
          <label htmlFor="migration-file-upload" className="cursor-pointer">
            <div className="text-4xl mb-4">📂</div>
            <p className="font-semibold mb-1">Click to upload or drag and drop</p>
            <p className="text-sm text-gray-500">
              {activeTab === 'dspace'
                ? 'ZIP files'
                : activeTab === 'eprints'
                ? 'XML files'
                : activeTab === 'koha'
                ? 'MRC or XML files'
                : 'CSV files'}
            </p>
          </label>
        </div>

        {uploadedFile && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-sm text-green-800">
              ✓ {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(2)} KB)
            </p>
          </div>
        )}

        {errors.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            {errors.map((error, idx) => (
              <p key={idx} className="text-sm text-red-800">
                ✗ {error}
              </p>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-6">
          <button
            onClick={validateFile}
            disabled={!uploadedFile || isMigrating}
            className="btn-outline disabled:opacity-50"
          >
            Validate
          </button>
          {showPreview && (
            <button
              onClick={startMigration}
              disabled={isMigrating}
              className="btn-primary disabled:opacity-50"
            >
              {isMigrating ? `Importing... ${migrationProgress}%` : 'Confirm & Import'}
            </button>
          )}
        </div>

        {migrationProgress > 0 && isMigrating && (
          <div className="mt-6">
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-primary-700 h-4 rounded-full transition-all duration-300"
                style={{ width: `${migrationProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">{migrationProgress}% complete</p>
          </div>
        )}
      </div>

      {showPreview && previewData.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Preview Data ({previewData.length} records)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  {Object.keys(previewData[0]).map((key) => (
                    <th key={key} className="text-left p-3 font-semibold">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    {Object.values(row).map((val, colIdx) => (
                      <td key={colIdx} className="p-3">
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previewData.length > 10 && (
            <p className="text-sm text-gray-500 mt-2">Showing 10 of {previewData.length} records</p>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Migration History</h2>
        {migrationLogs.length > 0 ? (
          <div className="space-y-3">
            {migrationLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 border rounded space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{log.source_system} Migration</p>
                    <p className="text-sm text-gray-600">
                      {new Date(log.started_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`badge ${
                      log.status === 'completed' ? 'badge-success' : 'badge-warning'
                    }`}
                  >
                    {log.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Records Processed</p>
                    <p className="font-semibold">{log.records_processed}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Successful</p>
                    <p className="font-semibold">{log.records_successful}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Failed</p>
                    <p className="font-semibold">{log.records_processed - log.records_successful}</p>
                  </div>
                </div>

                {new Date().getTime() - new Date(log.started_at).getTime() < 24 * 60 * 60 * 1000 && (
                  <button
                    onClick={() => rollbackMigration(log.id)}
                    className="btn-outline text-red-600 text-sm py-1 px-2"
                  >
                    Rollback (within 24h)
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No migration history</p>
        )}
      </div>
    </div>
  );
}
