import { LitElement, html, nothing } from 'lit';
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
import {
  warnDeferredNeverWoken,
  warnDeferredWithoutClient,
  warnMissingRouter,
} from './dev-warn.js';
import { UIRouterLitElement } from './ui-router.js';
import type {
  ParentView,
  UiRouterContextEvent,
  UiViewContextEvent,
} from './events.js';
import {
  adoptUiViewContext,
  contextRequestEventName,
  isContextRequest,
  parentUiViewContext,
  requestContext,
} from './context.js';

/** @internal */
let viewIdCounter = 0;

/**
 * Spelled out because the @lit-labs/ssr DOM shim has no `Node`. The type keeps
 * it the platform's value, checked against `Node` without referencing one.
 */
const COMMENT_NODE = 8 satisfies Node['COMMENT_NODE'];

/**
 * Whether `node` opens another render's output: lit's own empty child-part
 * comment, or a part marker a render wrote under whatever prefix.
 */
const isRenderMarker = (node: ChildNode | null): boolean => {
  if (!node || node.nodeType !== COMMENT_NODE) {
    return false;
  }
  const { data } = node as Comment;
  return data === '' || data.includes('lit-part');
};

/** @internal */
export interface UiViewAddress {
  context: ViewContext | StateObject;
  fqn: string;
}

type deregisterFn = () => void;

/** A view is its descendants' parent for its whole connected life. */
const noParentViewUnsubscribe = () => {};

/**
 * @hideconstructor
 * @category components
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
 * It answers the community <code>context-request</code> protocol for
 * {@link parentUiViewContext} with itself, from the same listener position, so
 * an element built on <code>@lit/context</code> finds its enclosing view too.
 * A view never answers its own request, so a nested
 * <code>&lt;ui-view&gt;</code> gets the view above it.
 *
 * @summary
 *
 * This is the <code>&lt;ui-view&gt;</code> component.
 *
 * The <code>&lt;ui-view&gt;</code> component is a viewport for routed components.
 * Routed components will be rendered inside the <code>&lt;ui-view&gt;</code> viewport.
 *
 * A prerendered view owns its own hydration. It sleeps while
 * <code>defer-hydration</code> is on it, rendering nothing. Removing the
 * attribute wakes it, and it requests <code>adoptUiViewContext</code> once and
 * calls the adopter it gets, which adopts the nodes the view holds. With none,
 * the view drops the held nodes and renders cold, warning in development. A
 * view detached before that wake update runs stays asleep, holding its nodes,
 * until it is attached again. Whatever the author wrote ahead of that render is
 * this view's fallback set, as it is on a cold view: it stands in the document
 * while the view sleeps, parks while a component occupies the view, and comes
 * back when none does.
 *
 */
export class UiView extends LitElement {
  /** the view name this viewport fills; empty selects the `$default` view */
  @property()
  name = '';

  /**
   * <code>&lt;ui-view&gt;</code> can be used without <code>&lt;ui-router&gt;</code>
   * by providing the <code>uiRouter</code> property directly.
   */
  @property({ attribute: false })
  uiRouter!: UIRouterLit;

  /** Written by the server on a prerendered view; while it is present the view renders nothing, and removing it wakes and hydrates the element. */
  @property({ type: Boolean, attribute: 'defer-hydration' })
  deferHydration = false;

  @state()
  private viewAddress!: UiViewAddress;

  /** Replaced only by a real view config change, so a retained view keeps its subtree. */
  @state()
  private component: RoutedLitTemplate | null = null;

  /**
   * Parks the fallback set while a component occupies the view.
   *
   * Created on connect: the @lit-labs/ssr DOM shim has no
   * `createDocumentFragment`.
   */
  private fallback?: DocumentFragment;

  /** The captured nodes, in authored order, wherever they currently sit. */
  private fallbackNodes: ChildNode[] = [];

  /** Whether those nodes sit in the fragment rather than in the light DOM. */
  private fallbackParked = true;

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
  private parentView!: ParentView | null;

  private readonly onUiViewContextEvent = (event: UiViewContextEvent) => {
    // can't adopt self; `target` is retargeted to this host for a view inside our shadow root, the path's first entry never is
    if (event.composedPath()[0] === this) {
      return;
    }
    // handle event; provide self as parent
    event.stopPropagation();
    event.detail.parentView = this;
  };

  /**
   * Answers a `context-request` for the parent-view context with itself.
   *
   * `subscribe` gets one call and a no-op unsubscribe: a view is the enclosing
   * view of its descendants for as long as it is connected.
   */
  private readonly onParentViewContextRequest = (event: Event) => {
    // A view's own request must reach the view above it.
    if (
      event.target === this ||
      !isContextRequest(event, parentUiViewContext)
    ) {
      return;
    }
    event.stopImmediatePropagation();
    event.callback(this, event.subscribe ? noParentViewUnsubscribe : undefined);
  };

  /** @internal */
  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener(
      this.constructor.uiViewContextEventName,
      this.onUiViewContextEvent as EventListener,
    );
    this.addEventListener(
      contextRequestEventName,
      this.onParentViewContextRequest,
    );
    this.setupUiView();
    // A deferred view holds another render's nodes behind whatever the author wrote ahead of them.
    if (this.deferHydration) {
      this.deferredAtConnect = true;
      if (import.meta.env.DEV) {
        // A macrotask: the hydrate walk clears the attribute within this task, and a pin answers on the wake update queued inside it.
        setTimeout(() => {
          if (this.isConnected && this.deferHydration && !this.hasUpdated) {
            warnDeferredNeverWoken(this);
          }
        }, 0);
      }
    } else if (this.deferredAtConnect) {
      // Re-attached still asleep: the wake update is this element's to ask for, since a router-less view registers nothing that would.
      this.requestUpdate();
    } else if (!this.hasUpdated) {
      // Past the first render the children are lit's own nodes and part markers, never authored hold content.
      this.captureContent();
    } else {
      // Re-attached under another provider: the seek above was skipped, the router it holds may no longer be the enclosing one.
      this.adoptProvidedRouter();
    }
  }

  private static readonly uiViewContextEventName =
    UIRouterLitElement.uiViewContextEventName;

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
  static seekParentView(candidate: Element): ParentView | null {
    const uiViewContextEvent = this.uiViewContextEvent();
    candidate.dispatchEvent(uiViewContextEvent);
    return uiViewContextEvent.detail.parentView;
  }

  private seekParentView() {
    this.parentView = this.constructor.seekParentView(this);
  }

  private readonly onUiRouterContextEvent = (event: UiRouterContextEvent) => {
    // Answering our own re-seek would just hand back the router we are replacing.
    if (this.seekingProvidedRouter) {
      return;
    }
    UIRouterLitElement.onUiRouterContextEvent(this.uiRouter)(event);
  };

  /** Answers `context-request` for the router, so a `@lit/context` consumer under this view is served too. */
  private readonly onContextRequest = (event: Event) => {
    if (this.seekingProvidedRouter) {
      return;
    }
    UIRouterLitElement.onContextRequest(this.uiRouter)(event);
  };

  private seekRouter() {
    if (!this.uiRouter) {
      this.soughtRouter = UIRouterLitElement.seekRouter(this);
      this.uiRouter = this.soughtRouter!;
    }
    this.addEventListener(
      UIRouterLitElement.uiRouterContextEventName,
      this.onUiRouterContextEvent as EventListener,
    );
    this.addEventListener(contextRequestEventName, this.onContextRequest);
  }

  /**
   * The router a seek last handed this view.
   *
   * Provenance, not a cache: `uiRouter` holding anything else means the app
   * assigned it, and an assignment is final. Equal to `uiRouter` — both
   * undefined included — means the view is free to seek again, since a
   * provider that had not upgraded yet may answer now.
   */
  private soughtRouter?: UIRouterLit;

  /** The router this view registered with; a late upgrade can supersede it. */
  private registeredRouter?: UIRouterLit;

  /** Set only for the synchronous span of our own re-seek. */
  private seekingProvidedRouter = false;

  /**
   * Seeks the provider's router, past our own answer.
   *
   * `<ui-view>` answers this event for descendants and stops it, deliberately —
   * see `listener-identity.spec.ts`. Suppressing that for the span of our own
   * dispatch keeps the guarantee intact for everyone else.
   */
  private seekProvidedRouter(): UIRouterLit | undefined {
    this.seekingProvidedRouter = true;
    try {
      return UIRouterLitElement.seekRouter(this);
    } finally {
      this.seekingProvidedRouter = false;
    }
  }

  /**
   * Adopts the router the provider now offers, when this view registered
   * without it or with another.
   *
   * Runs whenever the router this view holds is one a seek produced, or none:
   * a provider that upgraded late, or a different `<ui-router>` this view has
   * just been attached under, supersedes it. A router the app assigned is kept.
   *
   * lit replays a pre-upgrade property inside the element's first update, not
   * at upgrade, so `<ui-router>` can run `connectedCallback` with `uiRouter`
   * still undefined and provide an instance of its own; a `<ui-view>`
   * connecting in between registers with that one and never sees a transition.
   * Firefox upgrades a detached subtree later than Chrome and WebKit, so
   * declarative shadow DOM parsed off-document reaches this there first.
   *
   * `registerUIView` syncs, so the re-registered view picks up the current
   * state without waiting for the next transition.
   *
   * A wake re-seeks before the update it schedules, because on a prerendered
   * page that update is the hydrate and `render()` reads the component from
   * the real registration.
   */
  private adoptProvidedRouter(): void {
    // Detached, the parent-view seek finds nothing and `disconnectedCallback` has run, so the registration would be wrong and permanent.
    if (!this.isConnected) {
      return;
    }

    const assigned = !!this.uiRouter && this.uiRouter !== this.soughtRouter;
    const router = assigned ? this.uiRouter : this.seekProvidedRouter();
    if (!router || router === this.registeredRouter) {
      return;
    }

    if (!assigned) {
      this.soughtRouter = router;
    }
    this.deregisterAll();
    this.uiRouter = router;
    this.setupUiView();
  }

  private deregisterAll(): void {
    while (this.disconnectedHandlers.length) {
      const handler = this.disconnectedHandlers.shift();
      handler?.();
    }
  }

  /** Set at connect on a deferred view, so the first update that runs is known to be the wake. */
  private deferredAtConnect = false;

  /** Set by the one capture this element gets, so a re-attach before the first update cannot append a second time. */
  private captured = false;

  /**
   * The children standing ahead of the first render's output: lit opens a
   * child part with an empty comment, and the server writes `lit-part`
   * markers. From that marker down the nodes are a render's, never authored.
   */
  private authoredPrefix(): ChildNode[] {
    const authored: ChildNode[] = [];
    for (const child of this.childNodes) {
      if (isRenderMarker(child)) break;
      authored.push(child);
    }
    return authored;
  }

  /**
   * Takes the authored children ahead of any render as this view's fallback
   * set.
   *
   * The nodes are moved, never copied, so they keep their identity and any
   * binding an enclosing template holds on them stays live. The first update
   * stands them back up when no component occupies the view.
   *
   * A view whose first child is a render marker holds a render's output from
   * the first child down, so it captures nothing and the nodes stay where they
   * stand: they are lit's own on a re-attached view, and never ours to move.
   */
  private captureContent() {
    if (this.captured || isRenderMarker(this.firstChild)) {
      return;
    }
    this.captured = true;
    this.fallback ??= document.createDocumentFragment();
    this.fallbackNodes = this.authoredPrefix();
    this.fallback.append(...this.fallbackNodes);
  }

  /**
   * Takes the authored children of a woken view as its fallback set, leaving
   * them where they stand.
   *
   * They are the children ahead of the render this view holds, so a view
   * holding nothing else is all fallback and one holding a render from the
   * first child down has none. Nothing is parked: the nodes stood in the
   * document while the view slept, and this update parks them only if a
   * component occupies the view, like any other fallback set.
   *
   * It runs at the wake rather than at connect because a deferred view is a
   * parsed one, and the document parser can connect an element before it fills it.
   */
  private captureHeldContent(): void {
    if (this.captured) {
      return;
    }
    const authored = this.authoredPrefix();
    if (!authored.length) {
      return;
    }
    this.captured = true;
    this.fallback ??= document.createDocumentFragment();
    this.fallbackNodes = authored;
    this.fallbackParked = false;
  }

  /** Whether this render shows the fallback set rather than a routed component. */
  private get showsFallback(): boolean {
    return !this.component || !this.viewAddress;
  }

  /**
   * Moves the fallback set between the light DOM and the fragment.
   *
   * It goes in ahead of everything else, and lit appends its own render marker
   * at the end of the element, so the two never interleave and the component's
   * nodes stay the only ones lit owns.
   */
  private placeFallback(): void {
    const fallback = this.fallback;
    const park = !this.showsFallback;
    if (!fallback || park === this.fallbackParked) {
      return;
    }
    this.fallbackParked = park;
    if (park) {
      fallback.append(...this.fallbackNodes);
    } else {
      this.insertBefore(fallback, this.firstChild);
    }
  }

  private readonly disconnectedHandlers: deregisterFn[] = [];

  private setupUiView() {
    this.seekRouter();
    this.seekParentView();
    const { viewId, uiRouter: router, parentView } = this;
    const name = this.name || '$default';

    const parentFqn = parentView?.fqn;
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
    this.registeredRouter = router;
  }

  /** @internal */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener(
      this.constructor.uiViewContextEventName,
      this.onUiViewContextEvent as EventListener,
    );
    this.removeEventListener(
      contextRequestEventName,
      this.onParentViewContextRequest,
    );

    this.deregisterAll();
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
  public get fqn(): string | undefined {
    return this._uiViewData?.fqn;
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
   * Declines every update while the view sleeps.
   *
   * A declined update still settles: `updateComplete` resolves `true` while
   * the view is asleep, so awaiting it proves nothing about a render having
   * happened — `hasUpdated` tells the two states apart. lit also marks the
   * declined update complete, so the changed-properties map arrives empty at
   * the wake and carries nothing that changed during a detached sleep.
   *
   * @internal
   */
  protected shouldUpdate(changed: PropertyValues<this>): boolean {
    // Asleep: nothing renders, and `hasUpdated` stays false, so `firstUpdated` still fires on the real first render.
    if (this.deferHydration) return false;
    // Detached before the wake ran: `willUpdate` is skipped too, so the held nodes and `deferredAtConnect` survive until a re-attach.
    if (this.deferredAtConnect && !this.isConnected) return false;
    return super.shouldUpdate(changed);
  }

  /** @internal */
  protected willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (this.deferredAtConnect) {
      this.adoptHeldNodes();
      // The wake is this view's first look at its children: the document parser can connect an element before it fills it.
      this.captureHeldContent();
    }
    this.placeFallback();
  }

  /** The first attached update after a deferred wake: re-seek the router the hydrate reads, then hand the view to an adopter or drop the foreign nodes. */
  private adoptHeldNodes(): void {
    this.deferredAtConnect = false;
    this.adoptProvidedRouter();
    const adopt = requestContext(this, adoptUiViewContext);
    if (adopt) return adopt(this);
    // Rendering over another render's nodes doubles the markup; what the author wrote ahead of them is the capture's.
    this.dropHeldRender();
    warnDeferredWithoutClient(this);
  }

  /** Drops the held render: every child from the first render marker down, leaving what the author wrote ahead of it. */
  private dropHeldRender(): void {
    const children = [...this.childNodes];
    const from = children.findIndex((child) => isRenderMarker(child));
    if (from < 0) {
      return;
    }
    // Optionally called: the @lit-labs/ssr DOM shim gives its nodes no `remove`.
    for (const child of children.slice(from)) child.remove?.();
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
    this.adoptProvidedRouter();
    if (!this.uiRouter) {
      warnMissingRouter(this, '<ui-view>', 'will never render a routed view');
    }
  }

  /**
   * The routed component's template, or nothing while the fallback set stands
   * in the light DOM on its own.
   */
  render(): TemplateResult | typeof nothing {
    if (this.showsFallback) {
      // Nothing captured, so never connected (server render) or holding another render's nodes: an empty declarative shadow root would hide the light DOM.
      return this.fallback ? nothing : html`<slot></slot>`;
    }

    const { uiRouter: router, component } = this;
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

    return component!(props);
  }
}

export interface UiView {
  /** @internal */
  constructor: typeof UiView;
}
