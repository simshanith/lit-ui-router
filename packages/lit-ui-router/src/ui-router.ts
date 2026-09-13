import { html, LitElement } from 'lit';
import type { TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';

import {
  contextRequestEventName,
  isRouterContextRequest,
  requestRouter,
} from './context.js';
import { UIRouterLit } from './core.js';

interface UiRouterContextEventDetail {
  uiRouter?: UIRouterLit;
}

/**
 * @internal
 */
export type UiRouterContextEvent = CustomEvent<UiRouterContextEventDetail>;

/** The router never changes under a subscriber, so there is nothing to undo. */
const noUnsubscribe = () => {};

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
  static uiRouterContextEventName = 'ui-router-context';

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
   * Answers a `context-request` for the router context.
   *
   * `subscribe` gets one call and a no-op unsubscribe: the element takes its
   * router on connect and does not swap it afterwards.
   */
  private readonly onContextRequest = (event: Event) => {
    const { uiRouter } = this;
    if (!uiRouter || !isRouterContextRequest(event)) {
      return;
    }
    // before the callback, so a throwing consumer cannot leak the request on
    event.stopImmediatePropagation();
    event.callback(uiRouter, event.subscribe ? noUnsubscribe : undefined);
  };

  /** @internal */
  connectedCallback(): void {
    super.connectedCallback();
    this.uiRouter = this.uiRouter || new UIRouterLit();

    this.addEventListener(
      this.constructor.uiRouterContextEventName,
      this.onUiRouterContextEvent as EventListener,
    );
    this.addEventListener(contextRequestEventName, this.onContextRequest);

    this.dispatchEvent(this.constructor.uiRouterContextEvent(this.uiRouter));
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
