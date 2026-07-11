import { services, UIRouter } from '@uirouter/core';

// .ts extension: node --test runs this graph directly via type stripping.
import { routePathPatterns } from './routes.ts';

// Core routes even static param defaults through services.$injector.invoke
// (params/param.ts); no framework installs one here, so exec() would throw
// for query-suffixed or defaulted-param patterns without this shim.
services.$injector = {
  invoke: (fn: () => unknown) => fn(),
} as typeof services.$injector;

// The default location services are inert stubs, so compiling matchers this
// way needs no DOM and is safe in the docs worker.
const { urlMatcherFactory } = new UIRouter();

const matchers = routePathPatterns.map((pattern) =>
  urlMatcherFactory.compile(pattern),
);

// The app root has no state url; router.config.ts matches it with when(/^\/?$/).
export function matchesAppRoute(path: string): boolean {
  return (
    /^\/?$/.test(path) ||
    matchers.some((matcher) => matcher.exec(path) !== null)
  );
}
