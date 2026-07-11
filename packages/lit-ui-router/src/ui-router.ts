import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { UIRouterLit } from './core.js';
import {
  UI_ROUTER_CONTEXT_EVENT,
  onUiRouterContextEvent,
  seekRouter,
  uiRouterContextEvent,
  type UiRouterContextEvent,
} from './context.js';

export type { UiRouterContextEvent } from './context.js';

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
  static uiRouterContextEventName = UI_ROUTER_CONTEXT_EVENT;

  /** @internal */
  static uiRouterContextEvent(uiRouter?: UIRouterLit): UiRouterContextEvent {
    return uiRouterContextEvent(uiRouter);
  }

  /**
   * Discovers the {@link UIRouterLit} instance provided by the nearest
   * enclosing <code>&lt;ui-router&gt;</code> element.
   *
   * Delegates to the standalone {@link seekRouter} function, which is also
   * importable from <code>lit-ui-router/pure</code> without registering the
   * custom elements.
   */
  static seekRouter(candidate: Element): UIRouterLit | undefined {
    return seekRouter(candidate);
  }

  /** @internal */
  static onUiRouterContextEvent(uiRouter?: UIRouterLit) {
    return onUiRouterContextEvent(uiRouter);
  }

  private onUiRouterContextEvent = (event: UiRouterContextEvent) => {
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
