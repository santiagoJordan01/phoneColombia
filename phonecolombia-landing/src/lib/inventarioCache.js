/** In-memory cache for inventario API data (survives route changes within the session). */

const DEFAULT_MAX_AGE_MS = 60_000;

const cache = new Map();
const inFlight = new Map();

export function makeCacheKey(scope, params = null) {
  if (params == null) return JSON.stringify([scope]);
  return JSON.stringify([scope, params]);
}

export function getCached(key) {
  return cache.get(key)?.data ?? null;
}

export function setCached(key, data) {
  cache.set(key, { data, at: Date.now() });
}

function isFresh(entry, maxAge) {
  return entry && Date.now() - entry.at < maxAge;
}

/**
 * Fetch with deduplication and stale-while-revalidate.
 * Returns { data, fromCache, refresh? } where refresh resolves when background revalidation completes.
 */
export async function cachedFetch(key, fetcher, { force = false, maxAge = DEFAULT_MAX_AGE_MS } = {}) {
  const entry = cache.get(key);

  if (!force && isFresh(entry, maxAge)) {
    return { data: entry.data, fromCache: true };
  }

  const doFetch = () => {
    if (inFlight.has(key)) return inFlight.get(key);
    const promise = Promise.resolve()
      .then(fetcher)
      .then((data) => {
        setCached(key, data);
        inFlight.delete(key);
        return data;
      })
      .catch((err) => {
        inFlight.delete(key);
        throw err;
      });
    inFlight.set(key, promise);
    return promise;
  };

  if (!force && entry) {
    const refresh = doFetch();
    return { data: entry.data, fromCache: true, refresh };
  }

  const data = await doFetch();
  return { data, fromCache: false };
}

export function invalidateByKey(key) {
  cache.delete(key);
  inFlight.delete(key);
}

export function invalidateInventarioCache(...scopes) {
  const targets = scopes.length
    ? scopes
    : ["dashboard", "inventory", "salesBootstrap", "serviceTickets", "reportsCatalogs", "reports"];

  for (const key of [...cache.keys()]) {
    for (const scope of targets) {
      if (key.startsWith(`["${scope}"`)) {
        cache.delete(key);
        inFlight.delete(key);
        break;
      }
    }
  }
}

export function clearInventarioCache() {
  cache.clear();
  inFlight.clear();
}
