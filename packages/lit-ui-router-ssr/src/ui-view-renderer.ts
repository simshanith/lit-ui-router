// The server half of `<ui-view>`: the element's own registration and resolve reads, run against the scoped router and written into the light DOM.
import { ElementRenderer } from '@lit-labs/ssr';
import type { RenderInfo } from '@lit-labs/ssr';
import type { ThunkedRenderResult } from '@lit-labs/ssr/lib/render-result.js';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { renderValue } from '@lit-labs/ssr/lib/render-value.js';
import {
  applyPairs,
  ResolveContext,
  Transition,
  isString,
} from '@uirouter/core';
import type { ActiveUIView, UIRouter, ViewConfig } from '@uirouter/core';
import { LitViewConfig, isRoutedLitElement } from 'lit-ui-router/pure';
import type {
  NormalizedLitViewDeclaration,
  UIViewInjectedProps,
  UIRouterLit,
} from 'lit-ui-router/pure';
import { getScopedRouter } from 'lit-ui-router/context';
import { servedMarkerPrefix } from './served-markers.js';

/** The tag this renderer answers for. */
const TAG = 'ui-view';

/** `<ui-view name>` selects a named view; an empty name is the `$default` one. */
const DEFAULT_VIEW = '$default';

// Server-render ids live in their own sequence: nothing on this side shares a registry with the client's `<ui-view>` counter.
let viewIdCounter = 0;

// Every `<ui-view>` between the render root and the one now rendering. A render is synchronous and depth-first, so the last entry is the parent view.
const openViews: UiViewRenderer[] = [];

const PART_CLOSE = '<!--/lit-part-->';

/**
 * Hides the markers this render wrote inside the view from the walk hydrating
 * its surroundings, leaving the outer pair plain for that walk to read.
 */
const prefixInterior = (markup: string): string => {
  // renderValue always wraps a hydratable value in the pair, so the ends are the pair by construction.
  const open = markup.indexOf('-->') + 3;
  const close = markup.length - PART_CLOSE.length;
  // A plain `<!--lit-part` never matches an already-prefixed `<!--ui-view:lit-part`, so a nested run's interior is prefixed once.
  const interior = markup
    .slice(open, close)
    .replaceAll('<!--lit-part', `<!--${servedMarkerPrefix}lit-part`)
    .replaceAll('<!--/lit-part', `<!--${servedMarkerPrefix}/lit-part`)
    .replaceAll('<!--lit-node', `<!--${servedMarkerPrefix}lit-node`);
  return markup.slice(0, open) + interior + markup.slice(close);
};

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const warnElementComponent = (fqn: string): void => {
  // DEV folds away in dist/*.js; see check:dev-split and dev-warnings.json.
  if (!import.meta.env.DEV) return;
  console.warn(
    'lit-ui-router-ssr: this view is a RoutedLitElement class, which has no server render, so the part was left empty for the client to fill:',
    fqn,
  );
};

/**
 * Renders the routed component of a `<ui-view>` into the element's light DOM,
 * between the part markers its client-side `render()` hydrates against.
 *
 * The renderer does what the element does on connect: it registers an
 * `ActiveUIView` with the router's view service under the address its `name`
 * attribute and its enclosing `<ui-view>`s spell, takes the `ViewConfig` the
 * registration syncs back, builds a `ResolveContext` over that config's path,
 * and hands the view declaration's component the same
 * `{ router, resolves, transition }` props the element hands it. The
 * registration is dropped again as soon as the markup is written, so a render
 * leaves the view service as it found it.
 *
 * The router comes from the `withRouterSync` scope {@link prerender} opens, so
 * the renderer needs no configuration of its own and goes into
 * `elementRenderers` as a class.
 *
 * An address no state routes renders nothing between its markers, which is what
 * the client's own first render of that view produces.
 *
 * The pair around the component is written plain, so the walk hydrating the
 * view's surroundings reads it as the `uiViewSlot()` child part and stops
 * there; every marker between that pair carries the served-marker prefix, so
 * the same walk reads past the view's interior and `lit-ui-router-ssr/client`
 * reveals it at that view's own wake. Collecting the component's markup to
 * prefix it is synchronous, so a component whose render awaits is not served.
 *
 * @example
 * ```ts
 * import { uiViewSlot } from 'lit-ui-router-ssr/client';
 *
 * // `uiViewSlot()` is the use site's opt-in: it is what reaches this
 * // renderer's `renderLight()`, and it commits nothing on the client.
 * const page = (router: UIRouterLit) =>
 *   html`<ui-router .uiRouter=${router}><ui-view>${uiViewSlot()}</ui-view></ui-router>`;
 * ```
 *
 * @category server
 */
export class UiViewRenderer extends ElementRenderer {
  /** Answers for `<ui-view>`, whatever class the tag is registered with. */
  static override matchesClass(
    _ceClass: typeof HTMLElement,
    tagName: string,
  ): boolean {
    return tagName === TAG;
  }

  /** No element instance is created, so attributes are held here and written back verbatim. */
  private readonly attributes: Map<string, string> = new Map();

  private data?: ActiveUIView;

  private config?: LitViewConfig;

  /** @internal */
  override setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  /** @internal */
  override renderAttributes(): ThunkedRenderResult {
    return [...this.attributes].map(([name, value]) =>
      value === '' ? ` ${name}` : ` ${name}="${escapeAttribute(value)}"`,
    );
  }

  /** The view's fully qualified name — `$default.detail` under a parent view. */
  private get fqn(): string {
    const name = this.attributes.get('name') || DEFAULT_VIEW;
    const parent = openViews.at(-1)?.data?.fqn;
    return parent ? `${parent}.${name}` : name;
  }

  /** The state context the view was created in: the parent view's, or the root. */
  private creationContext(router: UIRouter): ActiveUIView['creationContext'] {
    const parent = openViews.at(-1)?.config?.viewDecl.$context;
    return parent ?? router.stateRegistry.root();
  }

  private register(router: UIRouter): () => void {
    const name = this.attributes.get('name') || DEFAULT_VIEW;
    const data: ActiveUIView = {
      $type: 'lit',
      id: viewIdCounter++,
      name,
      fqn: this.fqn,
      creationContext: this.creationContext(router),
      configUpdated: (config: ViewConfig) => {
        if (config instanceof LitViewConfig) this.config = config;
      },
      config: undefined as unknown as ViewConfig,
    };
    this.data = data;
    // registerUIView syncs, so `configUpdated` has already run when this returns.
    return router.viewService.registerUIView(data);
  }

  /** The props `<ui-view>` injects: the router, the resolved tokens, the transition. */
  private props(router: UIRouter, config: LitViewConfig): UIViewInjectedProps {
    const context = new ResolveContext(config.path);
    const injector = context.injector();
    const resolves = context
      .getTokens()
      .filter((token) => isString(token))
      .map((token) => context.getResolvable(token))
      .filter((resolvable) => resolvable.resolved)
      .map(({ token }) => [token as string, injector.get(token) as unknown])
      .reduce(applyPairs, {});
    return {
      router,
      resolves,
      transition: injector.get(Transition) as Transition,
    };
  }

  /** @internal */
  override renderLight(
    renderInfo: RenderInfo,
  ): ThunkedRenderResult | undefined {
    const router = getScopedRouter() as UIRouterLit | undefined;
    if (!router) return undefined;
    const deregister = this.register(router);
    const config = this.config;
    const component = (config?.viewDecl as NormalizedLitViewDeclaration)
      ?.component;
    if (!config || !component) {
      deregister();
      return undefined;
    }
    if (isRoutedLitElement(component)) {
      warnElementComponent(this.data!.fqn);
      deregister();
      return undefined;
    }
    const value = component(this.props(router, config));
    return [
      () => {
        openViews.push(this);
        try {
          // renderValue writes the `<!--lit-part digest-->` pair the element's own render() hydrates against; collecting it here is what lets the interior be prefixed.
          return prefixInterior(
            collectResultSync(renderValue(value, renderInfo)),
          );
        } finally {
          openViews.pop();
          deregister();
        }
      },
    ];
  }
}
