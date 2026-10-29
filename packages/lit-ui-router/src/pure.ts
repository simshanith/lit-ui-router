// Side-effect-free entry: the full API without element registration or tag-map globals.
export type {
  DefaultResolvesType,
  LitStateDeclaration,
  LitViewDeclaration,
  LitViewDeclarationElement,
  LitViewDeclarationObject,
  LitViewDeclarationTemplate,
  NormalizedLitViewDeclaration,
  RoutedLitComponent,
  RoutedLitElement,
  RoutedLitTemplate,
  TypedLitStateDeclaration,
  TypedLitViewComponent,
  TypedLitViewDeclaration,
  UiOnExit,
  UiOnParamsChanged,
  UIViewInjectedProps,
  UIViewResolves,
} from './interface.js';

export { isRoutedLitElement, LitViewConfig, UIRouterLit } from './core.js';

export {
  type TransitionCallback,
  type TransitionCallbackReason,
  TransitionController,
  type TransitionControllerOptions,
  type TransitionEventType,
} from './transition-controller.js';

export { UIRouterLitElement } from './ui-router.js';

export { UiView } from './ui-view.js';

export { viewRendered } from './view-rendered.js';

export {
  uiSref,
  UiSrefDirective,
  type UiSrefOptions,
  type UiSrefTransitionOptions,
} from './ui-sref.js';

export {
  type AriaCurrentValue,
  type AriaCurrentValues,
  type SrefStatus,
  uiSrefActive,
  UiSrefActiveDirective,
  type UiSrefActiveParams,
} from './ui-sref-active.js';

export { SrefHrefDirective, srefHref } from './sref-href.js';

export {
  srefActiveClass,
  SrefActiveClassDirective,
  type SrefActiveClassParams,
  srefAriaCurrent,
  SrefAriaCurrentDirective,
  type SrefAriaCurrentParams,
  SrefStatusDirective,
  type SrefTargetParams,
} from './sref-active.js';

export {
  SrefStatusController,
  type SrefStatusControllerOptions,
} from './sref-status-controller.js';

// Deprecated plumbing (#873, #541, #874): 2.0 deletes this block.
/* oxlint-disable typescript/no-deprecated -- the entry re-exports deprecated plumbing until 2.0 */
export { isLitViewDeclarationTemplate, litViewsBuilder } from './core.js';

export {
  type UiRouterContextEvent,
  type UiViewContextEvent,
} from './ui-router.js';

export { type UiViewAddress } from './ui-view.js';

export {
  clickBelongsToBrowser,
  inLitDevMode,
  isNativeLink,
  sameTarget,
  srefEventLink,
  srefTransitionOptions,
  UI_SREF_TARGET_EVENT,
  UI_SREF_TARGET_REMOVED_EVENT,
  type UiSrefElement,
  uiSrefTargetEvent,
  type UiSrefTargetEvent,
  uiSrefTargetRemovedEvent,
} from './ui-sref.js';

export {
  mergeSrefStatus,
  srefStatus,
  type TransEvt,
  TRANSITION_STATE_CHANGE_EVENT,
  TransitionStateChange,
} from './ui-sref-active.js';
/* oxlint-enable typescript/no-deprecated */
