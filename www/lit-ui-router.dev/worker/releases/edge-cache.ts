// Stale-while-revalidate over the Workers Cache API, which has none, and immutable answers kept as is; it stores nothing on workers.dev or preview urls.

/** The cache an answer goes in, the hook that lets a write outlive the response, and the clock that ages entries. */
export interface EdgeCache {
  cache: Pick<Cache, 'match' | 'put'>;
  waitUntil(promise: Promise<unknown>): void;
  now(): number;
}

/** A state's cache key for one request; anything else its answer varies on joins the key here. */
export type CacheKey = (request: Request) => Request;

/** The request url, search kept, fragment and trailing slash dropped, as a GET so a HEAD shares the entry. */
export const urlKey: CacheKey = (request) => {
  const url = new URL(request.url);
  url.hash = '';

  if (url.pathname.length > 1 && url.pathname.endsWith('/'))
    url.pathname = url.pathname.slice(0, -1);

  return new Request(url, { method: 'GET' });
};

/** An answer, and whether the edge may keep it. */
export interface Answer {
  response: Response;
  cacheable: boolean;
}

/** An entry younger than this is served without a lookup. */
export const FRESH_MS = 60_000;

/** An entry is served, and refreshed behind the response, until this age; past it the lookup runs first. */
export const KEEP_MS = 86_400_000;

/** When the entry was stored, in epoch ms; it rides out to clients so an entry's age is observable. */
export const STORED_AT = 'X-Edge-Stored-At';

/** The answer's own Cache-Control, held while the stored copy carries the edge's retention. */
const CLIENT_CACHE_CONTROL = 'X-Edge-Client-Cache-Control';

// The Cache API keeps an entry for its Cache-Control max-age.
const RETENTION = `public, max-age=${KEEP_MS / 1000}`;

/** An immutable answer is kept for its own max-age and never refreshed. */
const isImmutable = (cacheControl: string | null): boolean =>
  cacheControl?.split(',').some((part) => part.trim() === 'immutable') ?? false;

const stored = (response: Response, now: number): Response => {
  const headers = new Headers(response.headers);
  const client = headers.get('Cache-Control');
  headers.set(CLIENT_CACHE_CONTROL, client ?? '');

  if (!isImmutable(client)) headers.set('Cache-Control', RETENTION);
  headers.set(STORED_AT, String(now));

  return new Response(response.clone().body, {
    status: response.status,
    headers,
  });
};

const served = (hit: Response): Response => {
  const headers = new Headers(hit.headers);
  const client = headers.get(CLIENT_CACHE_CONTROL);
  headers.delete(CLIENT_CACHE_CONTROL);

  if (client) headers.set('Cache-Control', client);
  else headers.delete('Cache-Control');

  return new Response(hit.body, { status: hit.status, headers });
};

const ageOf = (hit: Response, now: number): number => {
  const storedAt = Number(hit.headers.get(STORED_AT));

  return Number.isFinite(storedAt) && storedAt > 0 ? now - storedAt : Infinity;
};

const store = (edge: EdgeCache, key: Request, response: Response) =>
  edge.cache.put(key, stored(response, edge.now()));

// A refresh that throws or answers uncacheable leaves the stale entry for the next request to retry.
const refresh = async (
  edge: EdgeCache,
  key: Request,
  answer: () => Promise<Answer>,
): Promise<void> => {
  try {
    const { response, cacheable } = await answer();

    if (cacheable) await store(edge, key, response);
  } catch {
    // the stale entry stays
  }
};

/** The answer cached at `key`: fresh or immutable as is, stale with a refresh behind it, else looked up and written back. */
export const cached = async (
  edge: EdgeCache,
  key: Request,
  answer: () => Promise<Answer>,
): Promise<Response> => {
  const hit = await edge.cache.match(key);

  if (hit !== undefined && isImmutable(hit.headers.get(CLIENT_CACHE_CONTROL)))
    return served(hit);

  const age = hit === undefined ? Infinity : ageOf(hit, edge.now());

  if (hit !== undefined && age < KEEP_MS) {
    if (age >= FRESH_MS) edge.waitUntil(refresh(edge, key, answer));

    return served(hit);
  }

  const { response, cacheable } = await answer();

  if (cacheable) edge.waitUntil(store(edge, key, response));

  return response;
};
