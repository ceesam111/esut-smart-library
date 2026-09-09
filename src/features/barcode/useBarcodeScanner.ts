import { useCallback, useEffect, useRef, useState } from 'react';

type ScannerMode = 'catalogue' | 'lookup';
type ScannerStatus = 'idle' | 'starting' | 'scanning' | 'permission_denied' | 'unsupported' | 'error';

interface UseBarcodeScannerOptions {
  mode: ScannerMode;
  onDetected: (code: string, format?: string) => void | Promise<void>;
}

interface QueuedScan {
  id: string;
  code: string;
  mode: ScannerMode;
  createdAt: string;
}

const QUEUE_KEY = 'smart-library-unsynced-scans';

export function loadQueuedScans(): QueuedScan[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}

export function queueScan(code: string, mode: ScannerMode) {
  const item = { id: crypto.randomUUID(), code, mode, createdAt: new Date().toISOString() };
  localStorage.setItem(QUEUE_KEY, JSON.stringify([...loadQueuedScans(), item]));
  return item;
}

export function clearQueuedScan(id: string) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(loadQueuedScans().filter((item) => item.id !== id)));
}

export function useBarcodeScanner({ mode, onDetected }: UseBarcodeScannerOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const quaggaRef = useRef<any>(null);
  const rafRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);
  const cooldownRef = useRef(false);
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [error, setError] = useState('');
  const [lastCode, setLastCode] = useState('');
  const [backend, setBackend] = useState<'native' | 'quagga' | 'none'>('none');

  const stop = useCallback(async () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (quaggaRef.current) {
      try { quaggaRef.current.stop(); } catch {}
      quaggaRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
  }, []);

  const handleCode = useCallback(async (code: string, format?: string) => {
    if (!code || cooldownRef.current) return;
    cooldownRef.current = true;
    setLastCode(code);
    if ('vibrate' in navigator) navigator.vibrate?.(80);
    try { await onDetected(code, format); }
    finally { setTimeout(() => { cooldownRef.current = false; }, 1200); }
  }, [onDetected]);

  const startNativeLoop = useCallback(() => {
    const BarcodeDetectorCtor = (window as any).BarcodeDetector;
    const detector = new BarcodeDetectorCtor({ formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e'] });
    const loop = async () => {
      const video = videoRef.current;
      if (video?.readyState && video.readyState >= 2) {
        try {
          const hits = await detector.detect(video);
          const hit = hits?.[0];
          if (hit?.rawValue) await handleCode(hit.rawValue, hit.format);
        } catch {}
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
  }, [handleCode]);

  const startQuagga = useCallback(async () => {
    const mod = await import('@ericblade/quagga2');
    const Quagga = (mod as any).default ?? mod;
    quaggaRef.current = Quagga;
    await new Promise<void>((resolve, reject) => {
      Quagga.init({
        inputStream: {
          type: 'LiveStream',
          target: videoRef.current?.parentElement,
          constraints: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        },
        decoder: { readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'upc_reader', 'upc_e_reader'] },
        locate: true,
      }, (err: Error | null) => err ? reject(err) : resolve());
    });
    Quagga.onDetected((result: any) => {
      const code = result?.codeResult?.code;
      const format = result?.codeResult?.format;
      if (code) handleCode(code, format);
    });
    Quagga.start();
  }, [handleCode]);

  const start = useCallback(async () => {
    setStatus('starting');
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not expose camera access. Use HTTPS, update the browser, or use manual/image scan.');
      const nativeSupported = 'BarcodeDetector' in window;
      if (nativeSupported) {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          await videoRef.current.play();
        }
        setBackend('native');
        setStatus('scanning');
        startNativeLoop();
        return;
      }
      setBackend('quagga');
      setStatus('scanning');
      await startQuagga();
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setStatus(name === 'NotAllowedError' ? 'permission_denied' : 'error');
      setError(name === 'NotAllowedError' ? 'Camera permission denied. Allow camera access and retry.' : (err as Error).message || 'Scanner failed to start.');
    }
  }, [startNativeLoop, startQuagga]);

  useEffect(() => () => { stop(); }, [stop]);

  return { videoRef, status, error, backend, lastCode, start, stop, queueScan: (code: string) => queueScan(code, mode), queuedScans: loadQueuedScans() };
}
