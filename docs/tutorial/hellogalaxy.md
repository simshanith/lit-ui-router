---
title: Hello Galaxy
description: Learn about nested states and views
---

# Hello Galaxy

Building on [Hello Solar System](./hellosolarsystem), this tutorial introduces **nested states** and **nested ui-views**. We'll zoom out to the Milky Way and build a star catalog — ten real stars with spectral class, constellation, distance, and magnitude — in a master-detail layout where the list stays visible. And since we're out here anyway, a sibling state renders a 3D astronaut.

## Live Demo

<StackBlitzEmbed
src="https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellogalaxy?embed=1&file=src/main.ts&view=preview"
title="lit-ui-router-hellogalaxy"><a href="https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellogalaxy?file=src/main.ts" target="_blank"><img alt="Open in StackBlitz" src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" /></a></StackBlitzEmbed>

## What We're Building

A three-level state tree:

- `galaxy` — a parent shell with section navigation and its own nested `<ui-view>`
- `galaxy.stars` — a master-detail star list; the catalog loads via an async resolve
- `galaxy.stars.star` — a detail panel for the selected star, at `/:starId`, rendered in a second nested `<ui-view>`
- `galaxy.astronaut` — a sibling of `galaxy.stars` that renders the Smithsonian's 3D scan of Neil Armstrong's spacesuit with [`@google/model-viewer`](https://modelviewer.dev/)

---

## Nested States

### Parent-Child Relationships

In UI Router, states form parent-child relationships using dot notation:

```typescript
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
```

Key concepts:

1. **Dot notation**: `galaxy.stars.star` means "star is a child of stars, which is a child of galaxy"
2. **URL composition**: Each child's URL appends to its parent's URL
   - `galaxy`: `/galaxy`
   - `galaxy.stars`: `/stars` → `/galaxy/stars`
   - `galaxy.stars.star`: `/:starId` → `/galaxy/stars/:starId`
3. **`redirectTo`**: Visiting the bare parent state (`/galaxy`) forwards to a sensible default child
4. **Resolve inheritance**: Child states can access parent resolves via `deps` (more below)

### The Parent Shell

The `galaxy` state's component is a shell: section navigation plus a `<ui-view>` where its child states render.

```typescript
@customElement('galaxy-shell')
class GalaxyShellComponent extends LitElement {
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
      <ui-view></ui-view>
    `;
  }
}
```

Note that `uiSrefActive` matches by state _inclusion_: the Stars tab stays highlighted even when the deeper `galaxy.stars.star` state is active.

### Nested ui-view with Fallback Content

The `galaxy.stars` component splits into a list column and a detail panel. The detail panel is another `<ui-view>` — the grandchild state renders there. Content slotted inside the `<ui-view>` shows as a fallback until a child state activates:

```typescript
@customElement('stars-container')
class StarsContainerComponent extends LitElement {
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
```

The nested `<ui-view>`:

- Renders the child state's component (`StarDetailComponent`)
- Shows the slotted fallback ("Select a star from the list") when no child state is active
- Only child states of `galaxy.stars` will render here

Each list entry gets a glowing dot colored by the star's spectral class letter — O and B stars render blue, G stars like the Sun render yellow, M stars like Betelgeuse render orange-red:

```typescript
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
```

---

## Relative State References

### Using `.` for Relative Navigation

When navigating within a state hierarchy, use relative references:

```typescript
// From within the 'galaxy.stars' state:
${uiSref('.star', { starId: star.id })}

// This is equivalent to:
${uiSref('galaxy.stars.star', { starId: star.id })}
```

The `.` means "relative to the current state's context." This is useful because:

- It's shorter to write
- If you rename an ancestor state, child references still work
- It makes the relationship clearer

### Going Up the Hierarchy

You can also navigate up:

```typescript
// From 'galaxy.stars.star', go back to parent
${uiSref('^')}  // Goes to 'galaxy.stars'

// Or use absolute reference
${uiSref('galaxy.stars')}
```

---

## Resolve Inheritance

The star detail state doesn't re-fetch the catalog. Its resolve declares a dependency on the **parent state's** `stars` resolve, alongside `$transition$` for the route parameter:

```typescript
const starState: LitStateDeclaration = {
  name: 'galaxy.stars.star',
  url: '/:starId',
  component: StarDetailComponent,
  resolve: [
    {
      token: 'star',
      deps: ['$transition$', 'stars'], // 'stars' comes from the parent!
      resolveFn: ($transition$: Transition, stars: Star[]) => {
        const starId = $transition$.params().starId;
        return stars.find((s) => s.id === starId);
      },
    },
  ],
};
```

This is powerful because:

- The parent's data is already loaded
- No need to fetch the entire catalog again
- The child resolve can filter or transform parent data

Note the `:starId` parameter here is a string slug (`sirius`, `proxima-centauri`) rather than a number — no `parseInt` needed.

---

## A Sibling State: the Astronaut

Nested views aren't just for master-detail. `galaxy.astronaut` is a _sibling_ of `galaxy.stars`: activating it swaps the entire stars UI out of the shell's `<ui-view>` and renders a 3D model instead — the Smithsonian's high-resolution scan of Neil Armstrong's Apollo 11 spacesuit, displayed with the `<model-viewer>` web component:

```typescript
@customElement('astronaut-view')
class AstronautViewComponent extends LitElement {
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
```

Routed components and third-party web components compose naturally — `<model-viewer>` is just another custom element inside a Lit template.

Note the resolve: instead of a top-level `import '@google/model-viewer'`, the state's `resolveFn` dynamically imports the library. Resolves can await **code, not just data** — the `<model-viewer>` element is registered on state activation, and the bundler splits the (large) library into its own chunk that's only fetched when someone visits the astronaut.

---

## Router Setup

```typescript
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
```

## Full Source Code

The complete source — including the full ten-star catalog and the deep-space styling — is in [`examples/hellogalaxy/src/main.ts`](https://github.com/simshanith/lit-ui-router/blob/main/examples/hellogalaxy/src/main.ts), or browse it in the StackBlitz embed above.

---

## The State Tree

Here's how our states form a hierarchy:

<svg viewBox="0 0 720 400" width="100%" style="max-width: 720px" role="img" aria-label="Nested states render in nested ui-view viewports: galaxy renders in the root viewport, galaxy.stars in the shell's viewport, galaxy.stars.star in the list's viewport; galaxy.astronaut is a sibling that swaps into the shell's viewport. Each child URL appends to its parent's." xmlns="http://www.w3.org/2000/svg">
  <title>Nested states, nested viewports</title>
  <defs>
    <marker id="arr-nested" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0L8 4L0 8z" fill="var(--vp-c-text-3, #929295)" />
    </marker>
  </defs>
  <g font-family="var(--vp-font-family-base, ui-sans-serif, system-ui, sans-serif)">
    <!-- root viewport -->
    <rect x="12" y="20" width="564" height="344" rx="8" fill="none" stroke="var(--vp-c-brand-1, #3451b2)" stroke-dasharray="5 4" />
    <rect x="20" y="26" width="66" height="16" rx="5" fill="var(--vp-c-brand-soft, rgba(100,108,255,0.14))" />
    <text x="53" y="38" font-size="10" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-brand-1, #3451b2)" text-anchor="middle">&lt;ui-view&gt;</text>
    <text x="94" y="38" font-size="10" fill="var(--vp-c-text-3, #929295)">root viewport, in app-root</text>
    <!-- galaxy -->
    <rect x="24" y="50" width="540" height="302" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="36" y="70" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">galaxy</text>
    <text x="36" y="85" font-size="10" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-3, #929295)">galaxy-shell</text>
    <text x="552" y="70" font-size="11" font-weight="600" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-brand-1, #3451b2)" text-anchor="end">/galaxy</text>
    <rect x="36" y="94" width="516" height="24" rx="5" fill="var(--vp-c-bg, #ffffff)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="44" y="110" font-size="11" fill="var(--vp-c-text-2, #67676c)">nav: Stars &#183; Astronaut &#8212; uiSrefActive matches by inclusion</text>
    <!-- shell viewport -->
    <rect x="36" y="126" width="516" height="214" rx="8" fill="none" stroke="var(--vp-c-brand-1, #3451b2)" stroke-dasharray="5 4" />
    <rect x="44" y="132" width="66" height="16" rx="5" fill="var(--vp-c-brand-soft, rgba(100,108,255,0.14))" />
    <text x="77" y="144" font-size="10" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-brand-1, #3451b2)" text-anchor="middle">&lt;ui-view&gt;</text>
    <text x="118" y="144" font-size="10" fill="var(--vp-c-text-3, #929295)">children of galaxy render here</text>
    <!-- galaxy.stars -->
    <rect x="48" y="154" width="428" height="174" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="60" y="174" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">galaxy.stars</text>
    <text x="60" y="189" font-size="10" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-3, #929295)">stars-container</text>
    <text x="464" y="174" font-size="11" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" text-anchor="end"><tspan fill="var(--vp-c-text-3, #929295)">/galaxy</tspan><tspan font-weight="600" fill="var(--vp-c-brand-1, #3451b2)"> + /stars</tspan></text>
    <!-- list column -->
    <rect x="60" y="196" width="120" height="118" rx="5" fill="var(--vp-c-bg, #ffffff)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="70" y="213" font-size="10" font-weight="600" fill="var(--vp-c-text-2, #67676c)">star list</text>
    <text x="70" y="230" font-size="10" fill="var(--vp-c-text-2, #67676c)">Sirius</text>
    <text x="70" y="245" font-size="10" fill="var(--vp-c-text-2, #67676c)">Vega</text>
    <text x="70" y="260" font-size="10" fill="var(--vp-c-text-2, #67676c)">&#8230;</text>
    <text x="70" y="284" font-size="9" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-3, #929295)">uiSref('.star')</text>
    <text x="70" y="298" font-size="9" fill="var(--vp-c-text-3, #929295)">relative sref</text>
    <!-- stars viewport -->
    <rect x="192" y="196" width="272" height="118" rx="8" fill="none" stroke="var(--vp-c-brand-1, #3451b2)" stroke-dasharray="5 4" />
    <rect x="200" y="202" width="66" height="16" rx="5" fill="var(--vp-c-brand-soft, rgba(100,108,255,0.14))" />
    <text x="233" y="214" font-size="10" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-brand-1, #3451b2)" text-anchor="middle">&lt;ui-view&gt;</text>
    <text x="274" y="214" font-size="10" fill="var(--vp-c-text-3, #929295)">slotted fallback until a child activates</text>
    <!-- galaxy.stars.star -->
    <rect x="204" y="224" width="248" height="80" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="216" y="244" font-size="12" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">galaxy.stars.star</text>
    <text x="216" y="258" font-size="10" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-3, #929295)">star-detail</text>
    <text x="440" y="244" font-size="11" font-weight="600" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-brand-1, #3451b2)" text-anchor="end">+ /:starId</text>
    <text x="216" y="280" font-size="10" fill="var(--vp-c-text-2, #67676c)">its star resolve reads :starId and the</text>
    <text x="216" y="294" font-size="10" fill="var(--vp-c-text-2, #67676c)">parent's stars resolve &#8212; inherited</text>
    <!-- astronaut sibling -->
    <rect x="584" y="126" width="128" height="110" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="594" y="146" font-size="11" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">galaxy.astronaut</text>
    <text x="594" y="160" font-size="10" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-3, #929295)">astronaut-view</text>
    <text x="594" y="178" font-size="11" font-weight="600" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-brand-1, #3451b2)">+ /astronaut</text>
    <text x="594" y="198" font-size="10" fill="var(--vp-c-text-2, #67676c)">a sibling of</text>
    <text x="594" y="212" font-size="10" fill="var(--vp-c-text-2, #67676c)">galaxy.stars</text>
    <line x1="584" y1="226" x2="481" y2="247" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" stroke-dasharray="4 3" marker-end="url(#arr-nested)" />
    <text x="586" y="256" font-size="10" fill="var(--vp-c-text-3, #929295)">siblings swap in the</text>
    <text x="586" y="269" font-size="10" fill="var(--vp-c-text-3, #929295)">same nested viewport</text>
    <!-- URL composition -->
    <text x="24" y="388" font-size="12" font-family="var(--vp-font-family-mono, ui-monospace, monospace)"><tspan fill="var(--vp-c-text-2, #67676c)">URLs compose:  </tspan><tspan fill="var(--vp-c-brand-1, #3451b2)">/galaxy</tspan><tspan fill="var(--vp-c-text-3, #929295)"> + </tspan><tspan fill="var(--vp-c-brand-1, #3451b2)">/stars</tspan><tspan fill="var(--vp-c-text-3, #929295)"> + </tspan><tspan fill="var(--vp-c-brand-1, #3451b2)">/:starId</tspan><tspan fill="var(--vp-c-text-3, #929295)"> &#8594; </tspan><tspan font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">/galaxy/stars/:starId</tspan></text>
  </g>
</svg>

When navigating to `/galaxy/stars/sirius`:

1. `galaxy` state is activated (if not already active)
2. `GalaxyShellComponent` renders in the root `<ui-view>`
3. `galaxy.stars` state is activated; its `stars` resolve fetches the catalog
4. `StarsContainerComponent` renders in the shell's nested `<ui-view>`
5. `galaxy.stars.star` state is activated; its `star` resolve finds Sirius in the inherited catalog
6. `StarDetailComponent` renders in the nested `<ui-view>` inside `StarsContainerComponent`

---

## Summary

You've now learned the core concepts of lit-ui-router:

| Tutorial           | Concepts                                                                               |
| ------------------ | -------------------------------------------------------------------------------------- |
| Hello World        | States, components, navigation with `uiSref`, basic routing                            |
| Hello Solar System | Resolves for data fetching, state parameters, accessing route data                     |
| Hello Galaxy       | Nested states, nested ui-views, `redirectTo`, relative references, resolve inheritance |

## What's Next?

Explore the <a href="/app" target="_self">Sample App</a> to see a more complete example with:

- Authentication and protected routes
- Lazy-loaded states
- Sticky states and deep state redirect
- Complex view targeting
- And more!
