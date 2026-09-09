export async function verifyTurnstileClient(token: string | null, action: string) {
  const config = await fetch('/api/security/turnstile/config').then((res) => res.ok ? res.json() : null).catch(() => null);
  if (!config?.siteKey) return;
  if (!token) throw new Error('Please complete the Cloudflare security verification before submitting.');
  const response = await fetch('/api/security/turnstile/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, action }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || 'Security challenge failed. Please try again.');
}
