// oxlint-disable typescript/no-deprecated -- the entry re-exports the deprecated plumbing until 2.0 stops exporting it (#873, #541)
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
  UiOnExit,
  UiOnParamsChanged,
  UIViewInjectedProps,
  UIViewResolves,
} from './interface.js';

export {
  isLitViewDeclarationTemplate,
  isRoutedLitElement,
  LitViewConfig,
  litViewsBuilder,
  UIRouterLit,
} from './core.js';

export {
  type TransitionCallback,
  type TransitionCallbackReason,
  TransitionController,
  type TransitionControllerOptions,
  type TransitionEventType,
} from './transition-controller.js';

export {
  type UiRouterContextEvent,
  UIRouterLitElement,
  type UiViewContextEvent,
} from './ui-router.js';

export { UiView, type UiViewAddress } from './ui-view.js';

export {
  clickBelongsToBrowser,
  inLitDevMode,
  isNativeLink,
  sameTarget,
  srefEventLink,
  srefTransitionOptions,
  UI_SREF_TARGET_EVENT,
  UI_SREF_TARGET_REMOVED_EVENT,
  uiSref,
  UiSrefDirective,
  type UiSrefElement,
  type UiSrefOptions,
  uiSrefTargetEvent,
  type UiSrefTargetEvent,
  uiSrefTargetRemovedEvent,
  type UiSrefTransitionOptions,
} from './ui-sref.js';

export {
  type AriaCurrentValue,
  type AriaCurrentValues,
  mergeSrefStatus,
  type SrefStatus,
  srefStatus,
  type TransEvt,
  TRANSITION_STATE_CHANGE_EVENT,
  TransitionStateChange,
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
