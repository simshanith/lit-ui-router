/** Stand-in for `lit-ui-router-signals` reading the registry; drops once that package types its selector. */
import type { ReactiveControllerHost } from 'lit';
import type { Signal } from 'signal-polyfill';
import {
  RouterSignalController,
  type RouterSignalControllerOptions,
} from 'lit-ui-router-signals';
import type { TypedRouteSnapshot } from 'ui-router-registry';

type RouterSignals = Parameters<
  ConstructorParameters<typeof RouterSignalController>[1]
>[0];

/**
 * `RouterSignals` whose `route` is the registry's snapshot. The per-field
 * signals stay loose: `params` alone can't be narrowed by `current` alone.
 */
export interface TypedRouterSignals extends Omit<RouterSignals, 'route'> {
  readonly route: Signal.Computed<TypedRouteSnapshot>;
}

/** `RouterSignalController` whose selector reads {@link TypedRouterSignals}. */
export interface TypedRouterSignalControllerConstructor {
  new <T>(
    host: ReactiveControllerHost & Element,
    selector: (route: TypedRouterSignals) => T,
    options?: RouterSignalControllerOptions<T>,
  ): RouterSignalController<T>;
}

// SAFETY: the same class; the registry only narrows the snapshot the selector
// reads, and `includes` gains a type predicate the untyped class doesn't declare
export const TypedRouterSignalController =
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- stand-in for the package declaring the narrower signature itself
  RouterSignalController as unknown as TypedRouterSignalControllerConstructor;
