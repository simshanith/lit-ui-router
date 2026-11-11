// Routed LitElement classes and the router that serves them, shared by the server and client lanes.
import { html, LitElement } from 'lit';
import type { TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { UIRouterLit } from 'lit-ui-router/pure';
import type {
  LitStateDeclaration,
  UIViewInjectedProps,
} from 'lit-ui-router/pure';
import { installServerLocation } from 'ui-router-server/location';
import { OtherView } from './fixture.js';

/** What each constructor call was handed, in order, across every routed card. */
export const constructed: (UIViewInjectedProps | undefined)[] = [];

/**
 * A shadow-DOM routed class taking its props both ways core hands them.
 *
 * Without props it renders another template, so a hydrate that reaches the
 * element before its props throws a mismatch instead of passing silently.
 */
abstract class PropsCard extends LitElement {
  /** The props the router last assigned, under whichever member the class declares. */
  abstract readonly props: UIViewInjectedProps | undefined;

  constructor(props?: UIViewInjectedProps) {
    super();
    constructed.push(props);
  }

  override render(): TemplateResult {
    const props = this.props;

    return props
      ? html`<p class="card">${props.resolves.detail}</p>`
      : html`<span class="unrouted">no props</span>`;
  }
}

/** A {@link PropsCard} declaring `uiViewProps`. */
export class RoutedCard extends PropsCard {
  @property({ attribute: false })
  uiViewProps?: UIViewInjectedProps;

  override get props(): UIViewInjectedProps | undefined {
    return this.uiViewProps;
  }
}

customElements.define('routed-card', RoutedCard);

/** A {@link PropsCard} declaring only `_uiViewProps`, the member's name before lit-ui-router 1.20. */
export class UnderscoreCard extends PropsCard {
  /** @public — router-assigned; the `_` prefix is convention, not privacy. */
  @property({ attribute: false })
  _uiViewProps?: UIViewInjectedProps;

  override get props(): UIViewInjectedProps | undefined {
    return this._uiViewProps;
  }
}

customElements.define('underscore-card', UnderscoreCard);

/** The same card, bound once in its declaration and reused across visits. */
export class StickyCard extends RoutedCard {
  static sticky = true;
}

customElements.define('sticky-card', StickyCard);

/** Clicks on any {@link BoundCard}'s button, so a spec can see its listener survived the hydrate. */
export const boundClicks: string[] = [];

/** A shadow-DOM routed class whose render binds an attribute and a listener on an inner element. */
export class BoundCard extends RoutedCard {
  override render(): TemplateResult {
    const detail = String(this.uiViewProps?.resolves.detail);

    return html`<button
      class="bound"
      title=${detail}
      @click=${() => boundClicks.push(detail)}
    >
      ${detail}
    </button>`;
  }
}

customElements.define('bound-card', BoundCard);

/** The sample apps' shape: light DOM, props through the constructor. */
export class LightClassCard extends LitElement {
  uiViewProps?: UIViewInjectedProps;

  constructor(props?: UIViewInjectedProps) {
    super();
    this.uiViewProps = props;
  }

  override createRenderRoot(): this {
    return this;
  }

  override render(): TemplateResult {
    return html`<p class="light">
      ${String(this.uiViewProps?.resolves.detail)}
    </p>`;
  }
}

customElements.define('light-class-card', LightClassCard);

/** One state per card, each resolving `detail`, and a template state to leave for. */
export const makeClassRouter = (): UIRouterLit => {
  const router = installServerLocation(new UIRouterLit(), {
    urlConfig: { strict: false },
  });

  const states: LitStateDeclaration[] = [
    {
      name: 'card',
      url: '/card?rev',
      params: { rev: { dynamic: true } },
      component: RoutedCard,
      resolve: { detail: () => 'card leaf' },
    },
    {
      name: 'underscore',
      url: '/underscore?rev',
      params: { rev: { dynamic: true } },
      component: UnderscoreCard,
      resolve: { detail: () => 'underscore leaf' },
    },
    {
      name: 'sticky',
      url: '/sticky',
      component: StickyCard,
      resolve: { detail: () => 'sticky leaf' },
    },
    {
      name: 'bound',
      url: '/bound',
      component: BoundCard,
      resolve: { detail: () => 'bound leaf' },
    },
    {
      name: 'light',
      url: '/light',
      component: LightClassCard,
      resolve: { detail: () => 'light leaf' },
    },
    { name: 'other', url: '/other', component: OtherView },
  ];

  for (const state of states) router.stateRegistry.register(state);

  return router;
};
