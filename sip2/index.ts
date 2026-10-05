import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startSip2Listener } from './listener';

function loadDotEnv(file: string): void {
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function readNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(resolve(projectRoot, '.env.local'));
loadDotEnv(resolve(projectRoot, '.env'));

const port = readNumber('SIP2_PORT', 6000);
const healthPort = readNumber('SIP2_HEALTH_PORT', 8788);
const maxConnections = readNumber('SIP2_MAX_CONNECTIONS', 32);
const idleTimeoutMs = readNumber('SIP2_IDLE_TIMEOUT_MS', 300_000);
const maxMessageBytes = readNumber('SIP2_MAX_MESSAGE_BYTES', 8192);
const tlsCertPath = process.env.SIP2_TLS_CERT || null;
const tlsKeyPath = process.env.SIP2_TLS_KEY || null;

const listener = await startSip2Listener({
  port,
  healthPort,
  maxConnections,
  idleTimeoutMs,
  maxMessageBytes,
  tlsCertPath,
  tlsKeyPath,
});

const scheme = listener.state.tls ? 'tls' : 'tcp';
console.warn(
  `[sip2] listening ${scheme} :${listener.state.port} (maxConn=${maxConnections}, idle=${idleTimeoutMs}ms, maxMsg=${maxMessageBytes}B); health=:${listener.state.healthPort}/health`,
);

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.warn(`[sip2] ${signal} received; draining connections`);
  await listener.close();
  console.warn('[sip2] stopped');
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
