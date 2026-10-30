import { isString } from '@uirouter/core';
import type { Transition } from '@uirouter/core';

import { isJsonValue, isNowait, urlParams } from './resolve-payload.ts';
import type { JsonValue, ResolvePayload } from './resolve-payload.ts';

/**
 * A resolve {@link dehydrate | `dehydrate`} would draw, as
 * {@link DehydrateOptions.shouldDehydrate | `shouldDehydrate`} sees it.
 */
export interface DehydrateCandidate {
  /** The name of the state that declares the resolve. */
  readonly state: string;
  /** The resolve's token. */
  readonly token: string;
  /** The value the server resolved, not yet checked for plain JSON data. */
  readonly value: unknown;
}

/** Options for {@link dehydrate | `dehydrate`}. */
export interface DehydrateOptions {
  /**
   * Decides which resolves the payload carries. It is called once for each
   * resolve `dehydrate` would otherwise draw: declared by its state with a
   * string token, resolved, and not `NOWAIT`. Returning `false` keeps the
   * resolve out of the payload, unlisted, and the client re-runs it on boot
   * as it would without a payload. Without it, every such resolve is drawn.
   */
  readonly shouldDehydrate?: (candidate: DehydrateCandidate) => boolean;
}

/** What {@link dehydrate | `dehydrate`} returns. */
export interface DehydrateResult {
  /** The payload to write into the document. */
  readonly payload: ResolvePayload;
  /**
   * The resolves left out of the payload because their value is not plain
   * JSON data. Each one re-runs on the client.
   */
  readonly unserializable: readonly {
    /** The name of the state that declares the resolve. */
    readonly state: string;
    /** The resolve's token. */
    readonly token: string;
  }[];
}

/**
 * Draws the resolve payload from a transition that has landed, such as the
 * one {@link settle | `settle`} hands back: every resolved value of every state
 * on its path, keyed by state name and token, and the state and url
 * parameters it was drawn for.
 *
 * Only the resolves a state declares with a string token are drawn. A value
 * goes in when it is {@link JsonValue | plain JSON data}: `null`, a boolean, a
 * string, a finite number, or an array or plain object of those, with no
 * cycle. Anything else (a `Date`, a `Map`, a class instance, `undefined`,
 * `NaN`) is listed in
 * {@link DehydrateResult.unserializable | `unserializable`} instead and
 * re-runs on the client, so an adopted value never differs from the one the
 * server resolved.
 *
 * A `NOWAIT` resolve stays with the client: it is neither awaited nor drawn,
 * nor listed, and the client runs it as it would without a payload.
 *
 * {@link DehydrateOptions.shouldDehydrate | `shouldDehydrate`} keeps a resolve
 * out by choice, such as data every page shares that the client loads once
 * from a cacheable file. It runs before the JSON check, so a resolve it keeps
 * out is not listed in `unserializable`; the client re-runs it on boot.
 *
 * @param transition - a transition that has landed
 * @param options - which resolves the payload carries
 * @returns the payload, and the resolves left out of it
 *
 * @example
 * ```ts
 * import { dehydrate, settle } from 'ui-router-server/ssr';
 *
 * const { payload, unserializable } = dehydrate(await settle(router, path));
 *
 * for (const { state, token } of unserializable)
 *   console.warn(`${path}: ${state}.${token} re-runs on the client`);
 * ```
 *
 * @example
 * Keep the site-wide `manifest` out of every page, so the client loads it
 * once from its own file:
 * ```ts
 * import { dehydrate, settle } from 'ui-router-server/ssr';
 *
 * const { payload } = dehydrate(await settle(router, path), {
 *   shouldDehydrate: ({ token }) => token !== 'manifest',
 * });
 * ```
 */
export const dehydrate = (
  transition: Transition,
  { shouldDehydrate }: DehydrateOptions = {},
): DehydrateResult => {
  const resolves: Record<string, Record<string, JsonValue>> = {};
  const unserializable: { state: string; token: string }[] = [];

  for (const { state, resolvables } of transition.treeChanges().to) {
    const declared = new Set<unknown>();
    const values: Record<string, JsonValue> = {};

    for (const own of state.resolvables) declared.add(own.token);

    for (const resolvable of resolvables) {
      const token: unknown = resolvable.token;
      const data: unknown = resolvable.data;

      if (!isString(token) || !declared.has(token) || !resolvable.resolved)
        continue;

      if (isNowait(resolvable, state)) continue;

      if (
        shouldDehydrate?.({ state: state.name, token, value: data }) === false
      )
        continue;

      if (isJsonValue(data)) values[token] = data;
      else unserializable.push({ state: state.name, token });
    }

    if (Object.keys(values).length > 0) resolves[state.name] = values;
  }

  const to = transition.$to();

  return {
    payload: {
      state: to.name,
      params: urlParams(to, transition.params()),
      resolves,
    },
    unserializable,
  };
};
