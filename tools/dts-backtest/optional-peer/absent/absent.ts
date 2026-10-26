// Registry not installed, Register not augmented: every sref keeps `string` and `RawParams`, never `any`.
import type { RawParams } from '@uirouter/core';
import {
  srefHref,
  type SrefArgs,
  type SrefParams,
  type SrefTarget,
  uiSref,
  uiSrefActive,
} from 'lit-ui-router';

type IsAny<T> = 0 extends 1 & T ? true : false;

// Mutual assignability, and `any` never counts.
type Equal<A, B> =
  IsAny<A> extends true
    ? false
    : [A] extends [B]
      ? [B] extends [A]
        ? true
        : false
      : false;

export const targetIsString: Equal<SrefTarget, string> = true;

export const argsAreLoose: Equal<
  SrefArgs<'home', object>,
  [params?: RawParams, options?: object]
> = true;

export const paramsAreRaw: Equal<SrefParams<'home'>, RawParams> = true;

declare const name: string;

export const links = [
  uiSref(name, { anything: 1 }, { reload: true }),
  uiSref('.child'),
  srefHref('anywhere', { anything: 1 }),
  uiSrefActive({ state: name, params: { anything: 1 } }),
  // @ts-expect-error a target is still a string
  uiSref(42),
];
