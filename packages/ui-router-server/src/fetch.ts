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
 * mapping, {@link mergeSearch} on redirect Locations, validator stripping and
 * status relabeling on status'd shells, the canonical Link header), the HOST
 * supplies asset IO through {@link FetchAdapterOptions.serveShell | serveShell}. Because a fetch Request is
 * immutable and served from a DIFFERENT url than the route path, the adapter
 * hands {@link FetchAdapterOptions.serveShell | serveShell} a fully-prepared shell Request — url rewritten to the
 * mount's {@link FetchAdapterOptions.shellPath | shellPath}, conditional validators already stripped on a status'd
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

// No shim here is pulled in with a `/// <reference>`: this one rides tsconfig
// `include`, the wintercg subset rides tsconfig `types`. A source-level
// reference would re-declare Request / Response / Headers in every CONSUMER's
// program — the shim's non-generic Request clashes with workerd's
// `Request<Cf, Props>` and breaks `ExportedHandler<Env>` typings (surfaced
// dogfooding the docs worker) — and it would survive the drift guard's
// `exclude`, turning that guard green.

import type { RawParams } from '@uirouter/core';

import { registeredDelegates, sharedWeakMap } from './delegate-registry.ts';
import type { DelegateRegistration } from './delegate-registry.ts';
import { mergeSearch } from './index.ts';
import type {
  RouteDeclaration,
  ServerRouter,
  ServerRouterDeclarations,
  Verdict,
} from './index.ts';

/**
 * The WinterCG handler: a verdict answered, or `null` to pass to the host.
 * `args` (a Worker's `env` and `ctx`) are forwarded to a delegate untouched.
 */
export type FetchHandler<Args extends unknown[] = []> = (
  request: Request,
  ...args: Args
) => Promise<Response | null>;

/**
 * The typed-registry seam, empty here. A typed state registry (core, a family
 * package or the app) augments it with a name-indexed `params` member holding
 * the params a pathname alone resolves for each state, which
 * {@link DelegateParams} reads. Search params hold their declared defaults.
 *
 * @example
 * ```ts
 * declare module 'ui-router-server/fetch' {
 *   interface DelegateSeam {
 *     params: { claims: { id: string } };
 *   }
 * }
 * ```
 */
// oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- registries augment it
export interface DelegateSeam {}

/** The params of state `N`: `DelegateSeam['params'][N]` once a registry augments the seam, core's RawParams otherwise. */
export type DelegateParams<N extends string> = DelegateSeam extends {
  /** The seam's name-indexed params, when a registry declares them. */
  params: infer P;
}
  ? N extends keyof P
    ? P[N]
    : RawParams
  : RawParams;

/** The delegate keys a router's states name: `string` for an untyped router. */
export type DelegateKey<Decls extends RouteDeclaration = RouteDeclaration> =
  string extends Decls['name']
    ? string
    : Decls extends {
          /** A typed declaration's delegate key. */
          readonly delegate: infer K extends string;
        }
      ? K
      : never;

/** The states that name delegate key `K`: `string` for an untyped router. */
export type DelegateState<
  K extends string = string,
  Decls extends RouteDeclaration = RouteDeclaration,
> = string extends Decls['name']
  ? string
  : Extract<
      Decls,
      {
        /** The key a state names. */
        readonly delegate: K;
      }
    >['name'];

/**
 * The route a delegated request matched, read with {@link delegateContext}.
 * A union over the states that name `K`, so checking `state` narrows `params`
 * for a typed router; untyped it is one object type.
 */
export type DelegateContext<
  K extends string = string,
  Decls extends RouteDeclaration = RouteDeclaration,
> = {
  [N in DelegateState<K, Decls>]: {
    /** Base of the mount that owned the pathname. */
    mount: string;
    /** The pathname within the mount, its base removed (`''` at the bare base); route on it, not on the request's url. */
    subpath: string;
    /** The key the matched state names. */
    delegate: K;
    /** Name of the matched, delegating state. */
    state: N;
    /** The params the pathname alone resolves; search params hold their declared defaults. */
    params: Readonly<DelegateParams<N>>;
  };
}[DelegateState<K, Decls>];

/**
 * Answers a request whose pathname matched a delegating state: fetch-shaped,
 * so a Hono app's `fetch` or a Worker's handler fits bare. It receives the
 * original request, body unread, plus the arguments the adapter was called
 * with; its Response goes out untouched. Read the matched route with
 * {@link delegateContext}.
 */
export type DelegateHandler<Args extends unknown[] = []> = (
  request: Request,
  ...args: Args
) => Response | Promise<Response>;

/**
 * The `delegates` option: a handler for every key a router's states name,
 * extra keys allowed. Every handler shares the adapter's one `Args`.
 */
export type DelegateHandlers<
  Args extends unknown[] = [],
  Decls extends RouteDeclaration = RouteDeclaration,
> = { readonly [K in DelegateKey<Decls>]: DelegateHandler<Args> } & {
  readonly [key: string]: DelegateHandler<Args>;
};

/** Makes `delegates` required when a typed router names delegate keys. */
export type RequiredDelegates<
  Args extends unknown[] = [],
  Decls extends RouteDeclaration = RouteDeclaration,
> =
  string extends DelegateKey<Decls>
    ? unknown
    : [DelegateKey<Decls>] extends [never]
      ? unknown
      : {
          /** Handlers for every key the router names. */
          delegates: DelegateHandlers<Args, Decls>;
        };

/** Host hooks for {@link createFetchHandler}: asset IO, which requests get verdicts, and delegate handlers. */
export interface FetchAdapterOptions<
  Args extends unknown[] = [],
  Decls extends RouteDeclaration = RouteDeclaration,
> {
  /**
   * Maps a shell verdict's mount to the pathname the shell Request is built
   * at (default: the mount base itself). The hook for aliased mounts whose
   * shell asset lives under another prefix (e.g. a 404 exhibit that borrows
   * the vanilla app's shell).
   */
  shellPath?: (mount: string) => string;
  /**
   * Serve the mount's shell asset. The adapter hands over a shell Request
   * already rewritten to {@link FetchAdapterOptions.shellPath | shellPath} and, for a status'd shell, already
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
   * static layer and should judge everything. Delegating states ignore it:
   * they answer every request that matches them.
   */
  shouldHandle?: (request: Request) => boolean;
  /**
   * Handlers for the keys states name in {@link index!RouteDeclaration.delegate | `delegate`}.
   * A request of any method or Accept that matches a delegating state goes
   * to its handler, called with the original request and the arguments the
   * adapter got (`delegates: { ledger: app.fetch }`), so every handler shares
   * one `Args` signature. A typed router requires every key it names at
   * compile time; construction throws when a router from `createServerRouter`
   * names a key missing here. A structural router is checked per request
   * instead, so its delegate verdict throws.
   *
   * Requests outside {@link FetchAdapterOptions.shouldHandle | shouldHandle} only match urls, never
   * a transition, and pass as `null` without matching when the router names
   * no keys (or, for a structural router, when this option is absent).
   */
  delegates?: DelegateHandlers<Args, Decls>;
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

type DelegateVerdict = Extract<Verdict, { kind: 'delegate' }>;

interface DelegatedRequest {
  context: DelegateContext;
  router: ServerRouter;
}

// Keyed by the Request object itself: a clone or a rebuilt Request carries no context.
const delegatedRequests = sharedWeakMap<Request, DelegatedRequest>(
  'ui-router-server/delegate',
);

const missingDelegate = (key: string): Error =>
  new Error(`No handler in delegates for delegate key '${key}'`);

// Fail fast: a key the tree names but the host never mapped is a deploy bug.
const checkDelegates = <Args extends unknown[]>(
  registration: DelegateRegistration | undefined,
  delegates: Readonly<Record<string, DelegateHandler<Args>>>,
): void => {
  for (const key of registration?.keys ?? []) {
    if (!Object.hasOwn(delegates, key)) throw missingDelegate(key);
  }
};

// Non-navigations only ever reach a delegate, so a registered router matches urls and never replays a transition.
const delegateMatcher = (
  router: ServerRouter,
  registration: DelegateRegistration | undefined,
): ((url: string) => Promise<DelegateVerdict | null>) => {
  if (registration !== undefined) return (url) => registration.delegateFor(url);

  return async (url) => {
    const verdict = await router.resolve(url);

    return verdict.kind === 'delegate' ? verdict : null;
  };
};

const isDelegatedTo = <K extends string>(
  context: DelegateContext,
  key: K,
): context is DelegateContext<K> => context.delegate === key;

/**
 * The route a request matched when the fetch adapter delegated it to `key`'s
 * handler: `{ mount, subpath, delegate, state, params }`. Call it with the
 * very Request the handler received (`c.req.raw` in a Hono route): the
 * context is keyed by that object, so `request.clone()` or
 * `new Request(request)` has none. Pass the router to type `state` and
 * `params` from its `as const` routes and to check the request came through it.
 *
 * @param request - the request a delegate handler received
 * @param key - the delegate key the handler is mapped to
 * @param router - the router the adapter was built with
 * @throws when the request was not delegated, was delegated to another key,
 * or came through another router
 */
export function delegateContext<
  K extends DelegateKey<Decls>,
  Decls extends RouteDeclaration = RouteDeclaration,
>(
  request: Request,
  key: K,
  router?: ServerRouter<Decls>,
): DelegateContext<K, Decls> {
  const delegated = delegatedRequests.get(request);

  if (delegated === undefined)
    throw new Error(
      `delegateContext: this request was not delegated (expected '${key}'); pass the Request the handler received, not a clone`,
    );

  const { context } = delegated;

  if (!isDelegatedTo(context, key))
    throw new Error(
      `delegateContext: this request was delegated to '${context.delegate}', not '${key}'`,
    );

  if (router !== undefined && router !== delegated.router)
    throw new Error(
      `delegateContext: this request was delegated by a handler built from another router`,
    );

  return context;
}

/**
 * Wraps a {@link ServerRouter} as a WinterCG fetch handler. `resolve()` is always
 * async (the simulate tier's lazy boundary), which fetch absorbs naturally —
 * with matcher-tier mounts nothing async ever actually runs.
 *
 * - `redirect` -> `Response(null, { status, Location })`, the request's search
 *   MERGED into the location via {@link mergeSearch} (targets that declare their
 *   own query keep it — never `?a=1?b=2`).
 * - `shell` -> {@link FetchAdapterOptions.serveShell | serveShell} on a Request rewritten to {@link FetchAdapterOptions.shellPath | shellPath}, the raw
 *   asset Response wrapped with a `Link: <mount>; rel="canonical"` header (the
 *   shell is the same representation at every route path).
 * - `shell` with status (the otherwise projection) -> validators stripped, the
 *   asset Response's status relabeled to the verdict's, no canonical Link (a
 *   404 is not an alternate representation of the mount root).
 * - `notFound` with a mount -> {@link FetchAdapterOptions.serveNotFound | serveNotFound} (honest 404).
 * - `delegate`, for any request -> the handler {@link FetchAdapterOptions.delegates | delegates} maps its key to,
 *   called with the original request and the handler's own extra arguments
 *   (`handler(request, env, ctx)` reaches `delegate(request, env, ctx)`); its
 *   Response goes out untouched and its throw propagates to the host.
 * - `notFound` without a mount, or a non-navigation request that matches no
 *   delegating state -> `null` (the host serves it however it would have).
 *   Non-navigations only match urls, never a transition, and skip matching
 *   when the router names no delegate keys.
 *
 * `R` is the router's type and `Args` the host's extra handler arguments;
 * write both (`createFetchHandler<typeof router, [Env]>`) or annotate the
 * result (`const handle: FetchHandler<[Env]> = …`), so the router's delegate
 * keys stay checked.
 *
 * @throws at construction when the router names a delegate key
 * {@link FetchAdapterOptions.delegates | delegates} lacks
 */
export function createFetchHandler<
  R extends ServerRouter,
  Args extends unknown[] = [],
>(
  router: R,
  options: FetchAdapterOptions<Args, ServerRouterDeclarations<R>> &
    RequiredDelegates<Args, ServerRouterDeclarations<R>>,
): FetchHandler<Args> {
  const {
    serveShell,
    serveNotFound = defaultServeNotFound,
    shellPath = (mount) => mount,
    shouldHandle = isNavigation,
  } = options;

  // SAFETY: a DelegateHandlers record keyed by string; the key check below covers the typed keys at runtime.
  const delegates = (options.delegates ?? {}) as Readonly<
    Record<string, DelegateHandler<Args>>
  >;

  const registration = registeredDelegates(router);
  checkDelegates(registration, delegates);

  const delegating =
    registration === undefined
      ? options.delegates !== undefined
      : registration.keys.size > 0;

  const delegateFor = delegateMatcher(router, registration);

  const delegateTo = (
    verdict: DelegateVerdict,
    request: Request,
    args: Args,
  ): Response | Promise<Response> => {
    const { delegate, mount, subpath, state, params } = verdict;

    if (!Object.hasOwn(delegates, delegate)) throw missingDelegate(delegate);
    delegatedRequests.set(request, {
      context: { mount, subpath, delegate, state, params },
      router,
    });

    return delegates[delegate](request, ...args);
  };

  const answer = async (
    verdict: Exclude<Verdict, DelegateVerdict>,
    request: Request,
  ): Promise<Response | null> => {
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

  return async (request, ...args) => {
    if (!shouldHandle(request)) {
      if (!delegating) return null;
      const verdict = await delegateFor(request.url);

      return verdict === null ? null : delegateTo(verdict, request, args);
    }

    const verdict = await router.resolve(request.url);

    if (verdict.kind === 'delegate') return delegateTo(verdict, request, args);

    return answer(verdict, request);
  };
}
