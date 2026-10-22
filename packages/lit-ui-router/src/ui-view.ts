import { LitElement, html, noChange, nothing } from 'lit';
import type {
  PropertyValues,
  ReactiveController,
  ReactiveControllerHost,
  TemplateResult,
} from 'lit';
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
  isFunction,
  isString,
  unnestR,
  Param,
  type RawParams,
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
import { routedElementOf, routedLitElementRenderer } from './routed-element.js';
import { warnMissingRouter } from './dev-warn.js';
import { UIRouterLitElement } from './ui-router.js';
import type {
  ParentView,
  UiRouterContextEvent,
  UiViewContextEvent,
} from './events.js';
import {
  contextRequestEventName,
  isContextRequest,
  parentUiViewContext,
} from './context.js';
import { RouterSubscribers, subscribeRouter } from './router-subscription.js';

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

  // SAFETY: `nodeType` COMMENT_NODE is a Comment
  const { data } = node as Comment;

  return data === '' || data.includes('lit-part');
};

/** Whether `node` sits inside `host`, across shadow roots. */
const composedContains = (host: Node, node: Node): boolean => {
  let current: Node | null = node;

  while (current && current !== host) {
    // SAFETY: a node with no parent is a shadow root, whose `host` leads out, or the top of its tree
    current =
      current.parentNode ?? (current as Partial<ShadowRoot>).host ?? null;
  }

  return current === host;
};

/** The attribute marking a view's routed element. */
const ROUTED_ATTRIBUTE = 'routed';

/** An element that may be a `ReactiveElement`, which reports its first update. */
type MaybeReactive = Element &
  Partial<ReactiveControllerHost & { readonly hasUpdated: boolean }>;

/** The incoming element a swap waits on, and how to stop waiting. */
interface PendingSwap {
  element: Element;
  cancel: () => void;
}

/** @internal */
interface ViewAddress {
  context: ViewContext | StateObject;
  fqn: string;
}

export type {
  /**
   * @internal
   * @deprecated `<ui-view>` plumbing, not a supported import (#541).
   */
  ViewAddress as UiViewAddress,
};

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
 * Its children are internal: read the routed component's element through
 * <code>routedElement</code>, or select it with <code>ui-view &gt; [routed]</code>.
 *
 * Whatever the author wrote inside the element, ahead of any render, is this
 * view's fallback set: it stands in the document while no component occupies
 * the view, parks while one does, and comes back when none does.
 *
 * A prerendered page needs the served variant this element is the base of —
 * <code>lit-ui-router-ssr/register</code> defines <code>ui-view</code> with it.
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

  @state()
  private viewAddress!: ViewAddress;

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

  /** The element a class component rendered; a template component leaves it unset. */
  private classElement?: Element;

  /**
   * Two places for class elements: an incoming element takes the free one, so
   * the element it replaces stands until the incoming one has rendered.
   */
  private readonly elementSlots: (Element | typeof nothing)[] = [
    nothing,
    nothing,
  ];

  /** The incoming element whose first update retires the one it replaces. */
  private pendingSwap?: PendingSwap;

  /** The element carrying the `routed` attribute. */
  private markedElement?: Element;

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
    // SAFETY: `litViewsBuilder` normalizes every view declaration of a lit state
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
    // A view's own request must reach the view above it; `target` is retargeted to this host for a view inside our shadow root, the path's first entry never is.
    if (
      event.composedPath()[0] === this ||
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
      // SAFETY: only `UiViewContextEvent`s are dispatched under this name
      this.onUiViewContextEvent as EventListener,
    );
    this.addEventListener(
      contextRequestEventName,
      this.onParentViewContextRequest,
    );
    this.setupUiView();

    if (this.hasUpdated) {
      // Re-attached under another provider: the seek above was skipped, the router it holds may no longer be the enclosing one.
      this.adoptProvidedRouter();
    } else {
      // Past the first render the children are lit's own nodes and part markers, never authored content.
      this.captureContent();
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

  // eslint-disable-next-line typescript/no-deprecated -- the house ui-router-context path stays answered until 2.0 (#874)
  private readonly onUiRouterContextEvent = (event: UiRouterContextEvent) => {
    // Answering our own re-seek would just hand back the router we are replacing.
    if (this.seekingProvidedRouter) {
      return;
    }

    // eslint-disable-next-line typescript/no-deprecated -- the house ui-router-context path stays answered until 2.0 (#874)
    UIRouterLitElement.onUiRouterContextEvent(this.uiRouter)(event);
  };

  /** Subscribers that took a router this view may still supersede. */
  private readonly routerSubscribers = new RouterSubscribers();

  /**
   * Answers `context-request` for the router, so a `@lit/context` consumer
   * under this view is served too.
   *
   * While the router this view holds is a sought one its provider may still
   * replace, a `subscribe` request is kept and called once more with the router
   * this view adopts.
   */
  private readonly onContextRequest = (event: Event) => {
    if (this.seekingProvidedRouter) {
      return;
    }

    this.routerSubscribers.answer(
      event,
      this.uiRouter,
      !!this.providerSubscription && this.uiRouter === this.soughtRouter,
    );
  };

  private seekRouter() {
    if (!this.uiRouter) {
      this.soughtRouter = this.seekProvidedRouter();
      this.uiRouter = this.soughtRouter!;
    }

    this.addEventListener(
      // eslint-disable-next-line typescript/no-deprecated -- the house ui-router-context path stays answered until 2.0 (#874)
      UIRouterLitElement.uiRouterContextEventName,
      // SAFETY: only `UiRouterContextEvent`s are dispatched under this name
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

  /** Drops this view's subscription to its provider; set while the provider may still replace its router. */
  private providerSubscription?: () => void;

  /** The provider replaced the router this view sought: adopt it, and pass it on. */
  private readonly onProvidedRouterReplaced = () => {
    this.providerSubscription = undefined;
    this.adoptProvidedRouter();
  };

  /**
   * Seeks the provider's router, past our own answer.
   *
   * `<ui-view>` answers this event for descendants and stops it, deliberately —
   * see `listener-identity.spec.ts`. Suppressing that for the span of our own
   * dispatch keeps the guarantee intact for everyone else.
   */
  private seekProvidedRouter(): UIRouterLit | undefined {
    this.providerSubscription?.();
    this.seekingProvidedRouter = true;

    try {
      const { router, unsubscribe } = subscribeRouter(
        this,
        this.onProvidedRouterReplaced,
      );

      this.providerSubscription = unsubscribe;

      return router;
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
   * A subclass that renders against a registration made elsewhere calls it
   * before the update that reads the component.
   */
  protected adoptProvidedRouter(): void {
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
    this.routerSubscribers.deliver(router);
  }

  private deregisterAll(): void {
    while (this.disconnectedHandlers.length) {
      const handler = this.disconnectedHandlers.shift();
      handler?.();
    }
  }

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
  protected captureContent(): void {
    if (this.captured || isRenderMarker(this.firstChild)) {
      return;
    }

    this.captured = true;
    this.fallback ??= document.createDocumentFragment();
    this.fallbackNodes = this.authoredPrefix();
    this.fallback.append(...this.fallbackNodes);
  }

  /**
   * Takes the authored children standing ahead of any render as this view's
   * fallback set, leaving them where they are.
   *
   * The nodes are not parked: they already stand in the document, and the
   * update that follows parks them only if a component occupies the view, like
   * any other fallback set. A view whose children are a render's from the first
   * one down captures nothing.
   *
   * This is the capture for a subclass that fills the element before its first
   * render, where {@link captureContent} at connect would be too early.
   */
  protected captureContentInPlace(): void {
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

    const registration: Omit<ActiveUIView, 'config'> & { config?: ViewConfig } =
      {
        $type: 'lit',
        id: viewId,
        name,
        fqn,
        creationContext,
        configUpdated: this._viewConfigUpdated.bind(this),
        config: undefined,
      };

    // SAFETY: ui-router calls `configUpdated` with a config before anything reads `config`
    this._uiViewData = registration as ActiveUIView;

    if (!router) {
      return;
    }

    // SAFETY: hook registration returns its deregistration function
    this.disconnectedHandlers.push(
      router.transitionService.onBefore({}, (trans) => {
        return this._invokeUiCanExitHook(trans);
      }) as deregisterFn,
    );

    // SAFETY: hook registration returns its deregistration function
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
      // SAFETY: only `UiViewContextEvent`s are dispatched under this name
      this.onUiViewContextEvent as EventListener,
    );
    this.removeEventListener(
      contextRequestEventName,
      this.onParentViewContextRequest,
    );

    this.providerSubscription?.();
    this.providerSubscription = undefined;
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
    const instance: (Partial<UiOnExit> & Element) | null = this.routedElement;

    const uiCanExitFn = instance?.uiCanExit;

    if (isFunction(uiCanExitFn)) {
      const state: StateDeclaration = this.state;

      if (trans.exiting().includes(state)) {
        trans.onStart({}, function () {
          return uiCanExitFn.call(instance, trans);
        });
      }
    }
  }

  /**
   * The element the routed component rendered: a class component's instance,
   * or the first element a template component rendered. `null` while the
   * fallback set shows.
   *
   * The view's children are internal, so read the routed element here rather
   * than through `firstElementChild` or child selectors. While a class
   * component replaces another, both stand until the incoming element has
   * rendered, and this is the incoming one.
   *
   * The same element carries the `routed` attribute, for CSS:
   * `ui-view > [routed]`.
   */
  get routedElement(): Element | null {
    return (
      this.classElement ?? (this.showsFallback ? null : this.firstElementChild)
    );
  }

  /** @internal */
  requestUpdate(...args: Parameters<LitElement['requestUpdate']>): void {
    super.requestUpdate(...args);

    const instance:
      | (Partial<Pick<LitElement, 'requestUpdate'>> & Element)
      | null = this.routedElement;

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

    const instance: (Partial<UiOnParamsChanged> & Element) | null =
      this.routedElement;

    if (isFunction(instance?.uiOnParamsChanged)) {
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

      const toParams: RawParams = $transition$.params('to');

      const fromParams: RawParams = $transition$.params('from');

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
    // SAFETY: a lit view's `$context` is the StateObject that declared it
    return (this.viewContext as StateObject).self;
  }

  /**
   * Adopts a late provider's router ahead of the first render, then places the
   * fallback set.
   *
   * Inside `willUpdate` the registration's sync folds into this update, so the
   * first render already shows the routed component instead of scheduling a
   * second update from `firstUpdated`.
   *
   * @internal
   */
  protected willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);

    if (!this.hasUpdated) {
      this.adoptProvidedRouter();
    }

    this.placeFallback();
  }

  /**
   * Reports a missing provider once this view has actually rendered nothing.
   *
   * Deliberately here rather than at the failed seek in `setupUiView`: the seek
   * runs in `connectedCallback`, and custom-element upgrade order is not
   * guaranteed, so a correct app can connect a `<ui-view>` before `<ui-router>`
   * upgrades. The first update's `willUpdate` re-seeks, so by the first
   * completed update the no-op is observable.
   *
   * @internal
   */
  /** @internal */
  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    this.markRoutedElement();
  }

  /** Moves the `routed` attribute onto the current routed element. */
  private markRoutedElement(): void {
    const element = this.routedElement ?? undefined;

    if (element === this.markedElement) {
      return;
    }

    this.markedElement?.removeAttribute(ROUTED_ATTRIBUTE);
    element?.setAttribute(ROUTED_ATTRIBUTE, '');
    this.markedElement = element;
  }

  protected firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);

    if (!this.uiRouter) {
      warnMissingRouter(this, '<ui-view>', 'will never render a routed view');
    }
  }

  /**
   * The routed component's template, or nothing while the fallback set stands
   * in the light DOM on its own.
   */
  render(): TemplateResult | typeof nothing | typeof noChange {
    // Inside an element its parent is retiring, so a config routed here is the incoming element's to render.
    if (this.parentView instanceof UiView && this.parentView.retires(this)) {
      return noChange;
    }

    if (this.showsFallback) {
      this.dropElements();

      // Nothing captured, so never connected (server render) or holding a render's nodes: an empty declarative shadow root would hide the light DOM.
      return this.fallback ? nothing : html`<slot></slot>`;
    }

    const { uiRouter: router, component, resolveContext: context } = this;
    const injector = context.injector();

    // The injector hands a NOWAIT token's promise, which renders before it settles.
    const resolves = context
      .getTokens()
      .filter(isString)
      .filter((token) => {
        const resolvable = context.getResolvable(token);

        return (
          resolvable.resolved ||
          context.getPolicy(resolvable).async === 'NOWAIT'
        );
      })
      .map((token): [string, unknown] => [token, injector.get<unknown>(token)])
      .reduce(applyPairs, {});

    const transition = injector.get<Transition>(Transition);

    const props: UIViewInjectedProps = { router, resolves, transition };

    const result = component!(props);
    const element = routedElementOf(result);

    if (!element) {
      this.dropElements();

      return result;
    }

    return this.placeElement(element);
  }

  /**
   * Renders `element` beside the one it replaces, which stands until
   * `element` has rendered: lit would otherwise remove it before inserting one
   * that has not.
   */
  private placeElement(element: Element): TemplateResult {
    const slots = this.elementSlots;

    if (element !== this.classElement) {
      // An incoming element that never rendered gives way, so the one on screen stays.
      const superseded = this.cancelPendingSwap();

      if (superseded) {
        slots[slots.indexOf(superseded)] = nothing;
      }

      this.classElement = element;

      if (!slots.includes(element)) {
        slots[slots.indexOf(nothing)] = element;
      }

      if (this.outgoingElement) {
        this.awaitFirstUpdate(element);
      }
    }

    return html`${slots[0]}${slots[1]}`;
  }

  /** The element standing beside the current one until that one has rendered. */
  private get outgoingElement(): Element | undefined {
    for (const slot of this.elementSlots) {
      if (slot !== nothing && slot !== this.classElement) return slot;
    }

    return undefined;
  }

  /** Retires the outgoing element once `element` has completed its first update. */
  private awaitFirstUpdate(element: MaybeReactive): void {
    const retire = () => this.retire(element);

    if (!isFunction(element.addController) || element.hasUpdated) {
      void Promise.resolve().then(retire);
      this.pendingSwap = { element, cancel: () => {} };

      return;
    }

    let done = false;

    const controller: ReactiveController = {
      hostUpdated: () => {
        if (done) return;
        done = true;
        retire();
      },
    };

    element.addController(controller);
    this.pendingSwap = {
      element,
      cancel: () => {
        done = true;
        // Deferred: lit iterates the controllers while it runs hostUpdated.
        void Promise.resolve().then(() =>
          element.removeController?.(controller),
        );
      },
    };
  }

  /** Stops waiting on the pending incoming element, and returns it. */
  private cancelPendingSwap(): Element | undefined {
    const pending = this.pendingSwap;
    this.pendingSwap = undefined;
    pending?.cancel();

    return pending?.element;
  }

  /** Whether `node` sits in the element this view is retiring. */
  private retires(node: Node): boolean {
    const outgoing = this.outgoingElement;

    return !!outgoing && composedContains(outgoing, node);
  }

  private dropElements(): void {
    this.cancelPendingSwap();
    this.classElement = undefined;
    this.elementSlots.fill(nothing);
  }

  /** Drops the element `incoming` replaced, unless a later swap took over. */
  private retire(incoming: Element): void {
    if (this.classElement !== incoming) {
      return;
    }

    this.cancelPendingSwap();
    const slots = this.elementSlots;
    slots[slots[0] === incoming ? 1 : 0] = nothing;
    // The routed element has nothing new to render.
    super.requestUpdate();
  }
}

export interface UiView {
  /** @internal */
  constructor: typeof UiView;
}
