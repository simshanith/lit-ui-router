import {
  extend,
  RawParams,
  TransitionOptions,
  isNumber,
  TargetState,
} from '@uirouter/core';
import { noChange, ElementPart } from 'lit';
import { directive, PartInfo, PartType } from 'lit/directive.js';
import { AsyncDirective } from 'lit/async-directive.js';

import { UIRouterLit } from './core.js';
import { UIRouterLitElement } from './ui-router.js';
import { UiView } from './ui-view.js';

/**
 * Event name dispatched when a uiSref target state changes.
 * @internal
 */
export const UI_SREF_TARGET_EVENT = 'uiSrefTarget';

/**
 * Interface for elements that have been enhanced with uiSref.
 * @internal
 */
export interface UiSrefElement extends Element {
  /** The href attribute value for the link */
  href: string;
  /** The target state for the link */
  targetState: TargetState;
}

/**
 * Custom event dispatched when a uiSref target state changes.
 * Used internally by uiSrefActive to track which states are being linked to.
 * @internal
 */
export interface UiSrefTargetEvent
  extends CustomEvent<{ targetState: TargetState }> {
  target: UiSrefElement;
}

/**
 * Create a uiSrefTarget event with the given target state.
 * @param targetState - The target state for the event
 * @returns A custom event with the target state in the detail
 * @internal
 */
export function uiSrefTargetEvent(targetState: TargetState): UiSrefTargetEvent {
  return new CustomEvent(UI_SREF_TARGET_EVENT, {
    bubbles: true,
    composed: true,
    detail: { targetState },
  }) as UiSrefTargetEvent;
}

/**
 * Directive class that creates state-based navigation links.
 *
 * This directive is used internally by the {@link uiSref} directive function.
 * It transforms elements (typically `<a>` tags) into UI-Router navigation links
 * by setting the `href` attribute and handling click events.
 *
 * @see {@link uiSref} for the public API
 * @see {@link https://ui-router.github.io/core/docs/latest/classes/_state_stateservice_.stateservice.html | StateService.go()}
 *
 * @category Directives
 */
export class UiSrefDirective extends AsyncDirective {
  state: string | null = null;
  params: RawParams = {};
  options: TransitionOptions = {};

  element: UiSrefElement | null = null;

  uiRouter: UIRouterLit | undefined;
  parentView: UiView | null = null;

  href: string | null = null;
  targetState: TargetState | null = null;

  unsubscribe: (() => void) | undefined;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error('The `uiSref` directive must be used as an element');
    }
  }

  getOptions(opts: TransitionOptions = this.options): TransitionOptions {
    const defaultOpts: TransitionOptions = {
      relative: this.parentView?.viewContext?.name,
      inherit: true,
      source: 'sref',
    };
    return extend(defaultOpts, opts || {});
  }

  render(state: string, params?: RawParams, options?: TransitionOptions) {
    if (!this.element) {
      return noChange;
    }

    const { uiRouter: router } = this;
    const $state = router?.stateService;
    if (!$state) {
      return noChange;
    }

    this.element.targetState = this.targetState = $state.target(
      state,
      params,
      this.getOptions(options),
    );

    this.href = $state.href(state, params, this.getOptions(options));

    if (this.href === this.element.getAttribute('href')) {
      return noChange;
    }

    if (this.href) {
      this.element.setAttribute('href', this.href);
    } else {
      this.element.removeAttribute('href');
    }

    this.element.dispatchEvent(uiSrefTargetEvent(this.targetState));
    return noChange;
  }

  seekRouter() {
    this.uiRouter = UIRouterLitElement.seekRouter(this.element!);
  }

  seekParentView() {
    this.parentView = UiView.seekParentView(this.element!);
  }

  disconnected() {
    this.element?.removeEventListener('click', this.onClick as EventListener);
    this.element = null;
    this.targetState = null;
    this.href = null;
    this.unsubscribe?.();
  }

  onClick = (event: MouseEvent) => {
    const { uiRouter: router, state, params } = this;
    const options = this.getOptions();
    const $state = router?.stateService;
    if (!$state || !this.element?.isConnected) {
      return;
    }
    const { button, ctrlKey, metaKey, target } = event;
    const openInNewTab =
      (target as Element).getAttribute('target') === '_blank';
    const isExternal = (target as Element).getAttribute('rel') === 'external';
    if (
      openInNewTab ||
      isExternal ||
      button ||
      !isNumber(button) ||
      ctrlKey ||
      metaKey ||
      !state
    ) {
      return;
    }
    $state.go(state, params, options);
    event.preventDefault();
  };

  update(
    part: ElementPart,
    [state, params = {}, options = {}]: [string, RawParams, TransitionOptions],
  ) {
    this.state = state;
    this.params = params;
    this.options = options;
    const uiSrefElement = part.element as unknown as UiSrefElement;
    if (this.element !== uiSrefElement) {
      this.element = uiSrefElement;
      this._firstUpdated = false;
      setTimeout(() => {
        this.firstUpdated();
      }, 0);
    }

    return this.doRender();
  }

  doRender = () => {
    return this.render(this.state!, this.params, this.options);
  };

  _firstUpdated = false;
  firstUpdated() {
    if (this._firstUpdated || !this.isConnected) {
      return;
    }

    this.seekRouter();
    this.seekParentView();
    this.element!.addEventListener('click', this.onClick as EventListener);
    this.unsubscribe = this.uiRouter!.stateRegistry.onStatesChanged(
      this.doRender,
    );
    this.doRender();
    this._firstUpdated = true;
  }
}

/**
 * Directive that creates state-based navigation links.
 *
 * The `uiSref` directive transforms elements (typically `<a>` tags) into
 * UI-Router navigation links. It automatically generates the `href` attribute
 * based on the target state and handles click events to perform state transitions.
 *
 * @param state - The target state name (can be relative like `.child` or `^.sibling`)
 * @param params - Optional state parameters
 * @param options - Optional transition options
 *
 * @example Basic usage
 * ```ts
 * import { uiSref } from 'lit-ui-router';
 * import { html } from 'lit';
 *
 * html`<a ${uiSref('home')}>Go Home</a>`
 * ```
 *
 * @example With parameters
 * ```ts
 * html`<a ${uiSref('user.detail', { userId: 123 })}>View User</a>`
 * ```
 *
 * @example With transition options
 * ```ts
 * html`<a ${uiSref('dashboard', {}, { reload: true })}>Reload Dashboard</a>`
 * ```
 *
 * @example Relative state references
 * ```ts
 * // Navigate to child state
 * html`<a ${uiSref('.child')}>Go to Child</a>`
 *
 * // Navigate to sibling state
 * html`<a ${uiSref('^.sibling')}>Go to Sibling</a>`
 * ```
 *
 * @see {@link https://ui-router.github.io/core/docs/latest/modules/_state_interface_.html#rawparams | RawParams}
 * @see {@link https://ui-router.github.io/core/docs/latest/interfaces/_transition_interface_.transitionoptions.html | TransitionOptions}
 *
 * @category Directives
 */
export const uiSref = directive(UiSrefDirective);
