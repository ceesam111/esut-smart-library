import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { isMissingSchemaError } from '@/server/supabase/schemaErrors';
import type { AccessState, VerificationStatus } from './types';

const VERIFY_TIMEOUT_MS = 8000;
const COURTESY_DELAY_MS = 250;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const buildUserAgent = (): string => process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'esut-smart-library';

export type FetchLike = (url: string, init?: RequestInit) => Promise<{ status: number }>;

export interface LinkCheckResult {
  status: 'ok' | 'not_found' | 'inconclusive';
  httpStatus: number | null;
}

const classifyStatus = (status: number | 'network_error'): LinkCheckResult => {
  if (status === 'network_error') return { status: 'inconclusive', httpStatus: null };
  if (status >= 200 && status < 400) return { status: 'ok', httpStatus: status };
  if (status === 404 || status === 410 || status === 451) return { status: 'not_found', httpStatus: status };
  return { status: 'inconclusive', httpStatus: status };
};

export const checkLink = async (url: string, fetchImpl: FetchLike = fetch): Promise<LinkCheckResult> => {
  const request = async (method: 'HEAD' | 'GET'): Promise<number | 'network_error'> => {
    try {
      const response = await fetchImpl(url, {
        method,
        redirect: 'follow',
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
        headers: { 'user-agent': buildUserAgent(), accept: '*/*' },
      });
      return response.status;
    } catch {
      return 'network_error';
    }
  };
  const headStatus = await request('HEAD');
  if (headStatus === 405 || headStatus === 501) {
    return classifyStatus(await request('GET'));
  }
  return classifyStatus(headStatus);
};

export interface VerificationRecord {
  id: string;
  full_text_url: string | null;
  landing_page_url: string;
  access_state: AccessState;
  verification_status: VerificationStatus;
  abstract_text: string | null;
}

export interface VerificationPatch {
  verification_status: VerificationStatus;
  verification_http_status: number | null;
  verification_checked_at: string;
  access_state?: AccessState;
}

export interface VerificationRepo {
  listRecords(limit: number): Promise<VerificationRecord[]>;
  applyResult(id: string, patch: VerificationPatch): Promise<void>;
}

export const createSupabaseVerificationRepo = (): VerificationRepo => {
  const supabase = getSupabaseAdminClient();
  return {
    async listRecords(limit) {
      const { data, error } = await supabase
        .from('scholarly_resources')
        .select('id,full_text_url,landing_page_url,access_state,verification_status,abstract_text')
        .eq('is_active', true)
        .order('verification_checked_at', { ascending: true, nullsFirst: true })
        .limit(limit);
      if (error) {
        if (isMissingSchemaError(error)) return [];
        throw new Error(error.message);
      }
      return (data ?? []) as VerificationRecord[];
    },
    async applyResult(id, patch) {
      const { error } = await supabase.from('scholarly_resources').update(patch).eq('id', id);
      if (error && !isMissingSchemaError(error)) throw new Error(error.message);
    },
  };
};

const clampLimit = (value: number): number => Math.min(Math.max(Math.floor(value), 1), MAX_LIMIT);

const downgradeAccessState = (state: AccessState, hasAbstract: boolean): AccessState => {
  if (state === 'full_text') return hasAbstract ? 'abstract_only' : 'metadata_only';
  if (state === 'abstract_only') return 'metadata_only';
  return state;
};

export interface VerificationRunSummary {
  checked: number;
  verified: number;
  failed: number;
  unverifiable: number;
}

export interface VerificationRunOptions {
  limit?: number;
}

export interface VerificationRunDeps {
  repo?: VerificationRepo;
  check?: (url: string) => Promise<LinkCheckResult>;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const runLinkVerification = async (
  options: VerificationRunOptions = {},
  deps: VerificationRunDeps = {},
): Promise<VerificationRunSummary> => {
  const repo = deps.repo ?? createSupabaseVerificationRepo();
  const check = deps.check ?? ((url: string) => checkLink(url));
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? defaultSleep;
  const limit = clampLimit(options.limit ?? DEFAULT_LIMIT);
  const records = await repo.listRecords(limit);
  const summary: VerificationRunSummary = { checked: 0, verified: 0, failed: 0, unverifiable: 0 };
  let processed = 0;
  for (const record of records) {
    if (processed > 0) await sleep(COURTESY_DELAY_MS);
    processed += 1;
    const url = record.full_text_url ?? record.landing_page_url;
    const result = await check(url);
    const checkedAt = now().toISOString();
    summary.checked += 1;
    if (result.status === 'ok') {
      summary.verified += 1;
      await repo.applyResult(record.id, {
        verification_status: 'verified',
        verification_http_status: result.httpStatus,
        verification_checked_at: checkedAt,
      });
      continue;
    }
    if (result.status === 'not_found') {
      summary.failed += 1;
      await repo.applyResult(record.id, {
        verification_status: 'failed',
        verification_http_status: result.httpStatus,
        verification_checked_at: checkedAt,
        access_state: downgradeAccessState(record.access_state, Boolean(record.abstract_text)),
      });
      continue;
    }
    summary.unverifiable += 1;
    if (record.verification_status === 'verified') {
      await repo.applyResult(record.id, {
        verification_status: 'stale',
        verification_http_status: result.httpStatus,
        verification_checked_at: checkedAt,
      });
    }
  }
  return summary;
};
