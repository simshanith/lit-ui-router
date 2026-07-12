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

// setTimeout and URLSearchParams exist on every target runtime (worker,
// node, browser) but not in the DOM-free ES lib this package compiles
// against.
declare function setTimeout(handler: () => void, ms: number): unknown;
declare class URLSearchParams {
  constructor(init?: string);
  has(name: string): boolean;
  append(name: string, value: string): void;
  getAll(name: string): string[];
  forEach(callback: (value: string, key: string) => void): void;
  toString(): string;
}

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
   * shell), the verdict's status wins outright AND suppresses conditional-
   * response passthrough: a 304 has no body and would let an unauthorized
   * probe read cache freshness, so never let an asset-layer 304 clobber an
   * explicit status.
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
  const mounts: Mount[] = Object.entries(config.mounts)
    .map(([base, mount]) => {
      if (!base.startsWith('/'))
        throw new Error(`Mount '${base}' must start with '/'`);
      const normalized =
        base !== '/' && base.endsWith('/') ? base.slice(0, -1) : base;
      return {
        base: normalized,
        config: mount,
        strategy: mount.strategy ?? 'matcher',
        // Simulate mounts accept the same declaration subset, so the
        // dependency-free compilation doubles as their construction-time
        // validation (their resolve path never consults it).
        compiled: {
          evaluate: compileRedirects({
            routes: mount.routes,
            rules: mount.redirects,
            config: mount.config,
          }),
          routes: compileRoutes(mount.routes, mount.config),
        },
      };
    })
    .sort((a, b) => b.base.length - a.base.length);
  if (new Set(mounts.map((mount) => mount.base)).size !== mounts.length)
    throw new Error('Mount bases must be unique');

  // The lazy core boundary: the simulate tier enters the module graph only
  // through this dynamic import, so matcher-only configs never load it.
  let simulate: Promise<typeof import('./simulate.ts')> | null = null;
  const loadSimulate = () => (simulate ??= import('./simulate.ts'));
  // Still lazy for matcher-only configs, but paid at construction when a
  // simulate mount exists — not on its first request. The stray rejection is
  // silenced here; resolve() awaits the same cached promise and rethrows.
  if (mounts.some((mount) => mount.strategy === 'simulate'))
    void loadSimulate().catch(() => {});

  const resolveMatcher = (mount: Mount, subpath: string): Verdict => {
    const redirected = mount.compiled.evaluate(subpath);
    if (redirected !== null)
      return {
        kind: 'redirect',
        mount: mount.base,
        location: join(mount.base, redirected),
        status: 302,
      };
    return matchRoute(mount.compiled.routes, subpath) !== null
      ? { kind: 'shell', mount: mount.base }
      : { kind: 'notFound', mount: mount.base };
  };

  const resolveSimulate = async (
    mount: Mount,
    subpath: string,
  ): Promise<Verdict> => {
    const { createHeadlessRouter, onceSettled } = await loadSimulate();
    try {
      // Fresh declarations per call: core mutates registrations, so sharing
      // them across concurrent resolutions is the hazard the copy prevents.
      const states: StateDeclaration[] = mount.config.routes.map((route) => ({
        ...route,
      }));
      const router = createHeadlessRouter(states);
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
      if (!router.urlService.match({ path: subpath, search: {}, hash: '' }))
        return { kind: 'notFound', mount: mount.base };
      const settled = onceSettled(router);
      router.urlService.url(subpath);
      router.urlService.sync();
      const outcome = await Promise.race([
        settled,
        new Promise<false>((expire) =>
          setTimeout(() => expire(false), SETTLE_TIMEOUT_MS),
        ),
      ]);
      // Failed and timed-out transitions degrade to the shell — the client
      // router re-runs them with its full configuration; never a wrong redirect.
      if (!outcome) return { kind: 'shell', mount: mount.base };
      // The memory location only moves when the client's address bar would:
      // core skips the url push for url-sourced transitions.
      const landed = router.urlService.url();
      return landed === subpath
        ? { kind: 'shell', mount: mount.base }
        : {
            kind: 'redirect',
            mount: mount.base,
            location: join(mount.base, landed),
            status: 302,
          };
    } catch {
      // Core can throw synchronously (registration, matching, sync); degrade
      // to the shell — the client router re-runs the url with its full
      // configuration — never a wrong redirect or a spurious 404.
      return { kind: 'shell', mount: mount.base };
    }
  };

  return {
    async resolve(pathnameOrUrl) {
      const pathname = pathnameOf(pathnameOrUrl);
      for (const mount of mounts) {
        const subpath = subpathIn(mount.base, pathname);
        if (subpath === null) continue;
        return mount.strategy === 'matcher'
          ? resolveMatcher(mount, subpath)
          : resolveSimulate(mount, subpath);
      }
      return { kind: 'notFound' };
    },
  };
}
