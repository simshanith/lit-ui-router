// Consumer light-DOM elements for #904, and the router and pages that draw them, shared by the node and client lanes.
import { hydrateRoot, lightSlot } from '../client.js';
import { html, LitElement } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import type {
  LitStateDeclaration,
  RoutedLitTemplate,
  UIRouterLit,
} from 'lit-ui-router/pure';
import { settle } from 'ui-router-server/ssr';
import { renderPage } from '../prerender.js';
import { LightDomHydrating, lightRenderers } from './light-dom-api.js';
import { makeRouter, uiView } from './fixture.js';
import type { Page } from './round-trip.js';

/** Each element's first update and each served view's adoption, in the order they ran. */
export const wakes: string[] = [];

/** The name an element logs its first update under. */
const wakeName = (element: Element): string =>
  element.id ? `${element.localName}#${element.id}` : element.localName;

/**
 * A card that renders into its light DOM, with no `isServer` branch, and does
 * not opt in. Its `@click` is bound in its own template, so it works only on
 * nodes the element rendered or hydrated itself.
 */
export class PlainLightCard extends LitElement {
  @property()
  label?: string;

  /** Picks a structurally different template, so a server and client render can disagree. */
  @property({ type: Boolean })
  compact = false;

  /** What `label` held when the first update began. */
  labelAtFirstUpdate?: string;

  override createRenderRoot(): this {
    return this;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!this.hasUpdated) {
      this.labelAtFirstUpdate = this.label;
      wakes.push(wakeName(this));
    }

    super.willUpdate(changed);
  }

  private press(): void {
    this.dispatchEvent(
      new CustomEvent('card-press', { bubbles: true, composed: true }),
    );
  }

  override render(): TemplateResult {
    return html`${
        this.compact
          ? html`<span class="card-label">${this.label}</span>`
          : html`<p class="card-label">${this.label}</p>`
      }<button class="card-button" @click=${this.press}>press</button>`;
  }
}

customElements.define('plain-light-card', PlainLightCard);

/** The same card, opted in. Subclassing proves the mixin leaves its base unopted. */
export class LightCard extends LightDomHydrating(PlainLightCard) {}

customElements.define('light-card', LightCard);

/** An opted-in element whose use site also writes children of its own. */
export class LightPanel extends LightDomHydrating(LitElement) {
  @property()
  heading?: string;

  override createRenderRoot(): this {
    return this;
  }

  override render(): TemplateResult {
    return html`<h2 class="panel-heading">${this.heading}</h2>`;
  }
}

customElements.define('light-panel', LightPanel);

/** An opted-in element whose own render holds a `<ui-view>`. */
export class LightFrame extends LightDomHydrating(LitElement) {
  @property()
  heading?: string;

  override createRenderRoot(): this {
    return this;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!this.hasUpdated) wakes.push(wakeName(this));
    super.willUpdate(changed);
  }

  override render(): TemplateResult {
    return html`<h2 class="frame-heading">${this.heading}</h2>
      ${uiView()}`;
  }
}

customElements.define('light-frame', LightFrame);

/** An opted-in element whose own render holds another opted-in element. */
export class LightOuter extends LightDomHydrating(LitElement) {
  @property()
  heading?: string;

  override createRenderRoot(): this {
    return this;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!this.hasUpdated) wakes.push(wakeName(this));
    super.willUpdate(changed);
  }

  override render(): TemplateResult {
    return html`<h2 class="outer-heading">${this.heading}</h2>
      <light-card id="inner" .label=${`${this.heading ?? ''} inner`}
        >${lightSlot()}</light-card
      >`;
  }
}

customElements.define('light-outer', LightOuter);

/** A routed template whose one element is an opted-in card, labelled from a resolve. */
export const CardView: RoutedLitTemplate = (props) =>
  html`<light-card id="routed" .label=${String(props.resolves.label ?? '')}
    >${lightSlot()}</light-card
  >`;

/** The fixture's router, plus `card`, which routes {@link CardView} into the root view. */
export const makeLightRouter = (): UIRouterLit => {
  const router = makeRouter();

  const card: LitStateDeclaration = {
    name: 'card',
    url: '/card',
    component: CardView,
    resolve: { label: () => 'routed' },
  };

  router.stateRegistry.register(card);

  return router;
};

/** One opted-in card at the top of the page, with a sibling outside it. */
export const cardPage =
  (label: string, compact = false): Page =>
  () =>
    html`<p class="sibling">sibling</p>
      <light-card id="top" .label=${label} .compact=${compact}
        >${lightSlot()}</light-card
      >`;

/** An unopted card beside an opted-in one. */
export const plainPage: Page = () =>
  html`<plain-light-card id="plain" .label=${'plain'}></plain-light-card>
    <light-card id="top" .label=${'opted'}>${lightSlot()}</light-card>`;

/** A panel whose use site writes a child ahead of the element's own render. */
export const panelPage: Page = () =>
  html`<light-panel id="panel" .heading=${'Panel'}
    ><p class="authored">mine</p>
    ${lightSlot()}</light-panel
  >`;

/** A panel whose authored child carries a binding of its own, which the element's hydrate cannot read past. */
export const boundPanelPage: Page = () =>
  html`<light-panel id="panel" .heading=${'Panel'}
    ><p class="authored">${'mine'}</p>
    ${lightSlot()}</light-panel
  >`;

/** A light-DOM element whose own render holds the root `<ui-view>`. */
export const framePage: Page = (router) =>
  html`<ui-router .uiRouter=${router}
    ><light-frame id="frame" .heading=${'Frame'}
      >${lightSlot()}</light-frame
    ></ui-router
  >`;

/** Two levels of light-DOM elements. */
export const outerPage: Page = () =>
  html`<light-outer id="outer" .heading=${'Outer'}
    >${lightSlot()}</light-outer
  >`;

/** The document a build would emit for `path`, drawn with {@link lightRenderers}. */
export const drawLight = async (page: Page, path: string): Promise<string> => {
  const router = makeLightRouter();
  await settle(router, path);

  try {
    return renderPage(page(router), router, new EventTarget(), lightRenderers);
  } finally {
    // The server render runs each element's `willUpdate` too; the log is the client's.
    wakes.length = 0;
  }
};

/** Hydrates `container` with a fresh client router on `path`, leaving the provider live. */
export const hydrateLight = async (
  container: HTMLElement,
  page: Page,
  path: string,
): Promise<() => void> => {
  const router = makeLightRouter();
  await settle(router, path);
  const release = hydrateRoot(container, page(router));

  if (!release) throw new Error('hydrateRoot left the container cold');

  return release;
};

/** The nodes removed from under `root` while it is watched. */
export const watchRemovals = (root: Node): (() => Node[]) => {
  const removed: Node[] = [];

  const collect = (records: MutationRecord[]): void => {
    for (const record of records) removed.push(...record.removedNodes);
  };

  const observer = new MutationObserver(collect);
  observer.observe(root, { childList: true, subtree: true });

  return () => {
    collect(observer.takeRecords());
    observer.disconnect();

    return removed;
  };
};
