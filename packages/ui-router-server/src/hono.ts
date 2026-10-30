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
 * {@link FetchAdapterOptions.serveShell} — `(mount, request) => c.env.ASSETS.fetch(request)`
 * on Cloudflare, a `serveStatic` fetch elsewhere.
 *
 * {@link FetchAdapterOptions.delegates} puts the router in front of a Hono app:
 * a request matching a delegating state goes to that app, any method, and its
 * Response is returned. The middleware forwards `c.env` and `c.executionCtx`
 * after the original request, its url unchanged, so `delegates: { ledger: ledger.fetch }`
 * fits bare and a route reads the match with `delegateContext(c.req.raw, 'ledger')`.
 */

import { createFetchHandler } from './fetch.ts';
import type { FetchAdapterOptions, RequiredDelegates } from './fetch.ts';
import type { ServerRouter, ServerRouterDeclarations } from './index.ts';

import type { Context, Env, ExecutionContext, MiddlewareHandler } from 'hono';

export { delegateContext } from './fetch.ts';

/** What `serverRouterHono` forwards to a delegate after the request: Hono's `env` and execution context. */
export type HonoDelegateArgs<E extends Env = Env> = [
  env: E['Bindings'],
  executionCtx: ExecutionContext | undefined,
];

// Hono's getter throws outside a runtime with an execution context (node, tests).
const executionCtxOf = (c: Context): ExecutionContext | undefined => {
  try {
    return c.executionCtx;
  } catch {
    return undefined;
  }
};

/**
 * Wraps a {@link ServerRouter} as Hono middleware. The returned handler resolves
 * the request to a verdict and either answers it (`return`ing the verdict
 * Response) or passes it on (`await next()`), exactly the fetch adapter's
 * `Response | null` contract expressed in Hono's continuation. Write the
 * router's type before the app's env (`serverRouterHono<typeof router, AppEnv>`)
 * so its delegate keys stay checked.
 */
export function serverRouterHono<R extends ServerRouter, E extends Env = Env>(
  router: R,
  options: FetchAdapterOptions<
    HonoDelegateArgs<E>,
    ServerRouterDeclarations<R>
  > &
    RequiredDelegates<HonoDelegateArgs<E>, ServerRouterDeclarations<R>>,
): MiddlewareHandler<E> {
  const handler = createFetchHandler<R, HonoDelegateArgs<E>>(router, options);

  return async (c, next) => {
    const response = await handler(c.req.raw, c.env, executionCtxOf(c));

    if (response) return response;

    return next();
  };
}
