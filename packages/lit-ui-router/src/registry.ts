/* oxlint-disable typescript/no-redundant-type-constituents -- R.StateName is `string` until an app registers; the unions are written for the registered case */
import type { RawParams } from '@uirouter/core';

// The only module that names ui-router-registry: an optional peer, read for types alone.
/** @ts-ignore optional peer: absent means untyped routes */
import type * as R from 'ui-router-registry';

// An unresolved import types R.Register as `any`; `IsAny` collapses to `any` there on TypeScript 5.5+.
type Absent = unknown extends R.Register ? true : false;

// Untyped until an app registers, so every sref keeps `string` and `RawParams`.
type Untyped = Absent extends true
  ? true
  : string extends R.StateName
    ? true
    : false;

type LooseRelative = `.${string}` | `^${string}`;

/**
 * A state an sref can target: a registered name, a relative ref (`.child`,
 * `^.sibling`) resolved against the enclosing view, or the registry's
 * `UncheckedRef` opt-out. Any `string` until an app augments
 * `ui-router-registry`'s `Register`.
 *
 * @category types
 */
export type SrefTarget = Untyped extends true
  ? string
  : R.StateName | LooseRelative | R.UncheckedRef;

/**
 * Checks a relative target's tail per call against the registered names, so
 * {@link SrefTarget} stays a small union. A failing ref reads as this key in
 * the error.
 *
 * @category types
 */
export type SrefRelativeCheck<T> = Untyped extends true
  ? unknown
  : T extends LooseRelative
    ? T extends R.RelativeRef
      ? unknown
      : {
          /** The relative refs that would have matched. */
          readonly 'relative ref ends no registered state name': R.RelativeRef;
        }
    : unknown;

/**
 * The arguments after an sref's target: params are required exactly when the
 * target state has a required param. A relative ref or an `UncheckedRef`
 * takes `RawParams`.
 *
 * @category types
 */
export type SrefArgs<T, Options> = Untyped extends true
  ? [params?: RawParams, options?: Options]
  : R.TargetArgs<T, Options>;

/**
 * The params of a target named in an object (`{ state, params }`): the
 * state's params when one registered name is given, `RawParams` otherwise.
 *
 * @category types
 */
export type SrefParams<T> = Untyped extends true
  ? RawParams
  : string extends T
    ? RawParams
    : R.StateName extends T
      ? RawParams
      : T extends R.StateName
        ? R.ParamsOf<T>
        : RawParams;
