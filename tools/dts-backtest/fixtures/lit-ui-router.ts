import { html, LitElement, type TemplateResult } from 'lit';
import {
  pushStateLocationPlugin,
  type HookResult,
  type RawParams,
  type Transition,
} from '@uirouter/core';
import {
  TransitionController,
  UIRouterLit,
  UIRouterLitElement,
  UiView,
  mergeSrefStatus,
  uiSref,
  uiSrefActive,
  uiSrefTargetEvent,
  type LitStateDeclaration,
  type RoutedLitTemplate,
  type SrefStatus,
  type TransitionCallback,
  type UIViewInjectedProps,
  type UiOnExit,
  type UiOnParamsChanged,
  type UiRouterContextEvent,
} from 'lit-ui-router';
import 'lit-ui-router/register';
import 'lit-ui-router/ui-router.register';
import 'lit-ui-router/ui-view.register';
import {
  TransitionController as PureTransitionController,
  UIRouterLitElement as PureUIRouterLitElement,
  type UIRouterLit as PureUIRouterLit,
} from 'lit-ui-router/pure';

interface UserResolves {
  user: { name: string };
}

export const userTemplate = (props?: UIViewInjectedProps<UserResolves>) => html`
  <h1>${props?.resolves.user.name}</h1>
  <a ${uiSref('home', { id: 1 })}>home</a>
  <nav ${uiSrefActive({ activeClasses: ['active'], exactClasses: ['exact'] })}>
    <a ${uiSref('user.detail')}>detail</a>
  </nav>
`;

const onTransition: TransitionCallback = (transition, reason) => {
  void transition?.params();
  void reason;
};

export class UserElement
  extends LitElement
  implements UiOnParamsChanged, UiOnExit
{
  static sticky = true;

  _uiViewProps: UIViewInjectedProps<UserResolves>;

  private readonly transitions = new TransitionController(this, {
    events: ['onSuccess', 'onError'],
    callback: onTransition,
  });

  constructor(props: UIViewInjectedProps<UserResolves>) {
    super();
    this._uiViewProps = props;
  }

  uiOnParamsChanged(newParams: RawParams, trans?: Transition): void {
    void newParams;
    void trans;
  }

  uiCanExit(): HookResult {
    return this.transitions !== undefined;
  }

  render(): TemplateResult {
    return html`<h1>${this._uiViewProps.resolves.user.name}</h1>`;
  }
}

userTemplate satisfies RoutedLitTemplate<UserResolves>;

export const states: LitStateDeclaration<UserResolves>[] = [
  { name: 'home', url: '/', component: () => html`<h1>Home</h1>` },
  { name: 'user', url: '/user/:id', component: UserElement },
  { name: 'user.detail', component: userTemplate },
];

export function setupRouter(): UIRouterLit {
  const router = new UIRouterLit();
  router.plugin(pushStateLocationPlugin);
  states.forEach((state) => router.stateRegistry.register(state));
  router.start();
  return router;
}

export function elements(root: Element): void {
  const uiRouter: UIRouterLitElement = new UIRouterLitElement();
  const uiView: UiView = new UiView();
  root.append(uiRouter, uiView);
  root.addEventListener('ui-router-context', (event) => {
    const contextEvent = event as UiRouterContextEvent;
    void contextEvent.detail;
  });
  root.dispatchEvent(
    uiSrefTargetEvent(setupRouter().stateService.target('home')),
  );
}

export function merge(a: SrefStatus, b: SrefStatus): SrefStatus {
  return mergeSrefStatus(a, b);
}

// Both entries must expose the same declarations.
TransitionController satisfies typeof PureTransitionController;

export function pureEntry(host: LitElement): PureUIRouterLit | undefined {
  void new PureTransitionController(host);
  return PureUIRouterLitElement.seekRouter(host);
}

// The register import above puts the tag-map augmentation in scope.
export function typedTag(): UiView {
  return document.createElement('ui-view');
}
