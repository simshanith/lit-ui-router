/** Stand-in for `lit-ui-router` typing `uiSref` itself; drops with that change. */
/* oxlint-disable typescript/no-redundant-type-constituents -- StateName is `string` until an app registers */
import type { TransitionOptions } from '@uirouter/core';
import {
  srefHref as untypedSrefHref,
  uiSref as untypedUiSref,
  type UiSrefTransitionOptions,
} from 'lit-ui-router';

import type { RelativeRef, StateName, TargetArgs } from 'ui-router-registry';

type UiSrefResult = ReturnType<typeof untypedUiSref>;

type SrefHrefResult = ReturnType<typeof untypedSrefHref>;

/** `uiSref` with registered state names and params. */
export type TypedUiSref = <T extends StateName | RelativeRef>(
  state: T,
  ...args: TargetArgs<T, UiSrefTransitionOptions>
) => UiSrefResult;

/** `srefHref` with registered state names and params. */
export type TypedSrefHref = <T extends StateName | RelativeRef>(
  state: T,
  ...args: TargetArgs<T, TransitionOptions>
) => SrefHrefResult;

export const uiSref: TypedUiSref = untypedUiSref;

export const srefHref: TypedSrefHref = untypedSrefHref;
