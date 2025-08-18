import { UIRouterLit } from './core.js';
import { UiView } from './components/ui-view.js';

export interface UiRouterContextEventDetail {
  uiRouter?: UIRouterLit;
}

export class UiRouterContextEvent extends CustomEvent<UiRouterContextEventDetail> {
  static readonly eventName = 'ui-router-context';

  constructor(detail: UiRouterContextEventDetail = {}) {
    super(UiRouterContextEvent.eventName, {
      bubbles: true,
      composed: true,
      detail,
    });
  }
}

export interface UiViewContextEventDetail {
  parentView?: UiView;
}

export class UiViewContextEvent extends CustomEvent<UiViewContextEventDetail> {
  static readonly eventName = 'ui-view-context';

  constructor(detail: UiViewContextEventDetail = {}) {
    super(UiViewContextEvent.eventName, {
      bubbles: true,
      composed: true,
      detail,
    });
  }
}
