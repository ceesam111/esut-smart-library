const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;
const IDS = /\b(?:matric|staff|library|patron)\s*(?:no|number|id)?\s*[:#-]?\s*[a-z0-9/-]+/gi;

export function redactPatronPii(text: string) {
  return text.replace(EMAIL, '[redacted-email]').replace(PHONE, '[redacted-phone]').replace(IDS, '[redacted-id]');
}

export function redactObject<T>(value: T): T {
  if (typeof value === 'string') return redactPatronPii(value) as T;
  if (Array.isArray(value)) return value.map((item) => redactObject(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, redactObject(val)])) as T;
  }
  return value;
}
