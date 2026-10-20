import * as React from 'react';

type ReactCache = <Args extends unknown[], Result>(fn: (...args: Args) => Promise<Result>) => (...args: Args) => Promise<Result>;

const reactCache: ReactCache | null = typeof (React as { cache?: unknown }).cache === 'function'
  ? ((React as unknown as { cache: ReactCache }).cache)
  : null;

export function requestMemo<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  if (reactCache) return reactCache(fn);
  return fn;
}
