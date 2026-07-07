import { html, LitElement, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { render } from 'lit';
import { hashLocationPlugin, Transition } from '@uirouter/core';
import {
  UIRouterLit,
  uiSref,
  uiSrefActive,
  LitStateDeclaration,
  UIViewInjectedProps,
} from 'lit-ui-router';

// Data Service
interface Star {
  id: string;
  name: string;
  spectralClass: string;
  constellation: string;
  distance: string;
  apparentMagnitude: string;
  funFact: string;
}

const stars: Star[] = [
  {
    id: 'sun',
    name: 'Sun',
    spectralClass: 'G2V',
    constellation: '(our star)',
    distance: '8.3 light-minutes',
    apparentMagnitude: '-26.74',
    funFact: "Contains 99.86% of the solar system's mass.",
  },
  {
    id: 'proxima-centauri',
    name: 'Proxima Centauri',
    spectralClass: 'M5.5Ve',
    constellation: 'Centaurus',
    distance: '4.25 ly',
    apparentMagnitude: '11.13',
    funFact: 'Closest star to the Sun; hosts the exoplanet Proxima b.',
  },
  {
    id: 'alpha-centauri-a',
    name: 'Alpha Centauri A',
    spectralClass: 'G2V',
    constellation: 'Centaurus',
    distance: '4.37 ly',
    apparentMagnitude: '0.01',
    funFact: 'A near-twin of the Sun in the nearest star system.',
  },
  {
    id: 'sirius',
    name: 'Sirius',
    spectralClass: 'A1V',
    constellation: 'Canis Major',
    distance: '8.6 ly',
    apparentMagnitude: '-1.46',
    funFact:
      'Brightest star in the night sky, with a white dwarf companion, Sirius B.',
  },
  {
    id: 'vega',
    name: 'Vega',
    spectralClass: 'A0V',
    constellation: 'Lyra',
    distance: '25 ly',
    apparentMagnitude: '0.03',
    funFact:
      'First star ever photographed (1850) and the historic zero point of the magnitude scale.',
  },
  {
    id: 'arcturus',
    name: 'Arcturus',
    spectralClass: 'K1.5III',
    constellation: 'Boötes',
    distance: '36.7 ly',
    apparentMagnitude: '-0.05',
    funFact: "Its light was used to open the 1933 Chicago World's Fair.",
  },
  {
    id: 'polaris',
    name: 'Polaris',
    spectralClass: 'F7Ib',
    constellation: 'Ursa Minor',
    distance: '~433 ly',
    apparentMagnitude: '1.98',
    funFact: 'The current North Star, and a pulsating Cepheid variable.',
  },
  {
    id: 'betelgeuse',
    name: 'Betelgeuse',
    spectralClass: 'M1-2Ia-Iab',
    constellation: 'Orion',
    distance: '~548 ly',
    apparentMagnitude: '0.5 (variable)',
    funFact:
      "A red supergiant so large it would engulf Jupiter's orbit; famously dimmed in 2019-20.",
  },
  {
    id: 'rigel',
    name: 'Rigel',
    spectralClass: 'B8Ia',
    constellation: 'Orion',
    distance: '~860 ly',
    apparentMagnitude: '0.13',
    funFact: 'A blue supergiant roughly 120,000 times as luminous as the Sun.',
  },
  {
    id: 'antares',
    name: 'Antares',
    spectralClass: 'M1.5Iab-Ib',
    constellation: 'Scorpius',
    distance: '~550 ly',
    apparentMagnitude: '1.06 (variable)',
    funFact: 'Its name means "rival of Mars" for its similar reddish hue.',
  },
];

const StarService = {
  // Simulated async fetch; resolves must settle before the state activates
  getStars: (): Promise<Star[]> =>
    new Promise((resolve) => setTimeout(() => resolve(stars), 300)),
};

// Approximate real star colors by spectral class letter (O hottest, M coolest)
const spectralColors: Record<string, string> = {
  O: '#92b5ff',
  B: '#a5c0ff',
  A: '#cad8ff',
  F: '#f8f7ff',
  G: '#ffefc4',
  K: '#ffd2a1',
  M: '#ffab6e',
};

const spectralColor = (spectralClass: string): string =>
  spectralColors[spectralClass[0]] ?? '#ffffff';

// Components
@customElement('galaxy-shell')
class GalaxyShellComponent extends LitElement {
  static styles = css`
    nav {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
    }
    nav a {
      color: #c9d6ea;
      text-decoration: none;
      padding: 6px 14px;
      border-radius: 999px;
      border: 1px solid #3d5a80;
      background: rgba(9, 12, 20, 0.6);
      cursor: pointer;
    }
    nav a:hover {
      color: #e6edf3;
      border-color: #3d5a80;
    }
    nav a.active {
      color: #0b1020;
      background: #7aa2ff;
      border-color: #7aa2ff;
      font-weight: 600;
    }
    .panel {
      background: rgba(9, 12, 20, 0.72);
      border: 1px solid rgba(61, 90, 128, 0.5);
      border-radius: 12px;
      padding: 20px;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }
    .backdrop-credit {
      color: #8fa1bb;
      font-size: 0.75rem;
      margin: 32px 0 0;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
    }
    .backdrop-credit a {
      color: #c9d6ea;
    }
  `;

  // Injected by <ui-view>; required by the RoutedLitElement contract
  _uiViewProps!: UIViewInjectedProps;

  constructor(props: UIViewInjectedProps) {
    super();
    this._uiViewProps = props;
  }

  render() {
    return html`
      <nav>
        <!-- activeClasses use stateService.includes, so Stars stays lit on the nested detail state -->
        <a
          ${uiSrefActive({ activeClasses: ['active'] })}
          ${uiSref('galaxy.stars')}
          >Stars</a
        >
        <a
          ${uiSrefActive({ activeClasses: ['active'] })}
          ${uiSref('galaxy.astronaut')}
          >Astronaut</a
        >
      </nav>
      <!-- Child states (galaxy.stars, galaxy.astronaut) render into this nested view -->
      <div class="panel">
        <ui-view></ui-view>
      </div>
      <p class="backdrop-credit">
        Backdrop:
        <a
          href="https://science.nasa.gov/image-detail/ssc2006-02a-0/"
          target="_blank"
          rel="noopener"
          >the Milky Way's center in infrared</a
        >
        &mdash; NASA, JPL-Caltech, Susan Stolovy (SSC/Caltech) et al.
      </p>
    `;
  }
}

@customElement('stars-container')
class StarsContainerComponent extends LitElement {
  static styles = css`
    .container {
      display: flex;
      gap: 24px;
    }
    .list {
      flex: 0 0 220px;
    }
    .list h3 {
      margin: 0 0 12px;
      color: #9db2ce;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    .list ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .list li {
      margin: 4px 0;
    }
    .list a {
      color: #c9d6ea;
      text-decoration: none;
      padding: 6px 10px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-radius: 6px;
      cursor: pointer;
    }
    .list a:hover {
      background: rgba(122, 162, 255, 0.12);
    }
    .list a.active {
      background: rgba(122, 162, 255, 0.25);
      color: #fff;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex: none;
      box-shadow: 0 0 6px 1px currentColor;
    }
    .detail {
      flex: 1;
      padding: 20px;
      background: rgba(13, 20, 33, 0.75);
      border: 1px solid #263449;
      border-radius: 12px;
      min-height: 260px;
    }
    .hint {
      color: #6b7c95;
      font-style: italic;
    }
  `;

  @property({ attribute: false })
  _uiViewProps!: UIViewInjectedProps;

  constructor(props: UIViewInjectedProps) {
    super();
    this._uiViewProps = props;
  }

  get stars(): Star[] {
    return this._uiViewProps.resolves!.stars;
  }

  render() {
    return html`
      <div class="container">
        <div class="list">
          <h3>Milky Way stars</h3>
          <ul>
            ${this.stars.map(
              (star) => html`
                <li>
                  <!-- Relative sref: '.star' resolves against this state (galaxy.stars) -->
                  <a
                    ${uiSrefActive({ activeClasses: ['active'] })}
                    ${uiSref('.star', { starId: star.id })}
                  >
                    <span
                      class="dot"
                      style="color: ${spectralColor(star.spectralClass)}"
                    ></span>
                    ${star.name}
                  </a>
                </li>
              `,
            )}
          </ul>
        </div>
        <div class="detail">
          <!-- Slotted fallback shows until the child state (galaxy.stars.star) activates -->
          <ui-view>
            <p class="hint">Select a star from the list</p>
          </ui-view>
        </div>
      </div>
    `;
  }
}

@customElement('star-detail')
class StarDetailComponent extends LitElement {
  static styles = css`
    h3 {
      margin: 0 0 4px;
      font-size: 1.5rem;
    }
    .constellation {
      color: #9db2ce;
      margin: 0 0 16px;
    }
    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 6px 16px;
      margin: 0 0 16px;
    }
    dt {
      color: #6b7c95;
    }
    dd {
      margin: 0;
      color: #e6edf3;
    }
    .fact {
      color: #c9d6ea;
      line-height: 1.6;
      border-left: 3px solid #7aa2ff;
      padding-left: 12px;
      margin: 0;
    }
  `;

  @property({ attribute: false })
  _uiViewProps!: UIViewInjectedProps;

  constructor(props: UIViewInjectedProps) {
    super();
    this._uiViewProps = props;
  }

  get star(): Star | undefined {
    return this._uiViewProps.resolves!.star;
  }

  render() {
    if (!this.star) {
      return html`<p>Star not found</p>`;
    }
    return html`
      <h3 style="color: ${spectralColor(this.star.spectralClass)}">
        ${this.star.name}
      </h3>
      <p class="constellation">${this.star.constellation}</p>
      <dl>
        <dt>Spectral class</dt>
        <dd>${this.star.spectralClass}</dd>
        <dt>Distance</dt>
        <dd>${this.star.distance}</dd>
        <dt>Apparent magnitude</dt>
        <dd>${this.star.apparentMagnitude}</dd>
      </dl>
      <p class="fact">${this.star.funFact}</p>
    `;
  }
}

@customElement('astronaut-view')
class AstronautViewComponent extends LitElement {
  static styles = css`
    h3 {
      margin: 0 0 12px;
    }
    p {
      color: #9db2ce;
      margin: 0 0 16px;
    }
    model-viewer {
      width: 100%;
      height: 420px;
      /* The glass panel mutes the page backdrop to near-black, so show
         the galactic-center photo directly inside the viewer instead */
      background: url('https://science.nasa.gov/wp-content/uploads/2023/09/ssc2006-02a-0.jpg?w=2048')
        center / cover no-repeat;
      border: 1px solid #263449;
      border-radius: 12px;
    }
    .attribution {
      color: #6b7c95;
      font-size: 0.8rem;
      margin: 8px 0 0;
    }
    .attribution a {
      color: #9db2ce;
    }
  `;

  // Injected by <ui-view>; required by the RoutedLitElement contract
  _uiViewProps!: UIViewInjectedProps;

  constructor(props: UIViewInjectedProps) {
    super();
    this._uiViewProps = props;
  }

  render() {
    return html`
      <h3>Someone is exploring out here too</h3>
      <p>Drag to orbit the astronaut. Scroll to zoom.</p>
      <model-viewer
        src="https://modelviewer.dev/shared-assets/models/NeilArmstrong.glb"
        alt="Neil Armstrong's Apollo 11 spacesuit, 3D scan"
        camera-controls
        auto-rotate
        ar
      ></model-viewer>
      <p class="attribution">
        <a
          href="https://3d.si.edu/object/3d/neil-armstrong-spacesuit:d8c63ba6-4ebc-11ea-b77f-2e728ce88125"
          target="_blank"
          rel="noopener"
          >Neil Armstrong Space Suit</a
        >
        provided by the Smithsonian Digitization Programs Office and the
        National Air and Space Museum.
        <a href="https://www.si.edu/Termsofuse" target="_blank" rel="noopener"
          >Usage Conditions Apply</a
        >
      </p>
    `;
  }
}

@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
    h1 {
      margin: 0 0 4px;
      color: #f2f6fc;
      font-size: 1.7rem;
      letter-spacing: 0.02em;
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.9);
    }
    .tagline {
      color: #a7b8d0;
      margin: 0 0 24px;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
    }
  `;

  render() {
    return html`
      <h1>Hello Galaxy</h1>
      <p class="tagline">
        Nested states, nested views &mdash; a tour of the Milky Way
      </p>
      <!-- Root view: the galaxy shell state renders here -->
      <ui-view></ui-view>
    `;
  }
}

// State definitions
// Parent shell state; owns the section nav and a nested <ui-view>
const galaxyState: LitStateDeclaration = {
  name: 'galaxy',
  url: '/galaxy',
  component: GalaxyShellComponent,
  // Visiting the bare parent forwards to the star list
  redirectTo: 'galaxy.stars',
};

// Child state (nested via dot notation) renders inside galaxy's <ui-view>
const starsState: LitStateDeclaration = {
  name: 'galaxy.stars',
  url: '/stars',
  component: StarsContainerComponent,
  resolve: [
    {
      token: 'stars',
      resolveFn: () => StarService.getStars(),
    },
  ],
};

// Grandchild state with a URL param, rendered inside galaxy.stars's <ui-view>
const starState: LitStateDeclaration = {
  name: 'galaxy.stars.star',
  url: '/:starId',
  component: StarDetailComponent,
  resolve: [
    {
      token: 'star',
      // Resolve inheritance: 'stars' is injected from the parent state's resolve
      deps: ['$transition$', 'stars'],
      resolveFn: ($transition$: Transition, stars: Star[]) => {
        const starId = $transition$.params().starId;
        return stars.find((s) => s.id === starId);
      },
    },
  ],
};

// Sibling of galaxy.stars; swaps into the same nested <ui-view>
const astronautState: LitStateDeclaration = {
  name: 'galaxy.astronaut',
  url: '/astronaut',
  component: AstronautViewComponent,
  resolve: [
    {
      // Resolves can await code, not just data: model-viewer loads on state
      // activation, and the bundler splits it into its own chunk
      token: 'modelViewer',
      resolveFn: () => import('@google/model-viewer'),
    },
  ],
};

// Router setup
const router = new UIRouterLit();
router.plugin(hashLocationPlugin);
import('@uirouter/visualizer').then(({ Visualizer }) =>
  router.plugin(Visualizer),
);
router.stateRegistry.register(galaxyState);
router.stateRegistry.register(starsState);
router.stateRegistry.register(starState);
router.stateRegistry.register(astronautState);
router.urlService.rules.initial({ state: 'galaxy.stars' });
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
