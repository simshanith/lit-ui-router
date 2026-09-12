import { RawParams, TargetState, TransitionOptions } from '@uirouter/core';
import { noChange, nothing, AttributePart } from 'lit';
import { directive, PartInfo, PartType } from 'lit/directive.js';
import type { DirectiveResult } from 'lit/directive.js';
import { AsyncDirective } from 'lit/async-directive.js';

import { UIRouterLit } from './core.js';
import { warnMissingRouter } from './dev-warn.js';
import { UIRouterLitElement } from './ui-router.js';
import {
  clickBelongsToBrowser,
  sameTarget,
  srefTransitionOptions,
  uiSrefTargetEvent,
} from './ui-sref.js';
import { UiView } from './ui-view.js';

/**
 * The attribute-part sibling of {@link UiSrefDirective}: the same link, bound
 * where the `href` lives instead of on the element.
 *
 * `render()` is a function of the router and the arguments alone — it returns
 * the `href` and touches no DOM — which is the shape a server renderer needs,
 * since it runs `render()` and never `update()`. Everything that needs the
 * element (finding the router, the click handler, the target event for an
 * enclosing `uiSrefActive`) lives in `update()`, which only a live document
 * runs. Handing the directive a router without an element is the remaining
 * server-side piece.
 *
 * @see {@link srefHref} for the public API
 *
 * @category directives
 */
export class SrefHrefDirective extends AsyncDirective {
  state: string | null = null;
  params: RawParams = {};
  options: TransitionOptions = {};

  element: Element | null = null;

  uiRouter: UIRouterLit | undefined;
  parentView: UiView | null = null;

  href: string | null = null;
  targetState: TargetState | null = null;

  /** whether the router seek has run — see {@link UiSrefDirective} */
  private _seekedRouter = false;
  private _firstUpdated = false;

  /** @internal */
  unsubscribe: (() => void) | undefined;

  /** @internal */
  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (
      partInfo.type !== PartType.ATTRIBUTE ||
      partInfo.strings !== undefined
    ) {
      throw new Error(
        'The `srefHref` directive must be the only expression in an attribute: href=${srefHref(...)}',
      );
    }
  }

  /** @internal */
  getOptions(opts: TransitionOptions = this.options): TransitionOptions {
    return srefTransitionOptions(this.parentView, opts);
  }

  /**
   * The `href` for the target state; `nothing` when the state has no url;
   * `noChange` until a router is found, so an attribute a server wrote
   * survives hydration untouched.
   */
  render(
    state: string,
    params?: RawParams,
    options?: TransitionOptions,
  ): string | typeof nothing | typeof noChange {
    const $state = this.uiRouter?.stateService;
    if (!$state) {
      if (this._seekedRouter) {
        this.warnMissingRouter(state);
      }
      return noChange;
    }

    const targetState = $state.target(state, params, this.getOptions(options));
    const targetChanged = !sameTarget(this.targetState, targetState);
    this.targetState = targetState;

    // core returns null from href() for a state whose navigable has no url
    this.href = $state.href(state, params, this.getOptions(options));

    // the href is not the target: a url-less state has none, and non-url
    // params change the target without changing it
    if (targetChanged && this.element) {
      this.element.dispatchEvent(uiSrefTargetEvent(targetState));
    }
    return this.href ?? nothing;
  }

  /** @internal */
  update(
    part: AttributePart,
    [state, params = {}, options = {}]: [
      string,
      RawParams?,
      TransitionOptions?,
    ],
  ): ReturnType<SrefHrefDirective['render']> {
    this.state = state;
    this.params = params;
    this.options = options;

    if (this.element !== part.element) {
      this.element = part.element;
      this._firstUpdated = false;
      // the part's element is not in the document yet; the seek needs it there
      setTimeout(() => {
        this.firstUpdated();
      }, 0);
    }

    return this.render(state, params, options);
  }

  /** @internal */
  firstUpdated(): void {
    if (this._firstUpdated || !this.isConnected) {
      return;
    }
    const element = this.element!;
    this.uiRouter = UIRouterLitElement.seekRouter(element);
    this._seekedRouter = true;
    this.parentView = UiView.seekParentView(element);
    element.addEventListener('click', this.onClick as EventListener);
    if (this.uiRouter) {
      this.unsubscribe = this.uiRouter.stateRegistry.onStatesChanged(
        this.doRender,
      );
    }
    // the update that scheduled this rendered before the seek: push the value
    // it could not, or let the no-op report itself
    this.doRender();
    this._firstUpdated = true;
  }

  /** @internal */
  doRender = (): void => {
    const value = this.render(this.state!, this.params, this.options);
    if (value !== noChange && this.isConnected) {
      this.setValue(value);
    }
  };

  /** @internal */
  onClick = (event: MouseEvent): void => {
    const { uiRouter: router, state, params } = this;
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
    void $state.go(state, params, this.getOptions());
    event.preventDefault();
  };

  private warnMissingRouter(state: string): void {
    const element = this.element;
    if (!element) return;
    warnMissingRouter(
      element,
      `<${element.localName} href=\${srefHref('${state}')}>`,
      'will not navigate',
    );
  }

  /** @internal */
  disconnected(): void {
    this.element?.removeEventListener('click', this.onClick as EventListener);
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this._firstUpdated = false;
  }

  /** @internal */
  reconnected(): void {
    // lit reconnects while the cached fragment is still detached; seek once
    // the element is back in the document
    setTimeout(() => {
      this.firstUpdated();
    }, 0);
  }
}

/**
 * Binds a state's `href` to an attribute: the attribute-part form of
 * {@link uiSref}.
 *
 * The two do the same job — generate the `href`, navigate on click, announce
 * the target to an enclosing {@link uiSrefActive} — and differ only in where
 * they sit. `uiSref` is an element part, which only a live browser can see;
 * this one *is* the `href`, so a static analyser reads the link the way the
 * browser does, and a server renderer can once it has a router to offer.
 * Use one or the other on an element, never both.
 *
 * **Arguments** are {@link uiSref}'s: the state name, its params, and core's
 * transition options. There is no `assignHref` — the attribute is the
 * binding, so it is written wherever it was bound.
 *
 * @example
 * ```ts
 * import { srefHref } from 'lit-ui-router';
 * import { html } from 'lit';
 *
 * html`<a href=${srefHref('users.detail', { userId: 123 })}>View User</a>`
 * ```
 *
 * @example With `srefActiveClass` and `srefAriaCurrent`
 * ```ts
 * html`<a href=${srefHref('users')}
 *         class="nav-link ${srefActiveClass({ state: 'users', activeClasses: ['active'] })}"
 *         aria-current=${srefAriaCurrent({ state: 'users' })}>Users</a>`
 * ```
 *
 * @see {@link uiSref}
 * @see {@link srefActiveClass}
 * @see {@link srefAriaCurrent}
 *
 * @category directives
 */
export const srefHref: (
  state: string,
  params?: RawParams,
  options?: TransitionOptions,
) => DirectiveResult<typeof SrefHrefDirective> = directive(SrefHrefDirective);
