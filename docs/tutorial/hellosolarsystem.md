---
title: Hello Solar System
description: Learn about resolves and state parameters
---

# Hello Solar System

Building on [Hello World](./helloworld), this tutorial introduces data fetching with **resolves** and **state parameters**. We'll build a list/detail tour of the solar system — the Sun, all eight planets, and one beloved dwarf planet — with real facts and CSS-gradient planet visuals.

## Live Demo

<StackBlitzEmbed
src="https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellosolarsystem?embed=1&file=src/main.ts&view=preview"
title="lit-ui-router-hellosolarsystem"><a href="https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellosolarsystem?file=src/main.ts" target="_blank"><img alt="Open in StackBlitz" src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" /></a></StackBlitzEmbed>

## What We're Building

- A `planets` state listing every body in the solar system, ordered by distance from the Sun
- A `planet` state showing details of a selected body: kind, distance, diameter, moons, orbital period, and a fun fact
- Data is fetched **before** each state is activated using resolves, from a service with simulated network latency
- The URL includes a parameter for the selected body: `/planets/4` is Earth

---

## Resolve Data

### What is a Resolve?

A **resolve** fetches data before a state is entered. The state's component only renders after all resolves have completed. This ensures your component always has the data it needs.

### The Solar System Service

First, we create a data service. Each body carries real data plus a CSS gradient used to draw it:

```typescript
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

// Ordered by distance from the Sun. (Abbreviated — the example has all ten bodies.)
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
  // ...Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto
];

// Simulated network latency so resolves are observably async.
const delay = <T>(value: T, ms = 300): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const SolarSystemService = {
  getAllBodies: (): Promise<SolarBody[]> => delay(solarBodies),
  getBody: (id: number): Promise<SolarBody | undefined> =>
    delay(solarBodies.find((b) => b.id === id)),
};
```

The `delay` helper makes each fetch take ~300ms, like a real API call. The router waits for it — notice the pause before each view appears.

### Adding Resolves to States

```typescript
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
```

The resolve block:

- **token**: A string identifier for the resolved data
- **resolveFn**: An async function that returns data (or a Promise)

When navigating to `planets`, the router:

1. Calls `SolarSystemService.getAllBodies()`
2. Waits for the Promise to resolve
3. Renders `PlanetListComponent` with the data available

### Accessing Resolved Data

Components receive resolved data through `_uiViewProps`:

```typescript
import { UIViewInjectedProps } from 'lit-ui-router';

@customElement('planet-list')
class PlanetListComponent extends LitElement {
  // The router constructs routed components with injected props.
  @property({ attribute: false })
  _uiViewProps!: UIViewInjectedProps;

  constructor(props: UIViewInjectedProps) {
    super();
    this._uiViewProps = props;
  }

  // Populated by the `planets` resolve on the list state.
  get planets(): SolarBody[] {
    return this._uiViewProps.resolves!.planets;
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
                  style="width:${dotSize(planet.diameterKm)}px;height:${dotSize(planet.diameterKm)}px;background:${planet.gradient}"
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
```

Key points:

- **`_uiViewProps`**: Injected by `<ui-view>`, contains `resolves`, `router`, and `transition`
- **Constructor parameter**: The props are passed to the constructor when the component is created
- **`resolves.planets`**: Access data using the resolve's token name

Each list item draws its body as a `radial-gradient` circle. A `dotSize` helper log-scales the circle by real diameter, so the Sun and Pluto fit on the same screen:

```typescript
// Log scale keeps the Sun and Pluto on the same screen.
const dotSize = (diameterKm: number): number =>
  Math.round(Math.log2(diameterKm / 1000) * 6 + 10);
```

---

## State Parameters

### Defining Parameters

The `planet` state needs to know which body to display. We define a URL parameter:

```typescript
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
```

- **`:planetId`**: Defines a URL parameter. For `/planets/4`, `planetId` would be `"4"`
- **`deps: ['$transition$']`**: Inject the current transition object
- **`$transition$.params()`**: Access all state parameters

### Linking with Parameters

Pass parameters when creating state links:

```typescript
html`<a ${uiSref('planet', { planetId: planet.id })}>${planet.name}</a>`;
```

The second argument to `uiSref` is a parameters object. This generates a URL like `/planets/4`.

### The Planet Detail Component

The detail view renders a larger orb plus a definition list of facts:

```typescript
@customElement('planet-detail')
class PlanetDetailComponent extends LitElement {
  @property({ attribute: false })
  _uiViewProps!: UIViewInjectedProps;

  constructor(props: UIViewInjectedProps) {
    super();
    this._uiViewProps = props;
  }

  // Populated by the `planet` resolve, keyed off the :planetId route param.
  get planet(): SolarBody | undefined {
    return this._uiViewProps.resolves!.planet;
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
          style="display:inline-block;width:${size}px;height:${size}px;background:${this.planet.gradient}"
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
```

Note the graceful fallback: if the URL contains an unknown id (say `/planets/42`), the resolve returns `undefined` and the component renders "Body not found" with a link back to the list.

---

## Router Setup

The router configuration is the same as Hello World, plus the [UI Router visualizer](https://github.com/ui-router/visualizer) so you can watch states and transitions as you click around:

```typescript
const router = new UIRouterLit();
router.plugin(hashLocationPlugin);
import('@uirouter/visualizer').then(({ Visualizer }) =>
  router.plugin(Visualizer),
);
router.stateRegistry.register(planetsState);
router.stateRegistry.register(planetState);
router.urlService.rules.initial({ state: 'planets' });
router.start();
```

## Full Source Code

The complete source — including all ten solar bodies and the starfield styling — is in [`examples/hellosolarsystem/src/main.ts`](https://github.com/simshanith/lit-ui-router/blob/main/examples/hellosolarsystem/src/main.ts), or browse it in the StackBlitz embed above.

---

## URL Persistence

Notice that the URL contains all the state information:

- `/#/planets` - The full list
- `/#/planets/4` - Earth's details

You can bookmark these URLs or refresh the page, and the application will restore to the same state — the resolves re-run and the data is re-fetched. This is one of the key benefits of state-based routing.

---

## Next Steps

Continue to [Hello Galaxy](./hellogalaxy) to learn about:

- **Nested states** with parent-child relationships
- **Nested ui-views** for complex layouts
- **Relative state references** for navigation within a state hierarchy
- **Resolve inheritance** between parent and child states
