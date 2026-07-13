/**
 * The Connect adapter: verdicts as Node-style `(req, res, next)` middleware.
 * One artifact covers every Connect-shaped stack — Express 4/5, bare
 * Connect, Koa via `koa-connect`, Fastify via `@fastify/middie`, and Vite's
 * dev/preview servers (see `./vite`) — and it is the honest-status upgrade
 * of the classic always-200 SPA fallback: redirect verdicts answer 302,
 * mount-owned misses answer 404, and only real routes reach the shell.
 *
 * The adapter owns verdict → response mechanics (status mapping,
 * [[mergeSearch]] on redirect Locations, validator stripping and status
 * relabeling on status'd shells); the HOST supplies asset IO. The default
 * host is the downstream stack itself: shells rewrite `req.url` to the
 * mount's shell path and `next()` into `express.static`/`sirv`/Vite —
 * which is why this middleware mounts BEFORE the static layer, exactly
 * where `connect-history-api-fallback` sits. Override [[serveShell]] /
 * [[serveNotFound]] to take asset IO in hand.
 *
 * Self-contained, like the tiers it fronts: the request/response types
 * below declare the minimal structural surface the adapter touches — a
 * hand-written `node:http` subset — so Node, Express, Koa, Fastify and Vite
 * objects all fit and `./connect`'s exported types leak no upstream http
 * types onto consumers (the fetch/timer globals come from @types/node; these
 * host contracts stay structural on purpose — a self-contained public API).
 */

import { mergeSearch } from './index.ts';
import type { ServerRouter } from './index.ts';

/** The subset of `http.IncomingMessage` the middleware reads (and rewrites). */
export interface ConnectRequest {
  url?: string;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * The subset of `http.ServerResponse` the middleware writes. `writeHead` is
 * variadic to admit Node's `(status, statusMessage?, headers?)` overloads —
 * the relabeling patch must forward whichever shape the downstream used.
 */
export interface ConnectResponse {
  writeHead(statusCode: number, ...rest: unknown[]): unknown;
  setHeader(name: string, value: string): unknown;
  end(body?: string): unknown;
}

/** Connect's continuation: call with no argument to pass, with an error to fail. */
export type ConnectNext = (error?: unknown) => void;

export type ConnectMiddleware = (
  req: ConnectRequest,
  res: ConnectResponse,
  next: ConnectNext,
) => void;

export interface ConnectAdapterOptions {
  /**
   * Maps a shell verdict's mount to the path the default [[serveShell]]
   * rewrites `req.url` to (default: the mount base itself). The hook for
   * aliased mounts whose shell lives under another prefix.
   */
  shellPath?: (mount: string) => string;
  /**
   * Serve the mount's shell. The default rewrites `req.url` to
   * [[shellPath]] and `next()`s into the downstream static layer. By the
   * time this runs the adapter has already done the status'd-shell
   * mechanics: request validators stripped and the response relabeled to
   * the verdict's status — a host override only owns the asset IO.
   */
  serveShell?: (
    mount: string,
    req: ConnectRequest,
    res: ConnectResponse,
    next: ConnectNext,
  ) => void;
  /**
   * Serve a mount-owned miss (`notFound` with a mount: the mount owned the
   * pathname but no route matched). The default answers a minimal
   * `text/plain` 404 — override to serve a real 404 page. A `notFound`
   * without a mount is never routed here: the pathname isn't this router's,
   * so the middleware always passes it through untouched.
   */
  serveNotFound?: (
    mount: string,
    req: ConnectRequest,
    res: ConnectResponse,
    next: ConnectNext,
  ) => void;
  /**
   * Which requests get verdicts. The default is the navigation heuristic
   * `connect-history-api-fallback` established (and Vite's own HTML
   * fallback mirrors): GET/HEAD requests whose Accept includes
   * `text/html`. Module and asset fetches (`Accept: *​/*`) pass through
   * untouched — essential under Vite, where a mount's module URLs live on
   * the same paths as its routes. Override with `() => true` when the
   * middleware sits behind the static layer and should judge everything.
   */
  shouldHandle?: (req: ConnectRequest) => boolean;
}

const acceptsHtml = (req: ConnectRequest): boolean => {
  const accept = req.headers.accept;
  return typeof accept === 'string' && accept.includes('text/html');
};

const isNavigation = (req: ConnectRequest): boolean =>
  (req.method === 'GET' || req.method === 'HEAD') && acceptsHtml(req);

// Status'd shells must suppress the conditional path (Verdict contract):
// the downstream serve has to answer 200 + full body so the relabel never
// manufactures a bodied 304 — or a body-less 404.
const stripValidators = (req: ConnectRequest): void => {
  delete req.headers['if-none-match'];
  delete req.headers['if-modified-since'];
};

// The verdict's status wins outright over whatever the downstream layer
// writes — express.static and sirv both decide their own status, so the
// override has to happen at writeHead (Node's implicit header flush funnels
// through it too). A 304 passes unrelabeled per the Verdict contract: it
// has no body, and the stripped validators make one unreachable anyway.
const relabel = (res: ConnectResponse, status: number): void => {
  const writeHead = res.writeHead.bind(res);
  res.writeHead = (downstream: number, ...rest: unknown[]) =>
    writeHead(downstream === 304 ? downstream : status, ...rest);
};

const defaultServeNotFound = (
  mount: string,
  req: ConnectRequest,
  res: ConnectResponse,
): void => {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(req.method === 'HEAD' ? undefined : `404 Not Found — ${mount}\n`);
};

/**
 * Wraps a [[ServerRouter]] as Connect middleware. Mount it BEFORE the
 * static layer; the default host serves shells by rewriting `req.url` and
 * `next()`ing into it. `resolve()` is always async (the simulate tier's
 * lazy boundary), which Connect absorbs naturally — with matcher-tier
 * mounts nothing async ever actually runs.
 *
 * - `redirect` → `writeHead(302, { Location })`, the request's search
 *   MERGED into the verdict's location via [[mergeSearch]] (targets that
 *   declare their own query keep it — never `?a=1?b=2`).
 * - `shell` → `Link: <mount>; rel="canonical"` (the shell is the same
 *   representation at every route path), then [[serveShell]].
 * - `shell` with status (the otherwise projection) → validators stripped,
 *   downstream status relabeled, no canonical Link (a 404 is not an
 *   alternate representation of the mount root), then [[serveShell]].
 * - `notFound` with a mount → [[serveNotFound]] (honest 404).
 * - `notFound` without a mount, or a non-navigation request → `next()`.
 */
export function createConnectMiddleware(
  router: ServerRouter,
  options: ConnectAdapterOptions = {},
): ConnectMiddleware {
  const {
    shellPath = (mount) => mount,
    serveShell = (mount, req, _res, next) => {
      req.url = shellPath(mount);
      next();
    },
    serveNotFound = defaultServeNotFound,
    shouldHandle = isNavigation,
  } = options;

  return (req, res, next) => {
    if (!shouldHandle(req)) {
      next();
      return;
    }
    const url = req.url ?? '/';
    const cut = url.indexOf('?');
    const search = cut === -1 ? '' : url.substring(cut);
    router.resolve(url).then((verdict) => {
      if (verdict.kind === 'redirect') {
        res.writeHead(verdict.status, {
          Location: mergeSearch(verdict.location, search),
        });
        res.end();
        return;
      }
      if (verdict.kind === 'shell') {
        if (verdict.status === undefined) {
          res.setHeader('Link', `<${verdict.mount}>; rel="canonical"`);
        } else {
          stripValidators(req);
          relabel(res, verdict.status);
        }
        serveShell(verdict.mount, req, res, next);
        return;
      }
      if (verdict.mount === undefined) {
        next();
        return;
      }
      serveNotFound(verdict.mount, req, res, next);
    }, next);
  };
}
