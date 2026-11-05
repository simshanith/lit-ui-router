// Must fail with TS2664 at the augmentation alone: RegisteredStates is augmented with the registry not installed,
// and every call still falls back to `string` rather than cascading into more errors. Keyed by hand: a
// `StatesOf` import would add TS2307 at the import line.
import type { RawParams } from '@uirouter/core';
import {
  srefHref,
  type SrefArgs,
  type SrefTarget,
  uiSref,
} from 'lit-ui-router';

const home = { name: 'home', url: '/home' } as const;

const item = { name: 'item', url: '/item/:id' } as const;

declare module 'ui-router-registry' {
  interface RegisteredStates {
    home: typeof home;
    item: typeof item;
  }
}

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
  SrefArgs<'item', object>,
  [params?: RawParams, options?: object]
> = true;

export const links = [
  uiSref('itme'),
  uiSref('item'),
  srefHref('anywhere', { anything: 1 }),
];
