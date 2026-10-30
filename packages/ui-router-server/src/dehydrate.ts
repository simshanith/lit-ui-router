import { isString } from '@uirouter/core';
import type { Transition } from '@uirouter/core';

import { isNowait, jsonCodec, urlParams } from './resolve-payload.ts';
import type {
  JsonValue,
  ResolveCodec,
  ResolvePayload,
} from './resolve-payload.ts';

/**
 * A resolve {@link dehydrate | `dehydrate`} would draw, as
 * {@link DehydrateOptions.shouldDehydrate | `shouldDehydrate`} sees it.
 */
export interface DehydrateCandidate {
  /** The name of the state that declares the resolve. */
  readonly state: string;
  /** The resolve's token. */
  readonly token: string;
  /** The value the server resolved, not yet encoded. */
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
  /**
   * Encodes each value the payload carries. A resolve whose value it throws
   * for is listed in {@link DehydrateResult.unserializable | `unserializable`}.
   * Defaults to {@link jsonCodec | `jsonCodec`}; `seed` takes the same codec.
   */
  readonly codec?: ResolveCodec;
}

/** What {@link dehydrate | `dehydrate`} returns. */
export interface DehydrateResult {
  /** The payload to write into the document. */
  readonly payload: ResolvePayload;
  /**
   * The resolves left out of the payload because the codec can't encode
   * their value. Each one re-runs on the client.
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
 * Only the resolves a state declares with a string token are drawn. Each
 * value goes in as {@link DehydrateOptions.codec | `codec`} encodes it. The
 * default, {@link jsonCodec | `jsonCodec`}, carries a value when it is
 * {@link JsonValue | plain JSON data}: `null`, a boolean, a string, a finite
 * number, or an array or plain object of those, with no cycle. Anything else
 * (a `Date`, a `Map`, a class instance, `undefined`, `NaN`) is listed in
 * {@link DehydrateResult.unserializable | `unserializable`} instead and
 * re-runs on the client, so an adopted value never differs from the one the
 * server resolved. A codec of the app's own carries more, such as a `Date`;
 * the payload records its name, and `seed` decodes with the same codec.
 *
 * A `NOWAIT` resolve stays with the client: it is neither awaited nor drawn,
 * nor listed, and the client runs it as it would without a payload.
 *
 * {@link DehydrateOptions.shouldDehydrate | `shouldDehydrate`} keeps a resolve
 * out by choice, such as data every page shares that the client loads once
 * from a cacheable file. It runs before the codec, so a resolve it keeps
 * out is not listed in `unserializable`; the client re-runs it on boot.
 *
 * @param transition - a transition that has landed
 * @param options - which resolves the payload carries, and how it encodes them
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
 *
 * @example
 * Carry the values devalue can, such as a `Date` or a `Map`, and pass the same
 * codec to `seed` on the client:
 * ```ts
 * import { parse, stringify } from 'devalue';
 * import { dehydrate, settle, type ResolveCodec } from 'ui-router-server/ssr';
 *
 * export const codec: ResolveCodec = {
 *   name: 'devalue',
 *   encode: (value) => stringify(value),
 *   decode: (value) => parse(value as string),
 * };
 *
 * const { payload } = dehydrate(await settle(router, path), { codec });
 * ```
 */
export const dehydrate = (
  transition: Transition,
  { shouldDehydrate, codec = jsonCodec }: DehydrateOptions = {},
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

      try {
        values[token] = codec.encode(data);
      } catch {
        unserializable.push({ state: state.name, token });
      }
    }

    if (Object.keys(values).length > 0) resolves[state.name] = values;
  }

  const to = transition.$to();

  const drawn: ResolvePayload = {
    state: to.name,
    params: urlParams(to, transition.params()),
    resolves,
  };

  return {
    payload:
      codec.name === jsonCodec.name ? drawn : { ...drawn, codec: codec.name },
    unserializable,
  };
};
