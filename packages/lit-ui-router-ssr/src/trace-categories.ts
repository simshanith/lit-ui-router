/**
 * Trace categories beyond `@uirouter/core`'s fixed `Category` enum, shaped
 * like a `trace.registerCategory` core could ship.
 */

import { Category, isFunction, isString, trace } from '@uirouter/core';
import type { Trace, UIRouter } from '@uirouter/core';

/** A category name as core's `enable`, `disable` and `enabled` take it. */
type CategoryName = Category | string | number;

/** Core's `Trace`, with the `registerCategory` a later core may ship. */
type CoreTrace = Trace & { registerCategory?: (name: string) => void };

/** The registered names of one underlying `Trace`, and which are on. */
interface Registry {
  readonly names: Set<string>;
  readonly enabled: Set<string>;
}

// Keyed by the underlying trace, so every router sharing core's singleton agrees.
const registries = new WeakMap<Trace, Registry>();

// Each wrapper, to the trace it wraps.
const wrapped = new WeakMap<Trace, Trace>();

const registryOf = (original: Trace): Registry => {
  const known = registries.get(original);

  if (known) return known;

  const created: Registry = { names: new Set(), enabled: new Set() };

  registries.set(original, created);

  return created;
};

// Splits `categories` into registered names and the ones core handles.
const partition = (
  { names }: Registry,
  categories: readonly CategoryName[],
): [string[], CategoryName[]] => {
  const own: string[] = [];
  const core: CategoryName[] = [];

  for (const category of categories)
    if (isString(category) && names.has(category)) own.push(category);
    else core.push(category);

  return [own, core];
};

const wrap = (original: Trace, registry: Registry): Trace => {
  // Every name, or only the ones core handles: core's no-argument call turns on all of its own.
  const set = (on: boolean, categories: CategoryName[]): void => {
    const [own, core] = partition(registry, categories);
    const names = categories.length === 0 ? [...registry.names] : own;

    for (const name of names)
      if (on) registry.enabled.add(name);
      else registry.enabled.delete(name);

    if (categories.length === 0 || core.length > 0)
      if (on) original.enable(...core);
      else original.disable(...core);
  };

  // SAFETY: an Object.create of a Trace inherits every member; the three overrides keep core's signatures.
  const wrapper = Object.create(original, {
    enable: { value: (...categories: CategoryName[]) => set(true, categories) },
    disable: {
      value: (...categories: CategoryName[]) => set(false, categories),
    },
    enabled: {
      value: (category: CategoryName): boolean =>
        isString(category) && registry.names.has(category)
          ? registry.enabled.has(category)
          : original.enabled(category),
    },
  }) as Trace;

  wrapped.set(wrapper, original);

  return wrapper;
};

/**
 * Registers a trace category beyond core's fixed set, so
 * `router.trace.enable(name)`, `disable(name)` and `enabled(name)` switch it
 * alone, and a no-argument `enable()` or `disable()` covers it too.
 *
 * Core normalizes every category name through its `Category` enum, so on its
 * own an unknown name lands on one shared `undefined` key, and enabling any
 * unknown name reads every other as enabled. This installs, once per router,
 * a wrapper over `router.trace` that answers registered names itself and
 * forwards everything else to core's trace. Core's own code logs through the
 * imported `trace` singleton, which the wrapper leaves untouched. Registered
 * names are kept per underlying trace, so every router registered over core's
 * singleton agrees on them; a router that never registers reads core's trace
 * unwrapped, and core's imported `trace.disable()` leaves registered names on.
 *
 * When `router.trace` has a `registerCategory` of its own, this delegates to
 * it and installs nothing.
 *
 * Register before enabling: call it right after creating the router.
 *
 * @throws an `Error` for one of core's own category names, such as `'TRANSITION'`
 *
 * @param router - the router whose `trace` gains the category
 * @param name - the category's name, such as `'HYDRATION'`
 *
 * @example
 * ```ts
 * import { UIRouterLit } from 'lit-ui-router';
 * import { registerTraceCategory } from 'lit-ui-router-ssr/client';
 *
 * const router = new UIRouterLit();
 * registerTraceCategory(router, 'HYDRATION');
 * router.trace.enable('HYDRATION');
 * ```
 */
export const registerTraceCategory = (router: UIRouter, name: string): void => {
  const current: CoreTrace = router.trace;

  if (isFunction(current.registerCategory)) {
    current.registerCategory(name);

    return;
  }

  if (Object.hasOwn(Category, name))
    throw new Error(
      `registerTraceCategory: '${name}' is one of core's trace categories; enable it by name without registering`,
    );

  const original = wrapped.get(current) ?? current;
  const registry = registryOf(original);

  registry.names.add(name);

  if (!wrapped.has(current)) router.trace = wrap(original, registry);
};

/**
 * Whether a registered category is on for core's `trace` singleton, read
 * without a router.
 *
 * @internal
 */
export const traceCategoryEnabled = (name: string): boolean => {
  const core: CoreTrace = trace;

  if (isFunction(core.registerCategory)) return core.enabled(name);

  return registries.get(trace)?.enabled.has(name) ?? false;
};
