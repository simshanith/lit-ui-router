import { LitElement, html } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import {
  ActiveUIView,
  ResolveContext,
  Transition,
  ViewConfig,
  applyPairs,
  StateDeclaration,
  PathNode,
  trace,
  TransitionHookFn,
  isFunction,
  isString,
  unnestR,
  Param,
  filter,
  ViewContext,
  StateObject,
} from '@uirouter/core';

import {
  RoutedLitTemplate,
  UIViewInjectedProps,
  UiOnExit,
  UiOnParamsChanged,
  NormalizedLitViewDeclaration,
} from './interface.js';
import { LitViewConfig, UIRouterLit, isRoutedLitElement } from './core.js';
import { routedLitElementRenderer } from './routed-element.js';
import { warnMissingRouter } from './dev-warn.js';
import { UIRouterLitElement, UiRouterContextEvent } from './ui-router.js';

/** @internal */
let viewIdCounter = 0;

/** @internal */
export interface UiViewAddress {
  context: ViewContext | StateObject;
  fqn: string;
}

interface UiViewContextEventDetail {
  parentView: UiView | null;
}

type UiViewContextEvent = CustomEvent<UiViewContextEventDetail>;

type deregisterFn = () => void;

/**
 * @hideconstructor
 *
 * @slot - <code>&lt;ui-view&gt;</code> renders slotted content as fallback
 * whenever no routed component is active.
 *
 * @fires {CustomEvent} ui-router-context
 *
 * This event is fired to obtain the <code>uiRouter</code> instance,
 * when not directly provided.
 * Once obtained, the <code>&lt;ui-view&gt;</code> listens and
 * provides the <code>uiRouter</code> to descendants.
 *
 * @fires {CustomEvent} ui-view-context
 *
 * This event is fired to obtain the parent <code>&lt;ui-view&gt;</code>.
 *
 * @summary
 *
 * This is the <code>&lt;ui-view&gt;</code> component.
 *
 * The <code>&lt;ui-view&gt;</code> component is a viewport for routed components.
 * Routed components will be rendered inside the <code>&lt;ui-view&gt;</code> viewport.
 *

 */
export class UiView extends LitElement {
  @property()
  name = '';

  /**
   * <code>&lt;ui-view&gt;</code> can be used without <code>&lt;ui-router&gt;</code>
   * by providing the <code>uiRouter</code> property directly.
   */
  @property({ attribute: false })
  uiRouter!: UIRouterLit;

  @state()
  private viewAddress!: UiViewAddress;

  /** Replaced only by a real view config change, so a retained view keeps its subtree. */
  @state()
  private component: RoutedLitTemplate | null = null;

  /** Created on connect: the @lit-labs/ssr DOM shim has no `createDocumentFragment`. */
  private inner?: DocumentFragment;

  /** @internal */
  createRenderRoot(): this {
    return this;
  }

  private readonly viewId = viewIdCounter++;

  private _uiViewData!: ActiveUIView;

  private resolveContext!: ResolveContext;

  private _viewConfigUpdated(config: ViewConfig) {
    if (!config) {
      this.component = null;
      this.requestUpdate();
      return;
    }

    if (!(config instanceof LitViewConfig)) {
      return;
    }

    // The "new" viewconfig is already applied, so exit early
    if (this._uiViewData.config === config) {
      return;
    }

    trace.traceUIViewConfigUpdated(this._uiViewData, config.viewDecl.$context!);
    this._applyUpdatedConfig(config);
  }

  private _applyUpdatedConfig(config: LitViewConfig) {
    this._uiViewData.config = config;

    if (!this.viewAddress && config?.viewDecl?.$context) {
      this.viewAddress = {
        fqn: this._uiViewData.fqn,
        context: config.viewDecl.$context,
      };
    }

    this.resolveContext = new ResolveContext(config.path);
    // Past the identity gate, so the config genuinely changed: a fresh renderer
    // here is what drops the old element.
    const { component } = config.viewDecl as NormalizedLitViewDeclaration;
    this.component = isRoutedLitElement(component)
      ? routedLitElementRenderer(component)
      : component;
    this.requestUpdate();
  }

  @state()
  private parentView!: UiView;

  private readonly onUiViewContextEvent = (event: UiViewContextEvent) => {
    // can't adopt self
    if (event.target === this) {
      return;
    }
    // handle event; provide self as parent
    event.stopPropagation();
    event.detail.parentView = this;
  };

  /** @internal */
  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener(
      this.constructor.uiViewContextEventName,
      this.onUiViewContextEvent as EventListener,
    );
    this.setupUiView();
    this.captureContent();
  }

  private static readonly uiViewContextEventName = 'ui-view-context';

  private static uiViewContextEvent(): UiViewContextEvent {
    return new CustomEvent(this.uiViewContextEventName, {
      bubbles: true,
      composed: true,
      detail: {
        parentView: null,
      },
    });
  }

  /** @internal */
  static seekParentView(candidate: Element): UiView | null {
    const uiViewContextEvent = this.uiViewContextEvent();
    candidate.dispatchEvent(uiViewContextEvent);
    return uiViewContextEvent.detail.parentView;
  }

  private seekParentView() {
    this.parentView = this.constructor.seekParentView(this)!;
  }

  private readonly onUiRouterContextEvent = (event: UiRouterContextEvent) => {
    UIRouterLitElement.onUiRouterContextEvent(this.uiRouter)(event);
  };

  private seekRouter() {
    if (!this.uiRouter) {
      this.uiRouter = UIRouterLitElement.seekRouter(this)!;
      // A sought router can be superseded; an app-provided one never is.
      this.routerFromSeek = !!this.uiRouter;
    }
    this.addEventListener(
      UIRouterLitElement.uiRouterContextEventName,
      this.onUiRouterContextEvent as EventListener,
    );
  }

  /** Whether `uiRouter` came from the context event rather than the app. */
  private routerFromSeek = false;

  /** The router this view actually registered with. */
  private boundRouter?: UIRouterLit;

  /** Seeks past this view's own answer to the context event. */
  private seekRouterAfresh(): UIRouterLit | undefined {
    const eventName = UIRouterLitElement.uiRouterContextEventName;
    this.removeEventListener(
      eventName,
      this.onUiRouterContextEvent as EventListener,
    );
    const found = UIRouterLitElement.seekRouter(this);
    this.addEventListener(
      eventName,
      this.onUiRouterContextEvent as EventListener,
    );
    return found;
  }

  /**
   * Re-registers when the router bound at connect turned out not to be the
   * app's.
   *
   * lit replays a property set before upgrade inside the element's first
   * update, so `<ui-router>` can run `connectedCallback` with `uiRouter` still
   * undefined and stand up an instance of its own; a `<ui-view>` connecting in
   * between binds to that instance and never sees a transition. Firefox
   * upgrades a detached subtree later than Chrome and WebKit, so declarative
   * shadow DOM parsed off-document reaches this there first.
   *
   * `registerUIView` syncs, so the re-registered view picks up the current
   * state without waiting for the next transition.
   */
  private rebindLateRouter(): void {
    const router = this.routerFromSeek
      ? this.seekRouterAfresh()
      : this.uiRouter;
    if (!router || router === this.boundRouter) {
      return;
    }

    this.teardownRouterSubscriptions();
    this.uiRouter = router;
    this.setupUiView();
  }

  private teardownRouterSubscriptions(): void {
    while (this.disconnectedHandlers.length) {
      const handler = this.disconnectedHandlers.shift();
      handler?.();
    }
  }

  private captureContent() {
    this.inner ??= document.createDocumentFragment();
    this.inner.append(...this.childNodes.values());
  }

  private readonly disconnectedHandlers: deregisterFn[] = [];

  private setupUiView() {
    this.seekRouter();
    this.seekParentView();
    const { viewId, uiRouter: router, parentView } = this;
    const name = this.name || '$default';

    const parentFqn = parentView?._uiViewData?.fqn;
    const creationContext =
      parentView?.viewContext || router?.stateRegistry.root();
    const fqn = parentFqn ? parentFqn + '.' + name : name;

    this._uiViewData = {
      $type: 'lit',
      id: viewId,
      name,
      fqn,
      creationContext,
      configUpdated: this._viewConfigUpdated.bind(this),
      config: undefined as unknown as ViewConfig,
    };

    if (!router) {
      return;
    }

    this.disconnectedHandlers.push(
      router.transitionService.onBefore({}, (trans) => {
        return this._invokeUiCanExitHook(trans);
      }) as deregisterFn,
    );

    this.disconnectedHandlers.push(
      router.transitionService.onSuccess({}, (trans) =>
        this._invokeUiOnParamsChangedHook(trans),
      ) as deregisterFn,
    );

    this.disconnectedHandlers.push(
      router.viewService.registerUIView(this._uiViewData),
    );
    this.boundRouter = router;
  }

  /** @internal */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener(
      this.constructor.uiViewContextEventName,
      this.onUiViewContextEvent as EventListener,
    );

    this.teardownRouterSubscriptions();
  }

  /**
   * For each transition, checks the component loaded in the ui-view for:
   *
   * - has a uiCanExit() component hook
   * - is being exited
   *
   * If both are true, adds the uiCanExit component function as a hook to that singular Transition.
   */
  private _invokeUiCanExitHook(trans: Transition) {
    const instance = this.firstElementChild as UiOnExit & Element;
    const uiCanExitFn: TransitionHookFn = instance?.uiCanExit;
    if (isFunction(uiCanExitFn)) {
      const state: StateDeclaration = this.state;

      if (trans.exiting().includes(state)) {
        trans.onStart({}, function () {
          return uiCanExitFn.call(instance, trans);
        });
      }
    }
  }

  /** @internal */
  requestUpdate(...args: Parameters<LitElement['requestUpdate']>): void {
    super.requestUpdate(...args);
    const instance = this.firstElementChild as LitElement;
    if (isFunction(instance?.requestUpdate)) {
      instance.requestUpdate();
    }
  }

  /**
   * For each transition, checks if any param values changed and notify component
   */
  private _invokeUiOnParamsChangedHook($transition$: Transition) {
    // Fresh resolves need a re-render; `render` reuses the element rather than rebuilding it.
    this.requestUpdate();

    const instance = this.firstElementChild as UiOnParamsChanged & Element;
    const uiOnParamsChanged: TransitionHookFn = instance?.uiOnParamsChanged;

    if (isFunction(uiOnParamsChanged)) {
      const viewState = this.state;
      const resolveContext: ResolveContext = new ResolveContext(
        this._uiViewData.config.path,
      );
      const viewCreationTrans: unknown =
        resolveContext.getResolvable('$transition$').data;

      // Exit early if the $transition$ is the same as the view was created within.
      // Exit early if the $transition$ will exit the state the view is for.
      if (
        $transition$ === viewCreationTrans ||
        $transition$.exiting().includes(viewState)
      )
        return;

      const toParams: { [paramName: string]: unknown } =
        $transition$.params('to');
      const fromParams: { [paramName: string]: unknown } =
        $transition$.params('from');
      const getNodeSchema = (node: PathNode) => node.paramSchema;
      const toSchema: Param[] = $transition$
        .treeChanges('to')
        .map(getNodeSchema)
        .reduce<Param[]>(unnestR, []);
      const fromSchema: Param[] = $transition$
        .treeChanges('from')
        .map(getNodeSchema)
        .reduce<Param[]>(unnestR, []);

      // Find the to params that have different values than the from params
      const changedToParams = toSchema.filter((param: Param) => {
        const idx = fromSchema.indexOf(param);
        return (
          idx === -1 ||
          !fromSchema[idx].type.equals(toParams[param.id], fromParams[param.id])
        );
      });

      // Only trigger callback if a to param has changed or is new
      if (changedToParams.length) {
        const changedKeys: string[] = changedToParams.map((x) => x.id);
        // Filter the params to only changed/new to params.  `$transition$.params()` may be used to get all params.
        const newValues = filter(toParams, (_, key) =>
          changedKeys.includes(key!),
        );
        instance.uiOnParamsChanged(newValues, $transition$);
      }
    }
  }

  /** @internal */
  public get viewContext(): ViewContext | undefined {
    return this?._uiViewData?.config?.viewDecl.$context;
  }

  /** @internal */
  public get state(): StateDeclaration {
    return (this.viewContext as StateObject).self;
  }

  /**
   * Reports a missing provider once this view has actually rendered nothing.
   *
   * Deliberately here rather than at the failed seek in `setupUiView`: the seek
   * runs in `connectedCallback`, and custom-element upgrade order is not
   * guaranteed, so a correct app can connect a `<ui-view>` before `<ui-router>`
   * upgrades. By the first completed update the no-op is observable.
   *
   * @internal
   */
  protected firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.rebindLateRouter();
    if (!this.uiRouter) {
      warnMissingRouter(this, '<ui-view>', 'will never render a routed view');
    }
  }

  /** @internal */
  render(): Node | TemplateResult {
    if (!this.component || !this.viewAddress) {
      // Never connected (server render): an empty declarative shadow root would hide the light DOM.
      return this.inner?.cloneNode(true) ?? html`<slot></slot>`;
    }

    const { uiRouter: router } = this;
    const injector = this.resolveContext.injector();
    const resolvables = this.resolveContext
      .getTokens()
      .filter((token) => isString(token))
      .map((token) => this.resolveContext.getResolvable(token))
      .filter((r) => r.resolved);

    const resolves = resolvables
      .map(({ token }) => [token as string, injector.get(token) as unknown])
      .reduce(applyPairs, {});
    const transition = injector.get(Transition) as Transition;

    const props: UIViewInjectedProps = { router, resolves, transition };

    return this.component(props);
  }
}

export interface UiView {
  /** @internal */
  constructor: typeof UiView;
}
