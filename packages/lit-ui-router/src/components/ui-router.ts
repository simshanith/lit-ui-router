import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { UIRouterLit } from '../core.js';
import { UiRouterContextEvent } from '../events.js';

/**
 * @summary
 *
 * This is the root ui-router component.
 *
 *
 * @slot - <code>&lt;ui-router&gt;</code> renders slotted content.
 *
 * @event {CustomEvent} ui-router-context
 *
 * <code>&lt;ui-router&gt;</code> listens to the
 * <code>ui-router-context</code> event
 * and provides the <code>uiRouter</code> instance.
 */
@customElement('ui-router')
export class UIRouterLitElement extends LitElement {
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  /**
   * Root <code>uiRouter</code> singleton.
   * If not provided, the element creates and assigns a new instance.
   */
  @property({ attribute: false })
  uiRouter: UIRouterLit | undefined;

  /** @internal */
  static seekRouter(candidate: Element): UIRouterLit | undefined {
    const uiRouterContextEvent = new UiRouterContextEvent();
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

  private onUiRouterContextEvent = (event: UiRouterContextEvent) => {
    this.constructor.onUiRouterContextEvent(this.uiRouter)(event);
  };

  async connectedCallback() {
    super.connectedCallback();
    this.uiRouter = this.uiRouter || new UIRouterLit();

    this.addEventListener(
      UiRouterContextEvent.eventName,
      this.onUiRouterContextEvent as EventListener,
    );

    this.dispatchEvent(new UiRouterContextEvent({ uiRouter: this.uiRouter }));
  }
}

export interface UIRouterLitElement {
  constructor: typeof UIRouterLitElement;
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-router': UIRouterLitElement;
  }
}
