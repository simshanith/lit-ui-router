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

// Travels with the module through the import graph: a consumer typechecking
// these sources via a plain import (types: []) never loads unreferenced
// ambient files, so the globals shims must be referenced, not just included.
// eslint-disable-next-line typescript/triple-slash-reference -- an ESM import of the ambient file would survive node's type stripping and 404 at runtime; the directive is type-space only
/// <reference path="./globals.d.ts" />

import type { RawParams, StateDeclaration } from '@uirouter/core';

import { compileRedirects, compileRoutes, matchRoute } from './redirects.ts';
import type {
  CompiledRoute,
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

export interface MountConfig {
  /** The mount's state tree; dotted names nest, urls append (see [[RouteDeclaration]]). */
  routes: RouteDeclaration[];
  /** when()-style pattern rules, evaluated before per-state redirectTo entries. */
  redirects?: RedirectRule[];
  /**
   * 'matcher' (default): dependency-free pattern matching plus data
   * redirects. 'simulate': replay through a headless @uirouter/core router —
   * the tier where routing that data cannot express (hooks, resolves,
   * redirectTo functions) will live. Those are NOT yet reachable through
   * MountConfig: both strategies consume the same [[RouteDeclaration]] data
   * subset today, deliberately, so strategy stays a pure cost knob; the
   * config widens later (e.g. an auth tier).
   */
  strategy?: 'matcher' | 'simulate';
  /** Matcher compiler options for 'matcher' mounts (defaults: strict, case-sensitive). */
  config?: UrlMatcherCompilerConfig;
}

// Discriminate on `kind`. (Consumer note: under oxlint's
// switch-exhaustiveness-check + consistent-return combination, an if-chain
// reads cleaner than a switch over this union.)
export type Verdict =
  /**
   * Serve the app shell. Status precedence: when `status` is absent (always,
   * today), serve the shell however you normally would — including 304
   * conditional responses. When a future data tier sets it (401/403-with-
   * shell), the verdict's status wins outright — and you must suppress the
   * conditional path BY STRIPPING the request's validators (If-None-Match,
   * If-Modified-Since) before the assets fetch, so it returns 200 + full
   * body to relabel. Never relabel a 304 itself: it has no body (a 401 with
   * a null body is malformed) and would let an unauthorized probe read
   * cache freshness.
   */
  | { kind: 'shell'; mount: string; status?: number }
  /**
   * Redirect to `location`: the mount-joined target path, which MAY carry
   * its own query string when the target declares search params. Callers
   * preserving the request's search must MERGE query params into it —
   * string concatenation (`location + url.search`) produces `?a=1?b=2`.
   * The matcher tier resolves pathnames only: incoming search values never
   * flow into redirect params.
   */
  | { kind: 'redirect'; mount: string; location: string; status: number }
  /** `mount` is set when a mount owned the pathname but nothing matched (per-mount 404s); absent when no mount matched at all. */
  | { kind: 'notFound'; mount?: string };

export interface ServerRouter {
  /** Accepts a pathname, an absolute url string, or anything with a `pathname` (URL, Location). */
  resolve(pathnameOrUrl: string | { pathname: string }): Promise<Verdict>;
}

interface Mount {
  base: string;
  config: MountConfig;
  strategy: 'matcher' | 'simulate';
  compiled: {
    evaluate: (pathname: string) => string | null;
    routes: CompiledRoute[];
  };
}

const pathnameOf = (input: string | { pathname: string }): string => {
  if (typeof input !== 'string') return input.pathname;
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

const toTarget = (to: string | RedirectTarget): RedirectTarget =>
  typeof to === 'string' ? { state: to } : to;

/**
 * Merges a request's search into a redirect `location` — the correct-by-
 * default replacement for `location + url.search`, which yields `?a=1?b=2`.
 * Params the redirect target declared win; remaining request params are
 * appended (all values of multi-value keys). Accepts the incoming search
 * with or without the leading '?'. Operates on `pathname?search` strings as
 * produced in redirect verdicts (no fragment handling).
 */
export function mergeSearch(location: string, incoming: string): string {
  const query = incoming.startsWith('?') ? incoming.substring(1) : incoming;
  if (!query) return location;
  const cut = location.indexOf('?');
  const pathname = cut === -1 ? location : location.substring(0, cut);
  const target = new URLSearchParams(
    cut === -1 ? '' : location.substring(cut + 1),
  );
  const request = new URLSearchParams(query);
  const keys = new Set<string>();
  request.forEach((_value, key) => keys.add(key));
  for (const key of keys) {
    if (target.has(key)) continue;
    for (const value of request.getAll(key)) target.append(key, value);
  }
  const merged = target.toString();
  return merged ? `${pathname}?${merged}` : pathname;
}

// --- Mount compilation (construction-time, strategy-independent) ---------

const normalizeBase = (base: string): string => {
  if (!base.startsWith('/'))
    throw new Error(`Mount '${base}' must start with '/'`);
  return base !== '/' && base.endsWith('/') ? base.slice(0, -1) : base;
};

const compileMount = ([base, config]: [string, MountConfig]): Mount => ({
  base: normalizeBase(base),
  config,
  strategy: config.strategy ?? 'matcher',
  // Simulate mounts accept the same declaration subset, so the
  // dependency-free compilation doubles as their construction-time
  // validation (their resolve path never consults it).
  compiled: {
    evaluate: compileRedirects({
      routes: config.routes,
      rules: config.redirects,
      config: config.config,
    }),
    routes: compileRoutes(config.routes, config.config),
  },
});

const compileMounts = (record: Record<string, MountConfig>): Mount[] => {
  const mounts = Object.entries(record)
    .map(compileMount)
    // The longest matching base owns a pathname outright.
    .sort((a, b) => b.base.length - a.base.length);
  if (new Set(mounts.map((mount) => mount.base)).size !== mounts.length)
    throw new Error('Mount bases must be unique');
  return mounts;
};

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
  const router = simulate.createHeadlessRouter(states);
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

// Transitions settle in microtasks; the timer is only a degrade-to-shell net.
const settledWithinTimeout = (settled: Promise<boolean>): Promise<boolean> =>
  Promise.race([
    settled,
    new Promise<false>((expire) =>
      setTimeout(() => expire(false), SETTLE_TIMEOUT_MS),
    ),
  ]);

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

// --- Per-strategy resolution -----------------------------------------------

const matcherVerdict = (mount: Mount, subpath: string): Verdict => {
  const redirected = mount.compiled.evaluate(subpath);
  if (redirected !== null) return redirectVerdict(mount, redirected);
  return matchRoute(mount.compiled.routes, subpath) !== null
    ? shellVerdict(mount)
    : notFoundVerdict(mount);
};

const simulateVerdict = async (
  simulate: SimulateModule,
  mount: Mount,
  subpath: string,
): Promise<Verdict> => {
  try {
    const router = buildHeadlessRouter(simulate, mount);
    if (!router.urlService.match({ path: subpath, search: {}, hash: '' }))
      return notFoundVerdict(mount);
    const settled = simulate.onceSettled(router);
    router.urlService.url(subpath);
    router.urlService.sync();
    // Failed and timed-out transitions degrade to the shell — the client
    // router re-runs them with its full configuration; never a wrong redirect.
    if (!(await settledWithinTimeout(settled))) return shellVerdict(mount);
    // The memory location only moves when the client's address bar would:
    // core skips the url push for url-sourced transitions.
    const landed = router.urlService.url();
    return landed === subpath
      ? shellVerdict(mount)
      : redirectVerdict(mount, landed);
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
 * A bare mount base ('/app', '/app/') resolves the empty subpath, which is
 * notFound unless the mount supplies a root pattern — a rule like
 * `{ pattern: /^\/?$/, to: ... }` or a `url: ''` route.
 */
export function createServerRouter(config: {
  mounts: Record<string, MountConfig>;
}): ServerRouter {
  const mounts = compileMounts(config.mounts);
  const loadSimulate = makeSimulateLoader();
  // Still lazy for matcher-only configs, but paid at construction when a
  // simulate mount exists — not on its first request. The stray rejection is
  // silenced here; resolve() awaits the same cached promise and rethrows.
  if (mounts.some((mount) => mount.strategy === 'simulate'))
    void loadSimulate().catch(() => {});

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
