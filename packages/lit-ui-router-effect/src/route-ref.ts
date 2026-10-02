import { Effect, SubscriptionRef } from 'effect';
import {
  Glob,
  Param,
  RawParams,
  StateDeclaration,
  StateOrName,
  Transition,
  UIRouter,
} from '@uirouter/core';

/**
 * The router's current state, as a value a `SubscriptionRef` can hold.
 *
 * Taken once per successful transition; every field, `includes()` included,
 * answers for that moment. A selector asking during a later transition gets
 * the settled answer, not the in-flight one.
 */
export interface RouteSnapshot {
  /** The current state declaration (`globals.current`). */
  readonly current: StateDeclaration | undefined;

  /** The current parameter values (`globals.params`), replaced per transition. */
  readonly params: RawParams;

  /** The transition that produced this snapshot; `undefined` before the first. */
  readonly transition: Transition | undefined;

  /**
   * `StateService.includes` evaluated against this snapshot: is the state (or
   * glob pattern, e.g. `'admin.**'`) included in the snapshot's active state,
   * with these parameter values?
   */
  includes(stateOrName: StateOrName, params?: RawParams): boolean;
}

const routeRefs = new WeakMap<
  UIRouter,
  SubscriptionRef.SubscriptionRef<RouteSnapshot>
>();

/** The snapshot of a router right now; `StateService.includes` minus the live reads. */
export function snapshotRoute(
  router: UIRouter,
  transition:
    | Transition
    | undefined = router.globals.successfulTransitions.peekTail(),
): RouteSnapshot {
  const { $current, current } = router.globals;
  // eslint-disable-next-line typescript/no-misused-spread -- snapshot StateParams' own props as a fresh plain object per transition
  const params: RawParams = { ...router.globals.params };
  const { matcher } = router.stateRegistry;
  return {
    current,
    params,
    transition,
    includes(stateOrName, values) {
      let target = stateOrName;
      if (typeof stateOrName === 'string' && Glob.is(stateOrName)) {
        if (!Glob.fromString(stateOrName).matches($current.name)) return false;
        target = $current.name;
      }
      const state = matcher.find(target, $current) as
        | ReturnType<typeof matcher.find>
        | undefined;
      if (!state || !$current.includes[state.name]) return false;
      if (!values) return true;
      const schema = state.parameters({ inherit: true, matchingKeys: values });
      return Param.equals(schema, Param.values(schema, params), values);
    },
  };
}

/**
 * The route ref for a router — one per router instance, attached lazily.
 *
 * No plugin and no router-configuration wiring: the first caller creates the
 * ref and registers the single `onSuccess` hook that feeds it, and both live
 * as long as the router does. `onSuccess` is the only hook a later transition
 * cannot supersede, so every value the ref ever holds is a settled route.
 */
export function routeRef(
  router: UIRouter,
): SubscriptionRef.SubscriptionRef<RouteSnapshot> {
  const existing = routeRefs.get(router);
  if (existing) return existing;
  const ref = Effect.runSync(SubscriptionRef.make(snapshotRoute(router)));
  routeRefs.set(router, ref);
  router.transitionService.onSuccess({}, (transition) => {
    Effect.runSync(SubscriptionRef.set(ref, snapshotRoute(router, transition)));
  });
  return ref;
}
