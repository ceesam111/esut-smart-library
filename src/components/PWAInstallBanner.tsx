import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  const ua = window.navigator.userAgent;
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac — detect touch Macs too
  const iPadOS = ua.includes('Macintosh') && 'ontouchend' in document;
  return iOSDevice || iPadOS;
}

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (
      localStorage.getItem('pwa_dismissed') === 'true' ||
      isStandalone()
    ) return;

    // iOS Safari never fires beforeinstallprompt — show manual instructions.
    if (isIOS()) {
      setIosHint(true);
      // Give first-time users a moment to land before prompting.
      const t = setTimeout(() => setVisible(true), 2500);
      return () => clearTimeout(t);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
      setDeferredPrompt(null);
    }
  };

  const dismiss = () => {
    localStorage.setItem('pwa_dismissed', 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed left-4 right-4 z-[9990] mx-auto max-w-sm"
      style={{ bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="bg-white rounded-xl shadow-xl border border-neutral-100 p-4"
           style={{ borderLeft: '4px solid #6B1D2A' }}>
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xl"
            style={{ background: '#6B1D2A' }}
          >
            📚
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-neutral-900">Install ESUT Library App</div>
            {iosHint ? (
              <>
                <div className="text-neutral-500 text-xs mt-0.5 leading-snug">
                  Tap the Share icon{' '}
                  <span aria-hidden className="inline-block align-middle">⬆️</span>{' '}
                  then choose <span className="font-semibold">“Add to Home Screen”</span> to install.
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={dismiss}
                    className="px-4 py-1.5 rounded-md text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: '#6B1D2A' }}
                  >
                    Got it
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-neutral-500 text-xs mt-0.5 leading-snug">
                  Access the library from your home screen — works offline.
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={install}
                    className="px-4 py-1.5 rounded-md text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: '#6B1D2A' }}
                  >
                    Install Now
                  </button>
                  <button
                    onClick={dismiss}
                    className="px-4 py-1.5 rounded-md text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
                  >
                    Not Now
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
