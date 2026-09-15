import { LitElement, html, nothing } from 'lit';
import type { PropertyValues, RenderOptions, TemplateResult } from 'lit';
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
import { warnColdServedRender, warnMissingRouter } from './dev-warn.js';
import { UIRouterLitElement, UiRouterContextEvent } from './ui-router.js';

/**
 * Prefixes every part marker `UiViewRenderer` writes inside a `<ui-view>`.
 *
 * `hydrate()` acts on comments whose data starts with `lit-part`, `/lit-part`
 * or `lit-node` and reads straight past every other comment, so a prefixed
 * marker is invisible to the walk hydrating the view's surroundings. The view
 * renames its own markers back at the wake, immediately before it hydrates
 * against them.
 *
 * @internal
 */
export const servedMarkerPrefix = 'ui-view:';

// The @lit-labs/ssr DOM shim has no `Node` global, and `willUpdate` runs there.
const COMMENT_NODE = 8;
const ELEMENT_NODE = 1;

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
 * @summary
 *
 * This is the <code>&lt;ui-view&gt;</code> component.
 *
 * The <code>&lt;ui-view&gt;</code> component is a viewport for routed components.
 * Routed components will be rendered inside the <code>&lt;ui-view&gt;</code> viewport.
 *
 * A prerendered view owns its own hydration. It sleeps while
 * <code>defer-hydration</code> is on it, rendering nothing, and its served
 * markers stay prefixed so the walk hydrating its surroundings reads past
 * them. Removing the attribute wakes it: it reveals those markers and adopts
 * the server's render through <code>UiView.hydrator</code>. With no hydrator
 * installed it drops that render and renders cold.
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

  /**
   * The hole a hydration client fills so a served view can adopt its markup.
   *
   * Core cannot depend on `@lit-labs/ssr-client`, so the `hydrate()` call is
   * the one piece of the seam it does not own. An installed hydrator must
   * adopt `container`'s children as the rendered `value`, leaving the lit part
   * it builds on the container so the `render()` that follows reuses it. A
   * client that cannot adopt — a document drawn for another state, say — must
   * leave the container ready for a plain render instead; whether that is
   * worth a warning is the client's call.
   *
   * Installed once, before the elements are registered, and shared by every
   * `<ui-view>` on the page.
   */
  static hydrator?: (
    value: unknown,
    container: HTMLElement,
    options?: RenderOptions,
  ) => void;

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
    // A deferred view holds server content between part markers, not authored hold content.
    if (!this.deferHydration) {
      this.captureContent();
    }
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
    // Answering our own re-seek would just hand back the router we are replacing.
    if (this.seekingProvidedRouter) {
      return;
    }
    UIRouterLitElement.onUiRouterContextEvent(this.uiRouter)(event);
  };

  private seekRouter() {
    if (!this.uiRouter) {
      this.uiRouter = UIRouterLitElement.seekRouter(this)!;
      // A sought router can be superseded; an app-provided one never is.
      this.routerFromProvider = !!this.uiRouter;
    }
    this.addEventListener(
      UIRouterLitElement.uiRouterContextEventName,
      this.onUiRouterContextEvent as EventListener,
    );
  }

  /** Whether `uiRouter` came from the context event rather than the app. */
  private routerFromProvider = false;

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
   * without it.
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
   * A wake — `deferHydration` going false — re-seeks before the update it
   * schedules, because on a prerendered page that update is the hydrate and
   * `render()` reads the component from the real registration.
   */
  private adoptProvidedRouter(): void {
    const router = this.routerFromProvider
      ? this.seekProvidedRouter()
      : this.uiRouter;
    if (!router || router === this.registeredRouter) {
      return;
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

  /** Set by the first update on a view that holds server output, and never cleared. */
  private wasServed = false;

  /** True between that detection and the wake that reveals the server's markers. */
  private servedPending = false;

  private static isPart(node: Node | undefined, data: string): boolean {
    return (
      node?.nodeType === COMMENT_NODE && (node as Comment).data.startsWith(data)
    );
  }

  /**
   * Recognises server output by the plain outer part marker that opens it.
   *
   * Every marker the server writes between that pair carries
   * {@link servedMarkerPrefix}, so nothing inside is mistaken for the pair
   * itself. The children are there to read: a served view sleeps under
   * `defer-hydration`, and the wake is long after the document was parsed.
   */
  private detectServed(): void {
    // The @lit-labs/ssr DOM shim has no `firstChild`, and a server render has nothing to detect.
    if (!UiView.isPart(this.firstChild ?? undefined, 'lit-part')) return;
    this.wasServed = true;
    this.servedPending = true;
  }

  /** Strips the prefix from one marker comment, leaving anything else alone. */
  private static revealMarker(node: Node | null): void {
    const comment = node as Comment | null;
    if (!UiView.isPart(comment ?? undefined, servedMarkerPrefix)) return;
    comment!.data = comment!.data.slice(servedMarkerPrefix.length);
  }

  /**
   * Renames this view's own served markers back to the ones `hydrate()` reads.
   *
   * A nested `<ui-view>` is left closed: only the outer pair this template
   * wrote around it is renamed, because everything inside is that view's own
   * served content and stays hidden from this walk until its own wake.
   */
  private static revealServedMarkers(node: Node): void {
    for (const child of node.childNodes) {
      if (child.nodeType === COMMENT_NODE) {
        UiView.revealMarker(child);
      } else if (child instanceof UiView) {
        UiView.revealMarker(child.firstChild);
        UiView.revealMarker(child.lastChild);
      } else if (child.nodeType === ELEMENT_NODE) {
        UiView.revealServedMarkers(child);
      }
    }
  }

  /**
   * Reveals the server's markers and hands them to the hydrator, once.
   *
   * Without a hydrator the server's nodes go instead: the plain render that
   * follows writes into the same outer pair and would otherwise double them.
   */
  private revealServed(): void {
    if (!this.servedPending) return;
    this.servedPending = false;
    const { hydrator } = UiView;
    if (!hydrator) {
      this.clearServed();
      warnColdServedRender(this);
      return;
    }
    UiView.revealServedMarkers(this);
    hydrator(this.render(), this, this.renderOptions);
  }

  /** Drops the server's nodes, keeping the outer pair the cold render writes into. */
  private clearServed(): void {
    for (const node of [...this.childNodes].slice(1, -1)) node.remove();
  }

  /** Sweeps authored hold content aside so the hold render can replay a clone. */
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
    this.registeredRouter = router;
  }

  /** @internal */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener(
      this.constructor.uiViewContextEventName,
      this.onUiViewContextEvent as EventListener,
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
  public get viewContext(): ViewContext | undefined {
    return this?._uiViewData?.config?.viewDecl.$context;
  }

  /** @internal */
  public get state(): StateDeclaration {
    return (this.viewContext as StateObject).self;
  }

  /** @internal */
  protected shouldUpdate(changed: PropertyValues<this>): boolean {
    // Asleep: nothing renders, and `hasUpdated` stays false, so `firstUpdated` still fires on the real first render.
    return !this.deferHydration && super.shouldUpdate(changed);
  }

  /** @internal */
  protected willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    // The parser connects this element before its children exist, so detection waits for the first update.
    if (!this.hasUpdated) this.detectServed();
    // A document rendered without `deferHydration: true` serves markup with no attribute to remove, so its first update is the wake.
    const woke =
      (changed.has('deferHydration') && !this.deferHydration) ||
      (this.wasServed && !this.hasUpdated);
    if (!woke) return;
    // The first render after waking is the hydrate, so it needs the real router; lit records no old value on a first update.
    this.adoptProvidedRouter();
    this.revealServed();
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

  /** @internal */
  render(): Node | TemplateResult | typeof nothing {
    if (!this.component || !this.viewAddress) {
      // A prerendered view has no authored hold content; the server wrote empty markers for an unrouted address.
      if (this.wasServed) return nothing;
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
