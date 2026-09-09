import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'node:crypto';
import { z, type ZodTypeAny } from 'zod';
import { childLogger } from '@/server/logging/logger';
import { ApiError, normalizeError, publicErrorMessage } from './errors';

export function withPagesHandler(options: { bodySchema?: ZodTypeAny; querySchema?: ZodTypeAny; handler: (ctx: { req: NextApiRequest; res: NextApiResponse; requestId: string; body: unknown; query: unknown; log: ReturnType<typeof childLogger> }) => Promise<unknown> }): NextApiHandler {
  return async (req, res) => {
    const requestId = String(req.headers['x-request-id'] || randomUUID());
    const log = childLogger({ requestId, method: req.method, path: req.url });
    try {
      const body = options.bodySchema ? options.bodySchema.parse(req.body) : req.body;
      const query = options.querySchema ? options.querySchema.parse(req.query) : req.query;
      const data = await options.handler({ req, res, requestId, body, query, log });
      if (!res.headersSent) res.status(200).json({ success: true, data, requestId });
    } catch (error) {
      const apiError = error instanceof z.ZodError ? new ApiError('VALIDATION_ERROR', 'Invalid request payload.', 400, error.flatten()) : normalizeError(error);
      log.error('pages/api request failed', { status: apiError.status, code: apiError.code, stack: error instanceof Error ? error.stack : undefined });
      if (!res.headersSent) res.status(apiError.status).json({ success: false, error: { code: apiError.code, message: publicErrorMessage(apiError), requestId } });
    }
  };
}
