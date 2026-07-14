// file: client/src/hooks/useCachedFetch.js
import { useEffect, useRef, useState } from "react";

const cache = new Map(); // key -> { data, timestamp }

export function useCachedFetch(key, fetchFn, { deps = [] } = {}) {
  const initial = cache.get(key);
  const [data, setDataState] = useState(initial ? initial.data : null);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState(null);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;
  const dataRef = useRef(data);
  dataRef.current = data;

  async function run(showSpinner) {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const result = await fetchFnRef.current();
      cache.set(key, { data: result, timestamp: Date.now() });
      dataRef.current = result;
      setDataState(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const entry = cache.get(key);
    if (entry) {
      dataRef.current = entry.data;
      setDataState(entry.data);
      setLoading(false);
      run(false); // silent background revalidate
    } else {
      run(true); // first-ever visit for this key — show spinner
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);

  // Writes both local state AND the shared cache, so a socket-driven or
  // post-mutation update isn't lost the moment the component unmounts
  // (e.g. switching admin tabs) — the next mount sees the fresh value
  // immediately instead of a stale one for a split second.
  function setData(next) {
    const resolved = typeof next === "function" ? next(dataRef.current) : next;
    dataRef.current = resolved;
    cache.set(key, { data: resolved, timestamp: Date.now() });
    setDataState(resolved);
  }

  return { data, loading, error, refresh: () => run(true), setData };
}

export function invalidateCache(key) {
  cache.delete(key);
}

export function primeCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}