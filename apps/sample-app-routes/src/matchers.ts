import { urlMatcherFactory } from 'ui-router-url-matcher';
import type { RawParams } from '@uirouter/core';

// .ts extension: node --test runs this graph directly via type stripping.
import { routePathPattern, routeSegments } from './routes.ts';
import type { AppRouteName } from './routes.ts';

// The standalone extraction of ui-router's matcher compiles with the same
// factory-default semantics as the client router — strict trailing slashes,
// case-sensitive — with no @uirouter/core in the bundle and no $injector
// shim. Parity is enforced by the package's differential suite.
const { compile } = urlMatcherFactory();

const matchers = (Object.keys(routeSegments) as AppRouteName[]).map(
  (state) => ({ state, matcher: compile(routePathPattern(state)) }),
);

export interface AppRouteMatch {
  /** The routeSegments key (state name) whose url pattern matched. */
  state: AppRouteName;
  params: RawParams;
}

/**
 * Match identity, not just truth: which state's url pattern the pathname
 * matched, with the extracted params — so the worker can grow state-keyed
 * behavior later without an API break. Among multiple matches the one with
 * the fewest params wins (static segments beat placeholders, as in the
 * router's own rule ordering); the app root has no state url, so it is
 * matchesAppRoute's concern, not a match here.
 */
export function matchAppRoute(pathname: string): AppRouteMatch | null {
  let best: AppRouteMatch | null = null;
  for (const { state, matcher } of matchers) {
    const params = matcher.exec(pathname);
    if (
      params !== null &&
      (best === null ||
        Object.keys(params).length < Object.keys(best.params).length)
    ) {
      best = { state, params };
    }
  }
  return best;
}

// The app root has no state url; router.config.ts matches it with when(/^\/?$/).
export function matchesAppRoute(path: string): boolean {
  return /^\/?$/.test(path) || matchAppRoute(path) !== null;
}
