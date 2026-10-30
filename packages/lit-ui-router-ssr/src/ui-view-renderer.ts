// The server half of `<ui-view>`: the element's own registration and resolve reads, run against the scoped router and written into the light DOM.
import { ElementRenderer, LitElementRenderer } from '@lit-labs/ssr';
import type { RenderInfo } from '@lit-labs/ssr';
import type { ThunkedRenderResult } from '@lit-labs/ssr/lib/render-result.js';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { renderValue } from '@lit-labs/ssr/lib/render-value.js';
import { ResolveContext } from '@uirouter/core';
import type { ActiveUIView, UIRouter, ViewConfig } from '@uirouter/core';
import type { LitElement, TemplateResult } from 'lit';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import {
  LitViewConfig,
  isRoutedClassRenderer,
  isRoutedLitElement,
  routedElementOf,
  routedViewTemplate,
} from 'lit-ui-router/pure';
import type { NormalizedLitViewDeclaration } from 'lit-ui-router/pure';
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

/** The registration a server `<ui-view>` hands core, before any config arrives. */
type Registration = Omit<ActiveUIView, 'config'> & { config?: ViewConfig };

/**
 * Hides the markers this render wrote inside the view from the walk hydrating
 * its surroundings, leaving the outer pair plain for that walk to read.
 *
 * @internal
 */
export const prefixInterior = (markup: string): string => {
  // renderValue always wraps a hydratable value in the pair, so the ends are the pair by construction.
  const open = markup.indexOf('-->') + 3;
  const close = markup.length - PART_CLOSE.length;

  // A plain `<!--lit-part` never matches an already-prefixed `<!--served:lit-part`, so a nested run's interior is prefixed once.
  const interior = markup
    .slice(open, close)
    .replaceAll('<!--lit-part', `<!--${servedMarkerPrefix}lit-part`)
    .replaceAll('<!--/lit-part', `<!--${servedMarkerPrefix}/lit-part`)
    .replaceAll('<!--lit-node', `<!--${servedMarkerPrefix}lit-node`);

  return markup.slice(0, open) + interior + markup.slice(close);
};

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** Stands in for the element's markup while lit writes the slot markers around it. */
const SLOT_SENTINEL = 'ui-view-routed-element-slot';

const NODE_MARKER = /<!--lit-node \d+-->/g;

/**
 * Writes `element` itself through `LitElementRenderer`: the renderer's own
 * instance is replaced by the one core built, so its render reads the props
 * core assigned.
 */
const renderElement = (element: LitElement, renderInfo: RenderInfo): string => {
  const tag = element.localName;

  if (!tag) {
    throw new Error(
      `lit-ui-router-ssr: a routed LitElement class must be on the customElements registry to prerender: ${element.constructor.name}`,
    );
  }

  // Element access reaches the protected `createRenderRoot()`, which `LitElementRenderer` patches to attach a shadow root.
  // oxlint-disable-next-line typescript/dot-notation -- dot access to a protected member does not typecheck
  const lightRoot = element['createRenderRoot']() === element;

  class Seated extends LitElementRenderer {
    static override matchesClass(ctor: typeof HTMLElement): boolean {
      return ctor === element.constructor;
    }

    constructor(tagName: string) {
      super(tagName);
      this.element = element;
    }

    // A declarative shadow root would hide a light-DOM render, so that element is served empty and renders cold.
    override renderShadow(info: RenderInfo): ThunkedRenderResult | undefined {
      return lightRoot ? undefined : super.renderShadow(info);
    }
  }

  const name = unsafeStatic(tag);

  const markup = collectResultSync(
    renderValue(staticHtml`<${name}></${name}>`, {
      ...renderInfo,
      elementRenderers: [Seated, ...renderInfo.elementRenderers],
    }),
  );

  // The element is a leaf value of the client's slot part: its own pair and node marker belong to a template the client never renders.
  return markup
    .slice(markup.indexOf('-->') + 3, markup.length - PART_CLOSE.length)
    .replace(NODE_MARKER, '');
};

/** A class view's markup: core's template, with the element written into the slot it places it in. */
const renderClassView = (
  result: TemplateResult,
  element: LitElement,
  renderInfo: RenderInfo,
): string => {
  // @lit-labs/ssr writes a node value as text, so the sentinel holds the slot while lit writes its markers.
  const slots: TemplateResult = {
    ...result,
    values: result.values.map((value) =>
      value === element ? SLOT_SENTINEL : value,
    ),
  };

  return collectResultSync(renderValue(slots, renderInfo)).replace(
    SLOT_SENTINEL,
    () => renderElement(element, renderInfo),
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
 * The template comes from core's `routedViewTemplate`, the helper `<ui-view>`
 * renders through, so the served markup and the client's first render share
 * one source. A routed `LitElement` class, plain or `sticky`, is built by core
 * and written through `LitElementRenderer` into the first of the two element
 * slots `<ui-view>` places a class in, with its props assigned before it
 * renders; the served view hands that element back to core at its wake. A
 * class that renders into its own light DOM is written without a shadow root,
 * so it renders cold into the element the client adopts.
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

  private data?: Registration;

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

    const data: Registration = {
      $type: 'lit',
      id: viewIdCounter++,
      name,
      fqn: this.fqn,
      creationContext: this.creationContext(router),
      configUpdated: (config: ViewConfig) => {
        if (config instanceof LitViewConfig) this.config = config;
      },
      config: undefined,
    };

    this.data = data;

    // registerUIView syncs, so `configUpdated` has already run when this returns.
    // SAFETY: core never reads `config`; the view takes its config from `configUpdated`.
    return router.viewService.registerUIView(data as ActiveUIView);
  }

  /** @internal */
  override renderLight(
    renderInfo: RenderInfo,
  ): ThunkedRenderResult | undefined {
    const router = getScopedRouter();

    if (!router) return undefined;
    const deregister = this.register(router);
    const config = this.config;

    // SAFETY: a `LitViewConfig` is built only from a lit state's normalized view declaration.
    const component = (config?.viewDecl as NormalizedLitViewDeclaration)
      ?.component;

    if (!config || !component) {
      deregister();

      return undefined;
    }

    const result = routedViewTemplate(
      component,
      router,
      new ResolveContext(config.path),
    );

    const element =
      isRoutedLitElement(component) || isRoutedClassRenderer(component)
        ? // SAFETY: core renders a routed class as a LitElement subclass's instance
          (routedElementOf(result) as LitElement | undefined)
        : undefined;

    return [
      () => {
        openViews.push(this);

        try {
          // renderValue writes the `<!--lit-part digest-->` pair the element's own render() hydrates against; collecting it here is what lets the interior be prefixed.
          return prefixInterior(
            element
              ? renderClassView(result, element, renderInfo)
              : collectResultSync(renderValue(result, renderInfo)),
          );
        } finally {
          openViews.pop();
          deregister();
        }
      },
    ];
  }
}
