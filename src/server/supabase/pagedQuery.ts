export interface PagedQueryPage {
  data: unknown[] | null;
  error: { message: string } | null;
}

export interface PagedQueryOptions {
  maxRows?: number;
  pageSize?: number;
}

export interface PagedQueryResult<T> {
  rows: T[];
  error: { message: string } | null;
}

const DEFAULT_PAGE_SIZE = 1000;

export const fetchAllPaged = async <T>(
  fetchPage: (from: number, to: number) => PromiseLike<PagedQueryPage>,
  options: PagedQueryOptions,
): Promise<PagedQueryResult<T>> => {
  const pageSize = Math.max(1, Math.floor(options.pageSize ?? DEFAULT_PAGE_SIZE));
  const maxRows =
    options.maxRows === undefined
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, Math.floor(options.maxRows));
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { rows, error };
    const chunk = (data ?? []) as T[];
    rows.push(...chunk);
    if (rows.length >= maxRows) return { rows: rows.slice(0, maxRows), error: null };
    if (chunk.length === 0) return { rows, error: null };
    from += chunk.length;
  }
};
