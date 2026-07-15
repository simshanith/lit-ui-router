/**
 * The fetch adapter: verdicts as a WinterCG `Request -> Response | null`
 * handler — the runtime-neutral sibling of the Connect adapter (see
 * `./connect`), for every fetch-shaped host (Cloudflare Workers, Deno, Bun,
 * Hono via `./hono`, node's `Request`/`Response`). It is the honest-status
 * upgrade of the always-200 SPA fallback the same way Connect is: redirect
 * verdicts answer 302, mount-owned misses answer 404, and only real routes
 * reach the shell.
 *
 * The division of labor is the Connect adapter's, adapted to fetch's
 * immutable objects: the adapter owns verdict -> response mechanics (status
 * mapping, [[mergeSearch]] on redirect Locations, validator stripping and
 * status relabeling on status'd shells, the canonical Link header), the HOST
 * supplies asset IO through [[serveShell]]. Because a fetch Request is
 * immutable and served from a DIFFERENT url than the route path, the adapter
 * hands [[serveShell]] a fully-prepared shell Request — url rewritten to the
 * mount's [[shellPath]], conditional validators already stripped on a status'd
 * shell — so the host's job is the pure one-liner `(_m, req) => ASSETS.fetch(req)`.
 * The adapter then wraps the raw asset Response with the verdict's status and
 * headers. `null` is the pass-through: a mountless miss or a non-navigation
 * request the host serves however it would have.
 *
 * Dependency-free like the tiers it fronts: the WinterCG surface it touches is
 * declared structurally in `fetch.globals.d.ts` (compiled into the package via
 * tsconfig `include`, not referenced from source — see below), so the DOM-free,
 * runtime-neutral compile holds — no fetch, workers, or node types.
 */

// fetch.globals.d.ts is deliberately NOT pulled in with a `/// <reference>`:
// the package's own tsconfig `include` (src/**/*) already compiles it, and a
// source-level reference would travel through the import graph and re-declare
// Request / Response / Headers in every CONSUMER's program, shadowing the
// runtime's own globals. For Headers/Response that is benign, but the shim's
// Request is non-generic, so it clashes with a real runtime's generic Request
// (workerd's `Request<Cf, Props>`) and breaks `ExportedHandler<Env>`-shaped
// typings — surfaced dogfooding the docs worker. Every fetch host already
// supplies these globals; none needs the shim leaked in.

import { mergeSearch } from './index.ts';
import type { ServerRouter } from './index.ts';

/** The WinterCG handler: a verdict answered, or `null` to pass to the host. */
export type FetchHandler = (request: Request) => Promise<Response | null>;

export interface FetchAdapterOptions {
  /**
   * Maps a shell verdict's mount to the pathname the shell Request is built
   * at (default: the mount base itself). The hook for aliased mounts whose
   * shell asset lives under another prefix (e.g. a 404 exhibit that borrows
   * the vanilla app's shell).
   */
  shellPath?: (mount: string) => string;
  /**
   * Serve the mount's shell asset. The adapter hands over a shell Request
   * already rewritten to [[shellPath]] and, for a status'd shell, already
   * stripped of conditional validators — so the host returns the RAW asset
   * Response (`(mount, request) => env.ASSETS.fetch(request)`) and the adapter
   * owns the status relabel and Link header on the way out. REQUIRED: asset IO
   * is the one thing a runtime-neutral adapter cannot default.
   */
  serveShell: (mount: string, request: Request) => Response | Promise<Response>;
  /**
   * Serve a mount-owned miss (`notFound` with a mount: the mount owned the
   * pathname but no route matched). The default answers a minimal `text/plain`
   * 404 — override to serve a real 404 page. A `notFound` without a mount is
   * never routed here: the pathname isn't this router's, so the handler returns
   * `null` and the host serves it.
   */
  serveNotFound?: (
    mount: string,
    request: Request,
  ) => Response | Promise<Response>;
  /**
   * Which requests get verdicts. The default is the navigation heuristic the
   * Connect adapter uses (and Vite's HTML fallback mirrors): GET/HEAD requests
   * whose Accept includes `text/html`. Module and asset fetches (`Accept: *​/*`)
   * pass as `null`. Override with `() => true` when the handler runs behind the
   * static layer and should judge everything.
   */
  shouldHandle?: (request: Request) => boolean;
}

const acceptsHtml = (request: Request): boolean => {
  const accept = request.headers.get('accept');
  return accept?.includes('text/html') ?? false;
};

const isNavigation = (request: Request): boolean =>
  (request.method === 'GET' || request.method === 'HEAD') &&
  acceptsHtml(request);

// The request's search, fragment excluded — mergeSearch operates on
// `pathname?search` and feeds the raw query to URLSearchParams, which would
// fold a trailing `#hash` into the last value. String ops, no URL global.
const searchOf = (url: string): string => {
  const q = url.indexOf('?');
  if (q === -1) return '';
  const hash = url.indexOf('#', q);
  return hash === -1 ? url.substring(q) : url.substring(q, hash);
};

// The request's origin (`scheme://host`), the same runtime-neutral parse
// index.ts's pathnameOf uses to strip it. A WinterCG Request.url is always
// absolute, so this always matches; the shell Request is built at origin +
// shellPath so it points at the asset, not the route path.
const originOf = (url: string): string => {
  const match = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i.exec(url);
  return match ? match[0] : '';
};

// Status'd shells must suppress the conditional path (Verdict contract): the
// asset fetch has to answer 200 + full body so the relabel never manufactures
// a bodied 304 — or a body-less 404. The shell Request is freshly constructed,
// so its headers are mutable (unlike the immutable incoming request).
const stripValidators = (request: Request): void => {
  request.headers.delete('If-None-Match');
  request.headers.delete('If-Modified-Since');
};

const defaultServeNotFound = (mount: string, request: Request): Response =>
  new Response(
    request.method === 'HEAD' ? null : `404 Not Found — ${mount}\n`,
    {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    },
  );

/**
 * Wraps a [[ServerRouter]] as a WinterCG fetch handler. `resolve()` is always
 * async (the simulate tier's lazy boundary), which fetch absorbs naturally —
 * with matcher-tier mounts nothing async ever actually runs.
 *
 * - `redirect` -> `Response(null, { status, Location })`, the request's search
 *   MERGED into the location via [[mergeSearch]] (targets that declare their
 *   own query keep it — never `?a=1?b=2`).
 * - `shell` -> [[serveShell]] on a Request rewritten to [[shellPath]], the raw
 *   asset Response wrapped with a `Link: <mount>; rel="canonical"` header (the
 *   shell is the same representation at every route path).
 * - `shell` with status (the otherwise projection) -> validators stripped, the
 *   asset Response's status relabeled to the verdict's, no canonical Link (a
 *   404 is not an alternate representation of the mount root).
 * - `notFound` with a mount -> [[serveNotFound]] (honest 404).
 * - `notFound` without a mount, or a non-navigation request -> `null` (the
 *   host serves it however it would have).
 */
export function createFetchHandler(
  router: ServerRouter,
  options: FetchAdapterOptions,
): FetchHandler {
  const {
    serveShell,
    serveNotFound = defaultServeNotFound,
    shellPath = (mount) => mount,
    shouldHandle = isNavigation,
  } = options;

  return async (request) => {
    if (!shouldHandle(request)) return null;
    const verdict = await router.resolve(request.url);

    if (verdict.kind === 'redirect') {
      return new Response(null, {
        status: verdict.status,
        headers: {
          Location: mergeSearch(verdict.location, searchOf(request.url)),
        },
      });
    }

    if (verdict.kind === 'shell') {
      const shellRequest = new Request(
        originOf(request.url) + shellPath(verdict.mount),
        request,
      );
      if (verdict.status !== undefined) stripValidators(shellRequest);
      const asset = await serveShell(verdict.mount, shellRequest);
      const headers = new Headers(asset.headers);
      // No canonical Link on a status'd shell: a 404 is not an alternate
      // representation of the mount root.
      if (verdict.status === undefined)
        headers.set('Link', `<${verdict.mount}>; rel="canonical"`);
      return new Response(asset.body, {
        status: verdict.status ?? asset.status,
        headers,
      });
    }

    if (verdict.mount === undefined) return null;
    return serveNotFound(verdict.mount, request);
  };
}
