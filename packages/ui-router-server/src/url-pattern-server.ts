/** @module url-pattern/server */

/**
 * The server half of URLPattern urls: {@link urlPatternCompiler} compiles
 * {@link url-pattern!urlPattern | urlPattern} routes for both server
 * strategies. The platform `URLPattern` matches a route, as the client
 * plugin's matcher does, while the matcher tier's params type, decode and
 * format its groups. Hand it to a mount's
 * {@link index!MountConfig.urlPattern | `urlPattern`} option, or to
 * {@link redirects!compileRoutes | compileRoutes}; a table of string urls
 * needs none of it.
 *
 * Node 22 needs `urlpattern-polyfill` loaded first; compiling a URLPattern
 * route without a global `URLPattern` throws.
 *
 * Experimental: names and shape may change.
 */

import type { RawParams } from '@uirouter/core';

import type {
  CompiledUrlPattern,
  RouteDeclaration,
  UrlPatternCompiler,
} from './redirects.ts';
import { mayMatchSlash } from './regexp-slash.ts';
import type { InexpressibleRoute } from './route-trie.ts';
import {
  compileParam,
  decodeCaptures,
  formatParts,
  paramValidates,
} from './url-matcher.ts';
import type {
  CompiledParam,
  ResolvedConfig,
  UrlMatcherCompilerConfig,
} from './url-matcher.ts';
import { urlPatternPlugin } from './url-pattern-client.ts';
import { parsedUrlPattern, requireUrlPattern } from './url-pattern.ts';
import type { ParsedUrlPattern } from './url-pattern.ts';

const isString = (value: unknown): value is string => typeof value === 'string';

// The printable ASCII a URL path keeps as written; URLPattern encodes any other literal.
const pathSafe = /^[\w\-.~!$&'()*+,;=:@/%[\]|\\]*$/;

// Why the route trie can't express the pattern, if it can't.
const inexpressibleOf = (
  config: Required<UrlMatcherCompilerConfig>,
  segments: readonly string[],
  pathParams: readonly CompiledParam[],
  groupPatterns: readonly (string | null)[],
): Omit<InexpressibleRoute, 'route'> | null => {
  if (config.caseInsensitive) return { reason: 'case-insensitive' };

  if (!segments.every((text) => pathSafe.test(text)))
    return { reason: 'encoded-literal' };

  // URLPattern's segment wildcard never spans a '/'; a regexp group may.
  const param = pathParams.find((_param, index) => {
    const regexp = groupPatterns[index];

    return regexp !== null && mayMatchSlash(regexp);
  });

  return param ? { reason: 'slash-spanning-param', param: param.id } : null;
};

const groupParam = (
  name: string,
  regexp: string | undefined,
  config: ResolvedConfig,
  where: string,
): CompiledParam => {
  const param = compileParam(name, null, false, config, where);

  if (regexp !== undefined && param.type.name !== 'path')
    throw new Error(
      `${where}: URLPattern group ':${name}' takes a regexp or a declared type, not both`,
    );

  if (param.isOptional)
    throw new Error(
      `${where}: URLPattern group ':${name}' is required, so it can't declare a default`,
    );

  return param;
};

// A urlPattern() chain, root first, with the chain's merged params; throws without a global URLPattern.
function compileUrlPattern(
  chain: readonly ParsedUrlPattern[],
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- a route's params, as RouteDeclaration.params
  params: Record<string, unknown>,
  config: Required<UrlMatcherCompilerConfig>,
  where: string,
): CompiledUrlPattern {
  requireUrlPattern();
  const resolved = { ...config, params };
  const pathname = chain.map((url) => url.pathname).join('');
  const query = chain.flatMap((url) => url.query);
  const segments = [''];
  const pathParams: CompiledParam[] = [];
  const groupPatterns: (string | null)[] = [];

  for (const token of chain.flatMap((url) => url.tokens)) {
    if (token.kind === 'text') {
      segments[segments.length - 1] += token.text;
      continue;
    }

    pathParams.push(groupParam(token.name, token.regexp, resolved, where));
    groupPatterns.push(token.regexp ?? null);
    segments.push('');
  }

  let engine: URLPattern;

  try {
    engine = new URLPattern(
      { pathname: config.strict ? pathname : `${pathname}{/}?` },
      { ignoreCase: config.caseInsensitive },
    );
  } catch (error) {
    // SAFETY: the URLPattern constructor throws only TypeErrors.
    throw new Error(`${where}: ${(error as Error).message}`, { cause: error });
  }

  const parts = {
    segments: Object.freeze(segments),
    pathParams: Object.freeze(pathParams),
    searchParams: Object.freeze(
      query.map((name) => compileParam(name, null, true, resolved, where)),
    ),
    decodeParams: config.decodeParams,
  };

  // As core's url rule: the engine matches, then every value must validate.
  const exec = (path: string): RawParams | null => {
    const match = engine.exec({ pathname: path });

    // The engine rewrites a non-canonical path before matching; a string url never does, nor the trie.
    if (match === null || match.pathname.input !== path) return null;
    const { groups } = match.pathname;

    const values = decodeCaptures(
      parts,
      pathParams.map((param) => groups[param.id]),
    );

    return pathParams.every((param) => paramValidates(param, values[param.id]))
      ? values
      : null;
  };

  // The port's url building, then the engine must match the built path.
  const format = (values: RawParams = {}): string | null => {
    const built = formatParts(parts, values);

    if (
      built === null ||
      built.encodedPath.some((encoded) => !isString(encoded) || encoded === '')
    )
      return null;

    if (engine.exec({ pathname: built.path }) === null) return null;

    return built.path + built.query + built.fragment;
  };

  return Object.freeze({
    ...parts,
    pattern: query.length ? `${pathname}?${query.join('&')}` : pathname,
    urlPattern: pathname,
    groupPatterns: Object.freeze(groupPatterns),
    strict: config.strict,
    caseInsensitive: config.caseInsensitive,
    inexpressible: inexpressibleOf(config, segments, pathParams, groupPatterns),
    exec,
    format,
  });
}

const mixedChain = (
  child: RouteDeclaration,
  parent: RouteDeclaration,
): Error => {
  const declared = parsedUrlPattern(child.url);

  return declared
    ? new Error(
        `Route '${child.name}': URLPattern url '${declared.pathname}' can't extend string url '${parent.url}'; declare the parent with urlPattern() too`,
      )
    : new Error(
        `Route '${child.name}': string url '${child.url}' can't extend URLPattern url '${parsedUrlPattern(parent.url)!.pathname}'; declare the child with urlPattern()`,
      );
};

// A route's chain, root first: every url-bearing route in it must be a urlPattern() url, as the client plugin requires.
const compileRouteChain: UrlPatternCompiler['compile'] = (
  chain,
  params,
  config,
  name,
) => {
  const urls: ParsedUrlPattern[] = [];
  let nearest: RouteDeclaration | null = null;

  for (const ancestor of chain) {
    const parsed = parsedUrlPattern(ancestor.url);
    const declared: unknown = ancestor.url;

    if (parsed === undefined && declared instanceof Object)
      throw new Error(
        `Route '${ancestor.name}': its url is an object urlPattern() did not build`,
      );

    if (
      nearest !== null &&
      ancestor.url !== undefined &&
      (parsed !== undefined) !== (parsedUrlPattern(nearest.url) !== undefined)
    )
      throw mixedChain(ancestor, nearest);

    if (parsed) urls.push(parsed);

    if (parsed || ancestor.url) nearest = ancestor;
  }

  return compileUrlPattern(urls, params, config, `Route '${name}'`);
};

/**
 * Compiles {@link url-pattern!urlPattern | urlPattern} routes for the
 * server strategies: a 'matcher' mount matches them with the platform
 * `URLPattern`, and a 'simulate' mount's headless router applies the client
 * plugin.
 *
 * @example
 * ```ts
 * import { createServerRouter } from 'ui-router-server';
 * import { urlPattern } from 'ui-router-server/url-pattern';
 * import { urlPatternCompiler } from 'ui-router-server/url-pattern/server';
 *
 * const router = createServerRouter({
 *   mounts: {
 *     '/': {
 *       routes: [{ name: 'user', url: urlPattern('/users/:id') }],
 *       urlPattern: urlPatternCompiler,
 *     },
 *   },
 * });
 * ```
 */
export const urlPatternCompiler: UrlPatternCompiler = Object.freeze({
  compile: compileRouteChain,
  plugin: urlPatternPlugin,
});
