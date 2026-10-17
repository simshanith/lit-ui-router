/**
 * Spike for #1306: what `lit-ui-router` would declare once its public
 * signatures read the registry. Each export here re-types an existing value
 * without a cast: the typed signature only narrows what callers may pass, so
 * the untyped value is assignable to it. In the package these would be
 * signature changes on the existing exports, not new values.
 */
/* oxlint-disable typescript/no-redundant-type-constituents -- StateName is `string` until an app registers */
import {
  uiSref as untypedUiSref,
  type UiSrefTransitionOptions,
} from 'lit-ui-router';

import type { RelativeRef, StateName, TargetArgs } from './registry.js';

type UiSrefResult = ReturnType<typeof untypedUiSref>;

/** `uiSref` with registered state names and params. */
export type TypedUiSref = <T extends StateName | RelativeRef>(
  state: T,
  ...args: TargetArgs<T, UiSrefTransitionOptions>
) => UiSrefResult;

export const uiSref: TypedUiSref = untypedUiSref;
