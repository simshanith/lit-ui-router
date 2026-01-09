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

  /** @internal */
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

  private onUiRouterContextEvent = (event: UiRouterContextEvent) => {
    this.constructor.onUiRouterContextEvent(this.uiRouter)(event);
  };

  async connectedCallback() {
    super.connectedCallback();
    this.uiRouter = this.uiRouter || new UIRouterLit();

    this.addEventListener(
      this.constructor.uiRouterContextEventName,
      this.onUiRouterContextEvent as EventListener,
    );

    this.dispatchEvent(this.constructor.uiRouterContextEvent(this.uiRouter));
  }

  render() {
    return html`<slot></slot>`;
  }
}

export interface UIRouterLitElement {
  constructor: typeof UIRouterLitElement;
}
