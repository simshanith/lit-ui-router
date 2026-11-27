// The verdict core both router entries share; the simulate tier arrives as a parameter, so this module never reaches @uirouter/core at runtime.

import type { RawParams } from '@uirouter/core';

import { mountsUnder, normalizeBase as siteBase, pathOf } from './base-path.ts';
import { registerDelegates } from './delegate-registry.ts';
import { warnMountDiagnostics } from './dev-warn.ts';
import { compileResolver } from './redirects.ts';
import type {
  CompiledResolver,
  RedirectRule,
  RedirectStatusCode,
  RedirectTarget,
  RouteDeclaration,
  RouteIndex,
  RouteMatch,
  RouteTableConfig,
} from './redirects.ts';
import { onOrigin, registerMountPolicies, respell } from './trailing-slash.ts';

declare module '@uirouter/core' {
  interface StateDeclaration {
    /** The host handler key a server adapter answers this state's url with (see {@link RouteDeclaration.delegate}). */
    delegate?: string;
    /** Marks a response state, answered by the handler bound to its name (see {@link RouteDeclaration.response}). */
    response?: true;
    /** The status this state's `redirectTo` answers with, `302` by default (see {@link RouteDeclaration.redirectStatusCode}). */
    redirectStatusCode?: RedirectStatusCode;
  }
}

/**
 * One mount's routing configuration: its state tree, its redirects, and the
 * tier that resolves them. `R` is the type of `routes`; an `as const` array
 * types the router's delegate keys, response states and state names (see
 * {@link ServerRouter}).
 */
export interface MountConfig<
  R extends readonly RouteDeclaration[] = readonly RouteDeclaration[],
> {
  /** The mount's state tree; dotted names nest, urls append (see {@link RouteDeclaration}). */
  routes: R;
  /** when()-style pattern rules, evaluated before per-state redirectTo entries. */
  redirects?: RedirectRule[];
  /**
   * 'matcher' (default): dependency-free pattern matching plus data
   * redirects. 'simulate': replay through a headless @uirouter/core router —
   * the tier where routing that data cannot express (hooks, resolves,
   * redirectTo functions) will live. Those are NOT yet reachable through
   * MountConfig: both strategies consume the same {@link RouteDeclaration} data
   * subset today, deliberately, so strategy stays a pure cost knob; the
   * config widens later (e.g. an auth tier).
   */
  strategy?: 'matcher' | 'simulate';
  /**
   * Url options (defaults: strict, case-sensitive, no squash, slashes as
   * requested); 'simulate' mounts apply all but decodeParams. Hand the same
   * object to {@link url-config!applyUrlConfig | `applyUrlConfig`} on the
   * client router so both sides compile and format urls alike. Under a
   * `trailingSlash` policy, a url matching a state in the other spelling
   * verdicts as a `308` redirect to the canonical one.
   */
  config?: RouteTableConfig;
  /**
   * How a 'matcher' mount looks up the route a pathname matches. Default: a
   * linear scan that tries every route. {@link routeTrie} walks a segment
   * trie to the few routes whose spelling fits, with the same verdicts, and
   * throws at construction for a route it can't express. Only the index a
   * mount names is bundled. On a 'simulate' mount it throws at construction.
   *
   * @example
   * ```ts
   * import { routeTrie } from 'ui-router-server';
   * import type { MountConfig } from 'ui-router-server';
   *
   * const app: MountConfig = {
   *   routes: [{ name: 'home', url: '' }, { name: 'item', url: '/items/:id' }],
   *   routeIndex: routeTrie,
   * };
   * ```
   */
  routeIndex?: RouteIndex;
  /**
   * Projection of the client's otherwise() rule. `state` references a
   * declared, url-less state (url-less so the unmatched url stays in the
   * address bar, like a server 404 — mirroring the real rule's semantics).
   * When declared, unknown paths under this mount verdict as shell with
   * status 404: the resource genuinely doesn't exist and the shell IS the
   * error page (never 200) — the client boots at the retained path and its
   * own otherwise rule renders the rich notFound state. Redirect rules and
   * route matches take precedence; undeclared keeps the notFound verdict.
   */
  otherwise?: {
    /** Name of the declared, url-less state unknown paths verdict as. */
    state: string;
  };
  /**
   * Idle headless routers a 'simulate' mount builds once @uirouter/core
   * loads, so its first requests skip the cold build. Default 0: the pool
   * builds on demand. An integer from 0 to 16 (the pool's idle cap); any
   * other value, or a positive count on a 'matcher' mount, throws at
   * construction. A failed prewarm build is dropped silently and requests
   * build on demand.
   *
   * The builds chain onto the import that construction starts, ahead of
   * every request on the mount, so the first request never races them and
   * there is nothing extra to await. In a Cloudflare Worker that constructs
   * its router at module scope, the builds may run during startup: they do
   * no I/O, timers or randomness, so global scope permits them, but their
   * CPU counts toward the Worker's startup time limit.
   */
  prewarm?: number;
  /**
   * Diagnostic kinds this mount means to trip, turned off for it alone: the
   * construction warning skips them and {@link diagnoseMounts} omits them,
   * so development and CI agree. A kind outside {@link MountDiagnosticKind}
   * throws at construction.
   *
   * @example
   * ```ts
   * import type { MountConfig } from 'ui-router-server';
   *
   * // /api owns its bare base and answers it with a 404 on purpose.
   * const mounts = {
   *   '/api': {
   *     routes: [{ name: 'item', url: '/items/:id' }],
   *     ignoreDiagnostics: ['bareBaseNotFound'],
   *   },
   * } satisfies Record<string, MountConfig>;
   * ```
   */
  ignoreDiagnostics?: readonly MountDiagnosticKind[];
}

/**
 * What the caller should serve for a pathname — the one output of
 * {@link ServerRouter.resolve}. Discriminate on `kind`. (Consumer note: under
 * oxlint's switch-exhaustiveness-check + consistent-return combination, an
 * if-chain reads cleaner than a switch over this union.)
 */
export type Verdict =
  /**
   * Serve the app shell. Status precedence: when `status` is absent, serve
   * the shell however you normally would — including 304 conditional
   * responses. When it is set (404 via the otherwise projection today;
   * 401/403-with-shell for a future auth tier), the verdict's status wins
   * outright — and you must suppress the conditional path BY STRIPPING the
   * request's validators (If-None-Match, If-Modified-Since) before the
   * assets fetch, so it returns 200 + full body to relabel. Never relabel a
   * 304 itself: it has no body (a 404 with a null body is malformed) and
   * would let a probe read cache freshness for a path that doesn't exist.
   */
  | {
      /** Discriminates the shell verdict. */
      kind: 'shell';
      /** Base of the mount that owned the pathname. */
      mount: string;
      /** Status to serve the shell as; absent means serve it however you normally would. */
      status?: number;
    }
  /**
   * Redirect to `location`: the mount-joined target path, which MAY carry
   * its own query string when the target declares search params. Callers
   * preserving the request's search must MERGE query params into it —
   * string concatenation (`location + url.search`) produces `?a=1?b=2`.
   * The matcher tier resolves pathnames only: incoming search values never
   * flow into redirect params.
   */
  | {
      /** Discriminates the redirect verdict. */
      kind: 'redirect';
      /** Base of the mount that owned the pathname. */
      mount: string;
      /**
       * The mount-joined target path; merge the request's search with {@link mergeSearch}.
       * A route's `redirectTo` names a state, never a url, so a location `createServerRouter`
       * formats can only mean a path on this site: it starts with exactly one `/`, and a
       * leading `//` an empty param would format collapses to one. The adapters answer
       * `location` as written: a custom resolver that returns a `//host` or full-url location
       * redirects there.
       */
      location: string;
      /**
       * Redirect status to answer with: the matched state's {@link RouteDeclaration.redirectStatusCode},
       * else 302; 308 for a trailing-slash respelling.
       */
      status: number;
    }
  /**
   * Hand the request to the host's handler for `delegate`: the pathname
   * matched a state that declares {@link RouteDeclaration.delegate}. Answer
   * any method and any Accept with it, not only navigations.
   */
  | {
      /** Discriminates the delegate verdict. */
      kind: 'delegate';
      /** Base of the mount that owned the pathname. */
      mount: string;
      /** The pathname within the mount, its base removed (`''` at the bare base). */
      subpath: string;
      /** The key the matched state names; the host maps it to a handler. */
      delegate: string;
      /** Name of the matched state. */
      state: string;
      /** The params the pathname alone resolves; search params hold their declared defaults. */
      params: RawParams;
    }
  /**
   * Answer with the `Response` the handler bound to `state` builds from its
   * resolves: the pathname matched a state that declares
   * {@link RouteDeclaration.response}, decided by url matching alone, with
   * no transition. Never serve the shell for it.
   */
  | {
      /** Discriminates the response verdict. */
      kind: 'response';
      /** Base of the mount that owned the pathname. */
      mount: string;
      /** The pathname within the mount, its base removed (`''` at the bare base). */
      subpath: string;
      /** Name of the matched response state; the host maps it to a handler. */
      state: string;
      /** The params the pathname alone resolves; search params hold their declared defaults. */
      params: RawParams;
    }
  /** `mount` is set when a mount owned the pathname but nothing matched (per-mount 404s); absent when no mount matched at all. */
  | {
      /** Discriminates the no-route verdict. */
      kind: 'notFound';
      /** Base of the mount that owned the pathname, when one did. */
      mount?: string;
    };

/** What a {@link MountDiagnostic} reports; new kinds may join the union in a minor release. */
export type MountDiagnosticKind = 'bareBaseNotFound';

/** One {@link diagnoseMounts} finding. Discriminate on `kind`. */
export interface MountDiagnostic {
  /** What the finding reports. */
  kind: MountDiagnosticKind;
  /** Base of the mount the finding is about, normalized as in a {@link Verdict}. */
  mount: string;
  /** What to fix, in a sentence; the development build's construction warning prints it. */
  message: string;
}

declare const routeDeclarations: unique symbol;

/**
 * The compiled resolver {@link createServerRouter} returns: a pathname in, a
 * {@link Verdict} out. `Decls` is the union of the route declarations it was
 * built from, inferred from `as const` routes; the fetch adapter reads its
 * delegate keys and state names. Untyped routes keep the default,
 * {@link RouteDeclaration}, under which keys and names are `string`.
 */
export interface ServerRouter<
  Decls extends RouteDeclaration = RouteDeclaration,
> {
  /**
   * Accepts a pathname, an absolute url string, or anything with a `pathname`
   * (URL, Location). Under a {@link ServerRouter.base | base}, the pathname
   * lies under it, with the base taken off, as the adapters hand it over;
   * verdict mounts and redirect locations come back the same way.
   *
   * A path that begins with `//` below its mount is answered from its
   * collapsed spelling, so no state matches it with an empty leading param:
   * a `302` to that spelling, the redirect that spelling itself answers, or
   * `notFound` when it matches no route.
   */
  resolve(pathnameOrUrl: string | { pathname: string }): Promise<Verdict>;
  /**
   * The url path the site is served at, from `createServerRouter({ base })`,
   * with one trailing slash. The adapters, `serverRouterPlugin` and
   * `prerender` default their own `base` to it.
   */
  readonly base?: string;
  /** Type-only: carries `Decls`; never set at runtime. */
  readonly [routeDeclarations]?: Decls;
}

/** The route declarations a {@link ServerRouter} type was built from. */
export type ServerRouterDeclarations<R extends ServerRouter> =
  R extends ServerRouter<infer Decls> ? Decls : never;

/** The names of a router's response states: `string` for an untyped router. */
export type ResponseState<Decls extends RouteDeclaration = RouteDeclaration> =
  string extends Decls['name']
    ? string
    : Extract<
        Decls,
        {
          /** A typed declaration's response marker. */
          readonly response: true;
        }
      >['name'];

/**
 * Rejects, at compile time, an `as const` row that is both a response state
 * and a delegate: it requires a property naming the offending states.
 */
export type ExclusiveMarkers<
  Decls extends RouteDeclaration = RouteDeclaration,
> = [
  Extract<
    Decls,
    {
      /** A typed declaration's response marker. */
      readonly response: true;
      /** A typed declaration's delegate key. */
      readonly delegate: string;
    }
  >,
] extends [never]
  ? unknown
  : {
      /** The states marked both `response` and `delegate`; a state is a page, a response state or a delegate. */
      responseAndDelegate: Extract<
        Decls,
        {
          /** A typed declaration's response marker. */
          readonly response: true;
          /** A typed declaration's delegate key. */
          readonly delegate: string;
        }
      >['name'];
    };

/** The delegate member of {@link Verdict}. */
export type DelegateVerdict = Extract<Verdict, { kind: 'delegate' }>;

/** The response member of {@link Verdict}. */
export type ResponseVerdict = Extract<Verdict, { kind: 'response' }>;

/**
 * Idle routers kept per simulate mount; a burst past it builds extras and drops them.
 *
 * @internal
 */
export const POOL_MAX_IDLE = 16;

/** One compiled mount. */
export interface Mount {
  base: string;
  config: MountConfig;
  strategy: 'matcher' | 'simulate';
  compiled: CompiledResolver;
  delegates: Map<string, string>;
  responses: Set<string>;
  prewarm: number;
}

const isUrlText = (input: string | { pathname: string }): input is string =>
  typeof input === 'string';

const pathnameOf = (input: string | { pathname: string }): string =>
  isUrlText(input) ? pathOf(input) : input.pathname;

// The pathname within the mount, or null when the mount doesn't own it.
const subpathIn = (base: string, pathname: string): string | null => {
  if (base === '/') return pathname;

  if (pathname === base) return '';

  if (pathname.startsWith(`${base}/`)) return pathname.substring(base.length);

  return null;
};

const join = (base: string, path: string): string =>
  base === '/' ? path || '/' : base + path;

const isStateName = (to: string | RedirectTarget): to is string =>
  typeof to === 'string';

export const toTarget = (to: string | RedirectTarget): RedirectTarget =>
  isStateName(to) ? { state: to } : to;

/**
 * Merges a request's search into a redirect `location` — the correct-by-
 * default replacement for `location + url.search`, which yields `?a=1?b=2`.
 * Params the redirect target declared win; remaining request params are
 * appended (all values of multi-value keys). Accepts the incoming search
 * with or without the leading '?'. Operates on `pathname?search#fragment`
 * strings as produced in redirect verdicts: a fragment (which
 * {@link matcher!format | format} emits for a `'#'` param value) is detached
 * before the merge and re-appended after it, so the query keeps its place
 * ahead of the fragment.
 */
export function mergeSearch(location: string, incoming: string): string {
  const query = incoming.startsWith('?') ? incoming.substring(1) : incoming;

  if (!query) return location;
  // Split the fragment off FIRST. It terminates the url, so a '?' after it is
  // fragment text rather than a query — and merging into `pathname#frag` would
  // otherwise append `?a=1` past the '#', where no agent will ever read it.
  const hash = location.indexOf('#');
  const fragment = hash === -1 ? '' : location.substring(hash);
  const base = hash === -1 ? location : location.substring(0, hash);
  const cut = base.indexOf('?');
  const pathname = cut === -1 ? base : base.substring(0, cut);
  const target = new URLSearchParams(cut === -1 ? '' : base.substring(cut + 1));
  const request = new URLSearchParams(query);
  const keys = new Set<string>();
  request.forEach((_value, key) => keys.add(key));

  for (const key of keys) {
    if (target.has(key)) continue;

    for (const value of request.getAll(key)) target.append(key, value);
  }

  const merged = target.toString();

  return merged ? `${pathname}?${merged}${fragment}` : `${pathname}${fragment}`;
}

// --- Mount compilation (construction-time, strategy-independent) ---------

const normalizeBase = (base: string): string => {
  if (!base.startsWith('/'))
    throw new Error(`Mount '${base}' must start with '/'`);

  return base !== '/' && base.endsWith('/') ? base.slice(0, -1) : base;
};

// The otherwise target must be a declared, URL-LESS state: a url-full
// target would move the client's address bar, and the honest projection of
// that is a redirect, not a shell-404 at the retained path.
const validateOtherwise = (base: string, config: MountConfig): void => {
  if (!config.otherwise) return;

  const state = config.routes.find(
    (route) => route.name === config.otherwise?.state,
  );

  if (!state)
    throw new Error(
      `Mount '${base}': otherwise state '${config.otherwise.state}' is not declared`,
    );

  if (state.url !== undefined)
    throw new Error(
      `Mount '${base}': otherwise state '${config.otherwise.state}' must be url-less (the unmatched url stays in the address bar)`,
    );
};

// The index's own message names the route and reason; the mount is added here.
const mountIndex = (
  base: string,
  config: MountConfig,
): RouteIndex | undefined => {
  const index = config.routeIndex;

  if (index === undefined) return undefined;

  if (config.strategy === 'simulate')
    throw new Error(`Mount '${base}': routeIndex needs the 'matcher' strategy`);

  return (routes) => {
    try {
      return index(routes);
    } catch (error) {
      throw new Error(
        `Mount '${base}': ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  };
};

const validatePrewarm = (base: string, config: MountConfig): number => {
  const prewarm = config.prewarm ?? 0;

  if (!Number.isInteger(prewarm) || prewarm < 0 || prewarm > POOL_MAX_IDLE)
    throw new Error(
      `Mount '${base}': prewarm must be an integer from 0 to ${POOL_MAX_IDLE}`,
    );

  if (prewarm > 0 && config.strategy !== 'simulate')
    throw new Error(`Mount '${base}': prewarm needs the 'simulate' strategy`);

  return prewarm;
};

// A record, so adding a kind to the union fails to compile until it is listed here.
const DIAGNOSTIC_KINDS: Record<MountDiagnosticKind, true> = {
  bareBaseNotFound: true,
};

const validateIgnoreDiagnostics = (base: string, config: MountConfig): void => {
  for (const kind of config.ignoreDiagnostics ?? []) {
    if (!Object.hasOwn(DIAGNOSTIC_KINDS, kind))
      throw new Error(
        `Mount '${base}': ignoreDiagnostics names unknown kind '${kind}' (known: ${Object.keys(DIAGNOSTIC_KINDS).join(', ')})`,
      );
  }
};

// A redirect answers navigations only, so a POST redirected onto a delegating state would never reach its handler.
const rejectRedirectsToDelegates = (
  base: string,
  config: MountConfig,
  delegates: Map<string, string>,
): void => {
  const sources = [
    ...config.routes.map((route) => ({
      to: route.redirectTo,
      from: `state '${route.name}'`,
    })),
    ...(config.redirects ?? []).map((rule) => ({
      to: rule.to,
      from: `rule '${String(rule.pattern)}'`,
    })),
  ];

  for (const { to, from } of sources) {
    if (to === undefined) continue;
    const { state } = toTarget(to);

    if (delegates.has(state))
      throw new Error(
        `Mount '${base}': ${from} redirects to delegating state '${state}'`,
      );
  }
};

// State name -> delegate key. A delegating state is answered by its handler,
// so it must be url-addressable and must not also redirect.
const compileDelegates = (
  base: string,
  config: MountConfig,
): Map<string, string> => {
  const delegates = new Map<string, string>();

  for (const route of config.routes) {
    if (route.delegate === undefined) continue;

    if (route.delegate === '')
      throw new Error(
        `Mount '${base}': state '${route.name}' delegate must not be empty`,
      );

    if (route.url === undefined)
      throw new Error(
        `Mount '${base}': delegating state '${route.name}' must declare a url`,
      );

    if (route.redirectTo !== undefined)
      throw new Error(
        `Mount '${base}': delegating state '${route.name}' cannot also declare redirectTo`,
      );
    delegates.set(route.name, route.delegate);
  }

  rejectRedirectsToDelegates(base, config, delegates);

  return delegates;
};

// A response state is answered by its handler, so it must be url-addressable, must not also redirect, and is never a delegate.
const compileResponses = (base: string, config: MountConfig): Set<string> => {
  const responses = new Set<string>();

  for (const route of config.routes) {
    if (!route.response) continue;

    if (route.delegate !== undefined)
      throw new Error(
        `Mount '${base}': response state '${route.name}' cannot also delegate`,
      );

    if (route.url === undefined)
      throw new Error(
        `Mount '${base}': response state '${route.name}' must declare a url`,
      );

    if (route.redirectTo !== undefined)
      throw new Error(
        `Mount '${base}': response state '${route.name}' cannot also declare redirectTo`,
      );
    responses.add(route.name);
  }

  return responses;
};

const compileMount = ([base, config]: [string, MountConfig]): Mount => {
  validateOtherwise(base, config);
  validateIgnoreDiagnostics(base, config);
  const prewarm = validatePrewarm(base, config);
  const responses = compileResponses(base, config);
  const delegates = compileDelegates(base, config);
  const strategy = config.strategy ?? 'matcher';

  return {
    base: normalizeBase(base),
    config,
    strategy,
    prewarm,
    delegates,
    responses,
    // Simulate mounts accept the same declaration subset, so the
    // dependency-free compilation doubles as their construction-time
    // validation (their resolve path never consults it).
    compiled: compileResolver(
      {
        routes: config.routes,
        rules: config.redirects,
        // Core always decodes, so a simulate mount's projection does too.
        config:
          strategy === 'simulate'
            ? { ...config.config, decodeParams: true }
            : config.config,
      },
      mountIndex(base, config),
    ),
  };
};

// Declaration order, so diagnostics read in the order the table was written.
const compileMounts = (record: Record<string, MountConfig>): Mount[] => {
  const mounts = Object.entries(record).map(compileMount);

  if (new Set(mounts.map((mount) => mount.base)).size !== mounts.length)
    throw new Error('Mount bases must be unique');

  return mounts;
};

// The longest matching base owns a pathname outright.
const byLongestBase = (mounts: Mount[]): Mount[] =>
  [...mounts].sort((a, b) => b.base.length - a.base.length);

// --- The simulate tier, injected -------------------------------------------

/**
 * The simulate strategy, handed in by the entry that bundles it. Without one,
 * a 'simulate' mount throws at construction.
 */
export interface SimulateTier {
  /** Called once at construction when a simulate mount exists: starts loading core and prewarms. */
  start(mounts: Mount[]): void;
  /** The verdict for a navigation to `subpath` on a simulate mount. */
  verdict(mount: Mount, subpath: string): Promise<Verdict>;
  /** The delegate or response verdict url matching alone gives `subpath`, else null. */
  marked(
    mount: Mount,
    subpath: string,
  ): Promise<DelegateVerdict | ResponseVerdict | null>;
}

// --- Verdict construction --------------------------------------------------

export const shellVerdict = (mount: Mount): Verdict => ({
  kind: 'shell',
  mount: mount.base,
});

export const redirectVerdict = (
  mount: Mount,
  path: string,
  status: RedirectStatusCode = 302,
): Verdict => ({
  kind: 'redirect',
  mount: mount.base,
  location: onOrigin(join(mount.base, path)),
  status,
});

export const notFoundVerdict = (mount: Mount): Verdict => ({
  kind: 'notFound',
  mount: mount.base,
});

const delegateVerdict = (
  mount: Mount,
  subpath: string,
  delegate: string,
  match: RouteMatch,
): DelegateVerdict => ({
  kind: 'delegate',
  mount: mount.base,
  subpath,
  delegate,
  state: match.state,
  params: match.params,
});

const responseVerdict = (
  mount: Mount,
  subpath: string,
  match: RouteMatch,
): ResponseVerdict => ({
  kind: 'response',
  mount: mount.base,
  subpath,
  state: match.state,
  params: match.params,
});

// The verdict a marked state answers with by url matching alone, or null for a page.
export const markedVerdict = (
  mount: Mount,
  subpath: string,
  match: RouteMatch,
): DelegateVerdict | ResponseVerdict | null => {
  if (mount.responses.has(match.state))
    return responseVerdict(mount, subpath, match);
  const delegate = mount.delegates.get(match.state);

  return delegate === undefined
    ? null
    : delegateVerdict(mount, subpath, delegate, match);
};

// A matched route answers with the shell, its delegate's handler, or its response handler.
const routeVerdict = (
  mount: Mount,
  subpath: string,
  match: RouteMatch,
): Verdict => markedVerdict(mount, subpath, match) ?? shellVerdict(mount);

// The otherwise projection: the shell is the error page, at an honest 404 —
// never 200, the resource genuinely doesn't exist.
export const otherwiseVerdict = (mount: Mount): Verdict => ({
  kind: 'shell',
  mount: mount.base,
  status: 404,
});

// --- Per-strategy resolution -----------------------------------------------

// The 308 to the canonical spelling of the matched state's url, or null when the request already used it.
export const respelledVerdict = (
  mount: Mount,
  subpath: string,
  state: string,
): Verdict | null => {
  const canonical = respell(subpath, mount.compiled.slashOf(state));

  return join(mount.base, canonical) === join(mount.base, subpath)
    ? null
    : redirectVerdict(mount, canonical, 308);
};

// Navigations only are respelled; a marked state answers a non-navigation at either spelling.
const matchedRouteVerdict = (
  mount: Mount,
  subpath: string,
  respelled: boolean,
): Verdict => {
  const resolution = mount.compiled.resolve(subpath);

  if (resolution.redirect !== null)
    return redirectVerdict(mount, resolution.redirect, resolution.status);

  // A when()-rule that lands where it started never reached route matching.
  const match =
    resolution.match === undefined
      ? mount.compiled.match(subpath)
      : resolution.match;

  if (match !== null)
    return (
      (respelled ? respelledVerdict(mount, subpath, match.state) : null) ??
      routeVerdict(mount, subpath, match)
    );

  return mount.config.otherwise
    ? otherwiseVerdict(mount)
    : notFoundVerdict(mount);
};

// Any URIError degrades to the shell, a caller's own included, as a core throw does on a simulate mount.
const matcherVerdict = (
  mount: Mount,
  subpath: string,
  respelled = true,
): Verdict => {
  try {
    return matchedRouteVerdict(mount, subpath, respelled);
  } catch (error) {
    if (error instanceof URIError) return shellVerdict(mount);

    throw error;
  }
};

// The matcher projection stands in for both strategies: they consume the same declaration subset.
const bareBaseDiagnostic = (mount: Mount): MountDiagnostic | null => {
  if (mount.base === '/') return null;

  let verdict: Verdict;

  try {
    verdict = matcherVerdict(mount, '');
  } catch {
    // A user param callback threw: no finding, so diagnostics never break construction; requests surface any throw but a URIError.
    return null;
  }

  if (
    verdict.kind === 'redirect' ||
    verdict.kind === 'delegate' ||
    verdict.kind === 'response' ||
    (verdict.kind === 'shell' && verdict.status === undefined)
  )
    return null;

  return {
    kind: 'bareBaseNotFound',
    mount: mount.base,
    message:
      `mount '${mount.base}' answers its bare base ('${mount.base}') with a 404. ` +
      `Give it a url: '' route, or a redirect rule matching the empty subpath such as { pattern: /^\\/?$/, to: '<state>' }.`,
  };
};

// One mount's findings, less the kinds its ignoreDiagnostics turns off.
const diagnosticsOf = (mount: Mount): MountDiagnostic[] => {
  const ignored = mount.config.ignoreDiagnostics ?? [];

  return [bareBaseDiagnostic(mount)].filter(
    (finding): finding is MountDiagnostic =>
      finding !== null && !ignored.includes(finding.kind),
  );
};

// Each createServerRouter router's mounts in declaration order, for diagnoseMounts.
const compiledMounts = new WeakMap<ServerRouter, Mount[]>();

// --- Construction ------------------------------------------------------------

// A message that names the entry with the simulate tier, for the entry without it.
const rejectSimulateMounts = (mounts: Record<string, MountConfig>): void => {
  for (const [base, config] of Object.entries(mounts)) {
    if (config.strategy === 'simulate')
      throw new Error(
        `Mount '${base}': the 'simulate' strategy needs createServerRouter from 'ui-router-server'; 'ui-router-server/router/matcher' builds 'matcher' mounts only`,
      );
  }
};

/**
 * The body of both entries' `createServerRouter`. `simulate` is the tier that
 * resolves 'simulate' mounts; without it, a 'simulate' mount throws here.
 */
export function createRouter(
  config: {
    /** As `createServerRouter`'s `base`. */
    base?: string;
    /** As `createServerRouter`'s `mounts`. */
    mounts: Record<string, MountConfig>;
  },
  simulate: SimulateTier | undefined,
): ServerRouter {
  const base =
    config.base === undefined
      ? undefined
      : siteBase(config.base, 'createServerRouter');

  // Keyed by the base-stripped path every mount check names.
  const record =
    base === undefined
      ? config.mounts
      : mountsUnder<MountConfig>(base, config.mounts, 'createServerRouter');

  if (simulate === undefined) rejectSimulateMounts(record);

  const declared = compileMounts(record);

  const mounts = byLongestBase(declared);

  if (
    simulate !== undefined &&
    mounts.some((mount) => mount.strategy === 'simulate')
  )
    simulate.start(mounts);

  const verdictFor = async (pathname: string): Promise<Verdict> => {
    for (const mount of mounts) {
      const subpath = subpathIn(mount.base, pathname);

      if (subpath === null) continue;

      const collapsed = onOrigin(subpath);

      if (collapsed !== subpath) return collapsedVerdict(mount, collapsed);

      if (mount.strategy === 'simulate' && simulate !== undefined)
        return simulate.verdict(mount, subpath);

      return matcherVerdict(mount, subpath);
    }

    return { kind: 'notFound' };
  };

  // A subpath that begins with '//' is answered from its collapsed spelling, so no state matches it with an empty leading param.
  const collapsedVerdict = async (
    mount: Mount,
    collapsed: string,
  ): Promise<Verdict> => {
    const verdict = await verdictFor(join(mount.base, collapsed));

    if (verdict.kind === 'notFound') return notFoundVerdict(mount);

    return verdict.kind === 'redirect'
      ? { ...verdict, mount: mount.base }
      : redirectVerdict(mount, collapsed, 302);
  };

  const routing: ServerRouter = {
    resolve: (pathnameOrUrl) => verdictFor(pathnameOf(pathnameOrUrl)),
  };

  const router: ServerRouter =
    base === undefined ? routing : { base, resolve: routing.resolve };

  compiledMounts.set(router, declared);
  registerMountPolicies(
    router,
    new Map(
      declared.map((mount) => [mount.base, mount.config.config?.trailingSlash]),
    ),
  );
  registerDelegates(router, {
    keys: new Set(declared.flatMap((mount) => [...mount.delegates.values()])),
    responses: new Set(declared.flatMap((mount) => [...mount.responses])),
    async markedFor(pathnameOrUrl) {
      const pathname = pathnameOf(pathnameOrUrl);

      for (const mount of mounts) {
        const subpath = subpathIn(mount.base, pathname);

        if (subpath === null) continue;

        if (mount.delegates.size === 0 && mount.responses.size === 0)
          return null;

        if (mount.strategy === 'simulate' && simulate !== undefined)
          return simulate.marked(mount, subpath);
        const verdict = matcherVerdict(mount, subpath, false);

        return verdict.kind === 'delegate' || verdict.kind === 'response'
          ? verdict
          : null;
      }

      return null;
    },
    undecodable(pathnameOrUrl) {
      const pathname = pathnameOf(pathnameOrUrl);

      for (const mount of mounts) {
        const subpath = subpathIn(mount.base, pathname);

        if (subpath === null) continue;

        try {
          matchedRouteVerdict(mount, onOrigin(subpath), false);
        } catch (error) {
          if (error instanceof URIError) return error;

          throw error;
        }

        return null;
      }

      return null;
    },
  });

  // Folded out of dist/*.js, so a bundle that never calls diagnoseMounts drops it.
  if (import.meta.env?.DEV) warnMountDiagnostics(router, diagnoseMounts);

  return router;
}

/**
 * Checks the mounts a router was built with for configurations that compile
 * but misroute, without logging: the findings the development build of
 * {@link createServerRouter} warns about, returned in every build.
 * It reports `'bareBaseNotFound'` for a mount other than '/' whose bare base
 * (`/app`) answers 404 — `notFound`, or the shell-404 of an `otherwise`
 * projection. Findings follow the table's declaration order. Assert the
 * result is empty in a test to catch them in CI.
 *
 * @param router - a router from this copy of the package's `createServerRouter`
 * @throws for any other object, such as a structural fake or a router from a
 * second copy of the package
 *
 * @example
 * ```ts
 * import assert from 'node:assert/strict';
 * import { test } from 'node:test';
 * import { createServerRouter, diagnoseMounts } from 'ui-router-server';
 *
 * // The table the server passes to createServerRouter.
 * const mounts = { '/app': { routes: [{ name: 'home', url: '' }] } };
 *
 * test('every mount serves its bare base', () => {
 *   assert.deepEqual(diagnoseMounts(createServerRouter({ mounts })), []);
 * });
 * ```
 */
export function diagnoseMounts(router: ServerRouter): MountDiagnostic[] {
  const mounts = compiledMounts.get(router);

  if (mounts === undefined)
    throw new TypeError(
      'diagnoseMounts: expected a router from createServerRouter in this copy of ui-router-server',
    );

  return mounts.flatMap(diagnosticsOf);
}
