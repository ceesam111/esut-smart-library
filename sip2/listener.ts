import net from 'node:net';
import tls from 'node:tls';
import { readFileSync } from 'node:fs';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { createSip2Session, handleSip2Message, type Sip2Session } from '@/server/sip2/server';

export interface Sip2ListenerOptions {
  /** TCP port. 0 = ephemeral (tests). */
  port: number;
  /** Health HTTP port. 0 = ephemeral (tests). */
  healthPort: number;
  host?: string;
  maxConnections: number;
  idleTimeoutMs: number;
  maxMessageBytes: number;
  tlsCertPath?: string | null;
  tlsKeyPath?: string | null;
  handler?: typeof handleSip2Message;
}

export interface Sip2ListenerState {
  startedAt: string;
  port: number;
  healthPort: number;
  tls: boolean;
  shuttingDown: boolean;
  connections: number;
  connectionsTotal: number;
  messagesProcessed: number;
  responsesSent: number;
  ignoredFrames: number;
  oversizeFrames: number;
  rejectedConnections: number;
  lastMessageAt: string | null;
}

/**
 * SIP2 framing: messages are CR-terminated (spec §15/§16), no length prefix.
 * Tolerates LF and CRLF terminators from less strict self-check software,
 * coalesced TCP segments, and multiple messages in one segment.
 */
export class Sip2FrameDecoder {
  private buffer = '';

  constructor(private readonly maxBytes: number) {}

  push(chunk: string): { frames: string[]; oversize: boolean } {
    this.buffer += chunk;
    const frames: string[] = [];
    for (;;) {
      const cr = this.buffer.indexOf('\r');
      const lf = this.buffer.indexOf('\n');
      const idx = cr === -1 ? lf : lf === -1 ? cr : Math.min(cr, lf);
      if (idx === -1) break;
      const frame = this.buffer.slice(0, idx);
      let consumed = idx + 1;
      if (this.buffer.charAt(idx) === '\r' && this.buffer.charAt(idx + 1) === '\n') consumed = idx + 2;
      this.buffer = this.buffer.slice(consumed);
      if (frame.length === 0) continue;
      if (frame.length > this.maxBytes) return { frames, oversize: true };
      frames.push(frame);
    }
    if (this.buffer.length > this.maxBytes) return { frames, oversize: true };
    return { frames, oversize: false };
  }
}

interface TrackedSocket {
  socket: net.Socket | tls.TLSSocket;
  getInflight: () => number;
}

export interface Sip2Listener {
  state: Sip2ListenerState;
  tcpServer: net.Server | tls.Server;
  healthServer: HttpServer;
  close: (graceMs?: number) => Promise<void>;
}

function loadTlsContext(certPath: string, keyPath: string): tls.TlsOptions {
  return { cert: readFileSync(certPath), key: readFileSync(keyPath) };
}

export async function startSip2Listener(options: Sip2ListenerOptions): Promise<Sip2Listener> {
  const {
    port,
    healthPort,
    host = '0.0.0.0',
    maxConnections,
    idleTimeoutMs,
    maxMessageBytes,
    tlsCertPath = null,
    tlsKeyPath = null,
    handler = handleSip2Message,
  } = options;

  const useTls = Boolean(tlsCertPath && tlsKeyPath);
  const state: Sip2ListenerState = {
    startedAt: new Date().toISOString(),
    port,
    healthPort,
    tls: useTls,
    shuttingDown: false,
    connections: 0,
    connectionsTotal: 0,
    messagesProcessed: 0,
    responsesSent: 0,
    ignoredFrames: 0,
    oversizeFrames: 0,
    rejectedConnections: 0,
    lastMessageAt: null,
  };

  const tracked = new Set<TrackedSocket>();

  const attachSocket = (socket: net.Socket | tls.TLSSocket) => {
    if (state.shuttingDown || state.connections >= maxConnections) {
      state.rejectedConnections += 1;
      console.warn('[sip2] rejecting connection: at capacity or shutting down');
      socket.destroy();
      return;
    }
    state.connections += 1;
    state.connectionsTotal += 1;
    const remote = `${socket.remoteAddress ?? 'unknown'}:${socket.remotePort ?? 0}`;
    console.warn(`[sip2] connection open ${remote} (active=${state.connections})`);

    let session: Sip2Session = createSip2Session(socket.remoteAddress ?? null);
    const decoder = new Sip2FrameDecoder(maxMessageBytes);
    let queue: Promise<void> = Promise.resolve();
    let inflight = 0;
    tracked.add({ socket, getInflight: () => inflight });

    socket.setEncoding('utf8');
    socket.setTimeout(idleTimeoutMs);
    socket.on('timeout', () => {
      console.warn(`[sip2] idle timeout ${remote}; closing`);
      socket.destroy();
    });
    socket.on('error', (err) => {
      console.error(`[sip2] socket error ${remote}: ${err.message}`);
      socket.destroy();
    });
    socket.on('close', () => {
      state.connections -= 1;
      console.warn(`[sip2] connection close ${remote} (active=${state.connections})`);
    });
    socket.on('data', (chunk: string) => {
      const { frames, oversize } = decoder.push(chunk);
      if (oversize) {
        state.oversizeFrames += 1;
        console.error(`[sip2] oversize frame from ${remote}; closing connection`);
        socket.destroy();
        return;
      }
      for (const frame of frames) {
        if (state.shuttingDown) continue;
        queue = queue.then(async () => {
          inflight += 1;
          try {
            const result = await handler(frame, session, {});
            session = result.session;
            state.messagesProcessed += 1;
            state.lastMessageAt = new Date().toISOString();
            if (result.response === null) {
              state.ignoredFrames += 1;
            } else if (!socket.destroyed) {
              socket.write(result.response);
              state.responsesSent += 1;
            }
          } catch (err) {
            console.error(`[sip2] handler failure from ${remote}: ${err instanceof Error ? err.message : String(err)}`);
          } finally {
            inflight -= 1;
          }
        });
      }
    });
  };

  const tcpServer: net.Server | tls.Server = useTls
    ? tls.createServer(loadTlsContext(tlsCertPath!, tlsKeyPath!), attachSocket)
    : net.createServer(attachSocket);

  if (useTls) {
    (tcpServer as tls.Server).on('tlsClientError', (err) => {
      console.error(`[sip2] TLS handshake error: ${err.message}`);
    });
  }

  await new Promise<void>((resolveListen, rejectListen) => {
    tcpServer.once('error', rejectListen);
    tcpServer.listen(port, host, () => {
      tcpServer.removeListener('error', rejectListen);
      const address = tcpServer.address();
      if (address && typeof address === 'object') state.port = address.port;
      resolveListen();
    });
  });

  const healthServer = createHttpServer((request, response) => {
    if (request.url !== '/health') {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not_found' }));
      return;
    }
    response.writeHead(state.shuttingDown ? 503 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: state.shuttingDown ? 'shutting_down' : 'ok', ...state }));
  });
  await new Promise<void>((resolveHealth, rejectHealth) => {
    healthServer.once('error', rejectHealth);
    healthServer.listen(healthPort, host, () => {
      healthServer.removeListener('error', rejectHealth);
      const address = healthServer.address();
      if (address && typeof address === 'object') state.healthPort = address.port;
      resolveHealth();
    });
  });

  const close = async (graceMs = 5000) => {
    state.shuttingDown = true;
    await new Promise<void>((resolveClose) => tcpServer.close(() => resolveClose()));
    const deadline = Date.now() + graceMs;
    while (Date.now() < deadline) {
      const pending = [...tracked].some((entry) => entry.getInflight() > 0 || !entry.socket.destroyed);
      if (!pending) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    for (const entry of tracked) entry.socket.destroy();
    tracked.clear();
    await new Promise<void>((resolveHealthClose) => healthServer.close(() => resolveHealthClose()));
  };

  return { state, tcpServer, healthServer, close };
}
