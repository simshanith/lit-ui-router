import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { UIRouterLit } from './core.js';

interface UiRouterContextEventDetail {
  uiRouter?: UIRouterLit;
}

/**
 * @internal
 */
export type UiRouterContextEvent = CustomEvent<UiRouterContextEventDetail>;

/**
 * @hideconstructor
 *
 * @slot - <code>&lt;ui-router&gt;</code> renders slotted content.
 *
 * @fires {CustomEvent} ui-router-context
 *
 * <code>&lt;ui-router&gt;</code> listens to the
 * <code>ui-router-context</code> event
 * and provides the <code>uiRouter</code> instance.
 *
 * @summary
 *
 * This is the root ui-router component.
 *
 */
@customElement('ui-router')
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
   */
  static seekRouter(candidate: Element): UIRouterLit | undefined {
    const uiRouterContextEvent = this.uiRouterContextEvent();
    candidate.dispatchEvent(uiRouterContextEvent);
    return uiRouterContextEvent.detail.uiRouter;
  }

  /** @internal */
  static onUiRouterContextEvent(uiRouter?: UIRouterLit) {
    return (event: UiRouterContextEvent) => {
      event.stopPropagation();
      event.detail.uiRouter = uiRouter;
    };
  }

  private readonly onUiRouterContextEvent = (event: UiRouterContextEvent) => {
    this.constructor.onUiRouterContextEvent(this.uiRouter)(event);
  };

  /** @internal */
  connectedCallback() {
    super.connectedCallback();
    this.uiRouter = this.uiRouter || new UIRouterLit();

    this.addEventListener(
      this.constructor.uiRouterContextEventName,
      this.onUiRouterContextEvent as EventListener,
    );

    this.dispatchEvent(this.constructor.uiRouterContextEvent(this.uiRouter));
  }

  /** @internal */
  render() {
    return html`<slot></slot>`;
  }
}

export interface UIRouterLitElement {
  /** @internal */
  constructor: typeof UIRouterLitElement;
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-router': UIRouterLitElement;
  }
}
