import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import {
  normalizeSort,
  type FacetCount,
  type RepositorySearchParams,
  type RepositorySearchResponse,
  type RepositorySearchResult,
  type SearchSort,
} from './types';

interface RawSearchResponse {
  items: RepositorySearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: {
    resourceType: FacetCount[];
    year: FacetCount[];
    faculty: FacetCount[];
    department: FacetCount[];
    author: FacetCount[];
    subject: FacetCount[];
    accessLevel: FacetCount[];
  };
  query: string;
  sort: string;
}

export async function searchRepository(params: RepositorySearchParams): Promise<RepositorySearchResponse> {
  const db = getSupabaseAdminClient();
  const sort = normalizeSort(params.sort);

  const { data, error } = await db.rpc('repository_search', {
    p_query: params.query?.trim() ? params.query.trim() : null,
    p_faculty: params.faculty ?? null,
    p_department: params.department ?? null,
    p_years: params.years ?? null,
    p_resource_types: params.resourceTypes ?? null,
    p_subjects: params.subjects ?? null,
    p_access_levels: params.accessLevels ?? null,
    p_sort: sort,
    p_page: params.page ?? 1,
    p_page_size: params.pageSize ?? 25,
    p_user_id: params.userId ?? null,
  });

  if (error) throw new Error(`Repository search failed: ${error.message}`);
  const raw = (data ?? {}) as RawSearchResponse;

  return {
    items: raw.items ?? [],
    total: raw.total ?? 0,
    page: raw.page ?? 1,
    pageSize: raw.pageSize ?? 25,
    totalPages: raw.totalPages ?? 0,
    facets: {
      resourceType: raw.facets?.resourceType ?? [],
      year: raw.facets?.year ?? [],
      faculty: raw.facets?.faculty ?? [],
      department: raw.facets?.department ?? [],
      author: raw.facets?.author ?? [],
      subject: raw.facets?.subject ?? [],
      accessLevel: raw.facets?.accessLevel ?? [],
    },
    query: raw.query ?? '',
    sort: (raw.sort as SearchSort) ?? sort,
  };
}

export function parseSearchParams(searchParams: URLSearchParams): RepositorySearchParams {
  const years = searchParams.get('years');
  return {
    query: searchParams.get('q')?.trim() || undefined,
    faculty: splitParams(searchParams.get('faculty')),
    department: splitParams(searchParams.get('department')),
    years: years ? years.split(',').map(Number).filter((value) => Number.isInteger(value)) : undefined,
    resourceTypes: splitParams(searchParams.get('resourceType')),
    subjects: splitParams(searchParams.get('subject')),
    accessLevels: splitParams(searchParams.get('accessLevel')),
    sort: normalizeSort(searchParams.get('sort')),
    page: Number(searchParams.get('page') ?? '1'),
    pageSize: Number(searchParams.get('pageSize') ?? '25'),
  };
}

function splitParams(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const parts = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}
