import { html, LitElement, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { render } from 'lit';
import { hashLocationPlugin } from '@uirouter/core';
import {
  Context,
  Data,
  Duration,
  Effect,
  Layer,
  ManagedRuntime,
  Schedule,
  SubscriptionRef,
} from 'effect';
import {
  UIRouterLit,
  uiSref,
  uiSrefActive,
  UIViewInjectedProps,
} from 'lit-ui-router';

import {
  CurrentTransition,
  EffectPlugin,
  EffectStateDeclaration,
  effectPlugin,
  provide,
} from './effect-plugin.js';
import { RouterRefController } from './router-ref-controller.js';

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

const MODEL_URL =
  'https://modelviewer.dev/shared-assets/models/NeilArmstrong.glb';

// Application services — these live as long as the app, so they go in the
// runtime's Layer. Route-lifetime services go in a resolve instead (below).
interface StarsApiService {
  readonly fetchAll: Effect.Effect<readonly Star[]>;
}
class StarsApi extends Context.Tag('StarsApi')<StarsApi, StarsApiService>() {}

const StarsApiLive = Layer.succeed(StarsApi, {
  // Simulated async fetch; resolves must settle before the state activates
  fetchAll: Effect.succeed(stars).pipe(Effect.delay('300 millis')),
});

const AppLayer = Layer.mergeAll(StarsApiLive);
type AppServices = Layer.Layer.Success<typeof AppLayer>;

// A typed failure, so an unknown :starId is a value the caller must handle
// rather than an exception nobody declared.
class StarNotFound extends Data.TaggedError('StarNotFound')<{
  starId: string;
}> {}

class ModelDownloadFailed extends Data.TaggedError('ModelDownloadFailed')<{
  cause: unknown;
}> {}

// The route-lifetime service: published by galaxy.stars' resolve, consumed by
// galaxy.stars.star's resolve with no `deps` array in between.
interface StarCatalogService {
  readonly all: readonly Star[];
  readonly find: (id: string) => Effect.Effect<Star, StarNotFound>;
}
class StarCatalog extends Context.Tag('StarCatalog')<
  StarCatalog,
  StarCatalogService
>() {}

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
      flex-wrap: wrap;
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
    /* Tighter panel, larger tap targets on touch-sized screens */
    @media (max-width: 480px) {
      nav a {
        padding: 10px 16px;
      }
      .panel {
        padding: 14px;
      }
    }
    @media (max-width: 640px) {
      /* Inflate link tap targets to ~44px without shifting layout */
      .backdrop-credit a {
        display: inline-block;
        padding: 15px 4px;
        margin: -15px -4px;
      }
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
    /* Stack the list above the detail pane on narrow screens */
    @media (max-width: 640px) {
      .container {
        flex-direction: column;
        gap: 16px;
      }
      .list {
        flex: none;
      }
      .list a {
        padding: 10px 12px;
      }
      .detail {
        padding: 16px;
        min-height: 200px;
      }
    }
  `;

  /** @public — router-assigned; the `_` prefix is convention, not privacy. */
  @property({ attribute: false })
  _uiViewProps!: UIViewInjectedProps<{ StarCatalog: StarCatalogService }>;

  constructor(props: UIViewInjectedProps<{ StarCatalog: StarCatalogService }>) {
    super();
    this._uiViewProps = props;
  }

  // The service resolve lands in `resolves` under the tag's key, so a view
  // reads it exactly like any other resolve.
  get stars(): readonly Star[] {
    return this._uiViewProps.resolves.StarCatalog.all;
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
    .observing {
      color: #7aa2ff;
      font-size: 0.8rem;
      margin: 16px 0 0;
      font-variant-numeric: tabular-nums;
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
  _uiViewProps!: UIViewInjectedProps<{ star: Star }>;

  constructor(props: UIViewInjectedProps<{ star: Star }>) {
    super();
    this._uiViewProps = props;
  }

  // Written by the ticker forked into this state's scope, not by a resolve:
  // it keeps changing after the transition is over.
  private readonly observing = new RouterRefController<string, string>(
    this,
    (line) => line,
    { ref: () => observingRef },
  );

  get star(): Star {
    return this._uiViewProps.resolves.star;
  }

  firstUpdated() {
    // The stacked (narrow) layout renders this detail below the star list
    if (window.matchMedia('(max-width: 640px)').matches) {
      this.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  render() {
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
      <p class="observing">${this.observing.value}</p>
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
         Webb's Cosmic Cliffs directly inside the viewer instead */
      background: url('https://science.nasa.gov/wp-content/uploads/2023/09/web-first-images-release.png')
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
    @media (max-width: 640px) {
      model-viewer {
        height: 320px;
      }
      /* Inflate link tap targets to ~44px without shifting layout */
      .attribution a {
        display: inline-block;
        padding: 15px 4px;
        margin: -15px -4px;
      }
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
      <!-- touch-action="pan-y" keeps one-finger vertical swipes scrolling the page -->
      <model-viewer
        src="${MODEL_URL}"
        alt="Neil Armstrong's Apollo 11 spacesuit, 3D scan"
        camera-controls
        auto-rotate
        ar
        touch-action="pan-y"
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
      <p class="attribution">
        Viewer backdrop:
        <a
          href="https://science.nasa.gov/image-detail/web-first-images-release/"
          target="_blank"
          rel="noopener"
          >&ldquo;Cosmic Cliffs&rdquo; in the Carina Nebula</a
        >, James Webb Space Telescope &mdash; NASA, ESA, CSA, and STScI.
      </p>
    `;
  }
}

// The demo's proof: every scope open/close, resolve start/finish/interrupt and
// hook redirect, in the order the fibers ran them.
@customElement('fiber-log')
export class FiberLogComponent extends LitElement {
  static styles = css`
    section {
      margin: 24px 0 0;
      background: rgba(9, 12, 20, 0.72);
      border: 1px solid rgba(61, 90, 128, 0.5);
      border-radius: 12px;
      padding: 12px 16px;
    }
    h3 {
      margin: 0 0 8px;
      color: #9db2ce;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 190px;
      overflow-y: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.75rem;
      line-height: 1.7;
      color: #c9d6ea;
    }
    li:last-child {
      color: #fff;
    }
  `;

  private readonly lines = new RouterRefController<
    readonly string[],
    readonly string[]
  >(this, (value) => value, { ref: (plugin) => plugin.log });

  updated() {
    const list = this.renderRoot.querySelector('ol');
    if (list) list.scrollTop = list.scrollHeight;
  }

  render() {
    return html`
      <section>
        <h3>Fibers</h3>
        <ol>
          ${(this.lines.value ?? []).map((line) => html`<li>${line}</li>`)}
        </ol>
      </section>
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
      margin: 0 0 8px;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
    }
    .here {
      display: inline-block;
      margin: 0 0 24px;
      padding: 4px 12px;
      border-radius: 999px;
      border: 1px solid #3d5a80;
      background: rgba(9, 12, 20, 0.6);
      color: #8fa1bb;
      font-size: 0.8rem;
    }
    .here.on-stars {
      color: #0b1020;
      background: #7aa2ff;
      border-color: #7aa2ff;
      font-weight: 600;
    }
  `;

  // <app-root> is not routed, so it never gets fresh view props and cannot use
  // uiSrefActive's includes. The controller answers "am I under galaxy.stars"
  // from the plugin's route ref, which keeps the marker lit on the detail
  // state the same way the shell's nav stays lit.
  private readonly onStars = new RouterRefController(
    this,
    (route) => route.current?.name?.startsWith('galaxy.stars') ?? false,
  );

  render() {
    return html`
      <h1>Hello Galaxy (Effect)</h1>
      <p class="tagline">
        Nested states, nested views &mdash; a tour of the Milky Way, on fibers
      </p>
      <p class="here ${this.onStars.value ? 'on-stars' : ''}">
        ${this.onStars.value ? 'Under galaxy.stars' : 'Elsewhere in the galaxy'}
      </p>
      <!-- Root view: the galaxy shell state renders here -->
      <ui-view></ui-view>
      <fiber-log></fiber-log>
    `;
  }
}

// Router setup — the plugin has to exist before states are registered, since
// it installs the resolve policy through a `resolvables` state-builder
// decorator, which only sees states registered after it.
const router = new UIRouterLit();
router.plugin(hashLocationPlugin);
void import('@uirouter/visualizer').then(({ Visualizer }) =>
  router.plugin(Visualizer),
);

const runtime = ManagedRuntime.make(AppLayer);
const effect = router.plugin<EffectPlugin<AppServices>>(effectPlugin(runtime));
const say = (line: string) => effect.append(line);

// Written by the star state's scoped ticker, read by <star-detail>.
const observingRef = runtime.runSync(SubscriptionRef.make(''));

// State definitions
// Parent shell state; owns the section nav and a nested <ui-view>
const galaxyState: EffectStateDeclaration<
  Record<string, unknown>,
  AppServices
> = {
  name: 'galaxy',
  url: '/galaxy',
  component: GalaxyShellComponent,
  // Visiting the bare parent forwards to the star list
  redirectTo: 'galaxy.stars',
  // Opened when galaxy is entered, released when it is exited — and nothing
  // in between, however many stars the visitor walks through.
  scoped: () =>
    Effect.acquireRelease(say('observatory session opened'), () =>
      say('observatory session closed'),
    ),
};

// Child state (nested via dot notation) renders inside galaxy's <ui-view>
const starsState: EffectStateDeclaration<
  { StarCatalog: StarCatalogService },
  AppServices
> = {
  name: 'galaxy.stars',
  url: '/stars',
  component: StarsContainerComponent,
  // `provide` publishes a service to this state and its descendants; the token
  // is the tag's key, so views still find it in `resolves`.
  resolve: [
    provide(
      StarCatalog,
      Effect.gen(function* () {
        yield* say('catalog: loading');
        const api = yield* StarsApi;
        const all = yield* api.fetchAll;
        yield* say(`catalog: ${all.length} stars ready`);
        return {
          all,
          find: (id: string) => {
            const star = all.find((s) => s.id === id);
            return star
              ? Effect.succeed(star)
              : Effect.fail(new StarNotFound({ starId: id }));
          },
        };
      }).pipe(Effect.onInterrupt(() => say('catalog: interrupted'))),
    ),
  ],
};

// Grandchild state with a URL param, rendered inside galaxy.stars's <ui-view>
const starState: EffectStateDeclaration<{ star: Star }, AppServices> = {
  name: 'galaxy.stars.star',
  url: '/:starId',
  component: StarDetailComponent,
  resolve: [
    {
      token: 'star',
      // Typed resolve inheritance: no `deps` array. The parent's service and
      // the running transition arrive as Effect requirements.
      resolveFn: () =>
        Effect.gen(function* () {
          const transition = yield* CurrentTransition;
          const catalog = yield* StarCatalog;
          const { starId } = transition.params<{ starId: string }>();
          return yield* catalog.find(starId);
        }),
    },
  ],
  // A ticker that lives exactly as long as this state: star-to-star navigation
  // closes and reopens it while the observatory session above survives.
  scoped: (params) => {
    const starId = String(params.starId);
    let seconds = 0;
    return Effect.gen(function* () {
      yield* say(`star scope opened: ${starId}`);
      yield* Effect.repeat(
        Effect.suspend(() =>
          SubscriptionRef.set(
            observingRef,
            `observing ${starId} for ${++seconds}s`,
          ),
        ),
        Schedule.spaced(Duration.seconds(1)),
      );
    }).pipe(
      Effect.ensuring(
        say(`star scope closed: ${starId}`).pipe(
          Effect.zipRight(SubscriptionRef.set(observingRef, '')),
        ),
      ),
    );
  },
};

// Sibling of galaxy.stars; swaps into the same nested <ui-view>
const astronautState: EffectStateDeclaration<
  Record<string, unknown>,
  AppServices
> = {
  name: 'galaxy.astronaut',
  url: '/astronaut',
  component: AstronautViewComponent,
  resolve: [
    {
      // Resolves can await code, not just data: model-viewer loads on state
      // activation, and the bundler splits it into its own chunk. As an
      // Effect it is also interruptible — click Astronaut then Stars during
      // the deliberate 1.5s pause and watch the fiber die mid-download.
      token: 'modelViewer',
      resolveFn: () =>
        Effect.gen(function* () {
          yield* say('astronaut: fiber started');
          yield* Effect.sleep(Duration.millis(1500));
          const module = yield* Effect.promise(
            () => import('@google/model-viewer'),
          );
          yield* Effect.tryPromise({
            // The signal is wired to interruption, so aborting the fiber
            // aborts the request.
            try: (signal) => fetch(MODEL_URL, { signal }),
            catch: (cause) => new ModelDownloadFailed({ cause }),
          }).pipe(
            Effect.timeout(Duration.seconds(8)),
            Effect.retry(Schedule.recurs(2)),
          );
          yield* say('astronaut: model downloaded');
          return module;
        }).pipe(Effect.onInterrupt(() => say('astronaut: fiber interrupted'))),
    },
  ],
};

// The typed error path, once: a bad :starId is caught before any resolve runs
// and turned into a redirect rather than a failed transition.
effect.onBefore({ to: 'galaxy.stars.star' }, (transition) =>
  Effect.gen(function* () {
    const api = yield* StarsApi;
    const all = yield* api.fetchAll;
    const { starId } = transition.params<{ starId: string }>();
    if (all.some((s) => s.id === starId)) return undefined;
    return yield* Effect.fail(new StarNotFound({ starId }));
  }).pipe(
    Effect.catchTag('StarNotFound', (error) =>
      say(`unknown star "${error.starId}" — redirecting to the list`).pipe(
        Effect.as(router.stateService.target('galaxy.stars')),
      ),
    ),
  ),
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
