/**
 * The bridge from an app's data-only state declarations to a mount's routes,
 * so the client states and the server table share one module.
 */

import type { RedirectTarget, RouteDeclaration } from './redirects.ts';

// The test's Required<RouteDeclaration> row fails until a new field is listed here.
const ROUTE_KEYS = [
  'name',
  'parent',
  'url',
  'params',
  'redirectTo',
  'redirectStatusCode',
  'delegate',
  'response',
] as const satisfies readonly (keyof RouteDeclaration)[];

/** The routes {@link routesFromStates} returns: each state narrowed to its {@link RouteDeclaration} fields. */
export type StateRoutes<S extends readonly RouteDeclaration[]> = {
  readonly [K in keyof S]: Pick<
    S[K],
    Extract<keyof S[K], keyof RouteDeclaration>
  >;
};

// A string or a plain object; a function or TargetState has another prototype.
const DATA_PROTOTYPES: readonly unknown[] = [
  String.prototype,
  Object.prototype,
];

const isDataRedirect = (to: string | RedirectTarget): boolean => {
  const prototype: unknown = Object.getPrototypeOf(to);

  return DATA_PROTOTYPES.includes(prototype);
};

const toRoute = (state: RouteDeclaration): RouteDeclaration => {
  if (!state.name)
    throw new Error('A state declaration for a mount needs a name');

  if (state.redirectTo !== undefined && !isDataRedirect(state.redirectTo))
    throw new Error(
      `State '${state.name}': only a state name or { state, params } redirectTo can be served; a function or TargetState needs the client`,
    );

  if (state.url !== undefined && 'abstract' in state && state.abstract)
    throw new Error(
      `State '${state.name}': an abstract state with a url can't be served; core never matches its url`,
    );

  const route: RouteDeclaration = { name: state.name };

  for (const key of ROUTE_KEYS)
    if (state[key] !== undefined) Object.assign(route, { [key]: state[key] });

  return route;
};

/**
 * A mount's routes from the app's data-only state declarations: each state's
 * {@link RouteDeclaration} fields (`name`, `parent`, `url`, `params`,
 * `redirectTo`, `redirectStatusCode`, `delegate`, `response`), with every
 * other field (`data`, `component`, `resolve`, ...) dropped. Literal names
 * and markers carry through, so an `as const` module still types the router.
 *
 * Throws for a state whose routing a mount would get wrong: a nameless
 * state, a function or `TargetState` `redirectTo`, or an abstract state with
 * a url. `otherwise` and url config stay on the mount; hand the same
 * {@link url-config!RouterUrlConfig | url config} to `applyUrlConfig` on the
 * client.
 *
 * @example
 * ```ts
 * import type { StateDeclaration } from '@uirouter/core';
 * import { routesFromStates } from 'ui-router-server';
 * import type { MountConfig } from 'ui-router-server';
 *
 * // states.ts: data only, imported by the client states and vite.config.ts.
 * const states = [
 *   { name: 'home', url: '/' },
 *   { name: 'item', url: '/items/:id', data: { title: 'Item' } },
 *   { name: 'legacy', url: '/old', redirectTo: 'home' },
 *   { name: 'notFound' },
 * ] as const satisfies readonly StateDeclaration[];
 *
 * const mounts = {
 *   '/': { routes: routesFromStates(states), otherwise: { state: 'notFound' } },
 * } satisfies Record<string, MountConfig>;
 * ```
 */
export function routesFromStates<const S extends readonly RouteDeclaration[]>(
  states: S,
): StateRoutes<S> {
  // SAFETY: toRoute copies each state's RouteDeclaration fields, in order.
  return states.map(toRoute) as StateRoutes<S>;
}
