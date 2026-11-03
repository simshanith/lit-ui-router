/**
 * The server strategies' side of urlPattern() routes: a route chain compiles
 * into a CompiledUrlPattern the platform URLPattern matches, as the client
 * plugin's matcher does, while the matcher port's params type, decode and
 * format its groups.
 */

import type { RawParams } from '@uirouter/core';

import {
  compareParts,
  compileParam,
  decodeCaptures,
  exec,
  formatParts,
  format,
  paramValidates,
} from './url-matcher.ts';
import type {
  CompiledMatcher,
  CompiledParam,
  ResolvedConfig,
  UrlMatcherCompilerConfig,
} from './url-matcher.ts';
import { requireUrlPattern } from './url-pattern.ts';
import type { CompiledUrlPattern, ParsedUrlPattern } from './url-pattern.ts';

/** A compiled route's matcher: a matcher-syntax pattern or a URLPattern chain. */
export type RouteMatcher = CompiledMatcher | CompiledUrlPattern;

const engines = new WeakMap<CompiledUrlPattern, URLPattern>();

const isString = (value: unknown): value is string => typeof value === 'string';

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

/**
 * Compiles a urlPattern() chain, root first, with the chain's merged params.
 * Throws when the runtime has no global URLPattern.
 */
export function compileUrlPattern(
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
    throw new Error(
      `${where}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  const compiled: CompiledUrlPattern = Object.freeze({
    pattern: query.length ? `${pathname}?${query.join('&')}` : pathname,
    urlPattern: pathname,
    segments: Object.freeze(segments),
    pathParams: Object.freeze(pathParams),
    searchParams: Object.freeze(
      query.map((name) => compileParam(name, null, true, resolved, where)),
    ),
    groupPatterns: Object.freeze(groupPatterns),
    strict: config.strict,
    caseInsensitive: config.caseInsensitive,
    decodeParams: config.decodeParams,
  });

  engines.set(compiled, engine);

  return compiled;
}

/** True for a matcher {@link compileUrlPattern} built. */
export const isCompiledUrlPattern = (
  matcher: RouteMatcher,
): matcher is CompiledUrlPattern => 'urlPattern' in matcher;

const engineOf = (matcher: CompiledUrlPattern): URLPattern =>
  engines.get(matcher)!;

// As core's url rule: the engine matches, then every value must validate.
const execUrlPattern = (
  matcher: CompiledUrlPattern,
  path: string,
): RawParams | null => {
  const match = engineOf(matcher).exec({ pathname: path });

  if (match === null) return null;
  const { groups } = match.pathname;

  const values = decodeCaptures(
    matcher,
    matcher.pathParams.map((param) => groups[param.id]),
  );

  return matcher.pathParams.every((param) =>
    paramValidates(param, values[param.id]),
  )
    ? values
    : null;
};

// The port's url building, then the engine must match the built path.
const formatUrlPattern = (
  matcher: CompiledUrlPattern,
  values: RawParams,
): string | null => {
  const parts = formatParts(matcher, values);

  if (
    parts === null ||
    parts.encodedPath.some((encoded) => !isString(encoded) || encoded === '')
  )
    return null;

  if (engineOf(matcher).exec({ pathname: parts.path }) === null) return null;

  return parts.path + parts.query + parts.fragment;
};

/** Matches a path against either kind of route matcher. */
export const execRoute = (
  matcher: RouteMatcher,
  path: string,
): RawParams | null =>
  isCompiledUrlPattern(matcher)
    ? execUrlPattern(matcher, path)
    : exec(matcher, path);

/** Builds a url from either kind of route matcher. */
export const formatRoute = (
  matcher: RouteMatcher,
  values: RawParams = {},
): string | null =>
  isCompiledUrlPattern(matcher)
    ? formatUrlPattern(matcher, values)
    : format(matcher, values);

/** Core's specificity sort over either kind of route matcher. */
export const compareRoutes: (a: RouteMatcher, b: RouteMatcher) => number =
  compareParts;
