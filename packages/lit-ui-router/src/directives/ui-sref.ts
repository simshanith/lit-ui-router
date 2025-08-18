import {
  extend,
  RawParams,
  TransitionOptions,
  isNumber,
  TargetState,
} from '@uirouter/core';
import { noChange, ElementPart } from 'lit';
import { directive, PartInfo, PartType } from 'lit/directive.js';
import { AsyncDirective } from 'lit/async-directive.js';

import { UIRouterLit } from '../core.js';
import { UIRouterLitElement } from '../components/ui-router.js';
import { UiView } from '../components/ui-view.js';

export const UI_SREF_TARGET_EVENT = 'uiSrefTarget';

export interface UiSrefElement extends Element {
  href: string;
  targetState: TargetState;
}

export interface UiSrefTargetEvent
  extends CustomEvent<{ targetState: TargetState }> {
  target: UiSrefElement;
}

export function uiSrefTargetEvent(targetState: TargetState): UiSrefTargetEvent {
  return new CustomEvent(UI_SREF_TARGET_EVENT, {
    bubbles: true,
    composed: true,
    detail: { targetState },
  }) as UiSrefTargetEvent;
}

export class UiSrefDirective extends AsyncDirective {
  state?: string;
  params: RawParams = {};
  options: TransitionOptions = {};

  element?: UiSrefElement;

  uiRouter?: UIRouterLit;
  parentView?: UiView;

  href?: string;
  targetState?: TargetState;

  unsubscribe: (() => void) | undefined;

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
    return extend(defaultOpts, opts || {});
  }

  render(state: string, params?: RawParams, options?: TransitionOptions) {
    if (!this.element) {
      return noChange;
    }

    const { uiRouter: router } = this;
    const $state = router?.stateService;
    if (!$state) {
      return noChange;
    }

    this.element.targetState = this.targetState = $state.target(
      state,
      params,
      this.getOptions(options),
    );

    this.href = $state.href(state, params, this.getOptions(options));

    if (this.href === this.element.getAttribute('href')) {
      return noChange;
    }

    if (this.href) {
      this.element.setAttribute('href', this.href);
    } else {
      this.element.removeAttribute('href');
    }

    this.element.dispatchEvent(uiSrefTargetEvent(this.targetState));
    return noChange;
  }

  seekRouter() {
    this.uiRouter = UIRouterLitElement.seekRouter(this.element!);
  }

  seekParentView() {
    this.parentView = UiView.seekParentView(this.element!);
  }

  disconnected() {
    this.element?.removeEventListener('click', this.onClick as EventListener);
    this.element = undefined;
    this.targetState = undefined;
    this.href = undefined;
    this.unsubscribe?.();
  }

  onClick = (event: MouseEvent) => {
    const { uiRouter: router, state, params } = this;
    const options = this.getOptions();
    const $state = router?.stateService;
    if (!$state) {
      return;
    }
    const { button, ctrlKey, metaKey, target } = event;
    const openInNewTab =
      (target as Element).getAttribute('target') === '_blank';
    const isExternal = (target as Element).getAttribute('rel') === 'external';
    if (
      openInNewTab ||
      isExternal ||
      button ||
      !isNumber(button) ||
      ctrlKey ||
      metaKey ||
      !state
    ) {
      return;
    }
    $state.go(state, params, options);
    event.preventDefault();
  };

  update(
    part: ElementPart,
    [state, params = {}, options = {}]: [string, RawParams, TransitionOptions],
  ) {
    this.state = state;
    this.params = params;
    this.options = options;
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

  doRender = () => {
    return this.render(this.state!, this.params, this.options);
  };

  _firstUpdated = false;
  firstUpdated() {
    if (this._firstUpdated || !this.isConnected) {
      return;
    }

    this.seekRouter();
    this.seekParentView();
    this.element!.addEventListener('click', this.onClick as EventListener);
    this.unsubscribe = this.uiRouter!.stateRegistry.onStatesChanged(
      this.doRender,
    );
    this.doRender();
    this._firstUpdated = true;
  }
}

export const uiSref = directive(UiSrefDirective);
