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

import { warnUntransported } from './dev-warn.ts';
import { drawnFor, isNowait, urlParams } from './resolve-payload.ts';
import type {
  JsonValue,
  ResolvePayload,
  Transporter,
} from './resolve-payload.ts';

export type {
  JsonValue,
  ResolvePayload,
  Transporter,
} from './resolve-payload.ts';

/** Options for {@link seed | `seed`}. */
export interface SeedOptions {
  /**
   * Rebuilds the values transporters carried, keyed by the names `dehydrate`
   * was given them under. A resolve whose value needs a transporter it lacks,
   * or one whose `decode` throws, runs its function instead.
   */
  readonly transport?: Readonly<Record<string, Transporter>>;
}

type Mark = NonNullable<ResolvePayload['transported']>[string][string][number];

type Transport = NonNullable<SeedOptions['transport']>;

type Revived =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly type: string; readonly reason: string };

// Copies the arrays and plain objects around each marked value, so the parsed payload stays as it was.
const rebuild = (
  encoded: JsonValue,
  path: readonly (string | number)[],
  // oxlint-disable-next-line anti-slop/no-unknown-returns -- a transporter's decoded value, which core's injector reads untyped
  decode: (path: readonly (string | number)[], encoded: JsonValue) => unknown,
  marked: ReadonlySet<string>,
  // oxlint-disable-next-line anti-slop/no-unknown-returns -- the value a resolve adopts, which core's injector reads untyped
): unknown => {
  if (marked.has(JSON.stringify(path))) return decode(path, encoded);

  if (!(encoded instanceof Object)) return encoded;

  if (Array.isArray(encoded))
    return encoded.map((item: JsonValue, index) =>
      rebuild(item, [...path, index], decode, marked),
    );

  return Object.fromEntries(
    Object.entries(encoded).map(([key, member]) => [
      key,
      rebuild(member, [...path, key], decode, marked),
    ]),
  );
};

const revive = (
  value: JsonValue,
  marks: readonly Mark[],
  transport: Transport,
): Revived => {
  const types = new Map(
    marks.map(({ type, path }) => [JSON.stringify(path), type]),
  );

  for (const type of types.values())
    if (!Object.hasOwn(transport, type))
      return {
        ok: false,
        type,
        reason: 'seed was given no transporter by that name',
      };

  let decoding = '';

  try {
    return {
      ok: true,
      value:
        types.size === 0
          ? value
          : rebuild(
              value,
              [],
              (path, encoded) => {
                decoding = types.get(JSON.stringify(path)) ?? '';

                return transport[decoding]?.decode(encoded);
              },
              new Set(types.keys()),
            ),
    };
  } catch {
    return { ok: false, type: decoding, reason: 'its decode threw' };
  }
};

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
 * A value a transporter carried is rebuilt by the transporter of the same name
 * in {@link SeedOptions.transport | `transport`} before it is adopted. When
 * that transporter is missing, or its `decode` throws, only that resolve runs
 * its function, and in development `seed` warns.
 *
 * The seed disarms itself once a transition succeeds.
 *
 * @param router - the client router, its states registered
 * @param payload - the payload `dehydrate` drew, as parsed from the document, or `undefined` when there is none
 * @param options - the transporters that rebuild values beyond plain JSON
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
  { transport = {} }: SeedOptions = {},
): (() => void) => {
  if (payload === undefined) return () => {};

  const values = new Map(
    Object.entries(payload.resolves).map(([state, tokens]) => {
      const marked = payload.transported?.[state] ?? {};
      const adoptable: [string, unknown][] = [];

      for (const [token, value] of Object.entries(tokens)) {
        const revived = revive(value, marked[token] ?? [], transport);

        if (revived.ok) adoptable.push([token, revived.value]);
        else warnUntransported(state, token, revived.type, revived.reason);
      }

      return [state, adoptable];
    }),
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
