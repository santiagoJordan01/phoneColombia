import { useCallback, useEffect, useRef, useState } from "react";
import { cachedFetch, getCached, invalidateByKey, setCached } from "../lib/inventarioCache.js";

/**
 * Cached query with stale-while-revalidate. Shows cached data instantly on remount.
 */
export function useCachedQuery(cacheKey, fetcher, { enabled = true, maxAge } = {}) {
  const key = typeof cacheKey === "string" ? cacheKey : JSON.stringify(cacheKey);
  const [data, setDataState] = useState(() => getCached(key));
  const [loading, setLoading] = useState(() => enabled && getCached(key) == null);
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const writeData = useCallback((next) => {
    setDataState(next);
    if (next !== undefined) setCached(key, next);
  }, [key]);

  const applyRefresh = useCallback((refreshPromise) => {
    if (!refreshPromise) return;
    setRefreshing(true);
    refreshPromise
      .then(writeData)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [writeData]);

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    const cached = getCached(key);
    if (cached != null) {
      setDataState(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    cachedFetch(key, () => fetcherRef.current(), { maxAge })
      .then((result) => {
        if (cancelled) return;
        writeData(result.data);
        setLoading(false);
        applyRefresh(result.refresh);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key, enabled, maxAge, applyRefresh, writeData]);

  const refetch = useCallback(async () => {
    const hadCache = getCached(key) != null;
    if (!hadCache) setLoading(true);
    else setRefreshing(true);
    try {
      const result = await cachedFetch(key, () => fetcherRef.current(), { force: true, maxAge });
      writeData(result.data);
      return result.data;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [key, maxAge, writeData]);

  const invalidate = useCallback(() => {
    invalidateByKey(key);
  }, [key]);

  const setData = useCallback((updater) => {
    setDataState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next !== undefined) setCached(key, next);
      return next;
    });
  }, [key]);

  return { data, setData, loading, refreshing, refetch, invalidate };
}
