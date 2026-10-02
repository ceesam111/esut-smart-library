import { createServer, type Server } from 'node:http';

export interface WorkerHealthState {
  startedAt: string;
  workerId: string;
  processed: number;
  failed: number;
  active: number;
  lastPollAt: string | null;
  shuttingDown: boolean;
  /** Per job-type counters so preservation throughput is visible in /health. */
  byType: Record<string, { processed: number; failed: number; lastRunAt: string | null }>;
  preservation: { pendingJobs: number; lastProducerRunAt: string | null; lastVerifyRunAt: string | null };
  extraction: {
    pending: number;
    processing: number;
    complete: number;
    failed: number;
    notSupported: number;
    noTextLayer: number;
    blockedExternal: number;
    lastRunAt: string | null;
  };
  searchIndex: { pendingReindexJobs: number; documents: number; lastReindexAt: string | null };
}

export function startHealthServer(port: number, state: WorkerHealthState): Server {
  const server = createServer((request, response) => {
    if (request.url !== '/health') {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not_found' }));
      return;
    }
    response.writeHead(state.shuttingDown ? 503 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: state.shuttingDown ? 'shutting_down' : 'ok', ...state }));
  });
  server.listen(port);
  return server;
}
