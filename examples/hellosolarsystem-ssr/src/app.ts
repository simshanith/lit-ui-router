import { html, LitElement, css, type TemplateResult } from 'lit';
import { uiViewSlot } from 'lit-ui-router-ssr/client';
// Defines <ui-router> and the served <ui-view>, in place of lit-ui-router's root entry.
import 'lit-ui-router-ssr/register';
import 'lit-ui-router/ui-router.register';
import { customElement, property } from 'lit/decorators.js';
import type { Transition } from '@uirouter/core';
import {
  type UIRouterLit,
  srefActiveClass,
  srefAriaCurrent,
  srefHref,
  type LitStateDeclaration,
  type UIViewInjectedProps,
} from 'lit-ui-router/pure';

import { solarBodies, type SolarBody } from './bodies.ts';
import { mount, routes } from './routes.ts';

// Data Service
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
              <a href=${srefHref('planet', { planetId: planet.id })}>
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
        Body not found.
        <a class="back-link" href=${srefHref('planets')}>Back</a>
      </p>`;
    }

    const size = dotSize(this.planet.diameterKm) * 2;

    return html`
      <div>
        <a class="back-link top" href=${srefHref('planets')}
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
        <a class="back-link" href=${srefHref('planets')}
          >Back to the solar system</a
        >
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
    /* ≥44px tap targets on touch-sized screens */
    @media (max-width: 480px) {
      nav a {
        padding: 13px 0;
      }
    }
  `;

  render() {
    return html`
      <h2>Hello Solar System</h2>
      <nav aria-label="Hello Solar System (Vite SSR)">
        <a
          class=${srefActiveClass({ state: 'planets', activeClasses: ['active'] })}
          aria-current=${srefAriaCurrent({ state: 'planets' })}
          href=${srefHref('planets')}
          >Planets</a
        >
      </nav>
      <ui-view>${uiViewSlot()}</ui-view>
    `;
  }
}

// State definitions
export const planetsState: LitStateDeclaration<{ planets: SolarBody[] }> = {
  ...routes.planets,
  component: PlanetListComponent,
  // Resolve blocks the transition until the async data is ready.
  resolve: [
    {
      token: 'planets',
      resolveFn: () => SolarSystemService.getAllBodies(),
    },
  ],
};

export const planetState: LitStateDeclaration<{
  planet: SolarBody | undefined;
}> = {
  ...routes.planet,
  component: PlanetDetailComponent,
  // deps injects $transition$ so the resolve can read the route parameter.
  resolve: [
    {
      token: 'planet',
      deps: ['$transition$'],
      resolveFn: ($transition$: Transition) => {
        const planetId = parseInt(
          $transition$.params<{ planetId: string }>().planetId,
        );

        return SolarSystemService.getBody(planetId);
      },
    },
  ],
};

const legacyState: LitStateDeclaration = routes.legacy;

const notFoundState: LitStateDeclaration = {
  ...routes.notFound,
  component: () => html`<p>Nothing orbits here.</p>`,
};

export const states = [planetsState, planetState, legacyState, notFoundState];

/** Registers the states and the server mount's url rules, from the same data. */
export const configure = (router: UIRouterLit): UIRouterLit => {
  // Before any state registers: url matchers compile with the strictness in force then.
  router.urlService.config.strictMode(mount.config.strict);

  for (const state of states) router.stateRegistry.register(state);

  router.urlService.rules.otherwise(mount.otherwise);

  return router;
};

/** The page both halves render: the server fills the slot, the client adopts it. */
export const page = (router: UIRouterLit): TemplateResult =>
  html`<ui-router .uiRouter=${router}><app-root></app-root></ui-router>`;
