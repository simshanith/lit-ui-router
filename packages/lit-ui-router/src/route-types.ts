/* oxlint-disable typescript/no-redundant-type-constituents, typescript/no-duplicate-type-constituents -- Names and Unchecked are `never` until RouteTypes is filled in; the unions are written for the filled-in case */
import type { RawParams } from '@uirouter/core';

/**
 * Typed state names and params for the sref directives, filled in by module
 * augmentation. Empty, every sref takes any state name and `RawParams`, as it
 * always has; nothing here emits JavaScript.
 *
 * A registry such as `ui-router-registry/lit` fills it in. Its members:
 *
 * - `names`: the registered state names.
 * - `args`: keyed by name, the params tuple a target takes, `[params: P]`
 *   when the state has a required param and `[params?: P]` otherwise.
 * - `relative`: the relative refs (`.child`, `^.sibling`) whose tail ends a
 *   registered name. A relative ref outside it is rejected; its params stay
 *   loose.
 * - `unchecked`: an opt-out type for targets the registry can't see, such as
 *   names built at runtime. It is accepted with loose params.
 *
 * The snapshot packages read two more, keyed by name: `resolved`, the params
 * as read back, and `snapshots`, the route snapshot narrowed to that state.
 *
 * ```ts
 * declare module 'lit-ui-router' {
 *   interface RouteTypes {
 *     names: 'home' | 'users.detail';
 *     args: { home: [params?: {}]; 'users.detail': [params: { userId: string }] };
 *   }
 * }
 * ```
 *
 * @category types
 */
// oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- filled in by module augmentation
export interface RouteTypes {}

type Names = RouteTypes extends { names: infer N extends string } ? N : never;

type Args = RouteTypes extends { args: infer A } ? A : never;

type IsTyped = [Names] extends [never] ? false : true;

type LooseRelative = `.${string}` | `^${string}`;

type Relative = RouteTypes extends { relative: infer R extends string }
  ? R
  : LooseRelative;

type Unchecked = RouteTypes extends { unchecked: infer U extends string }
  ? U
  : never;

/**
 * A state an sref can target: a registered name, a relative ref (`.child`,
 * `^.sibling`) resolved against the enclosing view, or the registry's unchecked
 * opt-out. Any string until {@link RouteTypes} is filled in.
 *
 * @category types
 */
export type SrefTarget = IsTyped extends true
  ? Names | LooseRelative | Unchecked
  : string;

/**
 * Checks a relative target's tail against {@link RouteTypes}' `relative` per
 * call, so {@link SrefTarget} stays a small union. A failing ref reads as this
 * key in the error.
 *
 * @category types
 */
export type SrefRelativeCheck<T> = T extends LooseRelative
  ? T extends Relative
    ? unknown
    : {
        /** The relative refs that would have matched. */
        readonly 'relative ref ends no registered state name': Relative;
      }
  : unknown;

/**
 * The arguments after an sref's target: params are required exactly when the
 * target state has a required param. A relative ref takes `RawParams`.
 *
 * @category types
 */
export type SrefArgs<T, Options> = IsTyped extends true
  ? T extends keyof Args
    ? Args[T] extends infer P extends unknown[]
      ? [...params: P, options?: Options]
      : [params?: RawParams, options?: Options]
    : [params?: RawParams, options?: Options]
  : [params?: RawParams, options?: Options];

/**
 * The params of a target named in an object (`{ state, params }`): the
 * state's params when one registered name is given, `RawParams` otherwise.
 *
 * @category types
 */
export type SrefParams<T> = IsTyped extends true
  ? string extends T
    ? RawParams
    : Names extends T
      ? RawParams
      : T extends keyof Args
        ? Args[T] extends [params?: infer P]
          ? P
          : RawParams
        : RawParams
  : RawParams;
