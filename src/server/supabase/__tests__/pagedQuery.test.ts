import { describe, expect, it } from 'vitest';
import { fetchAllPaged, type PagedQueryPage } from '../pagedQuery';

interface FakeServerOptions {
  cap?: number;
  failOnCall?: number;
  failWith?: { message: string };
}

const fakeServer = (allRows: number[], options: FakeServerOptions = {}) => {
  const cap = options.cap ?? Number.POSITIVE_INFINITY;
  const calls: Array<{ from: number; to: number }> = [];
  const fetchPage = (from: number, to: number): Promise<PagedQueryPage> => {
    calls.push({ from, to });
    const callNumber = calls.length;
    if (options.failOnCall === callNumber) {
      return Promise.resolve({ data: null, error: options.failWith ?? { message: 'boom' } });
    }
    const requested = to - from + 1;
    const take = Math.min(requested, cap);
    return Promise.resolve({ data: allRows.slice(from, from + take), error: null });
  };
  return { fetchPage, calls };
};

const range = (count: number): number[] => Array.from({ length: count }, (_, index) => index);

describe('fetchAllPaged', () => {
  it('collects every row across pages when the server applies no cap', async () => {
    const { fetchPage, calls } = fakeServer(range(2500));
    const result = await fetchAllPaged<number>(fetchPage, { maxRows: 10000 });
    expect(result.error).toBeNull();
    expect(result.rows).toHaveLength(2500);
    expect(result.rows[0]).toBe(0);
    expect(result.rows[2499]).toBe(2499);
    expect(calls.length).toBe(4);
    expect(calls[3]).toEqual({ from: 2500, to: 3499 });
  });

  it('uses a default page size of 1000 when none is given', async () => {
    const { fetchPage, calls } = fakeServer(range(1500));
    const result = await fetchAllPaged<number>(fetchPage, { maxRows: 10000 });
    expect(result.rows).toHaveLength(1500);
    expect(calls[0]).toEqual({ from: 0, to: 999 });
    expect(calls[1]).toEqual({ from: 1000, to: 1999 });
  });

  it('stops once maxRows is reached and never returns more than maxRows', async () => {
    const { fetchPage, calls } = fakeServer(range(2500));
    const result = await fetchAllPaged<number>(fetchPage, { maxRows: 2001 });
    expect(result.error).toBeNull();
    expect(result.rows).toHaveLength(2001);
    expect(calls.length).toBe(3);
  });

  it('collects every row when the server cap is smaller than the page size', async () => {
    const { fetchPage } = fakeServer(range(350), { cap: 100 });
    const result = await fetchAllPaged<number>(fetchPage, { maxRows: 10000 });
    expect(result.error).toBeNull();
    expect(result.rows).toHaveLength(350);
    expect(result.rows[349]).toBe(349);
  });

  it('returns an empty result for an empty table without extra requests', async () => {
    const { fetchPage, calls } = fakeServer([]);
    const result = await fetchAllPaged<number>(fetchPage, { maxRows: 10000 });
    expect(result.error).toBeNull();
    expect(result.rows).toEqual([]);
    expect(calls.length).toBe(1);
  });

  it('returns the first page error without issuing further requests', async () => {
    const { fetchPage, calls } = fakeServer(range(5000), {
      failOnCall: 1,
      failWith: { message: 'schema cache miss' },
    });
    const result = await fetchAllPaged<number>(fetchPage, { maxRows: 10000 });
    expect(result.rows).toEqual([]);
    expect(result.error).toEqual({ message: 'schema cache miss' });
    expect(calls.length).toBe(1);
  });

  it('returns rows collected before a later page error alongside the error', async () => {
    const { fetchPage, calls } = fakeServer(range(5000), { failOnCall: 2 });
    const result = await fetchAllPaged<number>(fetchPage, { maxRows: 10000 });
    expect(result.rows).toHaveLength(1000);
    expect(result.error).toEqual({ message: 'boom' });
    expect(calls.length).toBe(2);
  });

  it('terminates when maxRows is zero', async () => {
    const { fetchPage, calls } = fakeServer(range(100));
    const result = await fetchAllPaged<number>(fetchPage, { maxRows: 0 });
    expect(result.rows).toEqual([]);
    expect(calls.length).toBe(1);
  });
});
