import { consume, createContext, provide } from '@lit/context';
import { html, LitElement, css, nothing, render } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { hashLocationPlugin, Transition } from '@uirouter/core';
import {
  UIRouterLit,
  uiSref,
  uiSrefActive,
  type LitStateDeclaration,
  type UIViewInjectedProps,
} from 'lit-ui-router';
import { routerContext } from 'lit-ui-router/context';
import {
  RouterSignalController,
  SignalController,
} from 'lit-ui-router-signals';
import { Signal } from 'signal-polyfill';
import type { TypedStateService } from 'ui-router-registry';
// Carries the registry into ui-router-signals' route snapshot.
import type {} from 'ui-router-registry/signals';
import { RouterSignals, watchSelection } from 'ui-router-signals';

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

type Unit = 'au' | 'km' | 'light';

const units: { id: Unit; label: string }[] = [
  { id: 'au', label: 'AU' },
  { id: 'km', label: 'km' },
  { id: 'light', label: 'light time' },
];

// Context hands each routed view the header's unit signal once; the signal
// carries every change after that, so the provider never re-provides.
const distanceUnitContext = createContext<Signal.State<Unit>>(
  Symbol('distance-unit'),
);

const KM_PER_AU = 149_597_871;

const LIGHT_SECONDS_PER_AU = 499.005;

const lightTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours} h ${minutes % 60} min`;

  return minutes > 0
    ? `${minutes} min ${Math.round(seconds % 60)} s`
    : `${Math.round(seconds)} s`;
};

const formatDistance = (au: number, unit: Unit): string => {
  if (unit === 'km') {
    return `${Math.round(au * KM_PER_AU).toLocaleString('en-US')} km`;
  }

  return unit === 'light' ? lightTime(au * LIGHT_SECONDS_PER_AU) : `${au} AU`;
};

// A clock that runs only while something watches it: the watched and
// unwatched callbacks start and stop the timer, so leaving the detail view
// stops it. Setting the same second again is no change, so readers wake once
// a second however often the timer fires.
let ticker: ReturnType<typeof setInterval> | undefined;

const wholeSecond = () => Math.floor(Date.now() / 1000) * 1000;

const now: Signal.State<number> = new Signal.State(wholeSecond(), {
  [Signal.subtle.watched]() {
    // watched() may not write signals itself; catch up just after
    queueMicrotask(() => now.set(wholeSecond()));
    ticker = setInterval(() => now.set(wholeSecond()), 250);
  },
  [Signal.subtle.unwatched]() {
    clearInterval(ticker);
    ticker = undefined;
  },
});

const clockTime = new Intl.DateTimeFormat('en-US', { timeStyle: 'medium' });

const steps = new Map([
  ['ArrowLeft', -1],
  ['ArrowRight', 1],
]);

// The body the URL names, if the planet state is active. Shared by the header
// and the tab title, which read the same router signals.
const routedBody = (route: RouterSignals): SolarBody | undefined => {
  const snapshot = route.route.get();

  if (!snapshot.includes('planet')) return undefined;
  const { planetId } = snapshot.params;

  return solarBodies.find((b) => b.id === planetId);
};

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
    .distance {
      margin-left: auto;
      color: #8ab4f8;
      font-size: 0.85em;
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
    /* ≥44px tap targets on touch-sized screens */
    @media (max-width: 480px) {
      a {
        box-sizing: border-box;
        min-height: 44px;
        padding: 8px 12px;
      }
      .kind {
        display: none;
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

  @consume({ context: distanceUnitContext })
  private readonly distanceUnit!: Signal.State<Unit>;

  // The resolve loads the bodies once; the unit can change any time after.
  private readonly unit = new SignalController(this, () =>
    this.distanceUnit.get(),
  );

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
                  planet.distanceAu > 0
                    ? html`<span class="distance"
                        >${formatDistance(planet.distanceAu, this.unit.value)}</span
                      >`
                    : nothing
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
    .light {
      margin: 0 0 16px;
      padding: 10px 14px;
      border: 1px solid #2c3350;
      border-radius: 10px;
      background: #171c2e;
      color: #cdd6f4;
    }
    .light time {
      color: #ffd166;
      font-variant-numeric: tabular-nums;
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

  @consume({ context: distanceUnitContext })
  private readonly distanceUnit!: Signal.State<Unit>;

  private readonly unit = new SignalController(this, () =>
    this.distanceUnit.get(),
  );

  // Watching `now` is what starts its timer; disconnecting stops it.
  private readonly clock = new SignalController(this, () => now.get());

  // Populated by the `planet` resolve, keyed off the :planetId route param.
  get planet(): SolarBody | undefined {
    return this._uiViewProps.resolves.planet;
  }

  private renderLight(planet: SolarBody) {
    const at = this.clock.value;

    if (planet.distanceAu === 0) {
      const earth = LIGHT_SECONDS_PER_AU * 1000;

      return html`<p class="light">
        Light leaving the Sun now reaches Earth at
        <time>${clockTime.format(at + earth)}</time>.
      </p>`;
    }

    const travel = planet.distanceAu * LIGHT_SECONDS_PER_AU;

    return html`<p class="light">
      Sunlight reaching ${planet.name} now left the Sun at
      <time>${clockTime.format(at - travel * 1000)}</time>, ${lightTime(travel)}
      ago.
    </p>`;
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
          <dd>${formatDistance(this.planet.distanceAu, this.unit.value)}</dd>
          <dt>Diameter</dt>
          <dd>${this.planet.diameterKm.toLocaleString('en-US')} km</dd>
          <dt>Known moons</dt>
          <dd>${this.planet.moons}</dd>
          <dt>Orbital period</dt>
          <dd>${this.planet.orbitalPeriod}</dd>
        </dl>
        ${this.renderLight(this.planet)}
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
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 16px;
      margin-bottom: 16px;
    }
    nav {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 16px;
    }
    nav a {
      color: #8ab4f8;
      text-decoration: none;
    }
    nav a.active {
      font-weight: bold;
      border-bottom: 2px solid #8ab4f8;
    }
    .units {
      display: flex;
      margin-left: auto;
      border: 1px solid #2c3350;
      border-radius: 999px;
      overflow: hidden;
    }
    .units button {
      padding: 4px 12px;
      border: 0;
      background: transparent;
      color: #8892b8;
      font: inherit;
      font-size: 0.85em;
      cursor: pointer;
    }
    .units button[aria-pressed='true'] {
      background: #8ab4f8;
      color: #0b1020;
      font-weight: 600;
    }
    .hint {
      flex-basis: 100%;
      margin: 0;
      color: #8892b8;
      font-size: 0.8em;
    }
    kbd {
      padding: 0 4px;
      border: 1px solid #2c3350;
      border-radius: 4px;
      font: inherit;
    }
    /* ≥44px tap targets on touch-sized screens */
    @media (max-width: 480px) {
      nav a {
        padding: 13px 0;
      }
      .units button {
        min-height: 44px;
      }
      .hint {
        display: none;
      }
    }
  `;

  // <app-root> sits outside every <ui-view>, so it follows the route through
  // the router's signals, waking only when the routed body changes.
  private readonly body = new RouterSignalController(this, routedBody);

  // <ui-router> answers this request, so no component reaches for module scope.
  @consume({ context: routerContext })
  private readonly router!: UIRouterLit;

  // The routed views are constructed by the router, so <app-root> cannot pass
  // them props; it provides the unit to every view rendered beneath it instead.
  @provide({ context: distanceUnitContext })
  private readonly distanceUnit = new Signal.State<Unit>('au');

  private readonly unit = new SignalController(this, () =>
    this.distanceUnit.get(),
  );

  private readonly onKey = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    const step = steps.get(event.key);
    const target = step === undefined ? undefined : this.neighbor(step);

    if (!target) return;
    event.preventDefault();
    void this.stateService.go('planet', { planetId: target.id });
  };

  private get stateService(): TypedStateService {
    return this.router.stateService;
  }

  private neighbor(step: number): SolarBody | undefined {
    const body = this.body.value;

    return body && solarBodies[solarBodies.indexOf(body) + step];
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKey);
  }

  private renderStep(rel: 'prev' | 'next') {
    const target = this.neighbor(rel === 'prev' ? -1 : 1);

    if (!target) return nothing;

    return html`<a rel=${rel} ${uiSref('planet', { planetId: target.id })}
      >${
        rel === 'prev'
          ? html`&lsaquo; ${target.name}`
          : html`${target.name} &rsaquo;`
      }</a
    >`;
  }

  render() {
    return html`
      <h2>Hello Solar System (Signals)</h2>
      <div class="bar">
        <nav aria-label="Hello Solar System (Signals)">
          <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('planets')}
            >Planets</a
          >
          ${this.renderStep('prev')} ${this.renderStep('next')}
        </nav>
        <div class="units" role="group" aria-label="Distance unit">
          ${units.map(
            ({ id, label }) => html`
              <button
                type="button"
                aria-pressed=${this.unit.value === id}
                @click=${() => this.distanceUnit.set(id)}
              >
                ${label}
              </button>
            `,
          )}
        </div>
        ${
          this.body.value
            ? html`<p class="hint">
                <kbd>&larr;</kbd> <kbd>&rarr;</kbd> step through the bodies
              </p>`
            : nothing
        }
      </div>
      <ui-view></ui-view>
    `;
  }
}

// State definitions
const planetsState = {
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
} as const satisfies LitStateDeclaration<{ planets: SolarBody[] }>;

const planetState = {
  name: 'planet',
  // The `int` param type decodes to a number, and `/planets/4x` matches no state.
  url: '/planets/{planetId:int}',
  component: PlanetDetailComponent,
  // deps injects $transition$ so the resolve can read the route parameter.
  resolve: [
    {
      token: 'planet',
      deps: ['$transition$'],
      resolveFn: ($transition$: Transition) => {
        const { planetId } = $transition$.params<{ planetId: number }>();

        return SolarSystemService.getBody(planetId);
      },
    },
  ],
} as const satisfies LitStateDeclaration<{ planet: SolarBody | undefined }>;

// `as const` keeps the names and urls literal for the registry to read.
declare module 'ui-router-registry' {
  interface Register {
    states: typeof planetsState | typeof planetState;
  }
}

// Router setup
const router = new UIRouterLit();

router.plugin(hashLocationPlugin);

void import('@uirouter/visualizer').then(({ Visualizer }) =>
  router.plugin(Visualizer),
);

router.stateRegistry.register(planetsState);

router.stateRegistry.register(planetState);

router.urlService.rules.initial({ state: 'planets' });

router.urlService.rules.otherwise({ state: 'planets' });

// The tab title lives outside the component tree: no host, no controller,
// just a watcher over the same router signals the header reads.
watchSelection(
  () => routedBody(RouterSignals.for(router))?.name,
  undefined,
  (name) => {
    document.title = name
      ? `${name} — Hello Solar System (Signals)`
      : 'Hello Solar System (Signals)';
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
