/**
 * @module
 * @mergeModuleWith <project>
 */
import { Glob, Param } from '@uirouter/core';
import type {
  RawParams,
  StateDeclaration,
  StateOrName,
  Transition,
  UIRouter,
} from '@uirouter/core';

/**
 * The router's current state as one immutable value, for reactive stores that
 * hold a route and compare it by identity.
 *
 * Taken once per successful transition; every field, `includes()` included,
 * answers for that moment. A selector asking during a later transition gets
 * the settled answer, not the in-flight one.
 *
 * @category types
 */
export interface RouteSnapshot {
  /** The current state declaration (`globals.current`). */
  readonly current: StateDeclaration | undefined;

  /** The current parameter values (`globals.params`), replaced per transition. */
  readonly params: RawParams;

  /** The transition that produced this snapshot; `undefined` before the first. */
  readonly transition: Transition | undefined;

  /**
   * {@link "@uirouter/core"!StateService.includes | StateService.includes}
   * evaluated against this snapshot: is the state (or glob pattern, e.g.
   * `'admin.**'`) included in the snapshot's active state, with these
   * parameter values?
   */
  includes(stateOrName: StateOrName, params?: RawParams): boolean;
}

/**
 * Takes a {@link RouteSnapshot} of a router right now: `StateService.includes`
 * minus the live reads.
 *
 * Call it from an `onSuccess` hook, passing the hook's transition, to feed a
 * store one settled route per transition.
 *
 * @param router - the router to read
 * @param transition - the transition the snapshot records; defaults to the
 *   router's latest successful transition
 *
 * @example
 * ```ts
 * import { snapshotRoute } from 'lit-ui-router/route-snapshot';
 *
 * router.transitionService.onSuccess({}, (transition) => {
 *   store.set(snapshotRoute(router, transition));
 * });
 * ```
 *
 * @category core
 */
export const snapshotRoute: (
  router: UIRouter,
  transition?: Transition,
) => RouteSnapshot = (
  router: UIRouter,
  transition:
    | Transition
    | undefined = router.globals.successfulTransitions.peekTail(),
): RouteSnapshot => {
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
};
