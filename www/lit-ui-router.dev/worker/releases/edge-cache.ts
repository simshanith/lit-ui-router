// The Workers Cache API in front of a response state's answer; it stores nothing on workers.dev or preview urls.

/** The cache an answer goes in, and the hook that lets the write outlive the response. */
export interface EdgeCache {
  cache: Pick<Cache, 'match' | 'put'>;
  waitUntil(promise: Promise<unknown>): void;
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

/** The answer cached at `key`, else the fresh one, written back in the background when it's cacheable. */
export const cached = async (
  edge: EdgeCache,
  key: Request,
  answer: () => Promise<Answer>,
): Promise<Response> => {
  const hit = await edge.cache.match(key);

  if (hit !== undefined) return hit;

  const { response, cacheable } = await answer();

  if (cacheable) edge.waitUntil(edge.cache.put(key, response.clone()));

  return response;
};
