import { useCallback, useEffect, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
  setData: (updater: T | ((prev: T | null) => T | null)) => void;
}

interface Settled<T> {
  key: string | null;
  data: T | null;
  error: string | null;
}

/**
 * Load-once-with-reload for screens. The latest request wins; loading is derived from
 * whether the settled result matches the current request key, so the effect never sets state synchronously.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [tick, setTick] = useState(0);
  const key = JSON.stringify([...deps, tick]);
  const [settled, setSettled] = useState<Settled<T>>({ key: null, data: null, error: null });

  useEffect(() => {
    let alive = true;
    fn()
      .then((data) => {
        if (alive) setSettled({ key, data, error: null });
      })
      .catch((e: unknown) => {
        if (alive) setSettled((prev) => ({ key, data: prev.data, error: e instanceof Error ? e.message : 'Something went wrong' }));
      });
    return () => {
      alive = false;
    };
    // `fn` is intentionally excluded: callers change `deps` when the request changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback<AsyncState<T>['setData']>(
    (updater) =>
      setSettled((prev) => ({
        ...prev,
        data: typeof updater === 'function' ? (updater as (p: T | null) => T | null)(prev.data) : updater,
      })),
    [],
  );

  return { data: settled.data, error: settled.key === key ? settled.error : null, loading: settled.key !== key, reload, setData };
}
