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
  /** Url segment appended to the ancestors' segments; a url-less state is structural only (never matched, never a redirect target). */
  url?: string;
  /** Param declarations for this state's own placeholders (shorthand defaults or [[ParamDeclaration]]s). */
  params?: Record<string, unknown>;
  /**
   * Data redirect, mirroring ui-router's redirectTo subset: a url landing on
   * this state goes to the target state instead. A string target keeps the
   * matched params; a [[RedirectTarget]] with `params` replaces them
   * (core's `result.params || trans.params()`). Chains are followed;
   * cycles are rejected at compile.
   */
  redirectTo?: string | RedirectTarget;
}

export interface RedirectTarget {
  state: string;
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
  pattern: RegExp | string;
  to: string | RedirectTarget;
}

export interface RedirectTable {
  routes: RouteDeclaration[];
  rules?: RedirectRule[];
  /** Matcher compiler options (defaults: strict, case-sensitive). */
  config?: UrlMatcherCompilerConfig;
}

export interface CompiledRoute {
  name: string;
  /** The full pattern: this state's url appended to its ancestors'. */
  pattern: string;
  matcher: CompiledMatcher;
  redirectTo?: string | RedirectTarget;
}

/**
 * Compiles the url-addressable routes of a declaration set: each state's url
 * appended to its ancestors' (dotted names nest), params merged rootward.
 * Url-less states contribute nothing and match nothing, as in ui-router.
 */
export function compileRoutes(
  routes: RouteDeclaration[],
  config: UrlMatcherCompilerConfig = {},
): CompiledRoute[] {
  const { compile } = urlMatcherFactory(config);
  const byName = new Map<string, RouteDeclaration>();
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
  }
  const compiled: CompiledRoute[] = [];
  for (const route of routes) {
    if (route.url === undefined) continue;
    const segments = route.name.split('.');
    let pattern = '';
    let params: Record<string, unknown> = {};
    for (let depth = 1; depth <= segments.length; depth++) {
      const name = segments.slice(0, depth).join('.');
      const ancestor = byName.get(name);
      if (!ancestor)
        throw new Error(`Route '${route.name}' has no ancestor '${name}'`);
      if (ancestor.url) {
        // Naive concatenation cannot splice a child into a parent's search
        // part (core's UrlMatcher.append can); fail rather than diverge.
        if (pattern.includes('?'))
          throw new Error(
            `Route '${route.name}': ancestor '${name}' cannot extend a pattern that already has search params`,
          );
        pattern += ancestor.url;
      }
      if (ancestor.params) params = { ...params, ...ancestor.params };
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

export interface RouteMatch {
  /** The route (state) name whose full pattern matched. */
  state: string;
  params: RawParams;
}

/**
 * Returns which route's pattern the pathname matched, with the extracted
 * params. The most specific match wins ([[compare]]); ties go to
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

const toTarget = (to: string | RedirectTarget): RedirectTarget =>
  typeof to === 'string' ? { state: to } : to;

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
  const routes = compileRoutes(table.routes, table.config);
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
    matcher: typeof rule.pattern === 'string' ? compile(rule.pattern) : null,
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

  return (pathname) => {
    for (const rule of rules) {
      if (rule.regexp) {
        if (rule.regexp.test(pathname))
          return follow(rule.to.state, rule.to.params ?? {}, pathname);
        continue;
      }
      const params = exec(rule.matcher!, pathname);
      if (params !== null)
        return follow(
          rule.to.state,
          { ...params, ...rule.to.params },
          pathname,
        );
    }
    const match = matchRoute(routes, pathname);
    if (match === null) return null;
    const route = byName.get(match.state)!;
    if (route.redirectTo === undefined) return null;
    const target = toTarget(route.redirectTo);
    return follow(target.state, target.params ?? match.params, pathname);
  };
}

/** One-shot convenience over [[compileRedirects]]. */
export function evaluateRedirects(
  table: RedirectTable,
  pathname: string,
): string | null {
  return compileRedirects(table)(pathname);
}
