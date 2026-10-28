/** Stand-in for `lit-ui-router` typing `uiSref` itself; drops with that change. */
/* oxlint-disable typescript/no-redundant-type-constituents -- StateName is `string` until an app registers */
import {
  uiSref as untypedUiSref,
  type UiSrefTransitionOptions,
} from 'lit-ui-router';

import type { RelativeRef, StateName, TargetArgs } from 'ui-router-registry';

type UiSrefResult = ReturnType<typeof untypedUiSref>;

/** `uiSref` with registered state names and params. */
export type TypedUiSref = <T extends StateName | RelativeRef>(
  state: T,
  ...args: TargetArgs<T, UiSrefTransitionOptions>
) => UiSrefResult;

export const uiSref: TypedUiSref = untypedUiSref;
