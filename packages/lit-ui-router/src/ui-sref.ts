import { RawParams, TransitionOptions, TargetState } from '@uirouter/core';
import { noChange, ElementPart } from 'lit';
import { directive, PartInfo, PartType } from 'lit/directive.js';
import type { DirectiveResult } from 'lit/directive.js';
import { AsyncDirective } from 'lit/async-directive.js';

import { UIRouterLit } from './core.js';
import { inLitDevMode, warnMissingRouter } from './dev-warn.js';
import { UIRouterLitElement } from './ui-router.js';
import { UiView } from './ui-view.js';

import {
  clickBelongsToBrowser,
  isNativeLink,
  sameTarget,
  srefTransitionOptions,
  uiSrefTargetEvent,
  uiSrefTargetRemovedEvent,
} from './sref-internals.js';
import type { UiSrefElement } from './sref-internals.js';

// re-export: `inLitDevMode` ships in the public d.ts (#541)
export { inLitDevMode };
export {
  UI_SREF_TARGET_EVENT,
  UI_SREF_TARGET_REMOVED_EVENT,
} from './sref-internals.js';
export type { UiSrefElement, UiSrefTargetEvent } from './sref-internals.js';

export {
  /**
   * @internal
   * @deprecated Directive plumbing, not a supported import.
   */
  clickBelongsToBrowser,
  /**
   * @internal
   * @deprecated Directive plumbing, not a supported import.
   */
  isNativeLink,
  /**
   * @internal
   * @deprecated Directive plumbing, not a supported import.
   */
  sameTarget,
  /**
   * @internal
   * @deprecated Directive plumbing, not a supported import.
   */
  srefEventLink,
  /**
   * @internal
   * @deprecated Directive plumbing, not a supported import.
   */
  srefTransitionOptions,
  /**
   * @internal
   * @deprecated Directive plumbing, not a supported import.
   */
  uiSrefTargetEvent,
  /**
   * @internal
   * @deprecated Directive plumbing, not a supported import.
   */
  uiSrefTargetRemovedEvent,
} from './sref-internals.js';

/**
 * Directive options for {@link uiSref}, passed alongside the transition
 * options in its third argument. These never reach `@uirouter/core`.
 *
 * @category types
 */
export interface UiSrefOptions {
  /**
   * Where the generated `href` is written.
   *
   * - `true` *(default in 1.x)* — always write it, whatever the element is.
   *   This is the historical behaviour and the standing answer for a custom
   *   element that declares its own `href`.
   * - `'auto'` — write it only to elements the HTML spec gives an `href`:
   *   `<a>`, `<area>`, and SVG `<a>`. This is the correct behaviour and
   *   becomes the default in 2.0.
   * - `false` — never write it; the app manages the attribute itself.
   *
   * Under `true`, a non-link that receives an `href` warns once and names
   * `'auto'` as the fix.
   *
   * This option governs the `href` attribute **only**. Whether the click
   * handler defers to native browser behaviour is decided by the element
   * itself, never by this setting — see `isNativeLink`.
   */
  assignHref?: boolean | 'auto';
}

/**
 * The third argument to {@link uiSref}: core's transition options plus this
 * directive's own.
 *
 * @category types
 */
export type UiSrefTransitionOptions = TransitionOptions & UiSrefOptions;

/** elements already warned about, so a re-render does not repeat itself */
const warnedAssignHref = new WeakSet<Element>();

/**
 * Directive class that creates state-based navigation links.
 *
 * This directive is used internally by the {@link uiSref} directive function.
 * It transforms elements (typically `<a>` tags) into UI-Router navigation links
 * by setting the `href` attribute and handling click events.
 *
 * @see {@link uiSref} for the public API
 * @see {@link AsyncDirective}
 * @see {@link "@uirouter/core"!StateService.go | StateService.go}
 *
 * @category directives
 */
export class UiSrefDirective extends AsyncDirective {
  /** the target state name from the last render */
  state: string | null = null;
  /** the target state params from the last render */
  params: RawParams = {};
  /** the transition options from the last render */
  options: TransitionOptions = {};

  /** @internal */
  element: UiSrefElement | null = null;

  /** @internal */
  uiRouter: UIRouterLit | undefined;
  /** @internal */
  parentView: UiView | null = null;

  /** this directive's own options, stripped from the transition options */
  uiSrefOptions: UiSrefOptions = {};

  /** the href computed for the target, or null when there is none */
  href: string | null = null;
  /** the resolved target, or null until the router is found */
  targetState: TargetState | null = null;

  /** whether the href currently on the element was written by us */
  private _ownsHref = false;

  /**
   * Whether {@link seekRouter} has run. The seek is deferred a task past the
   * first render, so `uiRouter` being empty before it means "not looked yet",
   * not "not there" — only after it may a bail be reported as a missing
   * provider.
   *
   * @internal
   */
  private _seekedRouter = false;

  /** @internal */
  unsubscribe: (() => void) | undefined;

  /**
   * Kept across a disconnect so {@link reconnected} can re-arm.
   * @internal
   */
  private _partElement: UiSrefElement | null = null;

  /** @internal */
  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error('The `uiSref` directive must be used as an element');
    }
  }

  /** the transition options with `relative` defaulted to the enclosing view */
  getOptions(opts: TransitionOptions = this.options): TransitionOptions {
    return srefTransitionOptions(this.parentView, opts);
  }

  /** @internal */
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
      if (this._seekedRouter) {
        this.warnMissingRouter(state);
      }
      return noChange;
    }

    const targetState = $state.target(state, params, this.getOptions(options));
    const targetChanged = !sameTarget(this.targetState, targetState);
    this.element.targetState = this.targetState = targetState;

    // core returns null from href() for a state whose navigable has no url
    this.href = $state.href(state, params, this.getOptions(options));

    if (this.shouldAssignHref()) {
      if (this.href !== this.element.getAttribute('href')) {
        if (this.href) {
          this.element.setAttribute('href', this.href);
          this._ownsHref = true;
        } else {
          this.element.removeAttribute('href');
          this._ownsHref = false;
        }
      }
    } else if (this._ownsHref) {
      // the option was flipped after we wrote one; leave author hrefs alone
      this.element.removeAttribute('href');
      this._ownsHref = false;
    }

    // the href is not the target: a url-less state has none, and non-url
    // params change the target without changing it
    if (targetChanged) {
      this.element.dispatchEvent(uiSrefTargetEvent(this.targetState));
    }
    return noChange;
  }

  /**
   * Whether this render writes the `href`, warning once per element under lit's
   * dev build when the 1.x default puts one on something that cannot use it.
   * @internal
   */
  shouldAssignHref(): boolean {
    const element = this.element!;
    const { assignHref = true } = this.uiSrefOptions;

    if (assignHref === 'auto') {
      return isNativeLink(element);
    }
    if (!assignHref) {
      return false;
    }

    // DEV folds away in dist/*.js (check:dev-split); inLitDevMode() is the runtime probe.
    if (
      import.meta.env.DEV &&
      inLitDevMode() &&
      this.href !== null &&
      !isNativeLink(element) &&
      !warnedAssignHref.has(element)
    ) {
      warnedAssignHref.add(element);
      console.warn(
        `lit-ui-router: uiSref wrote href="${this.href}" to <${element.localName}>, which has no href in HTML. ` +
          `Pass { assignHref: 'auto' } to write it only to links; 'auto' becomes the default in 2.0.`,
      );
    }
    return true;
  }

  /** @internal */
  seekRouter(): void {
    this.uiRouter = UIRouterLitElement.seekRouter(this.element!);
    this._seekedRouter = true;
  }

  /**
   * Names this sref in the missing-provider warning. Shared by the two sites
   * that observe the no-op — the render that writes no `href` and the click
   * that navigates nowhere — so an element that does both still warns once.
   *
   * @internal
   */
  private warnMissingRouter(state: string): void {
    const element = this.element!;
    warnMissingRouter(
      element,
      `<${element.localName} uiSref="${state}">`,
      'will not navigate',
    );
  }

  /** @internal */
  seekParentView(): void {
    this.parentView = UiView.seekParentView(this.element!);
  }

  /** @internal */
  disconnected(): void {
    this.element?.removeEventListener('click', this.onClick as EventListener);
    // lit notifies before it removes the nodes: the container still hears this
    this.element?.dispatchEvent(uiSrefTargetRemovedEvent());
    this.element = null;
    this.targetState = null;
    this.href = null;
    this._ownsHref = false;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    // re-arming is what `reconnected` does; without this it would no-op
    this._firstUpdated = false;
  }

  /**
   * Re-arms after a detach/re-attach; `update` only re-arms on a NEW element.
   * @internal
   */
  reconnected(): void {
    this.element = this._partElement;
    if (this.element) {
      this.firstUpdated();
    }
  }

  /** @internal */
  onClick = (event: MouseEvent): void => {
    const { uiRouter: router, state, params } = this;
    const options = this.getOptions();
    const $state = router?.stateService;
    if (!$state || !this.element?.isConnected || !state) {
      if (!$state && state && this.element?.isConnected) {
        this.warnMissingRouter(state);
      }
      return;
    }

    if (clickBelongsToBrowser(event, event.currentTarget as Element)) {
      return;
    }

    // fire-and-forget: @uirouter/core handles transition promise rejections
    void $state.go(state, params, options);
    event.preventDefault();
  };

  /** @internal */
  update(
    part: ElementPart,
    [state, params = {}, options = {}]: [
      string,
      RawParams?,
      UiSrefTransitionOptions?,
    ],
  ): typeof noChange {
    // split the directive's own options out so they never reach core
    const { assignHref, ...transitionOptions } = options;
    this.state = state;
    this.params = params;
    this.options = transitionOptions;
    this.uiSrefOptions = { assignHref };
    const uiSrefElement = part.element as unknown as UiSrefElement;
    this._partElement = uiSrefElement;
    if (this.element !== uiSrefElement) {
      this.element = uiSrefElement;
      this._firstUpdated = false;
      setTimeout(() => {
        this.firstUpdated();
      }, 0);
    }

    return this.doRender();
  }

  /** @internal */
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
    // no router: the subscription is the only step that needs one, and
    // `doRender` still has to run for the no-op to report itself
    if (this.uiRouter) {
      this.unsubscribe = this.uiRouter.stateRegistry.onStatesChanged(
        this.doRender,
      );
    }
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
 * - `params` - Optional state parameters (see {@link RawParams})
 * - `options` - Optional transition options (see {@link TransitionOptions}), plus
 *   this directive's own (see {@link UiSrefOptions})
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
 * @example On an element that is not a link
 * ```ts
 * // `<button>` has no href in HTML; 'auto' keeps the attribute off it.
 * // Clicking still navigates — the option governs the href only.
 * html`<button ${uiSref('.new', {}, { assignHref: 'auto' })}>New</button>`
 * ```
 *
 * @see {@link RawParams}
 * @see {@link TransitionOptions}
 * @see {@link UiSrefOptions}
 * @see {@link DirectiveResult}
 *
 * @category directives
 */
export const uiSref: (
  state: string,
  params?: RawParams,
  options?: UiSrefTransitionOptions,
) => DirectiveResult<typeof UiSrefDirective> = directive(UiSrefDirective);
