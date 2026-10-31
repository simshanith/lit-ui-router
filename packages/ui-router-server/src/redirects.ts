/**
 * Declarative redirects: a redirect table plus compiled routes, evaluated
 * against a pathname with no router instance — target paths are built by the
 * matcher tier's format().
 *
 * Boundary: redirects expressible as DATA belong here — when()-style pattern
 * rules and per-state redirectTo entries. Anything that needs hooks,
 * resolves, or injected services to decide belongs to the simulate tier.
 */

import type { RawParams } from '@uirouter/core';

import { compare, exec, format, urlMatcherFactory } from './url-matcher.ts';
import type {
  CompiledMatcher,
  UrlMatcherCompilerConfig,
} from './url-matcher.ts';

/** A state's contribution to the url-addressable route set. */
export interface RouteDeclaration {
  /** The state name; dotted names nest under their parent, as in ui-router. */
  name: string;
  /**
   * The parent state's name, as core's `StateDeclaration.parent`: the state
   * nests under it instead of under its dotted prefix. A dotted name with a
   * `parent` is rejected at compile, as core rejects it at registration.
   */
  parent?: string;
  /** Url segment appended to the ancestors' segments; a url-less state is structural only (never matched, never a redirect target). */
  url?: string;
  /** Param declarations for this state's own placeholders (shorthand defaults or {@link matcher!ParamDeclaration | ParamDeclaration}s). */
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- published; a shorthand default is any value, as core's state.params
  params?: Record<string, unknown>;
  /**
   * Data redirect, mirroring ui-router's redirectTo subset: a url landing on
   * this state goes to the target state instead. A string target keeps the
   * matched params; a {@link RedirectTarget} with `params` replaces them
   * (core's `result.params || trans.params()`). Chains are followed;
   * cycles are rejected at compile.
   */
  redirectTo?: string | RedirectTarget;
  /**
   * Names the host handler that answers this state's url, for any method and
   * any Accept: the verdict is `delegate` instead of `shell`. The state tree
   * stays isomorphic because it carries only the key; the adapter's
   * `delegates` option maps the key to a handler. A delegating state needs a
   * url and no `redirectTo`, and no redirect may target it. Child states
   * don't inherit it.
   */
  delegate?: string;
  /**
   * Marks a response state: its url answers with the `Response` a handler
   * bound to the state's name builds from its resolves (a redirect, JSON, a
   * badge) instead of a page, and the verdict is `response` instead of
   * `shell`. The tree carries only the marker, so client bundles never import
   * the handler. A response state needs a url and no `redirectTo`, and can't
   * also delegate. Child states don't inherit it.
   */
  response?: true;
}

/** A redirect target in state terms; the matcher tier formats it back into a path. */
export interface RedirectTarget {
  /** Name of the url-addressable state to redirect to. */
  state: string;
  /** Params for the target's pattern; when present they replace the matched ones. */
  params?: RawParams;
}

/**
 * A when()-style rule: pathnames matching `pattern` redirect to `to`. Rules
 * evaluate before state redirects, in declaration order. A string pattern
 * compiles as a matcher pattern and its extracted params carry into the
 * target (explicit target params win); a RegExp contributes no params.
 *
 * Server redirects assume path-location clients. Hash-location apps keep
 * route state in the fragment the server never sees, so a mount-root rule
 * would rewrite the visible path on every entry — serve the shell at the
 * mount root instead.
 */
export interface RedirectRule {
  /** Pathnames to redirect: a matcher pattern (whose params carry into the target) or a RegExp. */
  pattern: RegExp | string;
  /** Where matching pathnames go — a state name, or a {@link RedirectTarget} with params. */
  to: string | RedirectTarget;
}

/** The input to {@link compileRedirects}: the route set plus the rules evaluated over it. */
export interface RedirectTable {
  /** The states whose urls the table redirects between (see {@link RouteDeclaration}). */
  routes: readonly RouteDeclaration[];
  /** when()-style rules, evaluated in declaration order before per-state redirectTo entries. */
  rules?: RedirectRule[];
  /** Matcher compiler options (defaults: strict, case-sensitive). */
  config?: UrlMatcherCompilerConfig;
}

/** One url-addressable state, compiled by {@link compileRoutes}. */
export interface CompiledRoute {
  /** The state name the pattern came from. */
  name: string;
  /** The full pattern: this state's url appended to its ancestors'. */
  pattern: string;
  /** The compiled pattern, for {@link matcher!exec | exec} and {@link matcher!format | format}. */
  matcher: CompiledMatcher;
  /** The state's declared redirect, carried through unresolved (see {@link RouteDeclaration.redirectTo}). */
  redirectTo?: string | RedirectTarget;
}

// Core's StateBuilder.parentName: the `parent`, else the dotted prefix.
const parentName = (route: RouteDeclaration): string => {
  const dot = route.name.lastIndexOf('.');

  if (dot === -1) return route.parent ?? '';

  if (route.parent)
    throw new Error(
      `Route '${route.name}': a route with 'parent' cannot have a '.' in its name`,
    );

  return route.name.slice(0, dot);
};

/**
 * Compiles the url-addressable routes of a declaration set: each state's url
 * appended to its ancestors' (a state's parent is its `parent`, else its
 * dotted prefix, as in ui-router), params merged rootward. Url-less states
 * contribute nothing and match nothing, as in ui-router.
 */
export function compileRoutes(
  routes: readonly RouteDeclaration[],
  config: UrlMatcherCompilerConfig = {},
): CompiledRoute[] {
  const { compile } = urlMatcherFactory(config);
  const byName = new Map<string, RouteDeclaration>();
  const parents = new Map<RouteDeclaration, string>();

  for (const route of routes) {
    if (byName.has(route.name))
      throw new Error(`Duplicate route '${route.name}'`);

    // Naive appending turns '/parent' + 'edit' into '/parentedit'; a url
    // must contribute a path segment ('/...') or a search part ('?...').
    if (route.url && !route.url.startsWith('/') && !route.url.startsWith('?'))
      throw new Error(
        `Route '${route.name}': url '${route.url}' must start with '/' or '?'`,
      );
    byName.set(route.name, route);
    parents.set(route, parentName(route));
  }

  // The route and its ancestors, leaf first.
  const chainOf = (route: RouteDeclaration): RouteDeclaration[] => {
    const chain = [route];
    let step = route;
    let name = parents.get(step)!;

    while (name) {
      const ancestor = byName.get(name);

      if (!ancestor)
        throw new Error(
          step.parent
            ? `Route '${step.name}' has unknown parent '${name}'`
            : `Route '${route.name}' has no ancestor '${name}'`,
        );

      if (chain.includes(ancestor))
        throw new Error(
          `Route '${route.name}': parent cycle through '${ancestor.name}'`,
        );
      chain.push(ancestor);
      step = ancestor;
      name = parents.get(step)!;
    }

    return chain;
  };

  const compiled: CompiledRoute[] = [];

  for (const route of routes) {
    if (route.url === undefined) continue;
    const chain = chainOf(route);
    let pattern = '';
    const params: NonNullable<RouteDeclaration['params']> = {};

    for (let depth = chain.length - 1; depth >= 0; depth--) {
      const ancestor = chain[depth];

      if (ancestor.url) {
        // Naive concatenation cannot splice a child into a parent's search
        // part (core's UrlMatcher.append can); fail rather than diverge.
        if (pattern.includes('?'))
          throw new Error(
            `Route '${route.name}': ancestor '${ancestor.name}' cannot extend a pattern that already has search params`,
          );
        pattern += ancestor.url;
      }

      if (ancestor.params) Object.assign(params, ancestor.params);
    }

    compiled.push({
      name: route.name,
      pattern,
      matcher: compile(pattern, { params }),
      redirectTo: route.redirectTo,
    });
  }

  return compiled;
}

/** What {@link matchRoute} reports for a matched pathname. */
export interface RouteMatch {
  /** The route (state) name whose full pattern matched. */
  state: string;
  /** The params extracted from the pathname, typed and defaulted. */
  params: RawParams;
}

/**
 * Returns which route's pattern the pathname matched, with the extracted
 * params. The most specific match wins ({@link compare}); ties go to
 * declaration order.
 */
export function matchRoute(
  routes: CompiledRoute[],
  pathname: string,
): RouteMatch | null {
  let best: RouteMatch | null = null;
  let bestMatcher: CompiledMatcher | null = null;

  for (const { name, matcher } of routes) {
    const params = exec(matcher, pathname);

    if (params === null) continue;

    // Strict < keeps the earlier declaration on ties.
    if (bestMatcher === null || compare(matcher, bestMatcher) < 0) {
      best = { state: name, params };
      bestMatcher = matcher;
    }
  }

  return best;
}

/**
 * Compiles a mount's routes into the lookup its 'matcher' strategy runs:
 * a pathname in, the {@link matchRoute} result over those routes out. It may
 * throw at compile for routes it can't serve. The default scans the routes
 * in order; {@link index!routeTrie | `routeTrie`} walks a segment trie.
 */
export type RouteIndex = (
  routes: CompiledRoute[],
) => (pathname: string) => RouteMatch | null;

const scanRoutes: RouteIndex = (routes) => (pathname) =>
  matchRoute(routes, pathname);

const isStateName = (to: string | RedirectTarget): to is string =>
  typeof to === 'string';

const toTarget = (to: string | RedirectTarget): RedirectTarget =>
  isStateName(to) ? { state: to } : to;

const isPathPattern = (pattern: string | RegExp): pattern is string =>
  typeof pattern === 'string';

/**
 * What a {@link compileResolver} evaluation reports: the redirect, plus the
 * route match whenever evaluation reached route matching.
 *
 * @internal
 */
export interface RedirectResolution {
  /** The redirected path, or null (see {@link compileRedirects}). */
  redirect: string | null;
  /** The route match; absent when a when()-rule decided before route matching ran. */
  match?: RouteMatch | null;
}

/**
 * {@link compileRedirects}, also reporting the compiled routes and each
 * evaluation's route match so a caller needs no second scan.
 *
 * @internal
 */
export interface CompiledResolver {
  /** The table's route lookup: the {@link RouteIndex} over its compiled routes. */
  match: (pathname: string) => RouteMatch | null;
  /** Evaluates a pathname once: its redirect and, when reached, its route match. */
  resolve: (pathname: string) => RedirectResolution;
}

/**
 * Compiles a redirect table into a {@link CompiledResolver} whose route
 * matching runs through `index`.
 *
 * @internal
 */
export function compileResolver(
  table: RedirectTable,
  index: RouteIndex = scanRoutes,
): CompiledResolver {
  const routes = compileRoutes(table.routes, table.config);
  const match = index(routes);
  const byName = new Map(routes.map((route) => [route.name, route]));
  const { compile } = urlMatcherFactory(table.config);

  const resolveTarget = (
    to: string | RedirectTarget,
    where: string,
  ): RedirectTarget => {
    const target = toTarget(to);

    if (!byName.has(target.state))
      throw new Error(
        `${where} redirects to unknown or url-less state '${target.state}'`,
      );

    return target;
  };

  const rules = (table.rules ?? []).map((rule) => ({
    matcher: isPathPattern(rule.pattern) ? compile(rule.pattern) : null,
    regexp: rule.pattern instanceof RegExp ? rule.pattern : null,
    to: resolveTarget(rule.to, `Rule '${String(rule.pattern)}'`),
  }));

  for (const route of routes) {
    // Validate targets and reject cycles while the table is being compiled.
    const seen = new Set([route.name]);
    let step = route;

    while (step.redirectTo !== undefined) {
      const next = resolveTarget(step.redirectTo, `State '${step.name}'`);

      if (seen.has(next.state))
        throw new Error(
          `Redirect cycle through '${next.state}' (from '${route.name}')`,
        );
      seen.add(next.state);
      step = byName.get(next.state)!;
    }
  }

  const follow = (
    stateName: string,
    initial: RawParams,
    pathname: string,
  ): string | null => {
    let state = byName.get(stateName)!;
    let carried = initial;

    while (state.redirectTo !== undefined) {
      const next = toTarget(state.redirectTo);
      // Explicit target params replace the carried ones, as core's
      // redirectTo hook does (result.params || trans.params()).
      carried = next.params ?? carried;
      state = byName.get(next.state)!;
    }

    const path = format(state.matcher, carried);

    // Invalid target params, or a redirect landing where it started: no-op.
    return path === null || path === pathname ? null : path;
  };

  const resolve = (pathname: string): RedirectResolution => {
    for (const rule of rules) {
      if (rule.regexp) {
        if (rule.regexp.test(pathname))
          return {
            redirect: follow(rule.to.state, rule.to.params ?? {}, pathname),
          };
        continue;
      }

      const params = exec(rule.matcher!, pathname);

      if (params !== null)
        return {
          redirect: follow(
            rule.to.state,
            { ...params, ...rule.to.params },
            pathname,
          ),
        };
    }

    const matched = match(pathname);

    if (matched === null) return { redirect: null, match: matched };
    const route = byName.get(matched.state)!;

    if (route.redirectTo === undefined)
      return { redirect: null, match: matched };
    const target = toTarget(route.redirectTo);

    return {
      redirect: follow(target.state, target.params ?? matched.params, pathname),
      match: matched,
    };
  };

  return { match, resolve };
}

/**
 * Compiles a redirect table into an evaluator: pathname in, redirected path
 * out — or null when the pathname does not redirect (no rule or redirecting
 * state matched, target params were invalid, or the redirect lands where it
 * started). Unknown or unaddressable targets and redirect cycles are
 * configuration errors and throw here, not at evaluation.
 */
export function compileRedirects(
  table: RedirectTable,
): (pathname: string) => string | null {
  const { resolve } = compileResolver(table);

  return (pathname) => resolve(pathname).redirect;
}

/** One-shot convenience over {@link compileRedirects}. */
export function evaluateRedirects(
  table: RedirectTable,
  pathname: string,
): string | null {
  return compileRedirects(table)(pathname);
}
