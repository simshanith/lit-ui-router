import { html, LitElement, css, render } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { hashLocationPlugin, Transition } from '@uirouter/core';
import {
  UIRouterLit,
  uiSref,
  uiSrefActive,
  LitStateDeclaration,
  UIViewInjectedProps,
} from 'lit-ui-router';

// Data Service
interface SolarBody {
  id: number;
  name: string;
  kind: 'star' | 'rocky planet' | 'gas giant' | 'ice giant' | 'dwarf planet';
  distanceAu: number;
  diameterKm: number;
  moons: number;
  orbitalPeriod: string;
  funFact: string;
  gradient: string;
}

// Ordered by distance from the Sun.
const solarBodies: SolarBody[] = [
  {
    id: 1,
    name: 'Sun',
    kind: 'star',
    distanceAu: 0,
    diameterKm: 1392700,
    moons: 0,
    orbitalPeriod: '230 million years around the galactic center',
    funFact: "Contains 99.86% of the solar system's mass.",
    gradient:
      'radial-gradient(circle at 35% 35%, #fff7ae, #ffb703 55%, #d00000)',
  },
  {
    id: 2,
    name: 'Mercury',
    kind: 'rocky planet',
    distanceAu: 0.39,
    diameterKm: 4879,
    moons: 0,
    orbitalPeriod: '88 days',
    funFact: 'One solar day on Mercury lasts about two Mercury years.',
    gradient:
      'radial-gradient(circle at 35% 35%, #d8d8d8, #8d8d8d 60%, #4a4a4a)',
  },
  {
    id: 3,
    name: 'Venus',
    kind: 'rocky planet',
    distanceAu: 0.72,
    diameterKm: 12104,
    moons: 0,
    orbitalPeriod: '225 days',
    funFact: 'Spins backwards, so the Sun rises in the west.',
    gradient:
      'radial-gradient(circle at 35% 35%, #f5e3b3, #e0b060 60%, #9c6f2f)',
  },
  {
    id: 4,
    name: 'Earth',
    kind: 'rocky planet',
    distanceAu: 1,
    diameterKm: 12756,
    moons: 1,
    orbitalPeriod: '365.25 days',
    funFact: 'The only known world with liquid-water oceans at the surface.',
    gradient:
      'radial-gradient(circle at 35% 35%, #9bd4f5, #2a7fd4 55%, #123c7a)',
  },
  {
    id: 5,
    name: 'Mars',
    kind: 'rocky planet',
    distanceAu: 1.52,
    diameterKm: 6792,
    moons: 2,
    orbitalPeriod: '687 days',
    funFact: 'Home to Olympus Mons, the tallest volcano in the solar system.',
    gradient:
      'radial-gradient(circle at 35% 35%, #f0a075, #c1440e 60%, #6e2408)',
  },
  {
    id: 6,
    name: 'Jupiter',
    kind: 'gas giant',
    distanceAu: 5.2,
    diameterKm: 142984,
    moons: 95,
    orbitalPeriod: '11.9 years',
    funFact: 'The Great Red Spot is a storm larger than Earth.',
    gradient:
      'radial-gradient(circle at 35% 35%, #f3ddc0, #c88b3a 55%, #7a4a1f)',
  },
  {
    id: 7,
    name: 'Saturn',
    kind: 'gas giant',
    distanceAu: 9.5,
    diameterKm: 120536,
    moons: 274,
    orbitalPeriod: '29.4 years',
    funFact: 'Less dense than water, it would float in a big enough bathtub.',
    gradient:
      'radial-gradient(circle at 35% 35%, #f7e7b8, #d9b36c 60%, #8f6f3a)',
  },
  {
    id: 8,
    name: 'Uranus',
    kind: 'ice giant',
    distanceAu: 19.2,
    diameterKm: 51118,
    moons: 28,
    orbitalPeriod: '84 years',
    funFact: 'Rotates on its side, tilted about 98 degrees.',
    gradient:
      'radial-gradient(circle at 35% 35%, #d8f7f7, #7fd4d4 60%, #3a8f9c)',
  },
  {
    id: 9,
    name: 'Neptune',
    kind: 'ice giant',
    distanceAu: 30.1,
    diameterKm: 49528,
    moons: 16,
    orbitalPeriod: '165 years',
    funFact: 'Winds reach 2,000 km/h, the fastest in the solar system.',
    gradient:
      'radial-gradient(circle at 35% 35%, #9fb8f5, #3b5bdb 60%, #1a2f7a)',
  },
  {
    id: 10,
    name: 'Pluto',
    kind: 'dwarf planet',
    distanceAu: 39.5,
    diameterKm: 2377,
    moons: 5,
    orbitalPeriod: '248 years',
    funFact: 'Reclassified as a dwarf planet in 2006, but still beloved.',
    gradient:
      'radial-gradient(circle at 35% 35%, #e8d8c8, #b09880 60%, #6a5a4a)',
  },
];

// Simulated network latency so resolves are observably async.
const delay = <T>(value: T, ms = 300): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const SolarSystemService = {
  getAllBodies: (): Promise<SolarBody[]> => delay(solarBodies),
  getBody: (id: number): Promise<SolarBody | undefined> =>
    delay(solarBodies.find((b) => b.id === id)),
};

// Log scale keeps the Sun and Pluto on the same screen.
const dotSize = (diameterKm: number): number =>
  Math.round(Math.log2(diameterKm / 1000) * 6 + 10);

// Components
@customElement('planet-list')
class PlanetListComponent extends LitElement {
  static styles = css`
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      margin: 4px 0;
    }
    a {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 8px 12px;
      border-radius: 10px;
      color: #cdd6f4;
      text-decoration: none;
    }
    a:hover {
      background: rgba(255, 255, 255, 0.07);
    }
    .body {
      flex: none;
      border-radius: 50%;
      box-shadow: 0 0 12px rgba(255, 255, 255, 0.25);
    }
    .name {
      min-width: 5.5em;
      font-weight: 600;
    }
    .kind {
      color: #8892b8;
      font-size: 0.85em;
    }
  `;

  // The router constructs routed components with injected props.
  @property({ attribute: false })
  _uiViewProps!: UIViewInjectedProps;

  constructor(props: UIViewInjectedProps) {
    super();
    this._uiViewProps = props;
  }

  // Populated by the `planets` resolve on the list state.
  get planets(): SolarBody[] {
    return this._uiViewProps.resolves.planets;
  }

  render() {
    return html`
      <h3>Bodies by distance from the Sun</h3>
      <ul>
        ${this.planets.map(
          (planet) => html`
            <li>
              <a ${uiSref('planet', { planetId: planet.id })}>
                <span
                  class="body"
                  style="width:${dotSize(planet.diameterKm)}px;height:${dotSize(
                    planet.diameterKm,
                  )}px;background:${planet.gradient}"
                ></span>
                <span class="name">${planet.name}</span>
                <span class="kind">${planet.kind}</span>
              </a>
            </li>
          `,
        )}
      </ul>
    `;
  }
}

@customElement('planet-detail')
class PlanetDetailComponent extends LitElement {
  static styles = css`
    .body {
      border-radius: 50%;
      box-shadow: 0 0 30px rgba(255, 255, 255, 0.3);
      margin: 8px 0 16px;
    }
    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 6px 16px;
      margin: 0 0 16px;
    }
    dt {
      color: #8892b8;
    }
    dd {
      margin: 0;
    }
    .fun-fact {
      font-style: italic;
      color: #cdd6f4;
    }
    .back-link {
      margin-top: 16px;
      display: block;
      color: #8ab4f8;
      text-decoration: none;
    }
    .back-link:hover {
      text-decoration: underline;
    }
  `;

  @property({ attribute: false })
  _uiViewProps!: UIViewInjectedProps;

  constructor(props: UIViewInjectedProps) {
    super();
    this._uiViewProps = props;
  }

  // Populated by the `planet` resolve, keyed off the :planetId route param.
  get planet(): SolarBody | undefined {
    return this._uiViewProps.resolves.planet;
  }

  render() {
    if (!this.planet) {
      return html`<p>
        Body not found. <a class="back-link" ${uiSref('planets')}>Back</a>
      </p>`;
    }
    const size = dotSize(this.planet.diameterKm) * 2;
    return html`
      <div>
        <h3>${this.planet.name}</h3>
        <span
          class="body"
          style="display:inline-block;width:${size}px;height:${size}px;background:${this
            .planet.gradient}"
        ></span>
        <dl>
          <dt>Kind</dt>
          <dd>${this.planet.kind}</dd>
          <dt>Distance from Sun</dt>
          <dd>${this.planet.distanceAu} AU</dd>
          <dt>Diameter</dt>
          <dd>${this.planet.diameterKm.toLocaleString('en-US')} km</dd>
          <dt>Known moons</dt>
          <dd>${this.planet.moons}</dd>
          <dt>Orbital period</dt>
          <dd>${this.planet.orbitalPeriod}</dd>
        </dl>
        <p class="fun-fact">${this.planet.funFact}</p>
        <a class="back-link" ${uiSref('planets')}>Back to the solar system</a>
      </div>
    `;
  }
}

@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
    :host {
      color: #e6e9f0;
    }
    h2 {
      letter-spacing: 0.04em;
    }
    nav {
      margin-bottom: 16px;
    }
    nav a {
      margin-right: 16px;
      color: #8ab4f8;
      text-decoration: none;
    }
    nav a.active {
      font-weight: bold;
      border-bottom: 2px solid #8ab4f8;
    }
  `;

  render() {
    return html`
      <h2>Hello Solar System</h2>
      <nav>
        <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('planets')}
          >Planets</a
        >
      </nav>
      <ui-view></ui-view>
    `;
  }
}

// State definitions
const planetsState: LitStateDeclaration = {
  name: 'planets',
  url: '/planets',
  component: PlanetListComponent,
  // Resolve blocks the transition until the async data is ready.
  resolve: [
    {
      token: 'planets',
      resolveFn: () => SolarSystemService.getAllBodies(),
    },
  ],
};

const planetState: LitStateDeclaration = {
  name: 'planet',
  url: '/planets/:planetId',
  component: PlanetDetailComponent,
  // deps injects $transition$ so the resolve can read the route parameter.
  resolve: [
    {
      token: 'planet',
      deps: ['$transition$'],
      resolveFn: ($transition$: Transition) => {
        const planetId = parseInt($transition$.params().planetId);
        return SolarSystemService.getBody(planetId);
      },
    },
  ],
};

// Router setup
const router = new UIRouterLit();
router.plugin(hashLocationPlugin);
void import('@uirouter/visualizer').then(({ Visualizer }) =>
  router.plugin(Visualizer),
);
router.stateRegistry.register(planetsState);
router.stateRegistry.register(planetState);
router.urlService.rules.initial({ state: 'planets' });
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
