import { DefType, isString, Resolvable } from '@uirouter/core';
import type {
  RawParams,
  StateObject,
  Transition,
  UIRouter,
} from '@uirouter/core';

/**
 * Plain JSON data: a value `JSON.stringify` and `JSON.parse` hand back
 * unchanged.
 */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/**
 * The resolved values a server render drew a page with, as
 * {@link dehydrate | `dehydrate`} writes them and {@link seed | `seed`}
 * adopts them.
 */
export interface ResolvePayload {
  /** The name of the state the payload was drawn for. */
  readonly state: string;
  /**
   * That state's url parameter values, keyed by parameter id, each encoded by
   * its type as the url spells it. Config parameters never reach the url, so
   * they stay out, and so does a parameter without a value.
   */
  readonly params: Readonly<Record<string, JsonValue>>;
  /** Resolved values keyed by state name, then by resolve token. */
  readonly resolves: Readonly<
    Record<string, Readonly<Record<string, JsonValue>>>
  >;
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

// Plain data only: a value JSON would convert (a Date, a Map, NaN, -0) comes back changed.
const isJsonValue = (
  value: unknown,
  ancestors: ReadonlySet<unknown> = new Set(),
): value is JsonValue => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true;

  if (typeof value === 'number')
    return Number.isFinite(value) && !Object.is(value, -0);

  if (typeof value !== 'object' || ancestors.has(value)) return false;

  const within = new Set(ancestors).add(value);

  if (Array.isArray(value))
    return Array.from(value).every((item) => isJsonValue(item, within));

  const prototype: unknown = Object.getPrototypeOf(value);

  return (
    (prototype === Object.prototype || prototype === null) &&
    Object.values(value).every((member) => isJsonValue(member, within))
  );
};

const isNowait = (resolvable: Resolvable, state: StateObject): boolean =>
  resolvable.getPolicy(state).async === 'NOWAIT';

// The url parameters a payload is drawn for, encoded the way the url spells them.
const urlParams = (
  state: StateObject,
  params: RawParams,
): ResolvePayload['params'] => {
  const drawn: Record<string, JsonValue> = {};

  for (const param of state.parameters()) {
    if (param.location === DefType.CONFIG) continue;

    const encoded: unknown = param.type.encode(params[param.id]);

    if (isJsonValue(encoded)) drawn[param.id] = encoded;
  }

  return drawn;
};

const drawnFor = (state: string, params: ResolvePayload['params']): string =>
  JSON.stringify([state, params]);

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
 * @param payload - the payload {@link dehydrate | `dehydrate`} drew, as parsed from the document, or `undefined` when there is none
 * @returns a function that disarms the seed
 * @throws a `TypeError`, before any hook is registered, when `payload.resolves` or a state's entry in it is `null` or missing
 *
 * @example
 * ```ts
 * import { seed } from 'ui-router-server/ssr';
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
