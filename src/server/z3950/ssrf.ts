import { lookup } from 'dns/promises';
import { isIP } from 'net';

const BLOCKED_PORTS = new Set([22, 23, 25, 53, 80, 443, 3306, 5432, 6379, 27017, 11211, 9200]);
const STANDARD_Z3950_PORT = 210;

export interface SSRFCheckResult {
  allowed: boolean;
  reason?: string;
  resolvedIPs?: string[];
}

export async function checkSSRF(host: string, port: number, trusted: boolean): Promise<SSRFCheckResult> {
  if (!trusted && port !== STANDARD_Z3950_PORT) {
    return { allowed: false, reason: `Port ${port} is not the standard Z39.50 port (210). Only trusted targets may use non-standard ports.` };
  }

  if (BLOCKED_PORTS.has(port)) {
    return { allowed: false, reason: `Port ${port} is blocked for security reasons.` };
  }

  let ips: string[];
  try {
    const addr = isIP(host);
    if (addr) {
      ips = [host];
    } else {
      const result = await lookup(host, { all: true });
      ips = result.map(r => r.address);
    }
  } catch {
    return { allowed: false, reason: `Could not resolve host ${host}` };
  }

  for (const ip of ips) {
    if (isPrivateOrReserved(ip)) {
      return { allowed: false, reason: `Host ${host} resolves to private/reserved IP ${ip}` };
    }
  }

  return { allowed: true, resolvedIPs: ips };
}

function isPrivateOrReserved(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length === 4 && parts.every(p => !isNaN(p))) {
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a >= 224) return true;
  }
  if (ip.includes(':')) {
    const lower = ip.toLowerCase();
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('fe80')) return true;
    if (lower === '::1') return true;
    if (lower.startsWith('::')) return true;
  }
  return false;
}
