export type SearchSort = 'relevance' | 'newest' | 'oldest' | 'title';

export interface RepositorySearchParams {
  query?: string;
  faculty?: string[];
  department?: string[];
  years?: number[];
  resourceTypes?: string[];
  subjects?: string[];
  accessLevels?: string[];
  sort?: SearchSort;
  page?: number;
  pageSize?: number;
  userId?: string | null;
}

export interface RepositorySearchFacets {
  resourceType: FacetCount[];
  year: FacetCount[];
  faculty: FacetCount[];
  department: FacetCount[];
  author: FacetCount[];
  subject: FacetCount[];
  accessLevel: FacetCount[];
}

export interface FacetCount {
  value: string;
  count: number;
}

export interface RepositorySearchResult {
  id: string;
  title: string;
  authors: string[];
  subjects: string[];
  keywords: string[];
  abstract: string | null;
  year: number | null;
  resourceType: string;
  facultyCode: string | null;
  department: string | null;
  doi: string | null;
  handle: string | null;
  license: string | null;
  createdAt: string;
  score: number;
  matchedIn: string[] | null;
  snippet: string | null;
  file: { name: string; accessLevel: string; extractionStatus: string } | null;
}

export interface RepositorySearchResponse {
  items: RepositorySearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: RepositorySearchFacets;
  query: string;
  sort: SearchSort;
}

export const SEARCH_SORTS: readonly SearchSort[] = ['relevance', 'newest', 'oldest', 'title'];

export function normalizeSort(sort: string | null | undefined): SearchSort {
  const normalized = (sort ?? '').toLowerCase();
  return SEARCH_SORTS.includes(normalized as SearchSort) ? (normalized as SearchSort) : 'relevance';
}

export function parseStringArray(value: string | null | undefined): string[] | null {
  if (!value) return null;
  const parts = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  return parts.length > 0 ? parts : null;
}

export function parseNumberArray(value: string | null | undefined): number[] | null {
  if (!value) return null;
  const parts = value.split(',').map((entry) => Number(entry.trim())).filter((entry) => Number.isInteger(entry));
  return parts.length > 0 ? parts : null;
}
