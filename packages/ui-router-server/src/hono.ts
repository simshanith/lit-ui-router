/**
 * The Hono adapter: the fetch handler (see `./fetch`) wrapped as Hono
 * middleware. Hono's request/response IS the WinterCG `Request`/`Response`,
 * so this is a thin bridge — `c.req.raw` in, a verdict `Response` out, or
 * `next()` to pass — and it inherits the fetch adapter's honest-status
 * mechanics wholesale: redirects answer 302, mount-owned misses answer 404,
 * and only real routes reach the shell.
 *
 * `hono` is a TYPE-ONLY peer: imported with `import type` (erased at build, so
 * the bundle never requires hono) and declared an optional peer dependency —
 * a consumer reaching for `./hono` already has hono as their framework, and no
 * other consumer pays for it. This mirrors `./vite`'s dependency-free framing,
 * with hono's real `MiddlewareHandler` type in place of a structural shim.
 *
 * Mount it BEFORE the static/serveStatic layer, the position the fetch
 * adapter's `null` pass-through assumes: a redirect or mount-owned 404 is
 * answered here, and everything else (`null`) falls through to `next()` and
 * Hono's own asset serving. The host still supplies asset IO through
 * [[FetchAdapterOptions.serveShell]] — `(mount, request) => c.env.ASSETS.fetch(request)`
 * on Cloudflare, a `serveStatic` fetch elsewhere.
 */

import { createFetchHandler } from './fetch.ts';
import type { FetchAdapterOptions } from './fetch.ts';
import type { ServerRouter } from './index.ts';

import type { MiddlewareHandler } from 'hono';

/**
 * Wraps a [[ServerRouter]] as Hono middleware. The returned handler resolves
 * the request to a verdict and either answers it (`return`ing the verdict
 * Response) or passes it on (`await next()`), exactly the fetch adapter's
 * `Response | null` contract expressed in Hono's continuation.
 */
export function serverRouterHono(
  router: ServerRouter,
  options: FetchAdapterOptions,
): MiddlewareHandler {
  const handler = createFetchHandler(router, options);
  return async (c, next) => {
    const response = await handler(c.req.raw);
    if (response) return response;
    return next();
  };
}
