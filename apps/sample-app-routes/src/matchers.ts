// #uirouter/* maps to lib-esm/* for bundlers and lib/* (CJS) under node,
// whose ESM loader can't resolve lib-esm's extensionless relative imports.
// Either way these are internal layout, not part of @uirouter/core's semver.
import { UrlMatcher } from '#uirouter/url/urlMatcher.js';
import { ParamTypes } from '#uirouter/params/paramTypes.js';
import { Param, DefType } from '#uirouter/params/param.js';
import { services } from '#uirouter/common/coreservices.js';
// lib and lib-esm d.ts declare privates separately; barrel types won't unify.
import type { ParamFactory } from '#uirouter/url/urlMatcherFactory.js';
import type { ParamType } from '#uirouter/params/paramType.js';
import type { StateDeclaration } from '#uirouter/state/interface.js';
import type { UrlConfig } from '#uirouter/url/urlConfig.js';

// .ts extension: node --test runs this graph directly via type stripping.
import { routePathPatterns } from './routes.ts';

// Core routes even static param defaults through services.$injector.invoke
// (params/param.ts); no framework installs one here, so exec() would throw
// for query-suffixed or defaulted-param patterns without this shim.
services.$injector = {
  invoke: (fn: () => unknown) => fn(),
} as typeof services.$injector;

const paramTypes = new ParamTypes();

// Param construction reads only paramTypes and defaultSquashPolicy() (whose
// factory default is false), so this duck-typed UrlConfig suffices.
const urlConfig = {
  paramTypes,
  defaultSquashPolicy: () => false,
} as unknown as UrlConfig;

// UrlMatcher only calls fromPath/fromSearch; fromConfig and the private
// router that the class type carries are never reached.
const paramFactory = {
  fromPath: (id: string, type: ParamType, state: StateDeclaration) =>
    new Param(id, type, DefType.PATH, urlConfig, state),
  fromSearch: (id: string, type: ParamType, state: StateDeclaration) =>
    new Param(id, type, DefType.SEARCH, urlConfig, state),
} as unknown as ParamFactory;

// Bare UrlMatcher defaults caseInsensitive to TRUE; match the factory's (and
// so the client router's) compile defaults instead.
export function compileAppPattern(
  pattern: string,
  state: StateDeclaration = { params: {} },
): UrlMatcher {
  return new UrlMatcher(pattern, paramTypes, paramFactory, {
    strict: true,
    caseInsensitive: false,
    state,
  });
}

const matchers = routePathPatterns.map((pattern) => compileAppPattern(pattern));

// The app root has no state url; router.config.ts matches it with when(/^\/?$/).
export function matchesAppRoute(path: string): boolean {
  return (
    /^\/?$/.test(path) ||
    matchers.some((matcher) => matcher.exec(path) !== null)
  );
}
