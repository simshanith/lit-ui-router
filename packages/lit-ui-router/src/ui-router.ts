import { html, LitElement } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';

import {
  contextRequestEventName,
  isRouterContextRequest,
  requestRouter,
} from './context.js';
import { UIRouterLit } from './core.js';
import { warnRouterSwapped } from './dev-warn.js';
import { uiRouterContextEventName, uiViewContextEventName } from './events.js';
import type { UiRouterContextEvent, UiViewContextEvent } from './events.js';
import { noUnsubscribe, RouterSubscribers } from './router-subscription.js';

export type { UiRouterContextEvent, UiViewContextEvent } from './events.js';

/**
 * @hideconstructor
 * @category components
 *
 * @slot - <code>&lt;ui-router&gt;</code> renders slotted content.
 *
 * @fires {CustomEvent} ui-router-context
 *
 * <code>&lt;ui-router&gt;</code> listens to the
 * <code>ui-router-context</code> event
 * and provides the <code>uiRouter</code> instance.
 *
 * It answers the community <code>context-request</code> protocol for
 * {@link routerContext} from the same listener position, so an element built
 * on <code>@lit/context</code> gets the router too. The two paths coexist and
 * neither sees the other's event: {@link UIRouterLitElement.seekRouter} asks
 * on <code>ui-router-context</code> first and falls back to
 * {@link requestRouter}.
 *
 * @summary
 *
 * This is the root ui-router component.
 *
 */
export class UIRouterLitElement extends LitElement {
  /**
   * Root <code>uiRouter</code> singleton.
   * If not provided, the element creates and assigns a new instance.
   */
  @property({ attribute: false })
  uiRouter: UIRouterLit | undefined;

  /** @internal */
  static uiRouterContextEventName: string = uiRouterContextEventName;

  /** @internal */
  static uiViewContextEventName: string = uiViewContextEventName;

  /** @internal */
  static uiRouterContextEvent(uiRouter?: UIRouterLit): UiRouterContextEvent {
    return new CustomEvent(this.uiRouterContextEventName, {
      bubbles: true,
      composed: true,
      detail: {
        uiRouter,
      },
    });
  }

  /**
   * Discovers the {@link UIRouterLit} instance provided by the nearest
   * enclosing <code>&lt;ui-router&gt;</code> element.
   *
   * Dispatches a bubbling, composed <code>ui-router-context</code> event from
   * the candidate element; the enclosing <code>&lt;ui-router&gt;</code>
   * answers it with its router instance. Returns <code>undefined</code> when
   * the candidate is not inside a <code>&lt;ui-router&gt;</code> (e.g. not
   * yet connected).
   *
   * This is the dependency-injection primitive for integrating external
   * reactivity systems (state stores, controllers) with the router context —
   * call it from <code>hostConnected()</code> / <code>connectedCallback()</code>
   * instead of prop-drilling the router instance.
   *
   * When no <code>&lt;ui-router&gt;</code> answers, it asks again with
   * {@link requestRouter}, so an ancestor providing {@link routerContext}
   * over the community protocol — a bare <code>@lit/context</code>
   * <code>ContextProvider</code>, say — is found as well.
   */
  static seekRouter(candidate: Element): UIRouterLit | undefined {
    const uiRouterContextEvent = this.uiRouterContextEvent();
    candidate.dispatchEvent(uiRouterContextEvent);
    return uiRouterContextEvent.detail.uiRouter ?? requestRouter(candidate);
  }

  /** @internal */
  static onUiRouterContextEvent(
    uiRouter?: UIRouterLit,
  ): (event: UiRouterContextEvent) => void {
    return (event: UiRouterContextEvent) => {
      event.stopPropagation();
      event.detail.uiRouter = uiRouter;
    };
  }

  private readonly onUiRouterContextEvent = (event: UiRouterContextEvent) => {
    this.constructor.onUiRouterContextEvent(this.uiRouter)(event);
  };

  /**
   * Answers a `context-request` for the router context with a router that is
   * final: `subscribe` gets one call and a no-op unsubscribe.
   *
   * @internal
   */
  static onContextRequest(uiRouter?: UIRouterLit): (event: Event) => void {
    return (event: Event) => {
      if (!uiRouter || !isRouterContextRequest(event)) {
        return;
      }
      // stopped first: a throwing consumer must not leak the request outward
      event.stopImmediatePropagation();
      event.callback(uiRouter, event.subscribe ? noUnsubscribe : undefined);
    };
  }

  /** Subscribers that took the placeholder, owed the app's router. */
  private readonly routerSubscribers = new RouterSubscribers();

  /**
   * Answers a `context-request` for the router context.
   *
   * While the placeholder minted on connect stands, a `subscribe` request is
   * kept and called once more with the router that replaces it, and gets an
   * unsubscribe that drops it. Any other answer is final: one call and a no-op
   * unsubscribe, since a later swap is unsupported and only warns.
   */
  private readonly onContextRequest = (event: Event) => {
    this.routerSubscribers.answer(
      event,
      this.uiRouter,
      !!this.ownRouter && this.uiRouter === this.ownRouter,
    );
  };

  /**
   * Answers the parent-view seek of every `<ui-view>` below, declining to name
   * one.
   *
   * A nested `<ui-router>` roots its own view tree: an enclosing
   * `<ui-view>` belongs to the outer router's tree, and its fully qualified
   * name and `ViewContext` would send the inner view looking for a view config
   * the inner router never has.
   */
  private readonly onUiViewContextEvent = (event: UiViewContextEvent) => {
    event.stopPropagation();
    event.detail.parentView = null;
  };

  /** @internal */
  connectedCallback(): void {
    super.connectedCallback();
    if (!this.uiRouter) {
      this.ownRouter = new UIRouterLit();
      this.uiRouter = this.ownRouter;
    }

    this.addEventListener(
      this.constructor.uiRouterContextEventName,
      this.onUiRouterContextEvent as EventListener,
    );
    this.addEventListener(contextRequestEventName, this.onContextRequest);
    this.addEventListener(
      this.constructor.uiViewContextEventName,
      this.onUiViewContextEvent as EventListener,
    );

    this.dispatchEvent(this.constructor.uiRouterContextEvent(this.uiRouter));
  }

  /** The router this element minted for itself, which the app is expected to replace once it has one. */
  private ownRouter?: UIRouterLit;

  /** @internal */
  protected willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    // Registered views keep the router they took, so a swap splits the page; replacing the placeholder minted above is the sanctioned upgrade.
    if (
      this.hasUpdated &&
      changed.has('uiRouter') &&
      changed.get('uiRouter') !== this.ownRouter
    ) {
      warnRouterSwapped(this);
    }
    // Only a placeholder's answers are kept, so this reaches subscribers on the upgrade alone.
    if (this.uiRouter && this.uiRouter !== this.ownRouter) {
      this.routerSubscribers.deliver(this.uiRouter);
    }
  }

  /** @internal */
  render(): TemplateResult {
    return html`<slot></slot>`;
  }
}

export interface UIRouterLitElement {
  /** @internal */
  constructor: typeof UIRouterLitElement;
}
