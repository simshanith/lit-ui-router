/**
 * The client side of server-side rendering, for any renderer: seeding a
 * client router's boot transition with the resolved values a server render
 * drew through `dehydrate` from `ui-router-server/ssr`.
 *
 * It imports `@uirouter/core` eagerly and nothing else, so a browser bundle
 * can take it.
 */

import { Resolvable } from '@uirouter/core';
import type { Transition, UIRouter } from '@uirouter/core';

import { drawnFor, isNowait, urlParams } from './resolve-payload.ts';
import type { ResolvePayload } from './resolve-payload.ts';

export type { JsonValue, ResolvePayload } from './resolve-payload.ts';

/**
 * Seeds `router` with a resolve payload, so the transition it was drawn for
 * adopts the payload's values in place of running their resolve functions.
 *
 * Call it before the router starts. The boot transition is still a real
 * transition, with every hook it would fire; only the resolves change. When
 * its target state and url parameters are the ones the payload was drawn
 * for, each entering state's resolves in the payload are pre-resolved with
 * the payload's values. Every other resolve runs its function as it would
 * without a payload: a resolve the payload does not carry, a `NOWAIT`
 * resolve, every resolve of a transition drawn for another state or other
 * parameters, and every resolve when `payload` is `undefined`. A transition
 * that redirects is checked against the payload again as its successor.
 *
 * The seed disarms itself once a transition succeeds.
 *
 * @param router - the client router, its states registered
 * @param payload - the payload `dehydrate` drew, as parsed from the document, or `undefined` when there is none
 * @returns a function that disarms the seed
 * @throws a `TypeError`, before any hook is registered, when `payload.resolves` or a state's entry in it is `null` or missing
 *
 * @example
 * ```ts
 * import { seed } from 'ui-router-server/ssr/client';
 *
 * seed(router, payload);
 * router.start();
 * ```
 */
export const seed = (
  router: UIRouter,
  payload: ResolvePayload | undefined,
): (() => void) => {
  if (payload === undefined) return () => {};

  const values = new Map(
    Object.entries(payload.resolves).map(([state, tokens]) => [
      state,
      Object.entries(tokens),
    ]),
  );

  const drawn = drawnFor(payload.state, payload.params);
  const { transitionService } = router;

  const adopt = (transition: Transition): void => {
    const to = transition.$to();

    if (drawnFor(to.name, urlParams(to, transition.params())) !== drawn) return;

    for (const { state, resolvables } of transition.treeChanges().entering) {
      for (const [token, value] of values.get(state.name) ?? []) {
        const declared = resolvables.find(
          (resolvable) => resolvable.token === token,
        );

        if (declared === undefined || isNowait(declared, state)) continue;

        transition.addResolvable(
          new Resolvable(token, () => value, [], declared.policy, value),
          state,
        );
      }
    }
  };

  // Ahead of any onBefore hook that reads a resolve, which would start the function.
  // SAFETY: hook registration returns its deregistration function, typed only as `Function`.
  const offBefore = transitionService.onBefore({}, adopt, {
    priority: 1000,
  }) as () => void;

  const disarm = (): void => {
    offBefore();
    offSuccess();
  };

  // SAFETY: hook registration returns its deregistration function, typed only as `Function`.
  const offSuccess = transitionService.onSuccess({}, disarm) as () => void;

  return disarm;
};
