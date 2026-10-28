// The payload contract both ssr entries share; neither entry reaches the other through it.
import { DefType } from '@uirouter/core';
import type { RawParams, Resolvable, StateObject } from '@uirouter/core';

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
 * `dehydrate` from `ui-router-server/ssr` writes them and `seed` from
 * `ui-router-server/ssr/client` adopts them.
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

/**
 * Plain data only: a value JSON would convert (a Date, a Map, NaN, -0) comes back changed.
 *
 * @internal
 */
export function isJsonValue(
  value: unknown,
  ancestors: ReadonlySet<unknown> = new Set(),
): value is JsonValue {
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
}

/** @internal */
export const isNowait = (resolvable: Resolvable, state: StateObject): boolean =>
  resolvable.getPolicy(state).async === 'NOWAIT';

/**
 * The url parameters a payload is drawn for, encoded the way the url spells them.
 *
 * @internal
 */
export const urlParams = (
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

/** @internal */
export const drawnFor = (
  state: string,
  params: ResolvePayload['params'],
): string => JSON.stringify([state, params]);
