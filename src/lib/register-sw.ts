// Guarded service-worker registration.
//
// Service workers must NEVER run inside the Lovable editor preview, an iframe,
// or in dev — they cache HTML and can serve stale builds. We only register the
// worker on the real published site. In every refused context we proactively
// unregister any stale worker so previews stay clean.

function isRefusedContext(): boolean {
  if (typeof window === 'undefined') return true;
  if (process.env.NODE_ENV !== 'production') return true;

  // Kill switch
  try {
    if (new URL(window.location.href).searchParams.get('sw') === 'off') return true;
  } catch {
    /* ignore */
  }

  // Inside an iframe (Lovable preview embeds the app)
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true; // cross-origin framing throws -> treat as framed
  }

  const host = window.location.hostname;
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('id-preview--') ||
    host.startsWith('preview--') ||
    host === 'lovableproject.com' ||
    host.endsWith('.lovableproject.com') ||
    host === 'lovableproject-dev.com' ||
    host.endsWith('.lovableproject-dev.com') ||
    host === 'beta.lovable.dev' ||
    host.endsWith('.beta.lovable.dev')
  ) {
    return true;
  }

  return false;
}

async function unregisterAll() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    /* ignore */
  }
}

export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  if (isRefusedContext()) {
    void unregisterAll();
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* registration failed — app still works without offline/push */
    });
  });
}
