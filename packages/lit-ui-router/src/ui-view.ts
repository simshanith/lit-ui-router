import { LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
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
  UiOnExit,
  UiOnParamsChanged,
  NormalizedLitViewDeclaration,
} from './interface.js';
import { LitViewConfig, UIRouterLit } from './core.js';
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
 * @event {CustomEvent} ui-router-context
 *
 * This event is fired to obtain the <code>uiRouter</code> instance,
 * when not directly provided.
 * Once obtained, the <code>&lt;ui-view&gt;</code> listens and
 * provides the <code>uiRouter</code> to descendants.
 *
 * @event {CustomEvent} ui-view-context
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
@customElement('ui-view')
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

  @state()
  private component: RoutedLitTemplate | null = null;

  private inner = document.createDocumentFragment();

  /** @internal */
  createRenderRoot() {
    return this;
  }

  private viewId = viewIdCounter++;

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

  private async _applyUpdatedConfig(config: LitViewConfig) {
    this._uiViewData.config = config;

    if (!this.viewAddress && config?.viewDecl?.$context) {
      this.viewAddress = {
        fqn: this._uiViewData.fqn,
        context: config.viewDecl.$context,
      };
    }

    this.resolveContext = new ResolveContext(config.path);
    this.component = (
      config.viewDecl as NormalizedLitViewDeclaration
    ).component;
    this.requestUpdate();
  }

  @state()
  private parentView!: UiView;

  private onUiViewContextEvent = (event: UiViewContextEvent) => {
    // can't adopt self
    if (event.target === this) {
      return;
    }
    // handle event; provide self as parent
    event.stopPropagation();
    event.detail.parentView = this;
  };

  /** @internal */
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener(
      this.constructor.uiViewContextEventName,
      this.onUiViewContextEvent as EventListener,
    );
    this.setupUiView();
    this.captureContent();
  }

  private static uiViewContextEventName = 'ui-view-context';

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
  static seekParentView(candidate: Element) {
    const uiViewContextEvent = this.uiViewContextEvent();
    candidate.dispatchEvent(uiViewContextEvent);
    return uiViewContextEvent.detail.parentView;
  }

  private seekParentView() {
    this.parentView = this.constructor.seekParentView(this) as UiView;
  }

  private onUiRouterContextEvent = (event: UiRouterContextEvent) => {
    UIRouterLitElement.onUiRouterContextEvent(this.uiRouter)(event);
  };

  private seekRouter() {
    this.uiRouter = this.uiRouter || UIRouterLitElement.seekRouter(this);
    this.addEventListener(
      UIRouterLitElement.uiRouterContextEventName,
      this.onUiRouterContextEvent as EventListener,
    );
  }

  private captureContent() {
    this.inner.append(...this.childNodes.values());
  }

  private disconnectedHandlers: deregisterFn[] = [];

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
  }

  /** @internal */
  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener(
      this.constructor.uiViewContextEventName,
      this.onUiViewContextEvent as EventListener,
    );

    while (this.disconnectedHandlers.length) {
      const handler = this.disconnectedHandlers.shift();
      handler?.();
    }
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
    const uiCanExitFn: TransitionHookFn = instance && instance.uiCanExit;
    if (isFunction(uiCanExitFn)) {
      const state: StateDeclaration = this.state;

      if (trans.exiting().indexOf(state) !== -1) {
        trans.onStart({}, function () {
          return uiCanExitFn.call(instance, trans);
        });
      }
    }
  }

  /** @internal */
  requestUpdate(...args: Parameters<LitElement['requestUpdate']>) {
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
    this.requestUpdate();

    const instance = this.firstElementChild as UiOnParamsChanged & Element;
    const uiOnParamsChanged: TransitionHookFn = instance?.uiOnParamsChanged;

    if (isFunction(uiOnParamsChanged)) {
      const viewState = this.state;
      const resolveContext: ResolveContext = new ResolveContext(
        this._uiViewData.config.path,
      );
      const viewCreationTrans =
        resolveContext.getResolvable('$transition$').data;

      // Exit early if the $transition$ is the same as the view was created within.
      // Exit early if the $transition$ will exit the state the view is for.
      if (
        $transition$ === viewCreationTrans ||
        $transition$.exiting().indexOf(viewState) !== -1
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
        .reduce(unnestR, []);
      const fromSchema: Param[] = $transition$
        .treeChanges('from')
        .map(getNodeSchema)
        .reduce(unnestR, []);

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
        const newValues = filter(
          toParams,
          (_, key) => changedKeys.indexOf(key!) !== -1,
        );
        instance.uiOnParamsChanged(newValues, $transition$);
      }
    }
  }

  /** @internal */
  public get viewContext() {
    return this?._uiViewData?.config?.viewDecl.$context;
  }

  /** @internal */
  public get state() {
    return (this.viewContext as StateObject).self;
  }

  /** @internal */
  render() {
    if (!this.component || !this.viewAddress) {
      return this.inner.cloneNode(true);
    }

    const { uiRouter: router } = this;
    const injector = this.resolveContext.injector();
    const resolvables = this.resolveContext
      .getTokens()
      .filter((token) => isString(token))
      .map((token) => this.resolveContext.getResolvable(token))
      .filter((r) => r.resolved);

    const resolves = resolvables
      .map(({ token }) => [token, injector.get(token)])
      .reduce(applyPairs, {});
    const transition = injector.get(Transition);

    return this.component({
      router,
      resolves,
      transition,
    });
  }
}

export interface UiView {
  /** @internal */
  constructor: typeof UiView;
}
