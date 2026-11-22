import {
  css,
  html,
  LitElement,
  render,
  svg,
  type SVGTemplateResult,
} from 'lit';
import { customElement } from 'lit/decorators.js';
import {
  BrowserLocationConfig,
  HashLocationService,
  locationPluginFactory,
  type Transition,
  type UIRouter,
} from '@uirouter/core';
import {
  TransitionController,
  UIRouterLit,
  uiSref,
  uiSrefActive,
  type LitStateDeclaration,
  type RoutedLitTemplate,
} from 'lit-ui-router';

const DOCS = 'https://lit-ui-router.dev';

// The home page's three feature cards, each a value of the one state's cardId param.
const CARDS = [
  {
    id: 'states',
    title: 'States',
    icon: new URL('./icons/lit-lightning.svg', import.meta.url).href,
    lead: 'Model an app as a tree of named states, not flat paths. Each state declares its URL, component, and data, and children inherit from ancestors.',
    links: [
      ['Links by state name', `${DOCS}/guides/links-and-navigation`],
      ['Path and query parameters', `${DOCS}/guides/state-parameters`],
      ['Route guards', `${DOCS}/guides/route-guards`],
      ['Redirects', `${DOCS}/guides/redirects`],
      ['Unmatched URLs', `${DOCS}/guides/unmatched-urls`],
      [
        'Abstract states',
        'https://ui-router.github.io/core/docs/latest/interfaces/_state_interface_.statedeclaration.html#abstract',
      ],
    ],
  },
  {
    id: 'views',
    title: 'Views',
    icon: new URL('./icons/lit-standards.svg', import.meta.url).href,
    lead: 'Each parent component can hold a ui-view for its children, keeping the outer layout mounted while inner states swap.',
    links: [
      ['Shells, master/detail, and tabs', `${DOCS}/tutorial/hellogalaxy`],
      ['Named views', `${DOCS}/guides/named-views`],
      ['Fallback content', `${DOCS}/guides/view-fallback-content`],
    ],
  },
  {
    id: 'resolves',
    title: 'Resolves',
    icon: new URL('./icons/lit-future.svg', import.meta.url).href,
    lead: "By default, a transition waits for a state's resolves before activating it, so the component renders with its data ready instead of starting empty.",
    links: [
      [
        'Dependent and inherited resolves',
        `${DOCS}/tutorial/hellogalaxy#resolve-inheritance`,
      ],
      ['Component inputs', `${DOCS}/guides/routed-components`],
      ['Failures and loading states', `${DOCS}/guides/loading-and-error-views`],
    ],
  },
] as const;

type Card = (typeof CARDS)[number];

const cardFor = (id: string): Card | undefined =>
  CARDS.find((card) => card.id === id);

// The card after (or before) the current one, wrapping around.
const step = (id: string, by: number): string => {
  const index = CARDS.findIndex((card) => card.id === id);

  return CARDS[(index + by + CARDS.length) % CARDS.length].id;
};

// Lucide icons (ISC licence), inlined: chevron-left and chevron-right.
const ICONS = {
  previous: svg`<path d="m15 18l-6-6l6-6" />`,
  next: svg`<path d="m9 18l6-6l-6-6" />`,
} satisfies Record<string, SVGTemplateResult>;

const icon = (name: keyof typeof ICONS) =>
  html`<svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    ${ICONS[name]}
  </svg>`;

type Resolved = { card: Card };

const cardView = (card: Card) => html`
  <article class="card">
    <div class="icon">
      <img src=${card.icon} alt="" width="40" height="40" />
    </div>
    <h2>${card.title}</h2>
    <p class="details">${card.lead}</p>
    <ul class="details">
      ${card.links.map(
        ([text, href]) =>
          html`<li>
            <a href=${href} target="_blank" rel="noopener">${text}</a>
          </li>`,
      )}
    </ul>
  </article>
`;

const CardPage: RoutedLitTemplate<Resolved> = ({ resolves: { card } }) =>
  cardView(card);

@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .stage {
      display: grid;
    }
    .stage > * {
      grid-area: 1 / 1;
    }
    /* The routed card fills the cell, so every card reads the same size. */
    ui-view {
      display: grid;
    }
    .sizer {
      visibility: hidden;
    }
    .card {
      box-sizing: border-box;
      padding: 24px;
      border: 1px solid light-dark(#f6f6f7, #202127);
      border-radius: 12px;
      background: light-dark(#f6f6f7, #202127);
    }
    .icon {
      display: flex;
      align-items: center;
      justify-content: center;
      inline-size: 48px;
      block-size: 48px;
      margin-block-end: 20px;
      border-radius: 6px;
      background: light-dark(rgb(142 150 170 / 0.14), rgb(101 117 133 / 0.16));
    }
    h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      line-height: 1.5;
    }
    .details {
      margin: 0;
      padding-block-start: 8px;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.7142857;
      color: light-dark(#67676c, #98989f);
    }
    ul.details {
      padding-inline-start: 14px;
    }
    a {
      color: light-dark(#006a9a, #29abe6);
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      margin-block-start: 12px;
    }
    /* Every control keeps a 32px hit area; the dots draw smaller inside theirs. */
    .pager a {
      display: inline-grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: none;
      color: inherit;
      cursor: pointer;
    }
    .pager a:focus-visible {
      outline: 2px solid light-dark(#006a9a, #29abe6);
      outline-offset: 1px;
    }
    .dot::before {
      content: '';
      display: block;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 999px;
      background: light-dark(#c2c2c4, #4a4d55);
    }
    /* The current dot is filled and stretched, so it reads without colour. */
    .dot[aria-current='page']::before {
      inline-size: 20px;
      background: CanvasText;
    }
    @media (forced-colors: active) {
      .dot::before {
        background: CanvasText;
      }
      .dot[aria-current='page']::before {
        background: Highlight;
      }
    }
    @media (hover: hover) and (pointer: fine) {
      .pager a:hover {
        background: light-dark(#f0f0f0, #2c2c2c);
      }
    }
  `;

  // Re-renders the pager after each transition, so Previous and Next follow the current card.
  private readonly transitions = new TransitionController(this, {
    criteria: { to: 'card' },
  });

  private get cardId(): string {
    return String(this.transitions.params.cardId ?? CARDS[0].id);
  }

  render() {
    return html`
      <!-- Hidden copies of every card share the routed card's grid cell, so the cell is always as tall as the tallest card and the pager holds still. -->
      <div class="stage">
        <ui-view></ui-view>
        ${CARDS.map(
          (card) =>
            html`<div class="sizer" aria-hidden="true" inert>
              ${cardView(card)}
            </div>`,
        )}
      </div>
      <nav class="pager" aria-label="Feature cards">
        <a
          aria-label="Previous card"
          ${uiSref('card', { cardId: step(this.cardId, -1) })}
          >${icon('previous')}</a
        >
        ${CARDS.map(
          (card, index) =>
            html`<a
              class="dot"
              aria-label="${card.title}, card ${index + 1} of ${CARDS.length}"
              ${uiSrefActive({ activeClasses: ['active'] })}
              ${uiSref('card', { cardId: card.id })}
            ></a>`,
        )}
        <a
          aria-label="Next card"
          ${uiSref('card', { cardId: step(this.cardId, 1) })}
          >${icon('next')}</a
        >
      </nav>
    `;
  }
}

// One state; moving between cards re-enters it with a new cardId.
const cardState: LitStateDeclaration<Resolved> = {
  name: 'card',
  url: '/:cardId',
  component: CardPage,
  resolve: [
    {
      token: 'card',
      deps: ['$transition$'],
      resolveFn: (transition: Transition) =>
        cardFor(String(transition.params().cardId)) ?? CARDS[0],
    },
  ],
  redirectTo: (transition) =>
    cardFor(String(transition.params().cardId))
      ? undefined
      : { state: 'card', params: { cardId: CARDS[0].id } },
};

// Router setup
const router = new UIRouterLit();

// Replaces the entry on every navigation, so an embedding page's history gains none; location.replace, unlike replaceState, still fires hashchange.
class ReplacingHashLocationService extends HashLocationService {
  // locationPluginFactory types the router as optional; the base class requires it.
  constructor(uiRouter?: UIRouter) {
    super(uiRouter!);
  }

  _set(_state: null, _title: string, url: string) {
    location.replace(`#${url}`);
  }
}

const hashLocationPlugin = locationPluginFactory(
  'featuresTour.replacingHashLocation',
  false,
  ReplacingHashLocationService,
  BrowserLocationConfig,
);

router.plugin(hashLocationPlugin);

router.stateRegistry.register(cardState);

router.urlService.rules.initial({
  state: 'card',
  params: { cardId: 'states' },
});

router.start();

// Render
render(
  html`
    <ui-router .uiRouter=${router}>
      <app-root></app-root>
    </ui-router>
  `,
  document.getElementById('root')!,
);
