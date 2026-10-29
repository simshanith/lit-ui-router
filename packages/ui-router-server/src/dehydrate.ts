import { isString } from '@uirouter/core';
import type { Transition } from '@uirouter/core';

import { isJsonValue, isNowait, urlParams } from './resolve-payload.ts';
import type { JsonValue, ResolvePayload } from './resolve-payload.ts';

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
 * @param transition - a transition that has landed
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
 */
export const dehydrate = (transition: Transition): DehydrateResult => {
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
