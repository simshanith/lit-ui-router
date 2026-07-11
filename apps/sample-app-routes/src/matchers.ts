import { urlMatcherFactory } from 'ui-router-url-matcher';

// .ts extension: node --test runs this graph directly via type stripping.
import { routePathPatterns } from './routes.ts';

// The standalone extraction of ui-router's matcher compiles with the same
// factory-default semantics as the client router — strict trailing slashes,
// case-sensitive — with no @uirouter/core in the bundle and no $injector
// shim. Parity is enforced by the package's differential suite.
const { compile } = urlMatcherFactory();

const matchers = routePathPatterns.map((pattern) => compile(pattern));

// The app root has no state url; router.config.ts matches it with when(/^\/?$/).
export function matchesAppRoute(path: string): boolean {
  return (
    /^\/?$/.test(path) ||
    matchers.some((matcher) => matcher.exec(path) !== null)
  );
}
