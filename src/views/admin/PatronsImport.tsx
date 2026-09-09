import { useState, useRef } from 'react';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';

interface ParsedRow {
  [key: string]: string;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: { row: number; email: string; error: string }[];
}

export default function PatronsImport() {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'progress' | 'complete'>('upload');
  const [csvData, setCsvData] = useState<ParsedRow[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<{ csvColumn: string; dbColumn: string }[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [sendWelcomeEmails, setSendWelcomeEmails] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dbColumns = [
    { key: 'name', label: 'Full Name', required: true },
    { key: 'email', label: 'Email Address', required: true },
    { key: 'matric_no', label: 'Matriculation Number' },
    { key: 'staff_id', label: 'Staff ID' },
    { key: 'faculty', label: 'Faculty' },
    { key: 'department', label: 'Department' },
    { key: 'level', label: 'Level' },
    { key: 'category', label: 'Patron Category' },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          alert('CSV file must have a header row and at least one data row');
          return;
        }

        // Parse CSV with proper handling of quoted fields
        const parseRow = (line: string): string[] => {
          const values: string[] = [];
          let current = '';
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());
          return values;
        };

        const headers = parseRow(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
        setCsvColumns(headers);

        const rows: ParsedRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseRow(lines[i]);
          const row: ParsedRow = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx]?.replace(/^"|"$/g, '').trim() || '';
          });
          rows.push(row);
        }

        setCsvData(rows);

        // Auto-map columns by name matching
        const autoMapping = headers.map(csvCol => {
          const csvLower = csvCol.toLowerCase().replace(/[_\s]/g, '');
          const match = dbColumns.find(dbCol =>
            dbCol.key === csvLower ||
            dbCol.label.toLowerCase() === csvCol.toLowerCase() ||
            dbCol.key.toLowerCase() === csvLower
          );
          return { csvColumn: csvCol, dbColumn: match?.key || '' };
        });
        setMapping(autoMapping);
        setStep('mapping');
      } catch (error) {
        console.error('Error parsing CSV:', error);
        alert('Failed to parse CSV file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const updateMapping = (index: number, dbColumn: string) => {
    const newMapping = [...mapping];
    newMapping[index].dbColumn = dbColumn;
    setMapping(newMapping);
  };

  const getMappedValue = (row: ParsedRow, dbColumn: string): string => {
    const map = mapping.find(m => m.dbColumn === dbColumn);
    return map ? row[map.csvColumn] || '' : '';
  };

  const performImport = async () => {
    setStep('progress');
    setImportProgress(0);

    const result: ImportResult = {
      total: csvData.length,
      success: 0,
      failed: 0,
      errors: [],
    };

    // Generate a random password for new users
    const generatePassword = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
      let password = '';
      for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const rowNum = i + 2; // +2 because row 1 is header

      try {
        const name = getMappedValue(row, 'name');
        const email = getMappedValue(row, 'email');
        const matricNo = getMappedValue(row, 'matric_no');
        const staffId = getMappedValue(row, 'staff_id');
        const facultyName = getMappedValue(row, 'faculty');
        const department = getMappedValue(row, 'department');
        const level = getMappedValue(row, 'level');
        const category = getMappedValue(row, 'category') || 'Undergraduate';

        // Validate required fields
        if (!name || !email) {
          result.failed++;
          result.errors.push({ row: rowNum, email: email || 'missing', error: 'Name and email are required' });
          continue;
        }

        // Find faculty code
        const faculty = institutionConfig.faculties.find(
          f => f.name.toLowerCase() === facultyName.toLowerCase() ||
               f.code.toLowerCase() === facultyName.toLowerCase()
        );
        const facultyCode = faculty?.code || '';
        const facultyNameFinal = faculty?.name || facultyName;

        // Generate patron ID
        const patronId = `${institutionConfig.institutionCode}-${facultyCode || 'GEN'}-${Math.floor(100000 + Math.random() * 900000)}`;

        // Create auth user - we need to do this differently since signUp requires password
        // For bulk import, we'll create patron records without auth users first
        // Then use a Supabase Edge Function to send invitation emails

        // For now, create patron record directly
        const { error: patronError } = await supabase.from('patrons').insert({
          patron_id: patronId,
          full_name: name,
          email: email,
          phone: null,
          date_of_birth: null,
          gender: null,
          patron_category: category,
          faculty_code: facultyCode || null,
          faculty_name: facultyNameFinal || null,
          department: department || null,
          level: level || null,
          programme: null,
          matric_number: matricNo || null,
          staff_id: staffId || null,
          rank: null,
          status: 'active',
          membership_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        });

        if (patronError) {
          // Check if it's a duplicate email
          if (patronError.code === '23505') {
            result.failed++;
            result.errors.push({ row: rowNum, email, error: 'Email already exists' });
          } else {
            result.failed++;
            result.errors.push({ row: rowNum, email, error: patronError.message });
          }
          continue;
        }

        // Send welcome email if enabled
        if (sendWelcomeEmails) {
          // In production, this would call an edge function to send the email
          // For now, we'll just log it
          console.log(`Welcome email would be sent to: ${email}`);
        }

        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ row: rowNum, email: getMappedValue(row, 'email') || 'unknown', error: error.message });
      }

      setImportProgress(Math.round(((i + 1) / csvData.length) * 100));
    }

    setImportResult(result);
    setStep('complete');
  };

  const downloadTemplate = () => {
    const headers = ['name', 'email', 'matric_no', 'staff_id', 'faculty', 'department', 'level', 'category'];
    const exampleRows = [
      ['John Doe', 'john.doe@university.edu', 'UNILAG/2020/001', '', 'Faculty of Law', 'Private Law', '300L', 'Undergraduate'],
      ['Dr. Jane Smith', 'jane.smith@university.edu', '', 'STAFF/001', 'Faculty of Sciences', 'Computer Science', '', 'Academic Staff'],
    ];
    const csv = [headers, ...exampleRows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'patron_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetImport = () => {
    setCsvData([]);
    setCsvColumns([]);
    setMapping([]);
    setImportProgress(0);
    setImportResult(null);
    setStep('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-neutral-800">Bulk Patron Import</h1>
          <p className="text-neutral-500 mt-1">Import patrons from Registrar CSV data</p>
        </div>
        <button onClick={downloadTemplate} className="btn-outline">
          Download Template
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {['Upload', 'Map Columns', 'Preview', 'Import'].map((label, idx) => (
          <div key={label} className="flex items-center">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
              ${['upload', 'mapping', 'preview', 'progress', 'complete'].indexOf(step) >= idx
                ? 'bg-primary-700 text-white'
                : 'bg-neutral-200 text-neutral-500'}`}>
              {idx + 1}
            </div>
            <span className="ml-2 text-neutral-600">{label}</span>
            {idx < 3 && <span className="mx-3 text-neutral-300">→</span>}
          </div>
        ))}
      </div>

      {step === 'upload' && (
        <div className="card p-8">
          <div className="border-2 border-dashed border-neutral-300 rounded-xl p-12 text-center hover:border-primary-400 hover:bg-primary-50/30 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="font-semibold text-neutral-800 mb-1">Click to upload CSV file</p>
              <p className="text-sm text-neutral-500">or drag and drop</p>
            </label>
          </div>

          <div className="mt-6 p-4 bg-primary-50 rounded-xl border border-primary-100">
            <h3 className="font-semibold text-neutral-800 mb-3">CSV Format Requirements</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-neutral-600">
              <div>
                <p className="font-medium text-neutral-700 mb-1">Required Columns:</p>
                <ul className="space-y-0.5">
                  <li>• <span className="font-mono text-primary-700">name</span> — Full name</li>
                  <li>• <span className="font-mono text-primary-700">email</span> — Email address</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-neutral-700 mb-1">Optional Columns:</p>
                <ul className="space-y-0.5">
                  <li>• <span className="font-mono">matric_no</span> — For students</li>
                  <li>• <span className="font-mono">staff_id</span> — For staff</li>
                  <li>• <span className="font-mono">faculty</span> — Must match config</li>
                  <li>• <span className="font-mono">department, level, category</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'mapping' && (
        <div className="card p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-neutral-800 mb-4">Map CSV Columns</h2>
            <p className="text-sm text-neutral-500 mb-6">
              Match your CSV columns to the database fields. Auto-mapped columns are pre-selected.
            </p>

            <div className="space-y-3">
              {mapping.map((map, idx) => (
                <div key={idx} className="flex items-center gap-4 p-3 bg-neutral-50 rounded-lg">
                  <div className="flex-1">
                    <span className="text-xs text-neutral-500 uppercase tracking-wide">CSV Column</span>
                    <p className="font-mono font-medium text-neutral-800">{map.csvColumn}</p>
                  </div>
                  <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  <div className="flex-1">
                    <select
                      className="input"
                      value={map.dbColumn}
                      onChange={(e) => updateMapping(idx, e.target.value)}
                    >
                      <option value="">Skip this column</option>
                      {dbColumns.map((col) => (
                        <option key={col.key} value={col.key}>
                          {col.label} {col.required && '(*)'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-warning-50 rounded-xl border border-warning-200">
            <input
              type="checkbox"
              id="sendEmails"
              checked={sendWelcomeEmails}
              onChange={(e) => setSendWelcomeEmails(e.target.checked)}
              className="w-4 h-4 rounded border-warning-300"
            />
            <label htmlFor="sendEmails" className="text-sm text-neutral-700">
              Send welcome emails to imported patrons with their library card details
            </label>
          </div>

          <div className="flex gap-4 pt-4 border-t">
            <button onClick={() => setStep('upload')} className="btn-ghost">
              ← Back
            </button>
            <button
              onClick={() => setStep('preview')}
              disabled={!mapping.some(m => m.dbColumn === 'name') || !mapping.some(m => m.dbColumn === 'email')}
              className="btn-primary flex-1"
            >
              Continue to Preview →
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="card p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-neutral-800 mb-1">Preview Import</h2>
            <p className="text-sm text-neutral-500 mb-4">
              Showing first 10 rows of {csvData.length} total records
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 border-b">
                <tr>
                  {mapping.filter(m => m.dbColumn).map(m => (
                    <th key={m.dbColumn} className="text-left p-3 font-semibold text-neutral-600">
                      {dbColumns.find(d => d.key === m.dbColumn)?.label || m.dbColumn}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="border-b hover:bg-neutral-50">
                    {mapping.filter(m => m.dbColumn).map(m => (
                      <td key={m.dbColumn} className="p-3 text-neutral-700">
                        {row[m.csvColumn] || <span className="text-neutral-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {csvData.length > 10 && (
            <p className="text-sm text-neutral-500 text-center">
              + {csvData.length - 10} more rows
            </p>
          )}

          <div className="flex items-center justify-between p-4 bg-success-50 rounded-xl border border-success-200">
            <div>
              <p className="font-medium text-success-800">{csvData.length} patrons ready to import</p>
              <p className="text-sm text-success-600">
                {sendWelcomeEmails ? 'Welcome emails will be sent' : 'No emails will be sent'}
              </p>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t">
            <button onClick={() => setStep('mapping')} className="btn-ghost">
              ← Back
            </button>
            <button onClick={performImport} className="btn-primary flex-1">
              Import {csvData.length} Patrons
            </button>
          </div>
        </div>
      )}

      {step === 'progress' && (
        <div className="card p-8 text-center space-y-6">
          <div>
            <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-neutral-800 mb-2">Importing Patrons...</h2>
            <p className="text-neutral-500">Please wait while we process the records</p>
          </div>

          <div className="w-full bg-neutral-200 rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all duration-300 bg-primary-600"
              style={{ width: `${importProgress}%` }}
            />
          </div>
          <p className="text-2xl font-bold text-primary-700">{importProgress}%</p>
        </div>
      )}

      {step === 'complete' && importResult && (
        <div className="space-y-6">
          <div className={`card p-8 text-center ${importResult.success > 0 ? 'bg-success-50' : 'bg-error-50'}`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4
              ${importResult.failed === 0 ? 'bg-success-100 text-success-600' : 'bg-warning-100 text-warning-600'}`}>
              {importResult.failed === 0 ? (
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>

            <h2 className="text-2xl font-semibold text-neutral-800 mb-2">Import Complete</h2>
            <div className="flex justify-center gap-8 mt-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-success-600">{importResult.success}</p>
                <p className="text-sm text-neutral-500">Successful</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-error-600">{importResult.failed}</p>
                <p className="text-sm text-neutral-500">Failed</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-neutral-400">{importResult.total}</p>
                <p className="text-sm text-neutral-500">Total</p>
              </div>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div className="card p-6">
              <h3 className="font-semibold text-error-600 mb-4">Import Errors</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-error-50 border-b">
                    <tr>
                      <th className="text-left p-3 font-semibold">Row</th>
                      <th className="text-left p-3 font-semibold">Email</th>
                      <th className="text-left p-3 font-semibold">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.errors.map((err, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-3">{err.row}</td>
                        <td className="p-3 font-mono text-xs">{err.email}</td>
                        <td className="p-3 text-error-600">{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button onClick={resetImport} className="btn-outline flex-1">
              Import Another File
            </button>
            <button onClick={() => window.location.href = '/admin/patrons'} className="btn-primary flex-1">
              View Patrons
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
