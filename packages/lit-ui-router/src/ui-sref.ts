import {
  equals,
  extend,
  RawParams,
  TransitionOptions,
  isNumber,
  TargetState,
} from '@uirouter/core';
import { noChange, ElementPart } from 'lit';
import { directive, PartInfo, PartType } from 'lit/directive.js';
import type { DirectiveResult } from 'lit/directive.js';
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
export interface UiSrefTargetEvent extends CustomEvent<{
  targetState: TargetState;
}> {
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
 * `@uirouter/core` types `equals` as `any` because it resolves to
 * `angular.equals || _equals` at load time. The implementation is a deep
 * structural compare (arrays, Date by `getTime`, RegExp by source, NaN).
 * @internal
 */
const paramsEqual = equals as (a: RawParams, b: RawParams) => boolean;

/**
 * Whether two target states name the same state with the same params.
 * `$state.target()` returns a fresh object every render, so identity is useless.
 * @internal
 */
function sameTarget(a: TargetState | null, b: TargetState): boolean {
  return !!a && a.name() === b.name() && paramsEqual(a.params(), b.params());
}

/**
 * Whether the element navigates on its own. `localName` is lowercase for HTML
 * and SVG alike, so SVG `<a>` needs no namespace check.
 * @internal
 */
function isNativeLink(element: Element): boolean {
  const tag = element.localName;
  return tag === 'a' || tag === 'area';
}

/**
 * Whether the click asked the browser for something other than a plain
 * in-place navigation: a new tab/window, a download, or a non-primary button.
 * @internal
 */
function isModifiedClick(event: MouseEvent): boolean {
  const { button, ctrlKey, metaKey, shiftKey, altKey } = event;
  return (
    !isNumber(button) || !!button || ctrlKey || metaKey || shiftKey || altKey
  );
}

/**
 * Whether the element declares that its href leaves the app: `target="_blank"`
 * or a `rel` token list containing `external`.
 * @internal
 */
function opensOffApp(element: Element): boolean {
  if (element.getAttribute('target') === '_blank') {
    return true;
  }
  // rel is a token list: `rel="external noopener"` is still external
  return (element.getAttribute('rel') ?? '').split(/\s+/).includes('external');
}

/**
 * Directive class that creates state-based navigation links.
 *
 * This directive is used internally by the {@link uiSref} directive function.
 * It transforms elements (typically `<a>` tags) into UI-Router navigation links
 * by setting the `href` attribute and handling click events.
 *
 * @see {@link uiSref} for the public API
 * @see [[AsyncDirective]]
 * @see [[StateService.go]]
 *
 * @category directives
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

  /** @internal */
  unsubscribe: (() => void) | undefined;

  /** @internal */
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
    return extend(defaultOpts, opts || {}) as TransitionOptions;
  }

  render(
    state: string,
    params?: RawParams,
    options?: TransitionOptions,
  ): typeof noChange {
    if (!this.element) {
      return noChange;
    }

    const { uiRouter: router } = this;
    const $state = router?.stateService;
    if (!$state) {
      return noChange;
    }

    const targetState = $state.target(state, params, this.getOptions(options));
    const targetChanged = !sameTarget(this.targetState, targetState);
    this.element.targetState = this.targetState = targetState;

    // core returns null from href() for a state whose navigable has no url
    this.href = $state.href(state, params, this.getOptions(options));

    if (this.href !== this.element.getAttribute('href')) {
      if (this.href) {
        this.element.setAttribute('href', this.href);
      } else {
        this.element.removeAttribute('href');
      }
    }

    // the href is not the target: a url-less state has none, and non-url
    // params change the target without changing it
    if (targetChanged) {
      this.element.dispatchEvent(uiSrefTargetEvent(this.targetState));
    }
    return noChange;
  }

  /** @internal */
  seekRouter(): void {
    this.uiRouter = UIRouterLitElement.seekRouter(this.element!);
  }

  /** @internal */
  seekParentView(): void {
    this.parentView = UiView.seekParentView(this.element!);
  }

  /** @internal */
  disconnected(): void {
    this.element?.removeEventListener('click', this.onClick as EventListener);
    this.element = null;
    this.targetState = null;
    this.href = null;
    this.unsubscribe?.();
  }

  onClick = (event: MouseEvent): void => {
    const { uiRouter: router, state, params } = this;
    const options = this.getOptions();
    const $state = router?.stateService;
    if (!$state || !this.element?.isConnected || !state) {
      return;
    }

    const element = event.currentTarget as Element;

    // author signals, so unscoped: they apply whatever the element is
    if (event.defaultPrevented || element.hasAttribute('download')) {
      return;
    }

    // scoped to links: these guards hand the click back to the browser, and a
    // non-link has nothing to hand it back to
    if (
      isNativeLink(element) &&
      (isModifiedClick(event) || opensOffApp(element))
    ) {
      return;
    }

    // fire-and-forget: @uirouter/core handles transition promise rejections
    void $state.go(state, params, options);
    event.preventDefault();
  };

  update(
    part: ElementPart,
    [state, params = {}, options = {}]: [
      string,
      RawParams?,
      TransitionOptions?,
    ],
  ): typeof noChange {
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

  doRender = (): typeof noChange => {
    return this.render(this.state!, this.params, this.options);
  };

  private _firstUpdated = false;
  /**
   * @internal
   */
  firstUpdated(): void {
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
 * **Arguments:**
 * - `state` - The target state name (can be relative like `.child` or `^.sibling`)
 * - `params` - Optional state parameters (see [[RawParams]])
 * - `options` - Optional transition options (see [[TransitionOptions]])
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
 * @see [[RawParams]]
 * @see [[TransitionOptions]]
 * @see [[DirectiveResult]]
 *
 * @category directives
 */
export const uiSref: (
  state: string,
  params?: RawParams,
  options?: TransitionOptions,
) => DirectiveResult<typeof UiSrefDirective> = directive(UiSrefDirective);
