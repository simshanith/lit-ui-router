// The house events `<ui-router>` and `<ui-view>` seek each other with.
import type { ViewContext } from '@uirouter/core';

import type { UIRouterLit } from './core.js';

/** @internal */
export const uiRouterContextEventName = 'ui-router-context';

/** @internal */
export const uiViewContextEventName = 'ui-view-context';

interface UiRouterContextEventDetail {
  uiRouter?: UIRouterLit;
}

/**
 * @internal
 */
export type UiRouterContextEvent = CustomEvent<UiRouterContextEventDetail>;

/**
 * What a nested `<ui-view>` reads off the view that answers its seek.
 *
 * @internal
 */
export interface ParentView {
  readonly fqn: string | undefined;
  readonly viewContext: ViewContext | undefined;
}

interface UiViewContextEventDetail {
  parentView: ParentView | null;
}

/**
 * @internal
 */
export type UiViewContextEvent = CustomEvent<UiViewContextEventDetail>;
