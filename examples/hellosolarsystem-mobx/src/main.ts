import { html, LitElement, css, render } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { hashLocationPlugin, Transition } from '@uirouter/core';
import { compareStructural, makeAutoObservable, reaction } from 'mobx';
import {
  UIRouterLit,
  uiSref,
  uiSrefActive,
  LitStateDeclaration,
  UIViewInjectedProps,
} from 'lit-ui-router';
import {
  ReactionController,
  RouterReactionController,
  RouterStore,
} from 'lit-ui-router-mobx';

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

// Route params are strings, and `parseInt('4x')` is 4. The resolve is the one
// place that turns :planetId into a body, so it is the one place that parses
// — strictly, so a bad URL resolves to nothing rather than to a silently
// different planet.
function parsePlanetId(value: string | undefined): number | undefined {
  return value !== undefined && /^\d+$/.test(value) ? Number(value) : undefined;
}

const SolarSystemService = {
  getAllBodies: (): Promise<SolarBody[]> => delay(solarBodies),
  getBody: (id: number): Promise<SolarBody | undefined> =>
    delay(solarBodies.find((b) => b.id === id)),
};

// Log scale keeps the Sun and Pluto on the same screen.
const dotSize = (diameterKm: number): number =>
  Math.round(Math.log2(diameterKm / 1000) * 6 + 10);

/** One stop on the tour: a state the visitor landed on, in order. */
interface TrailStop {
  state: string;
  label: string;
  bodyId?: number;
}

// Application state, not route state. `trail` is the only history the store
// keeps; everything else about the tour is computed from it.
class Tour {
  /**
   * The resolved body being visited, set by the `planet` state's onEnter.
   * The URL alone cannot supply this — only the resolve knows the body.
   */
  active?: SolarBody = undefined;

  /** Every stop, in order. Replaced rather than mutated. */
  trail: readonly TrailStop[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Both facts about one arrival, written together: an action, so the two
   * observables settle in a single batch and no reader sees them disagree.
   */
  arrive(state: string, body?: SolarBody) {
    this.active = body;
    const stop: TrailStop = body
      ? { state, label: body.name, bodyId: body.id }
      : { state, label: state === 'planet' ? 'Unknown body' : 'All bodies' };
    this.trail = [...this.trail, stop];
  }

  /**
   * A real computed: MobX recomputes it only when `trail` changes and hands
   * back the same Set until then, so selectors over it stay cheap.
   */
  get visited(): ReadonlySet<number> {
    return new Set(
      this.trail.flatMap((stop) =>
        stop.bodyId === undefined ? [] : [stop.bodyId],
      ),
    );
  }

  get visitedCount(): number {
    return this.visited.size;
  }
}

const TourStore = new Tour();

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
    .visited {
      margin-left: auto;
      color: #8ab4f8;
      font-size: 0.85em;
    }
    /* ≥44px tap targets on touch-sized screens */
    @media (max-width: 480px) {
      a {
        box-sizing: border-box;
        min-height: 44px;
        padding: 8px 12px;
      }
      /* Cap the log-scaled dots so the Sun doesn't dwarf the row */
      .body {
        max-width: 44px;
        max-height: 44px;
      }
    }
  `;

  // The router constructs routed components with injected props.
  /** @public — router-assigned; the `_` prefix is convention, not privacy. */
  @property({ attribute: false })
  _uiViewProps!: UIViewInjectedProps<{ planets: SolarBody[] }>;

  constructor(props: UIViewInjectedProps<{ planets: SolarBody[] }>) {
    super();
    this._uiViewProps = props;
  }

  // The `planets` resolve loads once per activation; the visited set keeps
  // moving after it. Selecting the computed means this re-renders when the
  // set actually changes, not on every stop added to the trail.
  private readonly tour = new ReactionController(this, () => TourStore.visited);

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
                ${
                  this.tour.value.has(planet.id)
                    ? html`<span class="visited">visited</span>`
                    : ''
                }
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
    /* Top back link only appears on phones, where the bottom one is below the fold */
    .back-link.top {
      display: none;
      margin: 0;
    }
    /* ≥44px tap targets on touch-sized screens */
    @media (max-width: 480px) {
      .back-link {
        padding: 13px 0;
      }
      .back-link.top {
        display: block;
      }
      /* Cap the doubled detail dot so facts stay above the fold */
      .body {
        max-width: 96px;
        max-height: 96px;
      }
    }
    /* Stack label/value pairs on narrow screens */
    @media (max-width: 420px) {
      dl {
        grid-template-columns: 1fr;
        gap: 2px 0;
      }
      dt {
        margin-top: 8px;
      }
    }
  `;

  /** @public — router-assigned; the `_` prefix is convention, not privacy. */
  @property({ attribute: false })
  _uiViewProps!: UIViewInjectedProps<{ planet: SolarBody | undefined }>;

  constructor(props: UIViewInjectedProps<{ planet: SolarBody | undefined }>) {
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
        <a class="back-link top" ${uiSref('planets')}
          >&lsaquo; Back to the solar system</a
        >
        <h3>${this.planet.name}</h3>
        <span
          class="body"
          style="display:inline-block;width:${size}px;height:${size}px;background:${
            this.planet.gradient
          }"
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
      display: inline-block;
      margin-right: 16px;
      color: #8ab4f8;
      text-decoration: none;
    }
    nav a.active {
      font-weight: bold;
      border-bottom: 2px solid #8ab4f8;
    }
    nav .trail {
      color: #8892b8;
    }
    .path {
      margin: 0;
      padding-left: 20px;
      color: #8892b8;
      font-size: 0.85em;
    }
    .path li {
      margin: 2px 0;
    }
    .crumb {
      color: #8892b8;
    }
    .crumb strong {
      color: #e6e9f0;
    }
    /* ≥44px tap targets on touch-sized screens */
    @media (max-width: 480px) {
      nav a {
        padding: 13px 0;
      }
    }
  `;

  // <app-root> is not routed, so it outlives every transition and never gets
  // fresh view props. Two controllers, two sources: the route one selects
  // what the URL says, the store one selects what the app remembers. Neither
  // runs an effect — the route sets the active visit, and the store derives
  // the rest from it.
  private readonly route = new RouterReactionController(this, (route) =>
    route.includes('planet'),
  );

  private readonly tour = new ReactionController(
    this,
    () => ({
      active: TourStore.active,
      trail: TourStore.trail,
      visited: TourStore.visitedCount,
    }),
    { equals: compareStructural },
  );

  render() {
    const onDetail = this.route.value;
    const { active, trail, visited } = this.tour.value;
    return html`
      <h2>Hello Solar System (MobX)</h2>
      <nav>
        <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('planets')}
          >Planets</a
        >
        ${onDetail ? html`<span class="trail">&rsaquo; body detail</span>` : ''}
      </nav>
      <p class="crumb">
        ${active ? html`Viewing <strong>${active.name}</strong> — ` : ''}
        <span class="visited-count"
          >${visited} of ${solarBodies.length} visited</span
        >
      </p>
      <ol class="path">
        ${trail.map((stop) => html`<li>${stop.label}</li>`)}
      </ol>
      <ui-view></ui-view>
    `;
  }
}

// State definitions
const planetsState: LitStateDeclaration<{ planets: SolarBody[] }> = {
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

const planetState: LitStateDeclaration<{ planet: SolarBody | undefined }> = {
  name: 'planet',
  url: '/planets/:planetId',
  component: PlanetDetailComponent,
  // deps injects $transition$ so the resolve can read the route parameter.
  resolve: [
    {
      token: 'planet',
      deps: ['$transition$'],
      resolveFn: ($transition$: Transition) => {
        const planetId = parsePlanetId(
          $transition$.params<{ planetId: string }>().planetId,
        );
        return planetId === undefined
          ? undefined
          : SolarSystemService.getBody(planetId);
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

// A visit is a transition that COMPLETED. An onEnter hook fires while the
// transition is still in flight, and a later hook can still redirect or fail
// it, so a tour built on onEnter can record arrivals that never happened.
// onSuccess is the honest trigger, and it knows both facts about the arrival
// at once: where we landed, and what that state resolved.
router.transitionService.onSuccess({}, (transition) => {
  const state = transition.to().name;
  if (!state) return; // the root state, which nothing navigates to
  // injector(<name>) scopes the lookup to that state's own resolves.
  const body =
    state === 'planet'
      ? (transition.injector(state).get('planet') as SolarBody | undefined)
      : undefined;
  TourStore.arrive(state, body);
});

// RouterStore is a plain MobX observable, so application code can react to the
// router with no component in the middle. Nothing here re-renders: the tab
// title lives outside the component tree, so there is no host and no
// controller — just a reaction.
reaction(
  () => {
    const route = RouterStore.for(router);
    return route.includes('planet') ? TourStore.active?.name : undefined;
  },
  (name) => {
    document.title = name
      ? `${name} — Hello Solar System (MobX)`
      : 'Hello Solar System (MobX)';
  },
);

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
