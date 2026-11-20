import { css, html, LitElement, render } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { hashLocationPlugin, type Transition } from '@uirouter/core';
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

const ADVANCE_MS = 7000;

type Resolved = { card: Card };

const CardPage: RoutedLitTemplate<Resolved> = ({ resolves: { card } }) => html`
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

@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .card {
      box-sizing: border-box;
      min-block-size: 23rem;
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
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-block-start: 12px;
    }
    .pager a,
    .pager button {
      display: inline-grid;
      place-items: center;
      min-inline-size: 32px;
      block-size: 32px;
      padding-inline: 10px;
      border: 1px solid light-dark(#c2c2c4, #3c3f44);
      border-radius: 999px;
      background: none;
      color: inherit;
      font: inherit;
      font-size: 14px;
      line-height: 1;
      text-decoration: none;
      cursor: pointer;
    }
    .pager a[aria-current='page'] {
      border-color: CanvasText;
      background: CanvasText;
      color: Canvas;
    }
    /* The inverted pill is a fill, which forced colours drop, so it takes the system's selected pair. */
    @media (forced-colors: active) {
      .pager a[aria-current='page'] {
        forced-color-adjust: none;
        border-color: Highlight;
        background: Highlight;
        color: HighlightText;
      }
    }
    @media (hover: hover) and (pointer: fine) {
      .pager a:not([aria-current='page']):hover,
      .pager button:hover {
        background: light-dark(#f0f0f0, #2c2c2c);
      }
    }
    .hidden {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `;

  // Re-renders the pager and restarts the timer after each transition.
  private readonly transitions = new TransitionController(this, {
    criteria: { to: 'card' },
    callback: () => this.schedule(),
  });

  private get cardId(): string {
    return String(this.transitions.params.cardId ?? CARDS[0].id);
  }

  @state() private playing = true;

  private readonly paused = { hovered: false, focused: false };

  private timer?: ReturnType<typeof setTimeout>;

  private readonly motion = matchMedia('(prefers-reduced-motion: reduce)');

  private readonly onMotion = () => this.schedule();

  connectedCallback() {
    super.connectedCallback();
    this.motion.addEventListener('change', this.onMotion);
    this.schedule();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.motion.removeEventListener('change', this.onMotion);
    clearTimeout(this.timer);
  }

  private hold(reason: 'hovered' | 'focused', on: boolean) {
    this.paused[reason] = on;
    this.schedule();
  }

  // Auto-advance through the router, replacing the history entry so Back does not step through cards.
  private schedule() {
    clearTimeout(this.timer);

    if (
      this.motion.matches ||
      !this.playing ||
      this.paused.hovered ||
      this.paused.focused
    )
      return;

    this.timer = setTimeout(() => {
      void router.stateService.go(
        'card',
        { cardId: step(this.cardId, 1) },
        { location: 'replace' },
      );
    }, ADVANCE_MS);
  }

  private toggle() {
    this.playing = !this.playing;
    this.schedule();
  }

  render() {
    return html`
      <div
        @pointerenter=${() => this.hold('hovered', true)}
        @pointerleave=${() => this.hold('hovered', false)}
        @focusin=${() => this.hold('focused', true)}
        @focusout=${() => this.hold('focused', false)}
      >
        <ui-view></ui-view>
        <nav class="pager" aria-label="Feature cards">
          <a ${uiSref('card', { cardId: step(this.cardId, -1) })}>
            <span aria-hidden="true">‹</span>
            <span class="hidden">Previous card</span>
          </a>
          ${CARDS.map(
            (card, index) =>
              html`<a
                ${uiSrefActive({ activeClasses: ['active'] })}
                ${uiSref('card', { cardId: card.id })}
                >${index + 1}<span class="hidden"> ${card.title}</span></a
              >`,
          )}
          <a ${uiSref('card', { cardId: step(this.cardId, 1) })}>
            <span aria-hidden="true">›</span>
            <span class="hidden">Next card</span>
          </a>
          ${
            this.motion.matches
              ? ''
              : html`<button type="button" @click=${this.toggle}>
                  ${this.playing ? 'Pause' : 'Play'}<span class="hidden">
                    slideshow</span
                  >
                </button>`
          }
        </nav>
      </div>
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
