import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { z, type ZodTypeAny } from 'zod';
import { childLogger } from '@/server/logging/logger';
import { ApiError, normalizeError } from './errors';
import { errorResponse, successResponse } from './responses';

export interface AppHandlerContext<TBody = unknown, TQuery = unknown, TParams = Record<string, string>> {
  request: NextRequest;
  requestId: string;
  body: TBody;
  query: TQuery;
  params: TParams;
  log: ReturnType<typeof childLogger>;
}

type HandlerResult = { data: unknown; status?: number } | unknown;

export function getRequestId(request: Request) {
  return request.headers.get('x-request-id') || randomUUID();
}

async function parseBody(request: NextRequest) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return undefined;
  return request.json().catch(() => undefined);
}

export function withHandler<TBody = unknown, TQuery = unknown, TParams extends Record<string, string> = Record<string, string>>(options: {
  bodySchema?: ZodTypeAny;
  querySchema?: ZodTypeAny;
  paramsSchema?: ZodTypeAny;
  tenantFrom?: (ctx: AppHandlerContext<TBody, TQuery, TParams>) => { tenantId?: string | null; tenantSlug?: string | null } | Promise<{ tenantId?: string | null; tenantSlug?: string | null }>;
  handler: (ctx: AppHandlerContext<TBody, TQuery, TParams>) => Promise<HandlerResult>;
}) {
  return async function wrapped(request: NextRequest, routeContext?: { params?: TParams }) {
    const startedAt = Date.now();
    const requestId = getRequestId(request);
    const baseLog = childLogger({ requestId, method: request.method, path: request.nextUrl.pathname });
    try {
      const rawBody = await parseBody(request);
      const rawQuery = Object.fromEntries(request.nextUrl.searchParams.entries());
      const rawParams = routeContext?.params ?? ({} as TParams);
      const body = options.bodySchema ? options.bodySchema.parse(rawBody) : rawBody;
      const query = options.querySchema ? options.querySchema.parse(rawQuery) : rawQuery;
      const params = options.paramsSchema ? options.paramsSchema.parse(rawParams) : rawParams;
      const ctx = { request, requestId, body, query, params, log: baseLog } as AppHandlerContext<TBody, TQuery, TParams>;
      const tenant = options.tenantFrom ? await options.tenantFrom(ctx) : {};
      const log = childLogger({ requestId, method: request.method, path: request.nextUrl.pathname, tenantId: tenant.tenantId ?? null, tenantSlug: tenant.tenantSlug ?? null });
      const result = await options.handler({ ...ctx, log });
      const status = typeof result === 'object' && result !== null && 'data' in result ? (result as { status?: number }).status ?? 200 : 200;
      const data = typeof result === 'object' && result !== null && 'data' in result ? (result as { data: unknown }).data : result;
      log.http('request completed', { status, durationMs: Date.now() - startedAt });
      return successResponse(data, requestId, status);
    } catch (error) {
      const apiError = error instanceof z.ZodError ? new ApiError('VALIDATION_ERROR', 'Invalid request payload.', 400, error.flatten()) : normalizeError(error);
      baseLog.error('request failed', { status: apiError.status, code: apiError.code, details: apiError.details, stack: error instanceof Error ? error.stack : undefined, durationMs: Date.now() - startedAt });
      return errorResponse(apiError, requestId);
    }
  };
}
