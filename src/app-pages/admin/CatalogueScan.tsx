import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useBarcodeScanner, loadQueuedScans, clearQueuedScan } from '@/features/barcode/useBarcodeScanner';

type Mode = 'catalogue' | 'lookup' | 'manual';

const emptyForm = {
  isbn: '', issn: '', title: '', authors: '', publisher: '', year: '', edition: '', language: 'English',
  category: '', subjects: '', copies: '1', shelf_location: '', item_type: 'book', source_url: '', notes: '',
};

async function authFetch(url: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in.');
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || json.error || `Request failed with ${res.status}`);
  return json && json.success === true && 'data' in json ? json.data : json;
}

function toRow(form: typeof emptyForm) {
  return {
    isbn: form.isbn || form.issn,
    title: form.title,
    authors: form.authors,
    publisher: form.publisher,
    year: form.year,
    edition: form.edition,
    language: form.language,
    category: form.category,
    subjects: form.subjects,
    copies: form.copies,
    shelf_location: form.shelf_location,
    item_type: form.item_type,
    source_url: form.source_url,
    notes: form.notes,
  };
}

export default function CatalogueScan() {
  const [mode, setMode] = useState<Mode>('catalogue');
  const [form, setForm] = useState(emptyForm);
  const [scanLog, setScanLog] = useState<Array<{ code: string; status: string; detail?: string }>>([]);
  const [message, setMessage] = useState('');
  const [queued, setQueued] = useState(loadQueuedScans());

  async function stage(row: Record<string, unknown>, source: 'scan' | 'manual') {
    try {
      const result = await authFetch('/api/admin/catalogue/scan/stage', { method: 'POST', body: JSON.stringify({ source, row }) });
      setScanLog((current) => [{ code: String(row.isbn || row.title), status: 'staged', detail: result.staged?.confidence }, ...current]);
      setMessage(`Staged ${result.staged?.title || result.staged?.isbn || 'resource'} for review.`);
    } catch (error) {
      if (!navigator.onLine) {
        const item = scanner.queueScan(String(row.isbn || row.title || 'manual'));
        setQueued(loadQueuedScans());
        setMessage(`Offline. Queued scan ${item.code} for later sync.`);
        return;
      }
      setMessage((error as Error).message);
    }
  }

  async function lookup(code: string) {
    try {
      const result = await authFetch('/api/admin/barcode-lookup', { method: 'POST', body: JSON.stringify({ code }) });
      setScanLog((current) => [{ code, status: result.record ? 'found' : 'not found', detail: result.type }, ...current]);
      if (result.href) setMessage(`Found ${result.type}. Open: ${result.href}`);
      else setMessage(`No ${result.type || 'matching'} record found.`);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function onDetected(code: string) {
    if (mode === 'lookup') return lookup(code);
    const numeric = code.replace(/[^0-9Xx]/g, '');
    const looksLikeResource = /^\d{8}$/.test(numeric) || /^\d{13}$/.test(numeric);
    if (!looksLikeResource) {
      setMessage('This does not look like ISBN/EAN-13 or ISSN. Switch to Internal lookup for Code-128 labels.');
      return;
    }
    await stage({ ...toRow(form), isbn: numeric }, 'scan');
  }

  async function scanImage(file: File | null) {
    if (!file) return;
    setMessage('Scanning uploaded barcode image...');
    try {
      if (!('BarcodeDetector' in window)) throw new Error('Image barcode scan requires a browser with BarcodeDetector support. Use Chrome/Edge or enter the code manually.');
      const bitmap = await createImageBitmap(file);
      const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e'] });
      const hits = await detector.detect(bitmap);
      bitmap.close?.();
      const code = hits?.[0]?.rawValue;
      if (!code) throw new Error('No barcode found in that image. Try a sharper, closer photo or enter the code manually.');
      await onDetected(code);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  const scanner = useBarcodeScanner({ mode: mode === 'lookup' ? 'lookup' : 'catalogue', onDetected });

  const statusHelp = useMemo(() => {
    if (scanner.status === 'permission_denied') return 'Camera permission denied. On iOS Safari, use HTTPS, tap AA/site settings if needed, allow Camera, then retry.';
    if (scanner.backend === 'quagga') return 'Using Quagga fallback. Keep the barcode centered and well lit.';
    return 'Use HTTPS on mobile. iOS Safari requires playsInline/muted/autoplay camera preview, already enabled here.';
  }, [scanner.backend, scanner.status]);

  async function submitManual() {
    await stage(toRow(form), 'manual');
    setForm(emptyForm);
  }

  async function syncQueued() {
    for (const item of queued) {
      try {
        if (item.mode === 'lookup') await lookup(item.code);
        else await stage({ isbn: item.code, copies: 1, item_type: 'book' }, 'scan');
        clearQueuedScan(item.id);
      } catch { /* keep queued */ }
    }
    setQueued(loadQueuedScans());
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-primary-800">Barcode Scanner</h1>
          <p className="text-sm text-neutral-500">ISBN/EAN-13, ISSN, internal Code-128 lookup, and manual staging. No QR scanning.</p>
        </div>
        <Link to="/admin/barcodes" className="btn-outline text-sm">Generate Code-128</Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(['catalogue', 'lookup', 'manual'] as Mode[]).map((m) => <button key={m} onClick={() => setMode(m)} className={`rounded-xl px-3 py-3 text-sm font-semibold ${mode === m ? 'bg-primary-700 text-white' : 'bg-white border border-neutral-200 text-neutral-700'}`}>{m === 'catalogue' ? 'Catalogue' : m === 'lookup' ? 'Internal lookup' : 'Enter manually'}</button>)}
      </div>

      {message && <div className="rounded-lg border border-primary-200 bg-primary-50 text-primary-900 px-4 py-3 text-sm">{message}</div>}

      {mode !== 'manual' && (
        <section className="card p-4 space-y-4">
          <div className="flex items-center justify-between"><span className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs">{mode === 'lookup' ? 'Code-128 lookup' : 'ISBN/EAN-13/ISSN cataloguing'}</span><span className="text-xs text-neutral-500">{scanner.backend}</span></div>
          <div className="relative rounded-2xl overflow-hidden bg-black min-h-72 flex items-center justify-center">
            <video ref={scanner.videoRef} className="w-full max-h-[70vh] object-cover" playsInline muted autoPlay />
            {scanner.status !== 'scanning' && <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">Camera preview appears here</div>}
          </div>
          <p className="text-xs text-neutral-500">{scanner.error || statusHelp}</p>
          <div className="grid grid-cols-2 gap-2"><button onClick={scanner.start} className="btn-primary text-base py-3">Big Scan Button</button><button onClick={scanner.stop} className="btn-outline text-base py-3">Stop</button></div>
          <label className="btn-outline text-center cursor-pointer">
            Scan from barcode photo
            <input type="file" accept="image/*" className="hidden" onChange={(e) => scanImage(e.target.files?.[0] ?? null)} />
          </label>
          <ManualFields form={form} setForm={setForm} compact />
          <button onClick={() => setMode('manual')} className="w-full btn-outline">Enter manually</button>
        </section>
      )}

      {mode === 'manual' && <section className="card p-4 space-y-4"><ManualFields form={form} setForm={setForm} /><button onClick={submitManual} className="btn-primary w-full py-3">Stage manual record</button></section>}

      {queued.length > 0 && <section className="card p-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Unsynced scans</h2><p className="text-sm text-neutral-500">{queued.length} queued locally.</p></div><button onClick={syncQueued} className="btn-primary text-sm">Sync later queue</button></div></section>}

      <section className="card p-4"><h2 className="font-semibold text-neutral-800 mb-3">Running scan list</h2>{scanLog.length === 0 ? <p className="text-sm text-neutral-500">No scans yet.</p> : <div className="space-y-2">{scanLog.map((item, index) => <div key={`${item.code}-${index}`} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2"><span className="font-mono text-sm">{item.code}</span><span className="text-xs text-neutral-500">{item.status} {item.detail ? `• ${item.detail}` : ''}</span></div>)}</div>}</section>
    </div>
  );
}

function ManualFields({ form, setForm, compact = false }: { form: typeof emptyForm; setForm: Dispatch<SetStateAction<typeof emptyForm>>; compact?: boolean }) {
  const fields = compact ? ['copies', 'shelf_location'] : Object.keys(emptyForm);
  return <div className="grid sm:grid-cols-2 gap-3">{fields.map((field) => field === 'item_type' ? <select key={field} value={form.item_type} onChange={(e) => setForm((f) => ({ ...f, item_type: e.target.value }))} className="input"><option value="book">book</option><option value="journal">journal</option><option value="ebook">ebook</option><option value="database">database</option></select> : <input key={field} value={(form as any)[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} placeholder={field} className="input" />)}</div>;
}
