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
import { inLitDevMode, warnMissingRouter } from './dev-warn.js';
import { UIRouterLitElement } from './ui-router.js';
import { UiView } from './ui-view.js';

// re-export: `inLitDevMode` ships in the public d.ts (#541)
export { inLitDevMode };

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
   * itself, never by this setting — see {@link isNativeLink}.
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
 * Whether the element navigates on its own. `localName` is lowercase for HTML
 * and SVG alike, so SVG `<a>` needs no namespace check.
 *
 * **Tag-based on purpose.** This decides where an `href` may be written, and
 * `href` is a property of the tag, not of the role: `<div role="link" href="…">`
 * is inert noise. `uiSrefActive`'s `isLinkElement` asks the neighbouring
 * *role*-based question for `aria-current`, which `<div role="link">`
 * legitimately takes. The two overlap on `<a>`/`<area>` and nowhere else — do
 * not unify them.
 *
 * @internal
 */
export function isNativeLink(element: Element): boolean {
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
 * Whether the element declares that its href leaves this browsing context: a
 * `target` other than `_self`, or a `rel` token list containing `external`.
 * @internal
 */
function opensOffApp(element: Element): boolean {
  const target = element.getAttribute('target');
  // browsing-context keywords are ASCII case-insensitive; a name we do not
  // recognise is a frame, which is equally not ours. untrimmed on purpose —
  // the browser does not trim either, so `" _blank"` really is a frame name
  if (target && target.toLowerCase() !== '_self') {
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

  /** this directive's own options, stripped from the transition options */
  uiSrefOptions: UiSrefOptions = {};

  href: string | null = null;
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
    this.element = null;
    this.targetState = null;
    this.href = null;
    this._ownsHref = false;
    this.unsubscribe?.();
  }

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
 * - `params` - Optional state parameters (see [[RawParams]])
 * - `options` - Optional transition options (see [[TransitionOptions]]), plus
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
 * @see [[RawParams]]
 * @see [[TransitionOptions]]
 * @see {@link UiSrefOptions}
 * @see [[DirectiveResult]]
 *
 * @category directives
 */
export const uiSref: (
  state: string,
  params?: RawParams,
  options?: UiSrefTransitionOptions,
) => DirectiveResult<typeof UiSrefDirective> = directive(UiSrefDirective);
