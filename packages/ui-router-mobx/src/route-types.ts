import type { RawParams, StateDeclaration, StateOrName } from '@uirouter/core';

/**
 * Typed store fields, filled in by module augmentation. Empty, the store's
 * `current` is a `StateDeclaration` and its `params` are `RawParams`, and
 * nothing here emits JavaScript.
 *
 * An app or a registry such as `ui-router-registry` fills it in. Its members:
 *
 * - `snapshot`: a route snapshot type whose `current` and `params` type the
 *   store's fields, and whose `includes` parameter types the targets
 *   `RouterStore.includes` takes beside a `snapshots` name.
 * - `snapshots`: keyed by state name, the snapshot narrowed to that state's
 *   subtree. `RouterStore.includes(name)` narrows the store's `current` and
 *   `params` to it.
 *
 * ```ts
 * declare module 'ui-router-mobx' {
 *   interface RouteTypes {
 *     snapshot: AppRouteSnapshot;
 *     snapshots: { 'contacts.contact': ContactSnapshot };
 *   }
 * }
 * ```
 *
 * @category types
 */
// oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- filled in by module augmentation
export interface RouteTypes {}

/**
 * The store's `current` and `params` as {@link RouteTypes} types them: its
 * `snapshot` member's, or `StateDeclaration` and `RawParams` until it is
 * filled in.
 *
 * @category types
 */
export type TypedStoreState = RouteTypes extends {
  /** The filled-in snapshot type. */
  snapshot: infer S extends {
    /** The snapshot's current state. */
    current: unknown;
    /** The snapshot's params. */
    params: unknown;
  };
}
  ? Pick<S, 'current' | 'params'>
  : {
      /** The current state declaration. */
      current: StateDeclaration | undefined;
      /** The current parameter values. */
      params: RawParams;
    };

/**
 * The other targets `RouterStore.includes` takes: the parameter of
 * {@link RouteTypes}' `snapshot.includes`, or any `StateOrName` until it is
 * filled in.
 *
 * @category types
 */
export type TypedStoreTarget = RouteTypes extends {
  /** The filled-in snapshot type. */
  snapshot: {
    /** The snapshot's non-predicate `includes` overload. */
    includes(stateOrName: infer T, params?: RawParams): boolean;
  };
}
  ? T
  : StateOrName;

/**
 * The state names `RouterStore.includes` narrows the store by: the keys
 * of {@link RouteTypes}' `snapshots`, or none until it is filled in.
 *
 * @category types
 */
export type TypedStoreName = RouteTypes extends {
  /** The filled-in snapshots, keyed by state name. */
  snapshots: infer S;
}
  ? keyof S & string
  : never;

/**
 * The store's `current` and `params` narrowed to state `N`'s subtree: its
 * `snapshots` entry, one member per state in the subtree.
 *
 * @category types
 */
export type TypedStoreNarrowing<N extends TypedStoreName> = RouteTypes extends {
  /** The filled-in snapshots, keyed by state name. */
  snapshots: infer M extends Record<N, unknown>;
}
  ? M[N] extends infer S
    ? S extends {
        /** The narrowed current state. */
        current: unknown;
        /** The narrowed params. */
        params: unknown;
      }
      ? Pick<S, 'current' | 'params'>
      : never
    : never
  : never;
