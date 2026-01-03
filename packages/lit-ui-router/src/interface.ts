import {
  Transition,
  HookResult,
  _ViewDeclaration,
  StateDeclaration,
  TypedMap,
  UIRouter,
} from '@uirouter/core';
import { TemplateResult, LitElement } from 'lit';

export interface UiOnParamsChanged {
  /**
   * A UI-Router view has an Lit `Component` (see [[LitViewDeclaration.component]]).
   * The `Component` may define component-level hooks which UI-Router will call at the appropriate times.
   * These callbacks are similar to Transition Hooks ([[IHookRegistry]]), but are only called if the view/component is currently active.
   *
   * The uiOnParamsChanged callback is called when parameter values change.
   *
   * This callback is used to respond dynamic parameter values changing.
   * It is called when a transition changed one or more dynamic parameter values,
   * and the routed component was not destroyed.
   *
   * It receives two parameters:
   *
   * - An object with (only) changed parameter values.
   *   The keys are the parameter names and the values are the new parameter values.
   * - The [[Transition]] which changed the parameter values.
   *
   */
  uiOnParamsChanged(
    newParams: { [paramName: string]: any },
    trans?: Transition,
  ): void;
}

export interface UiOnExit {
  /**
   * A UI-Router view has an Lit `Component` (see [[LitViewDeclaration.component]]).
   * The `Component` may define component-level hooks which UI-Router will call at the appropriate times.
   * These callbacks are similar to Transition Hooks ([[IHookRegistry]]), but are only called if the view/component is currently active.
   *
   * The uiCanExit callback is called when the routed component's state is about to be exited.
   *
   * The callback can be used to cancel or alter the new Transition that would otherwise exit the component's state.
   *
   * This callback is used to inform a view that it is about to be exited, due to a new [[Transition]].
   * The callback can ask for user confirmation, and cancel or alter the new Transition.  The callback should
   * return a value, or a promise for a value.  If a promise is returned, the new Transition waits until the
   * promise settles.
   *
   * Called when:
   * - The component is still active inside a `ui-view`
   * - A new Transition is about to run
   * - The new Transition will exit the view's state
   *
   * Called with:
   * - The `Transition` that is about to exit the component's state
   *
   * @return a hook result which may cancel or alter the pending Transition (see [[HookResult]])
   */
  uiCanExit(newTransition?: Transition): HookResult;
}

export type UIViewResolves = TypedMap<any>;

export interface UIViewInjectedProps {
  transition?: Transition;
  resolves?: UIViewResolves;
  router: UIRouter;
}

export type RoutedLitTemplate =
  | ((props?: UIViewInjectedProps) => TemplateResult)
  | ((props: UIViewInjectedProps) => TemplateResult);
export interface LitViewDeclarationTemplate extends _ViewDeclaration {
  (props?: UIViewInjectedProps): TemplateResult;
}

export interface IRoutedLitElementConstructor {
  new (): IRoutedLitElement;
  sticky?: boolean;
}

export interface IRoutedLitElement extends LitElement {
  _uiViewProps?: UIViewInjectedProps;
}

export type RoutedLitComponent =
  | RoutedLitTemplate
  | IRoutedLitElementConstructor;

export interface LitViewDeclarationElement
  extends IRoutedLitElement,
    _ViewDeclaration {}

export interface LitViewDeclarationObject extends _ViewDeclaration {
  component: RoutedLitComponent;
}

export type LitViewDeclaration =
  | LitViewDeclarationObject
  | LitViewDeclarationElement
  | LitViewDeclarationTemplate;

export interface LitStateDeclaration extends StateDeclaration {
  component?: LitViewDeclaration;
}

export interface NormalizedLitViewDeclaration extends _ViewDeclaration {
  component: RoutedLitTemplate;
}
