import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com/turnstile"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function TurnstileWidget({
  action,
  onToken,
  compact = false,
}: {
  action: string;
  onToken: (token: string | null) => void;
  compact?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    fetch('/api/security/turnstile/config')
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (json?.siteKey) setSiteKey(json.siteKey);
        else setEnabled(false);
      })
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (!enabled || !siteKey || !containerRef.current) return;
    let cancelled = false;
    loadTurnstileScript().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        theme: 'light',
        size: compact ? 'compact' : 'normal',
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      });
    }).catch(() => setEnabled(false));
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Cloudflare can remove challenge iframes during route changes; do not crash the React tree.
        }
        widgetIdRef.current = null;
      }
    };
  }, [action, compact, enabled, onToken, siteKey]);

  if (!enabled) return null;
  return <div ref={containerRef} className="min-h-[65px]" data-turnstile-widget />;
}
