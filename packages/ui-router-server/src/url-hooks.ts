/**
 * The pull seam between url consumers and urlPattern() urls: a urlPattern()
 * value carries its own hooks, so a table of string urls never loads
 * URLPattern code.
 */

import type { UIRouter, UIRouterPlugin } from '@uirouter/core';

import type { RouteDeclaration } from './redirects.ts';
import type {
  CompiledMatcher,
  UrlMatcherCompilerConfig,
} from './url-matcher.ts';
import type { CompiledUrlPattern } from './url-pattern.ts';

/**
 * The key a urlPattern() value carries its {@link UrlHooks} under.
 *
 * @internal
 */
export const urlHooks: unique symbol = Symbol.for('ui-router-server.urlHooks');

/**
 * What a url consumer calls on a urlPattern() value.
 *
 * @internal
 */
export interface UrlHooks {
  /** Compiles a route's chain, root first, for the server strategies; `name` is the route's. */
  readonly compile: (
    chain: readonly RouteDeclaration[],
    // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- a route's params, as RouteDeclaration.params
    params: Record<string, unknown>,
    config: Required<UrlMatcherCompilerConfig>,
    name: string,
  ) => CompiledUrlPattern;
  /** The plugin a router applies before registering these urls. */
  readonly plugin: (router: UIRouter) => UIRouterPlugin;
}

/**
 * A url value that carries its own {@link UrlHooks}.
 *
 * @internal
 */
export interface HookedUrl {
  /** The pathname pattern, for error messages. */
  readonly pathname: string;
  /** The value's hooks. */
  readonly [urlHooks]: UrlHooks;
}

/**
 * A state url as a {@link HookedUrl}, or undefined for a string url.
 *
 * @internal
 */
export const hookedUrl = (url: string | undefined): HookedUrl | undefined => {
  const value: unknown = url;

  if (!(value instanceof Object && urlHooks in value)) return undefined;

  // SAFETY: only urlPattern() builds a value keyed by urlHooks.
  // oxlint-disable-next-line anti-slop/no-widen-then-assert -- a urlPattern() url is typed as a branded string but is an object at runtime
  return value as HookedUrl;
};

/**
 * True for a route matcher a {@link UrlHooks.compile} built.
 *
 * @internal
 */
export const isCompiledUrlPattern = (
  matcher: CompiledMatcher | CompiledUrlPattern,
): matcher is CompiledUrlPattern => 'urlPattern' in matcher;
