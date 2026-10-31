import { isString } from '@uirouter/core';
import type { PathNode, Transition } from '@uirouter/core';

import { isJsonValue, isNowait, urlParams } from './resolve-payload.ts';
import type {
  JsonValue,
  ResolvePayload,
  Transporter,
} from './resolve-payload.ts';

type Mark = NonNullable<ResolvePayload['transported']>[string][string][number];

type Transport = NonNullable<DehydrateOptions['transport']>;

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
   * Carries values plain JSON data can't, keyed by a name `seed` is given the
   * same transporter under. A value that is neither plain JSON data nor
   * claimed by one, at the top or nested in an array or plain object, lists
   * its resolve in {@link DehydrateResult.unserializable | `unserializable`},
   * and so does an `encode` that throws.
   */
  readonly transport?: Readonly<Record<string, Transporter>>;
}

/** What {@link dehydrate | `dehydrate`} returns. */
export interface DehydrateResult {
  /** The payload to write into the document. */
  readonly payload: ResolvePayload;
  /**
   * The resolves left out of the payload because their value is not plain
   * JSON data and no transporter carries it. Each one re-runs on the client.
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
 * {@link DehydrateOptions.transport | `transport`} carries more. Each value
 * that is not plain JSON data, at the top of a resolve or nested in its
 * arrays and plain objects, is offered to each transporter in key order, and
 * the first encoding other than `false`, `null` or `undefined` goes in. The
 * payload lists where each one sits in
 * {@link ResolvePayload.transported | `transported`}, apart from the values,
 * so no value of the app's own can pass for one.
 *
 * A `NOWAIT` resolve stays with the client: it is neither awaited nor drawn,
 * nor listed, and the client runs it as it would without a payload.
 *
 * {@link DehydrateOptions.shouldDehydrate | `shouldDehydrate`} keeps a resolve
 * out by choice, such as data every page shares that the client loads once
 * from a cacheable file. It runs before any transporter, so a resolve it keeps
 * out is not listed in `unserializable`; the client re-runs it on boot.
 *
 * @param transition - a transition that has landed
 * @param options - which resolves the payload carries, and how it carries values beyond plain JSON
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
 * Carry a `Date`, and pass the same transport to `seed` on the client:
 * ```ts
 * import { dehydrate, settle, type Transporter } from 'ui-router-server/ssr';
 *
 * export const transport = {
 *   Date: {
 *     encode: (value) => value instanceof Date && value.toISOString(),
 *     decode: (encoded) => new Date(encoded as string),
 *   } satisfies Transporter<Date>,
 * };
 *
 * const { payload } = dehydrate(await settle(router, path), { transport });
 * ```
 */
export const dehydrate = (
  transition: Transition,
  { shouldDehydrate, transport = {} }: DehydrateOptions = {},
): DehydrateResult => {
  const resolves: Record<string, Record<string, JsonValue>> = {};
  const transported: Record<string, Record<string, Mark[]>> = {};
  const unserializable: { state: string; token: string }[] = [];

  for (const node of transition.treeChanges().to) {
    const name = node.state.name;
    const drawn = drawState(node, shouldDehydrate, transport);

    if (Object.keys(drawn.values).length > 0) resolves[name] = drawn.values;

    if (Object.keys(drawn.marked).length > 0) transported[name] = drawn.marked;

    for (const token of drawn.unserializable)
      unserializable.push({ state: name, token });
  }

  const to = transition.$to();

  const drawn: ResolvePayload = {
    state: to.name,
    params: urlParams(to, transition.params()),
    resolves,
  };

  return {
    payload:
      Object.keys(transported).length > 0 ? { ...drawn, transported } : drawn,
    unserializable,
  };
};

const drawState = (
  { state, resolvables }: PathNode,
  shouldDehydrate: DehydrateOptions['shouldDehydrate'],
  transport: Transport,
) => {
  const declared = new Set<unknown>();
  const values: Record<string, JsonValue> = {};
  const marked: Record<string, Mark[]> = {};
  const unserializable: string[] = [];

  for (const own of state.resolvables) declared.add(own.token);

  for (const resolvable of resolvables) {
    const token: unknown = resolvable.token;
    const data: unknown = resolvable.data;

    if (!isString(token) || !declared.has(token) || !resolvable.resolved)
      continue;

    if (isNowait(resolvable, state)) continue;

    if (shouldDehydrate?.({ state: state.name, token, value: data }) === false)
      continue;

    const marks: Mark[] = [];

    try {
      values[token] = encode(data, transport, [], marks, new Set());
    } catch {
      unserializable.push(token);
      continue;
    }

    if (marks.length > 0) marked[token] = marks;
  }

  return { values, marked, unserializable };
};

const isJsonPrimitive = (value: unknown): value is JsonValue =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' &&
    Number.isFinite(value) &&
    !Object.is(value, -0));

// Throws for a value neither plain JSON data nor carried, so its resolve is listed.
const encode = (
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- a resolved value, which core types any
  value: unknown,
  transport: Transport,
  path: readonly (string | number)[],
  marks: Mark[],
  ancestors: ReadonlySet<unknown>,
): JsonValue => {
  if (isJsonPrimitive(value)) return value;

  if (ancestors.has(value)) throw new TypeError('the value has a cycle');

  const within = new Set(ancestors).add(value);

  if (Array.isArray(value))
    return Array.from(value, (item, index) =>
      encode(item, transport, [...path, index], marks, within),
    );

  const prototype: unknown =
    value === undefined ? undefined : Object.getPrototypeOf(value);

  if (prototype === Object.prototype || prototype === null)
    return Object.fromEntries(
      // SAFETY: a value whose prototype is Object.prototype or null is an object.
      Object.entries(value as object).map(([key, member]) => [
        key,
        encode(member, transport, [...path, key], marks, within),
      ]),
    );

  return claim(value, transport, path, marks);
};

const claim = (
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- a resolved value, which core types any
  value: unknown,
  transport: Transport,
  path: readonly (string | number)[],
  marks: Mark[],
): JsonValue => {
  for (const [type, transporter] of Object.entries(transport)) {
    const encoded = transporter.encode(value);

    if (encoded === false || encoded == null) continue;

    if (!isJsonValue(encoded))
      throw new TypeError(
        `the ${type} transporter's encoding is not plain JSON data`,
      );

    marks.push({ type, path });

    return encoded;
  }

  throw new TypeError(
    'the value is not plain JSON data, and no transporter carries it',
  );
};
