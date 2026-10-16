/**
 * The verdict API: per-mount routing config in, a routing verdict out.
 * Runtime-agnostic — a pathname (or URL-shaped input) in, a plain verdict
 * object out; no fetch/Response, no workers types. The server (worker, node,
 * anything) stays a thin consumer: verdict → HTTP is the caller's one job.
 *
 * Strategy tiers, priced separately: 'matcher' mounts are dependency-free
 * (pattern matching + data redirects); 'simulate' mounts replay the path
 * through a headless @uirouter/core router (the optional peer dependency),
 * loaded lazily on first use — a matcher-only configuration never loads
 * core, and resolve() is async so that boundary can hold.
 */

import type { RawParams, StateDeclaration } from '@uirouter/core';

import { compileResolver, matchRoute } from './redirects.ts';
import { createRouterPool, POOL_MAX_IDLE } from './router-pool.ts';
import type { PooledRouter, RouterPool } from './router-pool.ts';
import type {
  CompiledResolver,
  RedirectRule,
  RedirectTarget,
  RouteDeclaration,
} from './redirects.ts';
import type { UrlMatcherCompilerConfig } from './url-matcher.ts';

export type {
  RedirectRule,
  RedirectTarget,
  RouteDeclaration,
} from './redirects.ts';

// Transitions settle in microtasks; the timer is only a degrade-to-shell net.
const SETTLE_TIMEOUT_MS = 100;

/** One mount's routing configuration: its state tree, its redirects, and the tier that resolves them. */
export interface MountConfig {
  /** The mount's state tree; dotted names nest, urls append (see {@link RouteDeclaration}). */
  routes: RouteDeclaration[];
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
   * Matcher compiler options (defaults: strict, case-sensitive, no squash);
   * 'simulate' mounts apply all but decodeParams. Hand the same object to
   * {@link url-config!applyUrlConfig | `applyUrlConfig`} on the client router
   * so both sides compile urls alike.
   */
  config?: UrlMatcherCompilerConfig;
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
      /** The mount-joined target path; merge the request's search with {@link mergeSearch}. */
      location: string;
      /** Redirect status to answer with (302 today). */
      status: number;
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
  /** The text {@link createServerRouter} passes to `console.warn`. */
  message: string;
}

/** The compiled resolver {@link createServerRouter} returns: a pathname in, a {@link Verdict} out. */
export interface ServerRouter {
  /** Accepts a pathname, an absolute url string, or anything with a `pathname` (URL, Location). */
  resolve(pathnameOrUrl: string | { pathname: string }): Promise<Verdict>;
}

interface Mount {
  base: string;
  config: MountConfig;
  strategy: 'matcher' | 'simulate';
  compiled: CompiledResolver;
  pool: RouterPool;
  prewarm: number;
}

const isUrlText = (input: string | { pathname: string }): input is string =>
  typeof input === 'string';

const pathnameOf = (input: string | { pathname: string }): string => {
  if (!isUrlText(input)) return input.pathname;
  // Accept absolute urls without requiring a URL global (runtime-neutral).
  const path = input.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, '');
  const end = path.search(/[?#]/);

  return end === -1 ? path : path.substring(0, end);
};

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

const toTarget = (to: string | RedirectTarget): RedirectTarget =>
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

const compileMount = ([base, config]: [string, MountConfig]): Mount => {
  validateOtherwise(base, config);
  const prewarm = validatePrewarm(base, config);

  return {
    base: normalizeBase(base),
    config,
    strategy: config.strategy ?? 'matcher',
    prewarm,
    // Simulate mounts accept the same declaration subset, so the
    // dependency-free compilation doubles as their construction-time
    // validation (their resolve path never consults it).
    compiled: compileResolver({
      routes: config.routes,
      rules: config.redirects,
      config: config.config,
    }),
    pool: createRouterPool(),
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

// --- The simulate tier, behind its lazy boundary --------------------------

type SimulateModule = typeof import('./simulate.ts');

// The lazy core boundary: the simulate tier enters the module graph only
// through this dynamic import, so matcher-only configs never load it.
const makeSimulateLoader = (): (() => Promise<SimulateModule>) => {
  let loaded: Promise<SimulateModule> | null = null;

  return () => (loaded ??= import('./simulate.ts'));
};

const buildHeadlessRouter = (simulate: SimulateModule, mount: Mount) => {
  // Fresh declarations per call: core mutates registrations, so sharing
  // them across concurrent resolutions is the hazard the copy prevents.
  const states: StateDeclaration[] = mount.config.routes.map((route) => ({
    ...route,
  }));

  const router = simulate.createHeadlessRouter(states, mount.config.config);

  // The real rule, replayed: otherwise() only fires when no other rule
  // matches, and the url-less target leaves the memory location unmoved.
  if (mount.config.otherwise) {
    const state = mount.config.otherwise.state;
    router.urlService.rules.otherwise(() => ({ state }));
  }

  for (const rule of mount.config.redirects ?? []) {
    const to = toTarget(rule.to);

    if (rule.pattern instanceof RegExp) {
      router.urlService.rules.when(rule.pattern, () => ({
        state: to.state,
        params: to.params,
      }));
    } else {
      router.urlService.rules.when(rule.pattern, (params: RawParams) => ({
        state: to.state,
        params: { ...params, ...to.params },
      }));
    }
  }

  return router;
};

const prewarmPools = (simulate: SimulateModule, mounts: Mount[]): void => {
  for (const mount of mounts) {
    try {
      mount.pool.warm(
        () => buildHeadlessRouter(simulate, mount),
        mount.prewarm,
      );
    } catch {
      // That mount's requests build on demand, as an unwarmed pool's do.
    }
  }
};

// Transitions settle in microtasks; the timer is only a degrade-to-shell net.
const settledWithinTimeout = (settled: Promise<boolean>): Promise<boolean> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    settled,
    new Promise<false>((expire) => {
      timer = setTimeout(() => expire(false), SETTLE_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
};

// --- Verdict construction --------------------------------------------------

const shellVerdict = (mount: Mount): Verdict => ({
  kind: 'shell',
  mount: mount.base,
});

const redirectVerdict = (mount: Mount, path: string): Verdict => ({
  kind: 'redirect',
  mount: mount.base,
  location: join(mount.base, path),
  status: 302,
});

const notFoundVerdict = (mount: Mount): Verdict => ({
  kind: 'notFound',
  mount: mount.base,
});

// The otherwise projection: the shell is the error page, at an honest 404 —
// never 200, the resource genuinely doesn't exist.
const otherwiseVerdict = (mount: Mount): Verdict => ({
  kind: 'shell',
  mount: mount.base,
  status: 404,
});

// --- Per-strategy resolution -----------------------------------------------

const matcherVerdict = (mount: Mount, subpath: string): Verdict => {
  const resolution = mount.compiled.resolve(subpath);

  if (resolution.redirect !== null)
    return redirectVerdict(mount, resolution.redirect);

  // A when()-rule that lands where it started never reached route matching.
  const match =
    resolution.match === undefined
      ? matchRoute(mount.compiled.routes, subpath)
      : resolution.match;

  if (match !== null) return shellVerdict(mount);

  return mount.config.otherwise
    ? otherwiseVerdict(mount)
    : notFoundVerdict(mount);
};

// The matcher projection stands in for both strategies: they consume the same declaration subset.
const bareBaseDiagnostic = (mount: Mount): MountDiagnostic | null => {
  if (mount.base === '/') return null;

  const verdict = matcherVerdict(mount, '');

  if (
    verdict.kind === 'redirect' ||
    (verdict.kind === 'shell' && verdict.status === undefined)
  )
    return null;

  return {
    kind: 'bareBaseNotFound',
    mount: mount.base,
    message:
      `ui-router-server: mount '${mount.base}' answers its bare base ('${mount.base}') with a 404. ` +
      `Give it a url: '' route, or a redirect rule matching the empty subpath such as { pattern: /^\\/?$/, to: '<state>' }.`,
  };
};

const diagnose = (mounts: Mount[]): MountDiagnostic[] =>
  mounts.flatMap((mount) => bareBaseDiagnostic(mount) ?? []);

// Null when the transition failed or timed out: that router may still be mid-transition.
const replayVerdict = async (
  pooled: PooledRouter,
  mount: Mount,
  subpath: string,
): Promise<Verdict | null> => {
  const { router } = pooled;

  if (!router.urlService.match({ path: subpath, search: {}, hash: '' }))
    return notFoundVerdict(mount);
  const settled = pooled.nextSettled();
  router.urlService.url(subpath);
  router.urlService.sync();

  if (!(await settledWithinTimeout(settled))) return null;

  // A transition that settled on the otherwise state IS the 404 page.
  if (router.globals.current.name === mount.config.otherwise?.state)
    return otherwiseVerdict(mount);
  // The memory location only moves when the client's address bar would:
  // core skips the url push for url-sourced transitions.
  const landed = router.urlService.url();

  return landed === subpath
    ? shellVerdict(mount)
    : redirectVerdict(mount, landed);
};

const simulateVerdict = async (
  simulate: SimulateModule,
  mount: Mount,
  subpath: string,
): Promise<Verdict> => {
  try {
    const pooled = mount.pool.checkOut(() =>
      buildHeadlessRouter(simulate, mount),
    );

    const verdict = await replayVerdict(pooled, mount, subpath);

    // Failed and timed-out transitions degrade to the shell — the client
    // router re-runs them with its full configuration; never a wrong redirect.
    // Their router is dropped, never pooled.
    if (verdict === null) return shellVerdict(mount);
    pooled.release();

    return verdict;
  } catch {
    // Core can throw synchronously (registration, matching, sync); degrade
    // to the shell — the client router re-runs the url with its full
    // configuration — never a wrong redirect or a spurious 404.
    return shellVerdict(mount);
  }
};

// --- The public entry ------------------------------------------------------

/**
 * Compiles a mount table into a resolver. Every mount's routes and redirect
 * table compile (and validate) at construction, whatever its strategy; a
 * config with 'simulate' mounts also starts loading @uirouter/core here.
 * The longest matching mount base owns a pathname outright — a verdict
 * never falls through to a shorter mount.
 *
 * A bare mount base ('/app', '/app/') resolves the empty subpath, which
 * 404s unless the mount supplies a root pattern — a rule like
 * `{ pattern: /^\/?$/, to: ... }` or a `url: ''` route. Construction passes
 * each {@link diagnoseMounts} finding's message to `console.warn`.
 */
export function createServerRouter(config: {
  mounts: Record<string, MountConfig>;
}): ServerRouter {
  const declared = compileMounts(config.mounts);

  for (const diagnostic of diagnose(declared)) console.warn(diagnostic.message);
  const mounts = byLongestBase(declared);
  const loadSimulate = makeSimulateLoader();

  // Still lazy for matcher-only configs, but paid at construction when a
  // simulate mount exists — not on its first request. Prewarm chains first,
  // so it fills the pools before any request's check-out. The stray
  // rejection is silenced here; resolve() awaits the same cached promise and
  // rethrows.
  if (mounts.some((mount) => mount.strategy === 'simulate'))
    void loadSimulate()
      .then((simulate) => prewarmPools(simulate, mounts))
      .catch(() => {});

  return {
    async resolve(pathnameOrUrl) {
      const pathname = pathnameOf(pathnameOrUrl);

      for (const mount of mounts) {
        const subpath = subpathIn(mount.base, pathname);

        if (subpath === null) continue;

        if (mount.strategy === 'matcher') return matcherVerdict(mount, subpath);

        return simulateVerdict(await loadSimulate(), mount, subpath);
      }

      return { kind: 'notFound' };
    },
  };
}

/**
 * Checks a mount table for configurations that compile but misroute, without
 * logging: the findings {@link createServerRouter} passes to `console.warn`.
 * It takes the same mount table, compiles it the same way, and throws for
 * the same invalid configs. It reports `'bareBaseNotFound'` for a mount
 * other than '/' whose bare base (`/app`) answers 404 — `notFound`, or the
 * shell-404 of an `otherwise` projection. Findings follow the table's
 * declaration order. Assert the result is empty in a test to catch them in
 * CI.
 *
 * @example
 * ```ts
 * import assert from 'node:assert/strict';
 * import { test } from 'node:test';
 * import { diagnoseMounts } from 'ui-router-server';
 *
 * import { mounts } from './routes.ts';
 *
 * test('every mount serves its bare base', () => {
 *   assert.deepEqual(diagnoseMounts(mounts), []);
 * });
 * ```
 */
export function diagnoseMounts(
  mounts: Record<string, MountConfig>,
): MountDiagnostic[] {
  return diagnose(compileMounts(mounts));
}
