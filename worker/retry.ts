export function nextRetryAt(attempts: number) {
  const delaySeconds = Math.min(900, Math.pow(2, Math.max(0, attempts - 1)) * 30);
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

export function shouldRetry(attempts: number, maxAttempts: number) {
  return attempts < maxAttempts;
}
