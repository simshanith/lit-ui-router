import { nothing } from 'lit';
import type {
  ReactiveController,
  ReactiveControllerHost,
  ReactiveElement,
  TemplateResult,
} from 'lit';
import {
  type ActiveUIView,
  isFunction,
  ResolveContext,
  trace,
  type ViewConfig,
  type ViewContext,
} from '@uirouter/core';

import { contextRequestEventName } from './context.js';
import { LitViewConfig, type UIRouterLit } from './core.js';
import type { UiViewContextEvent } from './events.js';
import { uiViewContextEventName } from './events.js';
import type { RoutedLitTemplate } from './interface.js';
import { routedElementOf } from './routed-element.js';
import { routedViewTemplate } from './routed-view.js';
import { RouterSubscribers, subscribeRouter } from './router-subscription.js';
import { UiView } from './ui-view.js';
import { setViewHost } from './view-rendered.js';
import {
  createViewRegistration,
  type DeregisterFn,
  nextViewId,
  registerView,
  routedComponentOf,
} from './view-registration.js';

/**
 * Options for {@link UiViewController}.
 *
 * @category controllers
 */
export interface UiViewControllerOptions {
  /** The view name the outlet fills; omitted or empty selects the `$default` view, as on `<ui-view>`. */
  name?: string;

  /**
   * The {@link UIRouterLit} instance to render for.
   *
   * The controller offers it to the host's descendants over the router
   * `context-request`, so `uiSref` links in the host's template and views in
   * the routed component find it with no <code>&lt;ui-router&gt;</code>.
   *
   * When omitted, the controller discovers the router from an ancestor
   * <code>&lt;ui-router&gt;</code> (or <code>&lt;ui-view&gt;</code>) each time
   * the host connects, and follows the placeholder router a
   * <code>&lt;ui-router&gt;</code> mints for itself to the one that replaces it.
   */
  router?: UIRouterLit;
}

/** The outlet each host holds; a host fills one view. */
const outlets = new WeakMap<HTMLElement, UiViewController>();

/**
 * A Lit
 * {@link https://lit.dev/docs/composition/controllers/ | ReactiveController}
 * that fills a view from the host's own template, without a
 * <code>&lt;ui-view&gt;</code> element: call {@link UiViewController.outlet}
 * where the routed component belongs.
 *
 * It registers with the router the way a <code>&lt;ui-view&gt;</code> in the
 * host's place would: named under the enclosing view, and the parent of any
 * <code>&lt;ui-view&gt;</code> (or another outlet's host) the routed
 * component renders. The routed component's `uiCanExit` and
 * `uiOnParamsChanged` hooks run as they do under
 * <code>&lt;ui-view&gt;</code>.
 *
 * A host holds one outlet: a second `UiViewController` on the same host
 * throws. A host with named views renders
 * <code>&lt;ui-view name="…"&gt;</code> elements in place of the outlet.
 *
 * Passed a `router`, the outlet needs no lit-ui-router elements at all: plain
 * lit templates, this controller and `uiSref` on plain anchors, all from
 * `lit-ui-router/pure`.
 *
 * It renders on the client only: `lit-ui-router-ssr` neither prerenders nor
 * hydrates an outlet.
 *
 * @example Render the routed view inside the host's layout
 * ```ts
 * class AppShell extends LitElement {
 *   private readonly view = new UiViewController(this);
 *
 *   render() {
 *     return html`<nav>…</nav><main>${this.view.outlet()}</main>`;
 *   }
 * }
 * ```
 *
 * @example With no lit-ui-router elements
 * ```ts
 * import { UIRouterLit, UiViewController, uiSref } from 'lit-ui-router/pure';
 *
 * const router = new UIRouterLit();
 * // …plugins and states…
 *
 * class HelloApp extends LitElement {
 *   private readonly view = new UiViewController(this, { router });
 *
 *   render() {
 *     return html`<a ${uiSref('hello')}>Hello</a>
 *       <main>${this.view.outlet()}</main>`;
 *   }
 * }
 * ```
 *
 * @category controllers
 */
export class UiViewController implements ReactiveController {
  private readonly host: ReactiveControllerHost & HTMLElement;

  private readonly options: UiViewControllerOptions;

  private readonly id = nextViewId();

  private router?: UIRouterLit;

  /** The router the registration was made with; a late provider supersedes it. */
  private registeredRouter?: UIRouterLit;

  private registration?: ActiveUIView;

  private component: RoutedLitTemplate | null = null;

  private resolveContext?: ResolveContext;

  /** The element a class component rendered; a template component leaves it unset. */
  private classElement?: Element;

  private readonly deregisterFns: DeregisterFn[] = [];

  /** drops the subscription to a provider that may still replace its router */
  private unsubscribe?: DeregisterFn;

  private readonly routerSubscribers = new RouterSubscribers();

  /**
   * @throws an `Error` when `host` already holds a `UiViewController`
   */
  constructor(
    host: ReactiveControllerHost & HTMLElement,
    options: UiViewControllerOptions = {},
  ) {
    if (outlets.has(host)) {
      throw new Error(
        `lit-ui-router: <${host.localName}> already has a UiViewController, and a host holds one outlet. Render <ui-view name="…"> elements in its place for named views.`,
      );
    }

    outlets.set(host, this);
    this.host = host;
    this.options = options;
    this.router = options.router;
    host.addController(this);
  }

  /**
   * The routed view's template, or `nothing` while no component fills the
   * view. Call it from the host's `render`.
   */
  outlet(): TemplateResult | typeof nothing {
    const { component, router, resolveContext } = this;

    if (!component || !router || !resolveContext) {
      this.classElement = undefined;

      return nothing;
    }

    const result = routedViewTemplate(component, router, resolveContext);
    this.classElement = routedElementOf(result);

    return result;
  }

  /**
   * The element a class component rendered, once {@link outlet} has rendered
   * it; `null` for a template component, or while no component fills the view.
   */
  get routedElement(): Element | null {
    return this.classElement ?? null;
  }

  /** @internal */
  get fqn(): string | undefined {
    return this.registration?.fqn;
  }

  /** @internal */
  get viewContext(): ViewContext | undefined {
    return this.registration?.config?.viewDecl.$context;
  }

  /** @internal */
  get isUpdatePending(): boolean {
    // SAFETY: a `ReactiveControllerHost` that reports pending updates is a `ReactiveElement`
    return !!(this.host as Partial<ReactiveElement>).isUpdatePending;
  }

  /** @internal */
  get updateComplete(): Promise<boolean> {
    return this.host.updateComplete;
  }

  /** @internal */
  requestUpdate(): void {
    this.host.requestUpdate();

    const instance:
      | (Partial<Pick<ReactiveElement, 'requestUpdate'>> & Element)
      | null = this.routedElement;

    if (isFunction(instance?.requestUpdate)) {
      instance.requestUpdate();
    }
  }

  /** @internal */
  hostConnected(): void {
    this.host.addEventListener(
      uiViewContextEventName,
      // SAFETY: only `UiViewContextEvent`s are dispatched under this name
      this.onUiViewContextEvent as EventListener,
    );

    if (this.options.router) {
      this.host.addEventListener(
        contextRequestEventName,
        this.onContextRequest,
      );
    } else {
      this.seekRouter();
    }

    this.register();
  }

  /** @internal */
  hostUpdate(): void {
    // A provider that upgraded after the host connected answers now, ahead of the render that reads the outlet.
    if (
      !this.registeredRouter &&
      !this.options.router &&
      this.host.isConnected
    ) {
      this.seekRouter();
      this.register();
    }
  }

  /** @internal */
  hostDisconnected(): void {
    this.host.removeEventListener(
      uiViewContextEventName,
      // SAFETY: only `UiViewContextEvent`s are dispatched under this name
      this.onUiViewContextEvent as EventListener,
    );
    this.host.removeEventListener(
      contextRequestEventName,
      this.onContextRequest,
    );
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.deregister();
  }

  private seekRouter(): void {
    this.unsubscribe?.();

    const { router, unsubscribe } = subscribeRouter(
      this.host,
      this.onRouterReplaced,
    );

    // A reconnect outside any provider keeps the router it had.
    this.router = router ?? this.router;
    this.unsubscribe = unsubscribe;
  }

  private readonly onRouterReplaced = (router: UIRouterLit): void => {
    this.unsubscribe = undefined;
    this.router = router;
    this.register();
  };

  private register(): void {
    this.deregister();

    const { router, id } = this;

    this.registration = createViewRegistration({
      id,
      name: this.options.name ?? '',
      parentView: UiView.seekParentView(this.host),
      router,
      configUpdated: this.configUpdated,
    });
    setViewHost(this.registration, this);

    if (!router) {
      return;
    }

    this.deregisterFns.push(...registerView(router, this.registration, this));
    this.registeredRouter = router;
  }

  private deregister(): void {
    this.registeredRouter = undefined;

    while (this.deregisterFns.length) {
      this.deregisterFns.shift()?.();
    }
  }

  private readonly configUpdated = (config: ViewConfig): void => {
    const registration = this.registration;

    if (!config) {
      this.component = null;
      this.host.requestUpdate();

      return;
    }

    if (
      !registration ||
      !(config instanceof LitViewConfig) ||
      registration.config === config
    ) {
      return;
    }

    trace.traceUIViewConfigUpdated(registration, config.viewDecl.$context!);
    registration.config = config;
    this.resolveContext = new ResolveContext(config.path);
    this.component = routedComponentOf(config);
    this.host.requestUpdate();
  };

  /** Offers the router from the options to the host's descendants. */
  private readonly onContextRequest = (event: Event): void => {
    // The host's own requests belong to the provider above.
    if (event.composedPath()[0] === this.host) {
      return;
    }

    this.routerSubscribers.answer(event, this.options.router, false);
  };

  /** Answers a nested view's parent seek with this outlet. */
  private readonly onUiViewContextEvent = (event: UiViewContextEvent) => {
    // The host's own seek belongs to the view above.
    if (event.composedPath()[0] === this.host) {
      return;
    }

    event.stopImmediatePropagation();
    event.detail.parentView = this;
  };
}
