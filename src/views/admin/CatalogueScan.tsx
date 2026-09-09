import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────
interface BookData {
  isbn: string;
  title: string;
  authors: string;
  publisher: string;
  year: number;
  cover_image: string;
  format: string;
}

interface BulkItem extends BookData {
  id: string;
  source: 'barcode' | 'backcover' | 'manual';
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

async function lookupISBN(isbn: string): Promise<Partial<BookData> | null> {
  const clean = isbn.replace(/[-\s]/g, '');

  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${clean}&format=json&jscmd=data`
    );
    const data = await res.json();
    const book = data[`ISBN:${clean}`];
    if (book) {
      return {
        title: book.title ?? '',
        authors: book.authors?.map((a: any) => a.name).join(', ') ?? '',
        publisher: book.publishers?.[0]?.name ?? '',
        year: book.publish_date
          ? parseInt(book.publish_date) || new Date().getFullYear()
          : new Date().getFullYear(),
        cover_image: book.cover?.large ?? book.cover?.medium ?? '',
      };
    }
  } catch { /* fallthrough */ }

  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${clean}`
    );
    const data = await res.json();
    const vol = data.items?.[0]?.volumeInfo;
    if (vol) {
      return {
        title: vol.title ?? '',
        authors: vol.authors?.join(', ') ?? '',
        publisher: vol.publisher ?? '',
        year: vol.publishedDate ? parseInt(vol.publishedDate) : new Date().getFullYear(),
        cover_image: vol.imageLinks?.thumbnail?.replace('http:', 'https:') ?? '',
      };
    }
  } catch { /* nothing found */ }

  return null;
}

function parseOCRText(text: string): Partial<BookData> {
  const lines = text
    .split(/[\n\r|]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  const isbnMatch = text.match(/(?:978|979)[-\s]?\d[-\s]?\d{3}[-\s]?\d{4,7}[-\s]?\d/);
  const isbn = isbnMatch ? isbnMatch[0].replace(/[-\s]/g, '') : '';

  const yearMatch = text.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

  const publisherMatch = text.match(
    /(?:Published by|Publisher[:\s]+|University Press|Press[:\s]+)([^\n.]+)/i
  );
  const publisher = publisherMatch ? publisherMatch[1].trim() : '';

  const authorMatch = text.match(/(?:By\s+|Author[:\s]+|Written by[:\s]+)([^\n]+)/i);
  const authors = authorMatch ? authorMatch[1].trim() : '';

  const meaningful = lines.filter(
    (l) => l.length > 4 && !/^(?:ISBN|www\.|http|©|copyright|\d+$)/i.test(l)
  );

  return {
    isbn,
    year,
    title: meaningful[0] ?? '',
    authors: (authors || meaningful[1]) ?? '',
    publisher: (publisher || meaningful[2]) ?? '',
    cover_image: '',
    format: 'Book',
  };
}

function emptyBook(): BookData {
  return { isbn: '', title: '', authors: '', publisher: '', year: new Date().getFullYear(), cover_image: '', format: 'Book' };
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CatalogueScan() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'barcode' | 'backcover' | 'bulk'>('barcode');

  // ── Barcode tab ──────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number>(0);
  const cooldownRef = useRef(false);
  const [barcodeSupported, setBarcodeSupported] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastISBN, setLastISBN] = useState('');
  const [isbnLoading, setIsbnLoading] = useState(false);
  const [isbnError, setIsbnError] = useState('');
  const [preview, setPreview] = useState<BookData | null>(null);
  const [manualISBN, setManualISBN] = useState('');

  // ── Back cover tab ───────────────────────────────────────────────────────────
  const bcVideoRef = useRef<HTMLVideoElement>(null);
  const bcCanvasRef = useRef<HTMLCanvasElement>(null);
  const bcFileRef = useRef<HTMLInputElement>(null);
  const [bcCameraActive, setBcCameraActive] = useState(false);
  const [bcCapture, setBcCapture] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [ocrFields, setOcrFields] = useState<BookData>(emptyBook());

  // ── Bulk queue ───────────────────────────────────────────────────────────────
  const [queue, setQueue] = useState<BulkItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<{ catalogued: number } | null>(null);

  useEffect(() => {
    setBarcodeSupported('BarcodeDetector' in window);
  }, []);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      stopStreamOn(videoRef);
      stopStreamOn(bcVideoRef);
    };
  }, []);

  function stopStreamOn(ref: React.RefObject<HTMLVideoElement | null>) {
    if (ref.current?.srcObject) {
      (ref.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      ref.current.srcObject = null;
    }
  }

  // ── Barcode scanning ─────────────────────────────────────────────────────────
  const fetchISBN = useCallback(async (isbn: string) => {
    setIsbnLoading(true);
    setIsbnError('');
    try {
      const data = await lookupISBN(isbn);
      setPreview({
        isbn,
        title: data?.title ?? '',
        authors: data?.authors ?? '',
        publisher: data?.publisher ?? '',
        year: data?.year ?? new Date().getFullYear(),
        cover_image: data?.cover_image ?? '',
        format: 'Book',
      });
      if (!data) setIsbnError(`No metadata found for ISBN ${isbn}. Fill in manually.`);
    } catch {
      setIsbnError('Failed to fetch book data. Check your connection.');
    } finally {
      setIsbnLoading(false);
    }
  }, []);

  const startScanLoop = useCallback(() => {
    setScanning(true);
    // @ts-ignore – BarcodeDetector not yet typed in TypeScript lib
    const detector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e'],
    });

    const loop = async () => {
      const v = videoRef.current;
      if (v && v.readyState >= 2 && !cooldownRef.current) {
        try {
          const barcodes = await detector.detect(v);
          const hit = (barcodes as any[]).find((b) => /^\d{8,13}$/.test(b.rawValue));
          if (hit && hit.rawValue !== lastISBN) {
            cooldownRef.current = true;
            setLastISBN(hit.rawValue);
            await fetchISBN(hit.rawValue);
            setTimeout(() => { cooldownRef.current = false; }, 3000);
          }
        } catch { /* frame not ready */ }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();
  }, [fetchISBN, lastISBN]);

  const startCamera = async () => {
    setIsbnError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        if (barcodeSupported) startScanLoop();
      }
    } catch {
      setIsbnError('Camera access denied. Enable camera permissions and try again.');
    }
  };

  const stopCamera = () => {
    cancelAnimationFrame(animFrameRef.current);
    setScanning(false);
    stopStreamOn(videoRef);
    setCameraActive(false);
    setLastISBN('');
  };

  // ── Back cover AI ─────────────────────────────────────────────────────────────
  const startBackCamera = async () => {
    setOcrError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (bcVideoRef.current) {
        bcVideoRef.current.srcObject = stream;
        await bcVideoRef.current.play();
        setBcCameraActive(true);
      }
    } catch {
      setOcrError('Camera access denied. Enable camera permissions and try again.');
    }
  };

  const stopBackCamera = () => {
    stopStreamOn(bcVideoRef);
    setBcCameraActive(false);
  };

  const captureFrame = () => {
    const video = bcVideoRef.current;
    const canvas = bcCanvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setBcCapture(dataUrl);
    stopBackCamera();
    runOCR(dataUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setBcCapture(dataUrl);
      runOCR(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const runOCR = async (dataUrl: string) => {
    setOcrLoading(true);
    setOcrError('');
    setOcrFields(emptyBook());
    try {
      const fetchRes = await fetch(dataUrl);
      const blob = await fetchRes.blob();

      const hfRes = await fetch(
        'https://api-inference.huggingface.co/models/microsoft/trocr-large-printed',
        {
          method: 'POST',
          headers: { 'Content-Type': blob.type || 'image/jpeg' },
          body: blob,
        }
      );

      if (hfRes.status === 503) {
        throw new Error('OCR model is loading — please retry in 20 seconds.');
      }
      if (!hfRes.ok) {
        throw new Error('OCR service returned an error. Please fill in manually.');
      }

      const result = await hfRes.json();
      let text = '';
      if (Array.isArray(result)) {
        text = result.map((r: any) => r.generated_text ?? '').join('\n');
      } else if (result.generated_text) {
        text = result.generated_text;
      }

      const fields = parseOCRText(text);
      const merged = { ...emptyBook(), ...fields };
      setOcrFields(merged);

      if (fields.isbn) {
        const extra = await lookupISBN(fields.isbn);
        if (extra) setOcrFields((prev) => ({ ...prev, ...extra, isbn: fields.isbn! }));
      }
    } catch (err: any) {
      setOcrError(err.message ?? 'OCR failed. Enter details manually below.');
    } finally {
      setOcrLoading(false);
    }
  };

  // ── Queue management ──────────────────────────────────────────────────────────
  const addToQueue = (item: BookData, source: BulkItem['source']) => {
    if (!item.title && !item.isbn) return;
    setQueue((prev) => [...prev, { ...item, id: uid(), source }]);
    if (source === 'barcode') {
      setPreview(null);
      setLastISBN('');
    } else {
      setBcCapture(null);
      setOcrFields(emptyBook());
    }
    setActiveTab('bulk');
  };

  const removeFromQueue = (id: string) => setQueue((prev) => prev.filter((i) => i.id !== id));

  const updateQueueItem = (id: string, patch: Partial<BulkItem>) =>
    setQueue((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const submitAll = async () => {
    if (!queue.length || submitting) return;
    setSubmitting(true);
    setSummary(null);
    let count = 0;
    for (const item of queue) {
      const { error } = await supabase.from('catalogue_items').insert({
        isbn: item.isbn || null,
        title: item.title,
        authors: item.authors
          ? item.authors.split(',').map((a) => a.trim()).filter(Boolean)
          : [],
        publisher: item.publisher || null,
        year: item.year || null,
        format: item.format || 'Book',
        total_copies: 1,
        available_copies: 1,
        status: 'active',
        cover_image: item.cover_image || null,
      });
      if (!error) count++;
    }
    setSummary({ catalogued: count });
    setQueue([]);
    setSubmitting(false);
  };

  const switchTab = (tab: typeof activeTab) => {
    if (tab !== 'barcode' && cameraActive) stopCamera();
    if (tab !== 'backcover' && bcCameraActive) stopBackCamera();
    setActiveTab(tab);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Camera Cataloguing</h1>
          <p className="text-neutral-500 mt-1 text-sm">
            Scan barcodes or photograph back covers to add items
          </p>
        </div>
        {queue.length > 0 && (
          <button
            onClick={() => switchTab('bulk')}
            className="btn-primary flex items-center gap-2"
          >
            <span className="w-5 h-5 rounded-full bg-white/25 text-xs font-bold flex items-center justify-center">
              {queue.length}
            </span>
            View Queue
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="card p-0 overflow-hidden">
        <div className="flex border-b border-neutral-200">
          {(
            [
              { id: 'barcode', icon: BarcodeIcon, label: 'Barcode' },
              { id: 'backcover', icon: CameraIcon, label: 'Back Cover AI' },
              { id: 'bulk', icon: StackIcon, label: `Bulk Session${queue.length ? ` (${queue.length})` : ''}` },
            ] as const
          ).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-primary-700 text-primary-700 bg-primary-50'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* ── TAB 1: Barcode ──────────────────────────────────────────────────── */}
        {activeTab === 'barcode' && (
          <div className="p-5 space-y-5">
            {!barcodeSupported && (
              <div className="bg-warning-50 border border-warning-200 text-warning-700 text-sm px-4 py-3 rounded-lg">
                Real-time barcode scanning requires Chrome or Edge on Android. Use manual ISBN entry below, or try updating your browser.
              </div>
            )}

            {/* Camera viewfinder */}
            <div className="relative bg-neutral-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
              />
              {!cameraActive && (
                <div className="text-center text-neutral-400 space-y-3 p-8">
                  <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center mx-auto">
                    <BarcodeIcon className="w-8 h-8 text-neutral-500" />
                  </div>
                  <p className="text-sm">Point camera at the ISBN barcode on the back cover</p>
                </div>
              )}
              {cameraActive && scanning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-32 border-2 border-primary-400 rounded-lg relative">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary-400 rounded-tl" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary-400 rounded-tr" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary-400 rounded-bl" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary-400 rounded-br" />
                    <div className="absolute inset-x-0 h-0.5 bg-primary-400/60 animate-scan-line" style={{ top: '50%' }} />
                  </div>
                </div>
              )}
              {isbnLoading && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                  <Spinner className="w-3 h-3" />
                  Looking up ISBN…
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {!cameraActive ? (
                <button onClick={startCamera} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <CameraIcon className="w-4 h-4" />
                  Start Camera
                </button>
              ) : (
                <button onClick={stopCamera} className="btn-outline flex-1">
                  Stop Camera
                </button>
              )}
            </div>

            {/* Manual ISBN entry */}
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Or enter ISBN manually…"
                className="input flex-1"
                value={manualISBN}
                onChange={(e) => setManualISBN(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && manualISBN.trim()) {
                    fetchISBN(manualISBN.trim());
                    setManualISBN('');
                  }
                }}
              />
              <button
                onClick={() => { fetchISBN(manualISBN.trim()); setManualISBN(''); }}
                disabled={!manualISBN.trim() || isbnLoading}
                className="btn-outline disabled:opacity-50"
              >
                Lookup
              </button>
            </div>

            {isbnError && (
              <p className="text-sm text-warning-700 bg-warning-50 border border-warning-200 px-3 py-2 rounded-lg">
                {isbnError}
              </p>
            )}

            {/* Preview */}
            {preview && (
              <div className="border border-neutral-200 rounded-xl overflow-hidden animate-fade-in">
                <div className="flex gap-4 p-4">
                  {preview.cover_image ? (
                    <img
                      src={preview.cover_image}
                      alt="Cover"
                      className="w-20 object-cover rounded-lg shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-28 bg-neutral-100 rounded-lg shrink-0 flex items-center justify-center text-neutral-400">
                      <BookIcon className="w-8 h-8" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="font-mono text-xs text-neutral-400">ISBN {preview.isbn}</div>
                    <input
                      className="input font-semibold text-sm py-1"
                      value={preview.title}
                      onChange={(e) => setPreview((p) => p && { ...p, title: e.target.value })}
                      placeholder="Title"
                    />
                    <input
                      className="input text-sm py-1"
                      value={preview.authors}
                      onChange={(e) => setPreview((p) => p && { ...p, authors: e.target.value })}
                      placeholder="Authors"
                    />
                    <div className="flex gap-2">
                      <input
                        className="input text-sm py-1 flex-1"
                        value={preview.publisher}
                        onChange={(e) => setPreview((p) => p && { ...p, publisher: e.target.value })}
                        placeholder="Publisher"
                      />
                      <input
                        type="number"
                        className="input text-sm py-1 w-24"
                        value={preview.year}
                        onChange={(e) => setPreview((p) => p && { ...p, year: +e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 px-4 pb-4">
                  <button
                    onClick={() => addToQueue(preview, 'barcode')}
                    className="btn-primary flex-1"
                    disabled={!preview.title}
                  >
                    Add to Queue
                  </button>
                  <button
                    onClick={() => navigate('/admin/catalogue/new', { state: { prefill: preview } })}
                    className="btn-outline"
                  >
                    Full Form
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Back Cover AI ──────────────────────────────────────────── */}
        {activeTab === 'backcover' && (
          <div className="p-5 space-y-5">
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 text-sm text-primary-800">
              <p className="font-semibold mb-1">For pre-ISBN and local publications</p>
              <p className="text-primary-700 text-xs leading-relaxed">
                Photograph the back cover. AI OCR extracts title, author, publisher, and ISBN if present.
                Essential for Nigerian and African publications without barcodes.
              </p>
            </div>

            {/* Camera / capture area */}
            <div className="relative bg-neutral-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
              <video
                ref={bcVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${bcCameraActive ? 'block' : 'hidden'}`}
              />
              <canvas ref={bcCanvasRef} className="hidden" />

              {bcCapture && !bcCameraActive && (
                <img src={bcCapture} alt="Captured" className="w-full h-full object-contain" />
              )}
              {!bcCameraActive && !bcCapture && (
                <div className="text-center text-neutral-400 space-y-3 p-8">
                  <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center mx-auto">
                    <CameraIcon className="w-8 h-8 text-neutral-500" />
                  </div>
                  <p className="text-sm">Photograph the book's back cover</p>
                </div>
              )}
              {ocrLoading && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3 text-white">
                  <Spinner className="w-8 h-8" />
                  <p className="text-sm font-medium">Extracting text…</p>
                  <p className="text-xs text-white/60">Hugging Face TrOCR</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {bcCameraActive ? (
                <>
                  <button onClick={captureFrame} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    <CameraIcon className="w-4 h-4" />
                    Capture Photo
                  </button>
                  <button onClick={stopBackCamera} className="btn-outline">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={startBackCamera}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    <CameraIcon className="w-4 h-4" />
                    Use Camera
                  </button>
                  <button
                    onClick={() => bcFileRef.current?.click()}
                    className="btn-outline flex-1 flex items-center justify-center gap-2"
                  >
                    <UploadIcon className="w-4 h-4" />
                    Upload Image
                  </button>
                  <input
                    ref={bcFileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </>
              )}
            </div>

            {ocrError && (
              <p className="text-sm text-warning-700 bg-warning-50 border border-warning-200 px-3 py-2 rounded-lg">
                {ocrError}
              </p>
            )}

            {/* Extracted fields editor */}
            {(bcCapture || ocrFields.title) && !ocrLoading && (
              <div className="border border-neutral-200 rounded-xl p-4 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-neutral-700">Extracted Details</p>
                  {bcCapture && (
                    <button
                      onClick={() => { setBcCapture(null); setOcrFields(emptyBook()); setOcrError(''); }}
                      className="text-xs text-neutral-400 hover:text-neutral-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <label className="label text-xs">Title</label>
                    <input
                      className="input"
                      value={ocrFields.title}
                      onChange={(e) => setOcrFields((p) => ({ ...p, title: e.target.value }))}
                      placeholder="Title"
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Authors</label>
                    <input
                      className="input"
                      value={ocrFields.authors}
                      onChange={(e) => setOcrFields((p) => ({ ...p, authors: e.target.value }))}
                      placeholder="Authors (comma-separated)"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label text-xs">Publisher</label>
                      <input
                        className="input"
                        value={ocrFields.publisher}
                        onChange={(e) => setOcrFields((p) => ({ ...p, publisher: e.target.value }))}
                        placeholder="Publisher"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Year</label>
                      <input
                        type="number"
                        className="input"
                        value={ocrFields.year}
                        onChange={(e) => setOcrFields((p) => ({ ...p, year: +e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label text-xs">ISBN (if found)</label>
                    <input
                      className="input font-mono"
                      value={ocrFields.isbn}
                      onChange={(e) => setOcrFields((p) => ({ ...p, isbn: e.target.value }))}
                      placeholder="Leave blank if none"
                    />
                  </div>
                </div>
                <button
                  onClick={() => addToQueue(ocrFields, 'backcover')}
                  disabled={!ocrFields.title}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  Add to Queue
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: Bulk Session ───────────────────────────────────────────── */}
        {activeTab === 'bulk' && (
          <div className="p-5 space-y-5">
            {summary && (
              <div className="bg-success-50 border border-success-200 text-success-700 px-4 py-3 rounded-xl flex items-center gap-3">
                <CheckIcon className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-semibold">{summary.catalogued} item{summary.catalogued !== 1 ? 's' : ''} catalogued successfully</p>
                  <p className="text-xs text-success-600 mt-0.5">
                    <button onClick={() => navigate('/admin/catalogue')} className="underline">
                      View catalogue
                    </button>
                    {' '}or continue scanning to add more.
                  </p>
                </div>
              </div>
            )}

            {queue.length === 0 && !summary && (
              <div className="text-center py-16 text-neutral-400">
                <StackIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Queue is empty</p>
                <p className="text-sm mt-1">Scan barcodes or photograph back covers to add items here</p>
                <div className="flex gap-2 justify-center mt-4">
                  <button onClick={() => switchTab('barcode')} className="btn-outline text-sm">
                    Barcode Scanner
                  </button>
                  <button onClick={() => switchTab('backcover')} className="btn-outline text-sm">
                    Back Cover AI
                  </button>
                </div>
              </div>
            )}

            {queue.length > 0 && (
              <>
                <div className="space-y-3">
                  {queue.map((item) => (
                    <QueueCard
                      key={item.id}
                      item={item}
                      editing={editingId === item.id}
                      onEdit={() => setEditingId(editingId === item.id ? null : item.id)}
                      onChange={(patch) => updateQueueItem(item.id, patch)}
                      onRemove={() => removeFromQueue(item.id)}
                    />
                  ))}
                </div>

                <div className="flex gap-3 pt-2 border-t border-neutral-100">
                  <button
                    onClick={() => { setQueue([]); setSummary(null); }}
                    className="btn-ghost text-sm"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={submitAll}
                    disabled={submitting || queue.length === 0}
                    className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? (
                      <><Spinner className="w-4 h-4" /> Publishing…</>
                    ) : (
                      <>Submit All ({queue.length} item{queue.length !== 1 ? 's' : ''})</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Queue Card ─────────────────────────────────────────────────────────────────
function QueueCard({
  item,
  editing,
  onEdit,
  onChange,
  onRemove,
}: {
  item: BulkItem;
  editing: boolean;
  onEdit: () => void;
  onChange: (patch: Partial<BulkItem>) => void;
  onRemove: () => void;
}) {
  const sourceBadge: Record<BulkItem['source'], string> = {
    barcode: 'bg-primary-100 text-primary-700',
    backcover: 'bg-gold-100 text-gold-700',
    manual: 'bg-neutral-100 text-neutral-600',
  };
  const sourceLabel: Record<BulkItem['source'], string> = {
    barcode: 'Barcode',
    backcover: 'AI OCR',
    manual: 'Manual',
  };

  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 p-3">
        {item.cover_image ? (
          <img
            src={item.cover_image}
            alt="Cover"
            className="w-12 h-16 object-cover rounded-lg shrink-0"
          />
        ) : (
          <div className="w-12 h-16 bg-neutral-100 rounded-lg shrink-0 flex items-center justify-center">
            <BookIcon className="w-5 h-5 text-neutral-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm text-neutral-800 truncate">{item.title || 'Untitled'}</p>
              <p className="text-xs text-neutral-500 truncate mt-0.5">
                {item.authors || 'Unknown author'}
                {item.year ? ` · ${item.year}` : ''}
              </p>
              {item.isbn && (
                <p className="font-mono text-xs text-neutral-400 mt-0.5">ISBN {item.isbn}</p>
              )}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${sourceBadge[item.source]}`}>
              {sourceLabel[item.source]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-primary-700 hover:bg-primary-50 transition-colors"
            title="Edit"
          >
            <EditIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-error-600 hover:bg-error-50 transition-colors"
            title="Remove"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {editing && (
        <div className="border-t border-neutral-200 bg-neutral-50 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="sm:col-span-2">
            <label className="label text-xs">Title</label>
            <input
              className="input text-sm"
              value={item.title}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </div>
          <div>
            <label className="label text-xs">Authors</label>
            <input
              className="input text-sm"
              value={item.authors}
              onChange={(e) => onChange({ authors: e.target.value })}
            />
          </div>
          <div>
            <label className="label text-xs">ISBN</label>
            <input
              className="input text-sm font-mono"
              value={item.isbn}
              onChange={(e) => onChange({ isbn: e.target.value })}
            />
          </div>
          <div>
            <label className="label text-xs">Publisher</label>
            <input
              className="input text-sm"
              value={item.publisher}
              onChange={(e) => onChange({ publisher: e.target.value })}
            />
          </div>
          <div>
            <label className="label text-xs">Year</label>
            <input
              type="number"
              className="input text-sm"
              value={item.year}
              onChange={(e) => onChange({ year: +e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label text-xs">Format</label>
            <select
              className="input text-sm"
              value={item.format}
              onChange={(e) => onChange({ format: e.target.value })}
            >
              {['Book', 'E-Book', 'Journal', 'Thesis', 'Report', 'Map', 'Video', 'Audio'].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Micro-components ───────────────────────────────────────────────────────────
function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <div
      className={`${className} border-2 border-current border-t-transparent rounded-full animate-spin inline-block`}
    />
  );
}

function BarcodeIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 9V6a1 1 0 011-1h2M3 15v3a1 1 0 001 1h2m11-16h2a1 1 0 011 1v3m0 6v3a1 1 0 01-1 1h-2M7 5v14M10 5v14M13 5v14M16 5v6m0 3v5" />
    </svg>
  );
}

function CameraIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function StackIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  );
}

function BookIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function UploadIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function EditIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function XIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
