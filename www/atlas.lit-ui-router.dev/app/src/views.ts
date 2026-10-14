/**
 * The views. Everything renders into the LIGHT DOM so the generated
 * `sheets/atlas.css` — the drawing set's own chrome, lifted verbatim out of
 * www/atlas.lit-ui-router.dev/generator/chrome.mjs — styles the plates.
 */
import type { UIRouter } from '@uirouter/core';
import type { SubscriptionRef } from 'effect';
import { LitElement, ReactiveElement, html, noChange, nothing, svg } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';
import { ref } from 'lit/directives/ref.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { srefActiveClass, srefAriaCurrent, srefHref } from 'lit-ui-router/pure';
import type { RoutedLitTemplate, UIRouterLit } from 'lit-ui-router';
import { uiViewSlot } from 'lit-ui-router-ssr/client';
import { RefController } from 'lit-ui-router-effect';
import { routeRef } from 'ui-router-effect';
import type { RouteSnapshot } from 'ui-router-effect';
import type {
  AscentRow,
  Band,
  ExtraRow,
  Filter,
  IssueEntry,
  LabelKey,
  Manifest,
  SheetLabels,
  SheetRow,
  Thumb,
} from './manifest.ts';
import {
  ARTICLE,
  BASIS_SUBJECT,
  CARD,
  EMPTY_FILTER,
  LABEL_KEYS,
  ascent,
  bands,
  entryTitle,
  facet,
  findExtra,
  isAppendix,
  isFiltered,
  kvVocabulary,
  labelledRows,
  matchesFilter,
  readFilter,
  sceneState,
  thumbSrc,
  without,
} from './manifest.ts';
import { loadCytoscape, runScripts } from './fragment.ts';
import type { FocusDetail } from './fragment.ts';
import { ICON_SPRITE, iconId } from './generated/icons.js';
import { FLAME_URL, GLOW_DARK_URL, GLOW_URL, LOGO_URL, UIROUTER_URL } from './generated/brand.js';
import { initCity } from './generated/city-init.js';
import type { CityScene } from './generated/city-init.js';
import { initBricks } from './generated/bricks-init.js';
import { initBuilds } from './generated/builds-init.js';
import type { BuildsScene } from './generated/builds-init.js';
import { ARTIFACT } from './mode.ts';
import { readPref, setTrace, setVisualizer } from './prefs.ts';
import type { PrefName, PrefState } from './prefs.ts';
import { href } from './routes.ts';
import { runtime } from './runtime.ts';
import type { ThemeChoice } from './theme.ts';
import { applyTheme, readTheme } from './theme.ts';

/**
 * The rail's and the cards' active class. `srefActiveClass` writes no
 * `aria-current` — a `class` binding cannot reach a second attribute — so every
 * link that takes it takes `srefAriaCurrent` beside it, which is the behaviour
 * `uiSrefActive` used to supply implicitly on an anchor.
 */
const ACTIVE_CLASSES = ['is-active'];

/**
 * THE ARTICLE (T9, shipped 2026-09-06): a title keeps its THE, drawn as a
 * lowercase superior in the data face (`sup.art`, styled in the generated
 * sheets/atlas.css so the app and the artifact draw it alike).
 * Twins: `articleTitle` in generator/chrome.mjs and in prerender.ts.
 */
const THE: TemplateResult = html`<sup class="art">the&nbsp;</sup>`;

/**
 * THE WORDMARK — the atlas's one name for itself, plain uppercase THE ALTITUDE
 * ATLAS in the display face. The rail head and the cover title carry it as
 * text; the ledger sites — the sheet-head PROJECT line and the plates' title
 * blocks — wrap it in `.project-mark` (styled in sheets/atlas.css, so the face
 * travels with the mark, not with the site) and only the size differs.
 * Twin: `PROJECT_MARK` in generator/chrome.mjs and in prerender.ts.
 */
const PROJECT_MARK: TemplateResult = html`<span class="project-mark">THE ALTITUDE ATLAS</span>`;

const articleTitle = (title: string): TemplateResult =>
  ARTICLE.test(title) ? html`${THE}${entryTitle(title)}` : html`${title}`;

/** The live site — where every page the artifact does not route lives. */
const SITE = 'https://atlas.lit-ui-router.dev';
const DOCS = 'https://lit-ui-router.dev';
const GITHUB = 'https://github.com/simshanith/lit-ui-router';
// the homes the colophon names: packages at npmx.dev, the atlas's files on its branch, each tool's own site
const BRANCH = `${GITHUB}/blob/www/atlas/`;
const npmUrl = (name: string) => `https://npmx.dev/package/${name}`;
const HOME = {
  npm: 'https://npmx.dev/',
  modelViewer: 'https://modelviewer.dev/',
  three: 'https://threejs.org/',
  navigation: 'https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API',
  vite: 'https://vite.dev/',
  redirects: 'https://developers.cloudflare.com/pages/configuration/redirects/',
  lucide: 'https://lucide.dev/',
};
const ext = (href: string, inner: unknown) => html`<a href=${href} target="_blank" rel="noopener">${inner}</a>`;
const pkg = (name: string) => ext(npmUrl(name), html`<code>${name}</code>`);

/**
 * An in-app path for the ONE site that is not a router link: the key box's
 * `<form action>`, a plain GET target that takes no directive. Every real link
 * asks the router through `srefHref`, so the artifact build's `#/…` comes from
 * `hashLocationPlugin` (src/router.ts) and not from a string prefix here.
 */
const to = (path: string): string => (ARTIFACT ? `#${path}` : path);

/** A link out to a bare plate: relative on the site, absolute in the artifact. */
const out = (path: string): string => (ARTIFACT ? `${SITE}${path}` : path);

/** Artifact-only: a page on the live site is a different document, so open a new tab. */
const outTarget = ARTIFACT ? '_blank' : nothing;

/**
 * A link to a page the artifact does not route — a sheet, a plate in the
 * round, the issue log. On the site it is the router's link, active class and
 * `aria-current`; the artifact routes only the gallery and the colophon
 * (src/router.ts), so there it is the live site's page and neither mark.
 */
const goHref = (state: string, params?: { num: string }): ReturnType<typeof srefHref> | string =>
  ARTIFACT
    ? `${SITE}${state === 'atlas.sheet' ? href.sheet(params?.num ?? '') : `${href.gallery}${state.slice('atlas.'.length)}`}/`
    : srefHref(state, params);
const goClass = (options: Parameters<typeof srefActiveClass>[0]): ReturnType<typeof srefActiveClass> | string =>
  ARTIFACT ? '' : srefActiveClass(options);
const goCurrent = (options: Parameters<typeof srefAriaCurrent>[0]): ReturnType<typeof srefAriaCurrent> | typeof nothing =>
  ARTIFACT ? nothing : srefAriaCurrent(options);

// --- <atlas-plate> — a generated fragment, inserted and brought to life ----

// The view template writes the fragment as the element's children, so the
// element renders nothing of its own: it runs the fragment's scripts. `pin` is
// the url's `focus`; generator/focus.mjs holds the contract the scripts read it by.
export class AtlasPlate extends ReactiveElement {
  static override properties = {
    fragment: { attribute: false },
    needsCytoscape: { attribute: false },
    pin: { attribute: false },
  };

  declare fragment: string;
  declare needsCytoscape: boolean;
  declare pin: string | null;
  #seq = 0;

  constructor() {
    super();
    this.fragment = '';
    this.needsCytoscape = false;
    this.pin = null;
  }

  // Light DOM: the plates' scripts find their JSON islands with
  // document.getElementById, and atlas.css is a plain stylesheet.
  override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // scroll does not bubble; capture it from the plate's own wrap
    this.addEventListener('scroll', this.#markEnd, true);
  }

  override disconnectedCallback(): void {
    this.removeEventListener('scroll', this.#markEnd, true);
    super.disconnectedCallback();
  }

  // The scrolled plate marks its end so the SCROLL → fade clears the drawing's
  // right edge — the rule chrome.mjs writes.
  #markEnd = (event: Event): void => {
    const wrap = event.target;
    if (!(wrap instanceof HTMLElement) || !wrap.classList.contains('figure-wrap')) return;
    wrap.parentElement?.toggleAttribute(
      'data-end',
      wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 1,
    );
  };

  override updated(changed: Map<PropertyKey, unknown>): void {
    if (!changed.has('fragment')) {
      if (changed.has('pin')) {
        const detail: FocusDetail = { focus: this.pin };
        this.dispatchEvent(new CustomEvent('atlas-focus-set', { detail }));
      }
      return;
    }
    if (!this.fragment) return;
    const seq = (this.#seq += 1);
    const boot = (): void => {
      if (seq !== this.#seq) return;
      // always set, so a plate never falls back to the address bar (the artifact routes by hash)
      this.dataset.focus = this.pin ?? '';
      runScripts(this);
    };
    if (this.needsCytoscape) void loadCytoscape().then(boot);
    else boot();
  }
}
customElements.define('atlas-plate', AtlasPlate);

// --- <atlas-city> — the 3D plate, and the layer that tears it down --------

// The 3D plates read their own `focus`: every other state reads none.
const SCENE_STATES: ReadonlySet<string | undefined> = new Set([
  'atlas.city',
  'atlas.plant',
  'atlas.bricks',
]);
const cityPin = (route: RouteSnapshot): string | null =>
  SCENE_STATES.has(route.current?.name) && typeof route.params.focus === 'string'
    ? route.params.focus
    : null;

/**
 * The city in the round: a generated fragment around a <model-viewer>, wired by
 * a generated module.
 *
 * WHY THE ELEMENT OWNS THE TEARDOWN. The wiring holds a MutationObserver on
 * <html>, a colour-scheme media listener, listeners and pending animation
 * frames, and a window hook — none of which the DOM reclaims when the routed
 * view is swapped. A router hook could dispose them, but the experimental layer
 * is deletable by design and this is not optional; the element that CREATED the
 * wiring is the one thing whose lifetime already matches it, so
 * `disconnectedCallback` is the hook. `updated` waits on the plate's own
 * `updateComplete` for "the fragment is in the DOM" — the same promise
 * `experimental/view-rendered.ts` chains, owned locally so `src/*.ts` stays
 * free of that directory. The pin is the url's `focus`, read by a
 * `RefController` over the router's one `routeRef` on the page's runtime and
 * handed to the scene on boot and on every change after it. Each plate names
 * its pin, wires its scene and hands the pin on in its own subclass.
 */
export abstract class AtlasScene<S extends { dispose(): void }> extends ReactiveElement {
  static override properties = {
    fragment: { attribute: false },
    lib: { attribute: false },
    router: { attribute: false },
  };

  declare fragment: string;
  /** The plate's library, resolved on entry: the <model-viewer> module. */
  declare lib: unknown;
  declare router: UIRouter | undefined;
  #scene: S | null = null;
  #seq = 0;
  #pin: RefController<[SubscriptionRef.SubscriptionRef<RouteSnapshot>], string | null> | undefined;

  constructor() {
    super();
    this.fragment = '';
    this.lib = undefined;
    this.router = undefined;
  }

  override willUpdate(): void {
    // Served, the city upgrades before hydration hands <ui-router> the app's router, and never reconnects.
    if (!this.router || this.#pin) return;
    this.#pin = new RefController(this, [routeRef(this.router)], (route) => this.pinOf(route), {
      runtime,
      onChange: () => this.#select(),
    });
  }

  override createRenderRoot(): HTMLElement {
    return this;
  }

  override updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('fragment') || changed.has('lib')) void this.#boot();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#teardown();
  }

  async #boot(): Promise<void> {
    const seq = (this.#seq += 1);
    const plate = this.querySelector('atlas-plate');
    if (!plate || !this.fragment || !this.lib) return;
    await plate.updateComplete; // the fragment (and its JSON island) is in the DOM
    if (seq !== this.#seq || !this.isConnected) return;
    this.#teardown();
    const scene = await this.raise(this.#pin?.value ?? null);
    // undefined = nothing was wired (no plate); a superseded boot disposes at once
    if (seq !== this.#seq || !this.isConnected) {
      scene?.dispose();
      return;
    }
    this.#scene = scene ?? null;
    this.#select(); // the url may have moved while the scene was raised
  }

  /** The plate's pin as the route carries it; null off the plate's state. */
  protected abstract pinOf(route: RouteSnapshot): string | null;

  /** Wires the plate over the adopted fragment, opening on `pin`. */
  protected abstract raise(pin: string | null): Promise<S | undefined>;

  /** Hands a later pin to the wired scene. */
  protected abstract apply(scene: S, pin: string | null): void;

  #select(): void {
    if (this.#scene) this.apply(this.#scene, this.#pin?.value ?? null);
  }

  #teardown(): void {
    this.#scene?.dispose();
    this.#scene = null;
  }
}

/** The city and its working twin: the pin is a member's number. */
export class AtlasCity extends AtlasScene<CityScene> {
  protected pinOf(route: RouteSnapshot): string | null {
    return cityPin(route);
  }

  protected raise(focus: string | null): Promise<CityScene | undefined> {
    return initCity(this, this.lib, focus);
  }

  protected apply(scene: CityScene, pin: string | null): void {
    scene.select(pin === null ? null : Number(pin));
  }
}
customElements.define('atlas-city', AtlasCity);

/** Sheet 2's model in the round: the same seam, wiring its own <model-viewer>. */
export class AtlasBricks extends AtlasCity {
  protected override raise(focus: string | null): Promise<CityScene | undefined> {
    return initBricks(this, this.lib, focus);
  }
}
customElements.define('atlas-bricks', AtlasBricks);

const textParam = (value: unknown): string | null => (typeof value === 'string' ? value : null);
/** The builds' pin: the build and the focus, one string so the ref's equality holds. */
const buildsPin = (route: RouteSnapshot): string | null =>
  route.current?.name === 'atlas.builds'
    ? JSON.stringify([textParam(route.params.build), textParam(route.params.focus)])
    : null;
const buildsPair = (pin: string | null): [string | null, string | null] =>
  pin === null ? [null, null] : (JSON.parse(pin) as [string | null, string | null]);

/** Sheet 2C's builds in the round: the pin is the picked build and its part. */
export class AtlasBuilds extends AtlasScene<BuildsScene> {
  protected pinOf(route: RouteSnapshot): string | null {
    return buildsPin(route);
  }

  protected raise(pin: string | null): Promise<BuildsScene | undefined> {
    return initBuilds(this, this.lib, ...buildsPair(pin));
  }

  protected apply(scene: BuildsScene, pin: string | null): void {
    scene.select(...buildsPair(pin));
  }
}
customElements.define('atlas-builds', AtlasBuilds);

// --- <atlas-themer> — the sheets' three-state theme control ----------------

export class AtlasThemer extends LitElement {
  static override properties = { choice: { state: true } };

  declare choice: ThemeChoice;

  constructor() {
    super();
    this.choice = readTheme();
  }

  override createRenderRoot(): HTMLElement {
    return this;
  }

  #pick(choice: ThemeChoice): void {
    this.choice = choice;
    applyTheme(choice);
  }

  override render(): TemplateResult {
    const button = (value: ThemeChoice, label: string): TemplateResult => html`
      <button
        type="button"
        aria-pressed=${this.choice === value ? 'true' : 'false'}
        @click=${() => this.#pick(value)}
      >
        ${label}
      </button>
    `;
    return html`
      <div class="themer" role="group" aria-label="colour scheme">
        ${button('auto', 'AUTO')}${button('light', 'VELLUM')}${button('dark', 'CYANO')}
      </div>
    `;
  }
}
customElements.define('atlas-themer', AtlasThemer);

// --- <atlas-copy-link> — the page's own url, pin and all, onto the clipboard -

// The router writes the href, so the artifact build copies its `#/…` url.
export class AtlasCopyLink extends LitElement {
  static override properties = { router: { attribute: false }, copied: { state: true } };

  declare router: UIRouter | undefined;
  declare copied: boolean;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.router = undefined;
    this.copied = false;
  }

  override createRenderRoot(): HTMLElement {
    return this;
  }

  override disconnectedCallback(): void {
    clearTimeout(this.#timer);
    super.disconnectedCallback();
  }

  async #copy(): Promise<void> {
    const router = this.router;
    if (!router) return;
    const url = router.stateService.href('.', router.globals.params, { absolute: true });
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // no clipboard, or no permission for it: select the url and copy the selection
      const input = this.querySelector('input');
      if (!input) return;
      input.value = url;
      input.select();
      // oxlint-disable-next-line typescript/no-deprecated
      const copied = document.execCommand('copy');
      this.querySelector('button')?.focus();
      if (!copied) return;
    }
    this.copied = true;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.copied = false;
    }, 1500);
  }

  override render(): TemplateResult {
    return html`
      <button type="button" class="util-copy" @click=${() => void this.#copy()}>
        <span aria-live="polite">${this.copied ? 'COPIED' : 'COPY LINK'}</span>
      </button>
      <input class="util-copy-src" type="text" readonly tabindex="-1" aria-hidden="true" />
    `;
  }
}
customElements.define('atlas-copy-link', AtlasCopyLink);

// --- <atlas-prefs> — the two live switches, in a panel off the utility bar --

export class AtlasPrefs extends LitElement {
  static override properties = {
    open: { state: true },
    visualizer: { state: true },
    trace: { state: true },
  };

  declare open: boolean;
  declare visualizer: PrefState;
  declare trace: PrefState;

  constructor() {
    super();
    this.open = false;
    this.visualizer = readPref('visualizer');
    this.trace = readPref('trace');
  }

  override createRenderRoot(): HTMLElement {
    return this;
  }

  #onPointerDown = (event: Event): void => {
    if (!this.contains(event.target as Node)) this.open = false;
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    this.open = false;
    this.querySelector<HTMLButtonElement>('.prefs-toggle')?.focus();
  };

  #listen(on: boolean): void {
    const method = on ? 'addEventListener' : 'removeEventListener';
    document[method]('pointerdown', this.#onPointerDown);
    document[method]('keydown', this.#onKeyDown as EventListener);
  }

  override updated(changed: PropertyValues<this>): void {
    if (changed.has('open')) this.#listen(this.open);
  }

  override disconnectedCallback(): void {
    this.#listen(false);
    super.disconnectedCallback();
  }

  #flip(name: PrefName, on: boolean): void {
    if (name === 'visualizer') {
      this.visualizer = { on, forced: false };
      void setVisualizer(on);
    } else {
      this.trace = { on, forced: false };
      setTrace(on);
    }
  }

  #row(name: PrefName, label: string, description: string): TemplateResult {
    const pref = this[name];
    return html`
      <div class="pref-row">
        <span class="pref-text">
          <span class="pref-label">${label}</span>
          <span class="pref-desc">${description}${pref.forced ? ' · set by the url' : ''}</span>
        </span>
        <button
          type="button"
          class="pref-switch"
          role="switch"
          aria-checked=${pref.on ? 'true' : 'false'}
          aria-label=${label.toLowerCase()}
          ?disabled=${pref.forced}
          @click=${() => this.#flip(name, !pref.on)}
        >
          ${pref.on ? 'ON' : 'OFF'}
        </button>
      </div>
    `;
  }

  override render(): TemplateResult {
    return html`
      <button
        type="button"
        class="prefs-toggle"
        aria-expanded=${this.open ? 'true' : 'false'}
        @click=${() => {
          this.open = !this.open;
        }}
      >
        PREFS
      </button>
      ${this.open
        ? html`
            <div class="prefs-panel" role="group" aria-label="preferences">
              ${ARTIFACT
                ? nothing
                : this.#row(
                    'visualizer',
                    'VISUALIZER',
                    'the state tree and transition log, drawn over the page',
                  )}
              ${this.#row('trace', 'TRACE', 'transition, view config and ui-view logging in the console')}
            </div>
          `
        : nothing}
    `;
  }
}
customElements.define('atlas-prefs', AtlasPrefs);

const copyLink = (router: UIRouter | undefined): TemplateResult =>
  html`<atlas-copy-link .router=${router}></atlas-copy-link>`;

// --- the utility bar: crumb left, utilities right, on every page ------------

function utilBar(
  crumb: TemplateResult,
  copy: TemplateResult | typeof nothing = nothing,
): TemplateResult {
  return html`
    <div class="util">
      <div class="crumb">${crumb}</div>
      <nav class="util-links" aria-label="utilities">
        <!-- The set's issue record: its own state since 2026-09-06, not a cover column. -->
        <a class="util-log" href=${goHref('atlas.log')} target=${outTarget}>LOG</a>
        <a class="util-docs" href="${DOCS}" target="_blank" rel="noopener">DOCS ↗</a>
        <a class="util-github" href="${GITHUB}" target="_blank" rel="noopener">GITHUB ↗</a>
        ${copy}
        <atlas-themer></atlas-themer>
        <atlas-prefs></atlas-prefs>
      </nav>
    </div>
  `;
}

const indexCrumb = (): TemplateResult =>
  html`<a href=${srefHref('atlas.gallery')}>← INDEX</a>`;

// --- the rail --------------------------------------------------------------

/** ≤900 the sheet list is a disclosure; a pick closes it over the new page. */
const closeRail = (): void => {
  const box = document.getElementById('rail-open') as HTMLInputElement | null;
  if (box) box.checked = false;
};

const sheetEntry = (sheet: SheetRow): TemplateResult => html`
  <a
    href=${goHref('atlas.sheet', { num: sheet.num })}
    target=${outTarget}
    @click=${closeRail}
    class=${goClass({
      state: 'atlas.sheet',
      params: { num: sheet.num },
      activeClasses: ACTIVE_CLASSES,
    })}
    aria-current=${goCurrent({ state: 'atlas.sheet', params: { num: sheet.num } })}
  >
    <span class="n">${sheet.num}</span><span class="t">${entryTitle(sheet.title)}</span>
  </a>
`;

// 'SHEET 7B · 3D' → '7B·3D': a 3D plate's number is its sheet head's
const railNum = (row: ExtraRow): string => row.shno.replace(/^SHEET /, '').replace(' · ', '·');

const railEntry = (entry: AscentRow): TemplateResult =>
  entry.kind === 'sheet'
    ? sheetEntry(entry.row)
    : html`
        <a
          href=${goHref(sceneState(entry.row))}
          target=${outTarget}
          @click=${closeRail}
          class=${goClass({ state: sceneState(entry.row), activeClasses: ACTIVE_CLASSES })}
          aria-current=${goCurrent({ state: sceneState(entry.row) })}
        >
          <span class="n">${railNum(entry.row)}</span><span class="t">${entryTitle(entry.row.title)}</span>
        </a>
      `;

/** Whether a rail entry is the page on screen. */
type Here = (entry: AscentRow) => boolean;

const OPEN_BANDS = 'atlas-rail-open';

/** The groups this viewer opened by hand, as space-separated keys. */
function readOpenBands(): Set<string> {
  try {
    return new Set(localStorage.getItem(OPEN_BANDS)?.split(' ').filter(Boolean));
  } catch {
    // private windows and blocked site data both throw here; every band starts shut
    return new Set();
  }
}

const writeOpenBands = (open: Set<string>): void => {
  try {
    localStorage.setItem(OPEN_BANDS, [...open].join(' '));
  } catch {
    // a remembered group is a convenience, never a requirement
  }
};

// The click lands before the details flips, so `open` is still the old state.
const rememberBand = (event: Event): void => {
  const group = (event.currentTarget as HTMLElement).parentElement as HTMLDetailsElement;
  const key = group.dataset.band;
  if (!key) return;
  const open = readOpenBands();
  if (group.open) open.delete(key);
  else open.add(key);
  writeOpenBands(open);
};

// Element parts never run on the server, so a remembered group opens after hydration.
const restoreBand = (element?: Element): void => {
  if (!(element instanceof HTMLDetailsElement)) return;
  const key = element.dataset.band;
  if (key && readOpenBands().has(key)) element.open = true;
};

const railGroups = (rail: HTMLElement): HTMLDetailsElement[] => [...rail.querySelectorAll<HTMLDetailsElement>('details.rail-group')];

/** The control folds while every group is open and unfolds otherwise; `data-all` picks the glyph. */
const labelAll = (button: HTMLButtonElement): void => {
  const rail = button.closest('nav.rail');
  if (!rail) return;
  const allOpen = railGroups(rail as HTMLElement).every((g) => g.open);
  const label = allOpen ? 'Collapse all' : 'Expand all';
  button.dataset.all = allOpen ? 'open' : 'shut';
  button.setAttribute('aria-label', label);
  button.title = label;
};

// Lucide chevrons-up-down and chevrons-down-up (ISC), in the house's 16-grid idiom.
const allGlyph = (glyph: 'expand' | 'collapse', paths: TemplateResult): TemplateResult => html`
  <svg
    class="rail-all-glyph"
    data-glyph=${glyph}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <g transform="scale(.666667)" stroke-width="1.95">${paths}</g>
  </svg>
`;

const UNFOLD = svg`<path d="m7 15 5 5 5-5" /><path d="m7 9 5-5 5 5" />`;
const FOLD = svg`<path d="m7 20 5-5 5 5" /><path d="m7 4 5 5 5-5" />`;

// Opens every group when any is shut, else shuts them all; the choice is remembered per group.
const toggleAll = (event: Event): void => {
  const button = event.currentTarget as HTMLButtonElement;
  const rail = button.closest('nav.rail');
  if (!rail) return;
  const groups = railGroups(rail as HTMLElement);
  const open = !groups.every((g) => g.open);
  const remembered = readOpenBands();
  for (const g of groups) {
    g.open = open;
    if (!g.dataset.band) continue;
    if (open) remembered.add(g.dataset.band);
    else remembered.delete(g.dataset.band);
  }
  writeOpenBands(remembered);
  labelAll(button);
};

const relabelAll = (event: Event): void => {
  const rail = (event.currentTarget as HTMLElement).closest('nav.rail');
  const button = rail?.querySelector<HTMLButtonElement>('button.rail-all');
  // the toggle has fired and the details has flipped by the time this runs
  if (button) queueMicrotask(() => labelAll(button));
};

const labelAllRef = (element?: Element): void => {
  if (element instanceof HTMLButtonElement) labelAll(element);
};

/** One altitude band inside a group: a flat head, then its plates. */
const railBand = (band: Band): TemplateResult => html`
  <p class="rail-band">${band.label}</p>
  <div class="rail-links">${band.rows.map(railEntry)}</div>
`;

/** A group of bands as one native disclosure: the set, then the appendix. */
interface Group {
  key: string;
  label: string;
  bands: Band[];
}

const groupsOf = (railBands: Band[]): Group[] => {
  const set = railBands.filter((band) => band.key !== 'appendix');
  const appendix = railBands.filter((band) => band.key === 'appendix');
  const groups: Group[] = set.length > 0 ? [{ key: 'set', label: 'SHEETS', bands: set }] : [];
  return appendix.length > 0 ? [...groups, { key: 'appendix', label: 'APPENDIX', bands: appendix }] : groups;
};

/**
 * The group holding the page on screen is opened by `live(true)`, so arriving
 * in a group the viewer shut reopens it; the other is left as the viewer set it.
 */
const railGroup = (group: Group, here: Here): TemplateResult => html`
  <details
    class="rail-group"
    data-band=${group.key}
    ?open=${group.bands.some((band) => band.rows.some(here)) ? live(true) : noChange}
    ${ref(restoreBand)}
    @toggle=${relabelAll}
  >
    <summary @click=${rememberBand}><span class="t">${group.label}</span></summary>
    ${group.bands.length === 1 ? html`<div class="rail-links">${group.bands[0]?.rows.map(railEntry)}</div>` : group.bands.map(railBand)}
  </details>
`;

function rail(manifest: Manifest | undefined, here: Here): TemplateResult {
  const railBands = manifest ? bands(manifest) : [];
  return html`
    <nav class="rail" aria-label="drawing set">
      <input type="checkbox" id="rail-open" class="rail-open" aria-label="show the sheets" />
      <div class="rail-head">
        <div class="rail-name">
          <!-- THE CLIENT, SPELLED OUT: lit-ui-router.dev = lit + ui-router, in the docs site's own marks -->
          <div class="client-eq" role="group" aria-label="lit-ui-router.dev equals lit plus ui-router">
            <a class="client-mark" href=${DOCS} title="lit-ui-router.dev" target="_blank" rel="noopener">
              <img class="client-glow client-glow-light" src=${GLOW_URL} alt="" aria-hidden="true" />
              <img class="client-glow client-glow-dark" src=${GLOW_DARK_URL} alt="" aria-hidden="true" />
              <img class="client-logo" src=${LOGO_URL} alt="lit-ui-router.dev" />
              <img class="client-logo client-logo-lit" src=${LOGO_URL} alt="" aria-hidden="true" />
            </a>
            <span class="op">=</span>
            <a class="client-term" href="https://lit.dev" title="Lit" target="_blank" rel="noopener">
              <img class="flame" src=${FLAME_URL} alt="Lit" />
            </a>
            <span class="op">+</span>
            <a class="client-term" href="https://ui-router.github.io/" title="UI-Router" target="_blank" rel="noopener">
              <img src=${UIROUTER_URL} alt="UI-Router" />
            </a>
          </div>
          <h1><a href=${srefHref('atlas.gallery')}>THE ALTITUDE ATLAS</a></h1>
        </div>
        <label class="rail-toggle" for="rail-open">SHEETS ▾</label>
      </div>
      <div class="rail-body">
        <div class="rail-top">
          <a
            href=${srefHref('atlas.gallery')}
            @click=${closeRail}
            class=${srefActiveClass({ state: 'atlas.gallery', activeClasses: ACTIVE_CLASSES })}
            aria-current=${srefAriaCurrent({ state: 'atlas.gallery' })}
            >INDEX</a
          >
          <a
            href=${srefHref('atlas.about')}
            @click=${closeRail}
            class=${srefActiveClass({ state: 'atlas.about', activeClasses: ACTIVE_CLASSES })}
            aria-current=${srefAriaCurrent({ state: 'atlas.about' })}
            >ABOUT</a
          >
        </div>
        <!-- a zero-height sticky dock: the control rides the scroll over the list -->
        <div class="rail-dock">
          <button
            type="button"
            class="rail-all"
            data-all="shut"
            aria-label="Expand all"
            title="Expand all"
            @click=${toggleAll}
            ${ref(labelAllRef)}
          >
            ${allGlyph('expand', UNFOLD)}${allGlyph('collapse', FOLD)}
          </button>
        </div>
        <p class="rail-sec">ASCENT ORDER</p>
        ${groupsOf(railBands).map((group) => railGroup(group, here))}
        <!-- The type specimen is a bench, not a plate: reachable at /specimen, off the rail. -->
      </div>
    </nav>
  `;
}

// --- the shell: rail + the nested content view -----------------------------

/**
 * The shell around whatever fills the content column.
 *
 * `ShellView` puts `<ui-view>` there and lets the router fill it, on both
 * halves. `uiViewSlot()` is the hole: the build's prerender reaches
 * `UiViewRenderer` through it and the routed component is written into the
 * element's light DOM; on the client the same directive wakes the view. Same
 * rail, same sprite, same cover CSS either way: ONE template set, one hole.
 */
export const shell = (manifest: Manifest | undefined, content: unknown, here: Here): TemplateResult => html`
  <!-- lit cannot bind inside <style>, so the whole tag rides unsafeHTML. -->
  ${manifest ? unsafeHTML(`<style>${manifest.cover.css}</style>`) : nothing}
  <!-- The icon table, once a page (generator/icons.mjs): every card cell, index chip and lane glyph is a <use>. -->
  ${unsafeHTML(ICON_SPRITE)}
  <div class="app">
    ${rail(manifest, here)}
    <main class="content">${content}</main>
  </div>
`;

// Every ui-view re-renders on each successful transition, so the shell reads the settled state.
export const ShellView: RoutedLitTemplate<ManifestResolves> = (props) => {
  const globals = props?.router?.globals;
  const name = globals ? globals.current.name : props?.transition?.to().name;
  const params = globals ? globals.params : (props?.transition?.params() ?? {});
  const here: Here = (entry) =>
    entry.kind === 'sheet' ? name === 'atlas.sheet' && params.num === entry.row.num : name === sceneState(entry.row);
  return shell(props?.resolves?.manifest, html`<ui-view>${uiViewSlot()}</ui-view>`, here);
};

/**
 * THE PAGE — the one root template, prerendered and hydrated.
 *
 * The build renders it per path and the boot in src/main.ts adopts what it
 * drew; every `<ui-view>` in the app carries `uiViewSlot()`, this one and the
 * shell's nested one.
 */
export const page = (router: UIRouterLit): TemplateResult =>
  html`<ui-router .uiRouter=${router}><ui-view>${uiViewSlot()}</ui-view></ui-router>`;

// --- gallery: the title sheet — key image, issue log, index ----------------

const logLink = (entry: IssueEntry): TemplateResult =>
  SCENE_STATES.has(`atlas.${entry.num}`)
    ? html`<a class="s" href=${srefHref(`atlas.${entry.num}`)}
        >${entry.head} · REV ${entry.rev}</a
      >`
    : html`<a class="s" href=${srefHref('atlas.sheet', { num: entry.num })}
        >${entry.head} · REV ${entry.rev}</a
      >`;

const logEntry = (entry: IssueEntry): TemplateResult => html`
  <li>
    <span class="d">${entry.date || '—'}</span>${logLink(entry)}<span class="t">${entry.desc}</span>
  </li>
`;

// --- the key index ---------------------------------------------------------
// FORM's four keys, each indexed in the shape its type asks for: mode is a
// boolean and gets a toggle, subject and projection are small enums and get
// grouped chip rows, basis is meaningful only inside the city group and is
// drawn inside it, and the kv box is the fallback for a combination the chips
// cannot say. Every chip is a srefHref onto atlas.gallery with the whole filter
// as params, so the index is a link and the browser's back button undoes a
// filter. `srefActiveClass` then lights the chip whose target IS the current
// url, and `srefHref` writes the url — query string and all — off the router,
// so the filter is spelled in exactly one place.

const ON_CLASSES = ['is-on'];

/**
 * THE KEY ROW — FORM's keys as one line of icons, hairline-separated in the
 * idiom of the plates' own title block (generator/chrome.mjs `.titleblock`):
 * the data face, no field names. Left to right, the keys the plate carries:
 * the subject's icon, the basis beside it as detail text on a city, the
 * projection's glyph, and the interactive lamp. A key the plate does not
 * carry draws NOTHING — twenty STATIC marks in a set of twenty-five is noise,
 * and basis says nothing about a plate that is not a city, so absence is the
 * value and the row is as long as the plate is.
 *
 * Every cell is a link into the filtered index; `srefActiveClass` echoes the
 * applied filter on the cell that would set it. The icons are named in the
 * cover's KEY INDEX, which is their legend; here each cell carries the key and
 * its value as an accessible name and a `title`, so a pointer names it too.
 * Twins: `keyRowBlock` in prerender.ts (plain hrefs, no directives) and the
 * chips in `chip()`, which draw the same symbols.
 */

/** A symbol from the page's one sprite; nothing where a key has no drawing. */
const icon = (key: LabelKey, value: string): TemplateResult | typeof nothing => {
  const id = iconId(key, value);
  return id
    ? html`<svg class="gl" aria-hidden="true"><use href="#${id}"></use></svg>`
    : nothing;
};

/**
 * One cell: the icon, and on the basis the value itself, which is the detail
 * a city needs (MEASURED, DELIVERED, REAL 3D ISOMETRIC) and no other key does.
 */
const keyCell = (key: LabelKey, value: string | undefined): TemplateResult | typeof nothing => {
  if (!value) return nothing;
  const next: Filter = { ...EMPTY_FILTER, [key]: value };
  return html`<a
    aria-label="${key} ${value}"
    title="${key} ${value}"
    href=${srefHref('atlas.gallery', { ...next })}
    class=${srefActiveClass({
      state: 'atlas.gallery',
      params: { ...next },
      activeClasses: ON_CLASSES,
      // CONSUMER FINDING: `class` holds ONE toggling directive, and this
      // cell's static half is interpolated (`kr-${key}`), so the statics come
      // in through `classes` — srefActiveClass's stand-in for classMap.
      classes: { 'kr-cell': true, [`kr-${key}`]: true },
    })}
    aria-current=${srefAriaCurrent({ state: 'atlas.gallery', params: { ...next } })}
    >${icon(key, value)}${key === 'basis' ? html`<span class="dt">${value}</span>` : nothing}</a
  >`;
};

const keyBlock = (labels: SheetLabels): TemplateResult => html`
  <span class="keyrow" aria-label="keys">
    ${keyCell('subject', labels.subject)}${keyCell('basis', labels.basis)}${keyCell(
      'projection',
      labels.projection,
    )}${keyCell('mode', labels.mode === 'interactive' ? labels.mode : undefined)}
  </span>
`;

/**
 * A CHIP MARKS ITSELF ACTIVE — and since 1.14 the router marks it, not this
 * file. `uiSrefActive` cached its status and recomputed it on transitions only,
 * while a chip's TARGET params are rewritten by the render the transition
 * causes: a chip whose target moved read one navigation behind, and the ALL
 * chips, whose target is "the filter minus this key", move on every click. The
 * app answered that by computing activeness by hand from the filter.
 * `srefActiveClass` re-reads its params on every render, so the hand
 * computation is gone and the chip's own target is the single source again.
 *
 * THE INDEX IS THE LEGEND. A value chip draws the same symbol the cards draw
 * for that value, ahead of the word, so the filter block names every icon on
 * the cover. The ALL chip names no value and takes none; `static` and the
 * basis values are drawn nowhere, and their chips are words, as on the cards.
 */
const chip = (
  key: LabelKey,
  label: string,
  count: number,
  next: Filter,
  withIcon = true,
): TemplateResult => html`
  <a
    href=${srefHref('atlas.gallery', { ...next })}
    class="kv ${srefActiveClass({
      state: 'atlas.gallery',
      params: { ...next },
      activeClasses: ON_CLASSES,
    })}"
    aria-current=${srefAriaCurrent({ state: 'atlas.gallery', params: { ...next } })}
    >${withIcon ? icon(key, label) : nothing}<i>${label}</i
    ><span class="c">${count}</span></a
  >
`;

/** One key's row: an ALL chip, then a chip per value the set actually carries. */
const keyRow = (
  key: LabelKey,
  rows: readonly { labels: SheetLabels }[],
  filter: Filter,
  extraClass = '',
): TemplateResult => {
  const all = without(filter, key);
  return html`
    <div class="krow ${extraClass}">
      <span class="kk">${key}</span>
      <div class="kchips">
        ${chip(key, 'all', rows.filter((row) => matchesFilter(row.labels, all)).length, all, false)}
        ${facet(rows, key, filter).map((entry) =>
          chip(key, entry.value, entry.count, { ...filter, [key]: entry.value }),
        )}
      </div>
    </div>
  `;
};

const keyIndex = (manifest: Manifest, filter: Filter, router?: UIRouter): TemplateResult => {
  const rows = labelledRows(manifest);
  const shown = rows.filter((row) => matchesFilter(row.labels, filter)).length;
  // basis says nothing about a plate that is not a city, so it is drawn inside
  // the city group rather than as a row of its own
  const inCity = filter.subject === BASIS_SUBJECT || filter.basis !== null;
  const submit = (event: Event): void => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const value = String(new FormData(form).get('kv') ?? '').trim();
    void router?.stateService.go('atlas.gallery', { ...filter, kv: value.length > 0 ? value : null });
  };
  return html`
    <div class="keyindex" aria-label="key index">
      <div class="khead">
        <span class="kt">KEY INDEX — FORM, SPLIT</span>
        <span class="kn">${shown} / ${rows.length} SHOWN</span>
        ${isFiltered(filter)
          ? html`<a class="kclear" href=${srefHref('atlas.gallery', { ...EMPTY_FILTER })}
              >CLEAR ✕</a
            >`
          : nothing}
      </div>
      ${keyRow('mode', rows, filter)} ${keyRow('subject', rows, filter)}
      ${inCity ? keyRow('basis', rows, filter, 'krow-in') : nothing}
      ${keyRow('projection', rows, filter)}
      <form class="kvbox" action="${to(href.gallery)}" method="get" @submit=${submit}>
        <label for="kv-query">key = value</label>
        <input
          id="kv-query"
          name="kv"
          list="kv-vocab"
          autocomplete="off"
          spellcheck="false"
          placeholder="subject=city projection=isometric"
          .value=${filter.kv ?? ''}
        />
        <datalist id="kv-vocab">
          ${kvVocabulary(rows).map((entry) => html`<option value="${entry}"></option>`)}
        </datalist>
        ${LABEL_KEYS.filter((key) => filter[key] !== null).map(
          (key) => html`<input type="hidden" name="${key}" value="${filter[key] ?? ''}" />`,
        )}
        <button type="submit">FILTER</button>
      </form>
    </div>
  `;
};

/**
 * THE CARD'S BACKDROP (T16) — the whole card's box, holding the whole plate
 * drawn at build time by generator/thumbs.mjs: transparent outside the ink, so
 * it lies over the card's gradient ground and behind the head window and the
 * text panel. One WebP per theme, and only the one the theme asks for is ever
 * fetched: `display: none` suppresses a lazy image's request, so the pair
 * costs a single file. On at rest, and nothing in the card moves. Decorative
 * either way — the card's title says what it is.
 */
const cardPic = (thumb: Thumb): TemplateResult => html`
  <div class="card-pic">
    <img
      class="l"
      src="${thumbSrc(thumb.light)}"
      alt=""
      width="600"
      height="800"
      loading="lazy"
      decoding="async"
    />
    <img
      class="d"
      src="${thumbSrc(thumb.dark)}"
      alt=""
      width="600"
      height="800"
      loading="lazy"
      decoding="async"
    />
  </div>
`;

/** The clear pane across the head of the card, over the backdrop. It holds
 *  the card's one fixed proportion and no content. */
const cardWindow = (): TemplateResult => html`<div class="card-window"></div>`;

/**
 * A cover card. The card is a CONTAINER, not a link: the title carries the one
 * primary `srefHref` and stretches over the whole card through a `::after`
 * (the Inclusive Components card pattern), so the key block's own filter links
 * are valid interactive content rather than links nested inside a link. Tab
 * order is title, then keys. Four layers, back to front: the card's gradient
 * ground, the plate's picture over the whole box, the clear head window, and
 * `.card-body` in opaque paper.
 */
const sheetCard = (sheet: SheetRow): TemplateResult => html`
  <article class="card">
    ${cardPic(sheet.thumb)} ${cardWindow()}
    <div class="card-body">
      <span class="n">${isAppendix(sheet.num) ? 'APPENDIX' : 'SHEET'} ${sheet.num} · REV ${sheet.rev}</span>
      <h3>
        <a
          href=${goHref('atlas.sheet', { num: sheet.num })}
          target=${outTarget}
          class="card-go ${goClass({
            state: 'atlas.sheet',
            params: { num: sheet.num },
            activeClasses: ACTIVE_CLASSES,
          })}"
          aria-current=${goCurrent({ state: 'atlas.sheet', params: { num: sheet.num } })}
          >${articleTitle(sheet.title)}</a
        >
      </h3>
      <span class="alt">${sheet.scale}</span>
      <p>${unsafeHTML(sheet.caption)}</p>
      <span class="meta">
        ${isAppendix(sheet.num) && sheet.plates.length === 0
          ? `${sheet.form} · NO CENSUS PLATE — META`
          : `${sheet.form} · ${String(sheet.plates.length)} PLATE${sheet.plates.length === 1 ? '' : 'S'}${isAppendix(sheet.num) ? ' — META' : ''}`}
      </span>
      ${keyBlock(sheet.labels)}
    </div>
  </article>
`;

/** A 3D plate's card: the same three layers as a sheet's, its picture taken from the scene. */
const cityCard = (extra: ExtraRow): TemplateResult => html`
  <article class="card">
    ${cardPic(extra.thumb)} ${cardWindow()}
    <div class="card-body">
      <span class="n">${extra.shno} · REV ${extra.rev}</span>
      <h3>
        <a
          href=${goHref(sceneState(extra))}
          target=${outTarget}
          class="card-go ${goClass({ state: sceneState(extra), activeClasses: ACTIVE_CLASSES })}"
          aria-current=${goCurrent({ state: sceneState(extra) })}
          >${articleTitle(extra.title)}</a
        >
      </h3>
      <span class="alt">${extra.scale}</span>
      <p>${extra.sub}</p>
      <span class="meta">3D · WEBGL · LOADED ON DEMAND</span>
      ${keyBlock(extra.labels)}
    </div>
  </article>
`;

export const GalleryView: RoutedLitTemplate<ManifestResolves> = (props) => {
  const manifest = props?.resolves?.manifest;
  if (!manifest) return html`<p class="loading">LOADING INDEX…</p>`;
  const city = findExtra(manifest, 'city');
  // ONE line of issue record on the title sheet; the log itself is /log.
  const latest = (manifest.issueLog ?? []).find((entry) => entry.date);
  // The key index's state is the url's: the router's settled globals, the
  // same read on the server and in the browser; with no router, the transition.
  const filter = readFilter(props?.router ? props.router.globals.params : props?.transition?.params());
  const shownAscent = ascent(manifest).filter((entry) => matchesFilter(entry.row.labels, filter));
  const shownAppendix = (manifest.appendix ?? []).filter((row) =>
    matchesFilter(row.labels, filter),
  );
  return html`
    ${utilBar(
      html`<span class="sh">INDEX</span
        ><span>${manifest.sheets.length} PLATES / ${manifest.total} SHEETS</span>`,
    )}
    <section class="sheet cover-sheet">
      <div class="sheet-head">
        <span class="proj">${PROJECT_MARK} — DRAWING SET</span>
        <span class="shno">${manifest.sheets.length} PLATES / ${manifest.total} SHEETS</span>
      </div>
      <!-- THE WORDMARK — the same plain uppercase name the rail head and the
           sheet-head line above carry, in the display face, so every site reads
           as one mark; only the size changes. -->
      <h2 class="cover-title">THE ALTITUDE ATLAS</h2>
      <p class="sheet-sub cover-sub">
        SAME SUBJECT AT EVERY SCALE — THE FORM CHANGES BECAUSE THE TRUTH DOES
        <span class="stamp">CLIENT ${manifest.client} · PLATES COUNTED ${manifest.date}</span>
      </p>
      <div class="hero">
        <!-- The key image: sheet 7's city, drawn at build time. model-viewer loads on the 3D plates and nowhere else. -->
        ${city
          ? html`
              <a class="hero-plate" href=${goHref('atlas.city')} target=${outTarget}>
                ${unsafeHTML(manifest.cover.hero)}
                <span class="hero-cap">
                  <span>${city.shno} · REV ${city.rev}</span>
                  <span class="t">${articleTitle(city.title)}</span>
                  <span class="go">RAISE THE CITY ↗</span>
                </span>
              </a>
            `
          : nothing}
      </div>
      ${latest
        ? html`<p class="cover-latest">
            <a href=${goHref('atlas.log')} target=${outTarget}
              ><span class="k">LATEST</span><span class="d">${latest.date}</span
              ><span class="s">${latest.head} · REV ${latest.rev}</span
              ><span class="t">${latest.desc}</span><span class="go">ISSUE LOG ↗</span></a
            >
          </p>`
        : nothing}
    </section>
    <h2 class="set-sec">SHEET INDEX — ASCENT ORDER</h2>
    ${keyIndex(manifest, filter, props?.router)}
    ${shownAscent.length > 0
      ? html`<div class="cards">
            <!-- Unkeyed since 1.14. A filter changes the list and an unkeyed
                 map re-uses a card's DOM for a different plate; that used to
                 leave each key cell's uiSrefActive holding the target it first
                 saw, so the filter echo went stale. srefActiveClass re-reads
                 its params on every render, so re-use is safe and the keying
                 (and its DOM moves) is no longer paying for anything. -->
            ${shownAscent.map((entry) =>
              entry.kind === 'sheet'
                ? sheetCard(entry.row)
                : cityCard(entry.row),
            )}
          </div>`
      : html`<p class="kempty">NO PLATE IN THE ASCENT CARRIES THAT KEY SET.</p>`}
    ${shownAppendix.length > 0
      ? html`
          <h2 class="set-sec">APPENDIX — PLATES ABOUT THE ATLAS, NOT THE CODEBASE</h2>
          <div class="cards">
            ${shownAppendix.map(sheetCard)}
          </div>
        `
      : nothing}
    <!-- The wide band: the numbers, then the argument. Side by side over 1800. -->
    <div class="cover-band">
      ${unsafeHTML(manifest.cover.statBar)}
      <div class="cover-wide">
        ${unsafeHTML(manifest.cover.survey)} ${unsafeHTML(manifest.cover.prose)}
      </div>
    </div>
  `;
};

// --- the issue log: the set's own revision record, on its own sheet --------

export const LogView: RoutedLitTemplate<ManifestResolves> = (props) => {
  const manifest = props?.resolves?.manifest;
  if (!manifest) return html`<p class="loading">LOADING THE LOG…</p>`;
  const log = manifest.issueLog ?? [];
  const dated = log.filter((entry) => entry.date);
  const undated = log.filter((entry) => !entry.date);
  return html`
    ${utilBar(html`${indexCrumb()}<span class="sh">ISSUE LOG</span>`)}
    <div class="plate-data">
      <span>ALTITUDE · THE SET'S OWN REVISIONS</span>
      <span>${dated.length} DATED · ${undated.length} AT ORIGINAL ISSUE</span>
    </div>
    <section class="sheet">
      <div class="sheet-head">
        <span class="proj">${PROJECT_MARK} — DRAWING SET</span>
        <span class="shno">ISSUE LOG</span>
      </div>
      <h2 class="sheet-title">${THE}ISSUE LOG</h2>
      <p class="sheet-sub">
        EVERY REV ACROSS EVERY PLATE, LATEST FIRST — THE SET'S OWN REVISION RECORD,
        READ FROM www/atlas.lit-ui-router.dev/HISTORY.md AT BUILD TIME; THE SHEETS THEMSELVES DESCRIBE
        THEIR PRESENT STATE ONLY
      </p>
      <div class="issue-log issue-log-page" aria-label="issue log">
        <ol>
          ${dated.map(logEntry)}
        </ol>
        ${undated.length > 0
          ? html`
              <details open>
                <summary>UNDATED — ORIGINAL ISSUE · ${undated.length} REVS</summary>
                <ol>
                  ${undated.map(logEntry)}
                </ol>
              </details>
            `
          : nothing}
      </div>
    </section>
  `;
};

// --- one sheet -------------------------------------------------------------

// Resolve generics are declared as TYPE ALIASES with OPTIONAL members on
// purpose. LitStateDeclaration defaults its generic to Record<string, any>,
// and a required member makes a typed view non-assignable to the default —
// see README/SSR-VERDICT for the write-up.
type ManifestResolves = { manifest?: Manifest };
type SheetResolves = { manifest?: Manifest; sheet?: SheetRow; fragment?: string };
type SceneResolves = { extra?: ExtraRow; fragment?: string; viewer?: unknown };
type SpecimenResolves = { specimen?: unknown };

const neighbours = (manifest: Manifest, sheet: SheetRow): [SheetRow?, SheetRow?] => {
  // The ← / → walk stays inside the ascent; an appendix plate walks its own
  // list (A1, A2, A2i, A3, A4), so A1 never appears as "next" after sheet 13.
  const list = isAppendix(sheet.num) ? (manifest.appendix ?? []) : manifest.sheets;
  const index = list.findIndex((row) => row.id === sheet.id);
  return [list[index - 1], list[index + 1]];
};

const seeAlso = (refs: string[]): TemplateResult | typeof nothing =>
  refs.length > 0
    ? html`<span
        >SEE ALSO
        ${refs.map(
          (num) => html`<a href=${srefHref('atlas.sheet', { num })}>${num}</a>&nbsp;`,
        )}</span
      >`
    : nothing;

/**
 * THE PLATE, one template on both sides of the seam.
 *
 * The fragment is the element's CHILD, written by this template: @lit-labs/ssr
 * emits it into the served page, and the client's `hydrate()` adopts it as the
 * same child part. The properties are what the served page cannot carry —
 * @lit-labs/ssr emits no property bindings — and hydration commits them, so
 * `<atlas-plate>` runs the adopted fragment's scripts exactly as it runs a
 * cold render's.
 */
const plate = (
  fragment: string,
  needsCytoscape: boolean,
  pin: string | null = null,
): TemplateResult =>
  html`<atlas-plate .fragment=${fragment} .needsCytoscape=${needsCytoscape} .pin=${pin}
    >${unsafeHTML(fragment)}</atlas-plate
  >`;

const verdictLine = (verdict: string): TemplateResult | typeof nothing =>
  verdict
    ? html`<p class="plate-verdict"><span class="lead">FIT VERDICT</span>${verdict}</p>`
    : nothing;

export const SheetView: RoutedLitTemplate<SheetResolves> = (props) => {
  const resolves = props?.resolves;
  const sheet = resolves?.sheet;
  const manifest = resolves?.manifest;
  if (!sheet || !manifest) return html`<p class="loading">LOADING PLATE…</p>`;
  const [prev, next] = neighbours(manifest, sheet);
  // the settled route
  const params = props?.router ? props.router.globals.params : props?.transition?.params();
  const focus = typeof params?.focus === 'string' ? params.focus : null;
  return html`
    ${utilBar(html`
      ${indexCrumb()}
      <!-- The one FACT in the strip, bold, in tabular figures. -->
      <span class="sh"
        >${isAppendix(sheet.num)
          ? `APPENDIX ${sheet.num}`
          : `SHEET ${sheet.num} OF ${String(manifest.total)}`}</span
      >
      ${prev
        ? html`<a href=${srefHref('atlas.sheet', { num: prev.num })}>PREV · ${prev.num}</a>`
        : nothing}
      ${next
        ? html`<a href=${srefHref('atlas.sheet', { num: next.num })}>NEXT · ${next.num}</a>`
        : nothing}
      <!-- The bare plate is a document of its own, not a state: a real link. -->
      <a href="${out(href.plate(sheet.num))}" target=${outTarget}>STANDALONE PLATE ↗</a>
    `,
      sheet.needsCytoscape ? copyLink(props?.router) : nothing,
    )}
    <div class="plate-data">
      <span>ALTITUDE · ${sheet.scale}</span>
      <span
        >PLATES READ:
        ${sheet.plates.length > 0 ? sheet.plates.join(' · ') : 'NONE — DRAWN FROM PROSE'}</span
      >
      ${seeAlso(sheet.refs)} ${keyBlock(sheet.labels)}
    </div>
    ${verdictLine(sheet.verdict)}
    ${plate(resolves.fragment ?? '', sheet.needsCytoscape, focus)}
  `;
};

// --- the city: sheet 7 in the round, with model-viewer loaded on demand ----

export const CityView: RoutedLitTemplate<SceneResolves> = (props) => {
  const resolves = props?.resolves;
  const extra = resolves?.extra;
  if (!extra || !resolves.fragment) return html`<p class="loading">RAISING THE CITY…</p>`;
  return html`
    ${utilBar(html`
      ${indexCrumb()}
      <span class="sh">${extra.shno}</span>
    `,
      copyLink(props?.router),
    )}
    <div class="plate-data">
      <span>ALTITUDE · ${extra.scale}</span>
      ${seeAlso(extra.refs)} ${keyBlock(extra.labels)}
    </div>
    ${verdictLine(extra.verdict)}
    <atlas-city .fragment=${resolves.fragment} .lib=${resolves.viewer} .router=${props?.router}
      >${plate(resolves.fragment, false)}</atlas-city
    >
  `;
};

// --- the bricks: sheet 2's finished model, with model-viewer loaded on demand ---

export const BricksView: RoutedLitTemplate<SceneResolves> = (props) => {
  const resolves = props?.resolves;
  const extra = resolves?.extra;
  if (!extra || !resolves.fragment) return html`<p class="loading">SEATING THE BRICKS…</p>`;
  return html`
    ${utilBar(html`
      ${indexCrumb()}
      <span class="sh">${extra.shno}</span>
    `,
      copyLink(props?.router),
    )}
    <div class="plate-data">
      <span>ALTITUDE · ${extra.scale}</span>
      ${seeAlso(extra.refs)} ${keyBlock(extra.labels)}
    </div>
    ${verdictLine(extra.verdict)}
    <atlas-bricks .fragment=${resolves.fragment} .lib=${resolves.viewer} .router=${props?.router}
      >${plate(resolves.fragment, false)}</atlas-bricks
    >
  `;
};

// --- the builds: sheet 2C's models, one picked at a time, with model-viewer loaded on demand ---

export const BuildsView: RoutedLitTemplate<SceneResolves> = (props) => {
  const resolves = props?.resolves;
  const extra = resolves?.extra;
  if (!extra || !resolves.fragment) return html`<p class="loading">LAYING OUT THE BUILDS…</p>`;
  return html`
    ${utilBar(html`
      ${indexCrumb()}
      <span class="sh">${extra.shno}</span>
    `,
      copyLink(props?.router),
    )}
    <div class="plate-data">
      <span>ALTITUDE · ${extra.scale}</span>
      ${seeAlso(extra.refs)} ${keyBlock(extra.labels)}
    </div>
    ${verdictLine(extra.verdict)}
    <atlas-builds .fragment=${resolves.fragment} .lib=${resolves.viewer} .router=${props?.router}
      >${plate(resolves.fragment, false)}</atlas-builds
    >
  `;
};

// --- the type specimen: a design bench, with its element loaded on demand ---

export const SpecimenView: RoutedLitTemplate<SpecimenResolves> = (props) => {
  // The element module IS the resolve (src/router.ts), so the custom element is
  // defined before the tag is written and the webfont <link> its
  // connectedCallback injects is fetched by this state and no other.
  if (!props?.resolves?.specimen) return html`<p class="loading">SETTING THE TYPE…</p>`;
  return html`
    ${utilBar(html`${indexCrumb()}<span class="sh">TYPE SPECIMEN</span>`)}
    <div class="plate-data">
      <span>ALTITUDE · THE SET'S OWN CHROME</span>
      <span>NOT A PLATE — A BENCH</span>
    </div>
    <section class="sheet">
      <div class="sheet-head">
        <span class="proj">${PROJECT_MARK} — DRAWING SET</span>
        <span class="shno">TYPE SPECIMEN</span>
      </div>
      <h2 class="sheet-title">${THE}TYPE SPECIMEN</h2>
      <p class="sheet-sub">
        SIX PAIRINGS ON ONE MOCK SHEET — IT OPENS ON THE ONE THE SET SHIPS · SITE FACES
        COME FROM ADOBE FONTS WHEN THE KIT IS STAGED, GOOGLE STAND-INS OTHERWISE · THE
        READOUTS BELOW SAY WHICH ONE ACTUALLY RENDERED AND HOW ITS GLYPHS MEASURE
        AGAINST TODAY'S MONO
      </p>
      <atlas-specimen></atlas-specimen>
    </section>
  `;
};

// --- about -----------------------------------------------------------------

const CARD_ALT =
  'The equation card: the lit-ui-router logo, an equals sign, the Lit flame, a plus sign and the UI-Router mark over the measured city of sheet 7, with THE ALTITUDE ATLAS lettered beneath.';

export const AboutView: RoutedLitTemplate<ManifestResolves> = (props) => {
  const manifest = props?.resolves?.manifest;
  const generatedBy = manifest?.generatedBy ?? 'www/atlas.lit-ui-router.dev/generator/emit-app.mjs';
  return html`
    ${utilBar(html`${indexCrumb()}<span class="sh">COLOPHON</span>`)}
    <section class="sheet">
      <div class="sheet-head">
        <span class="proj">${PROJECT_MARK} — DRAWING SET</span>
        <span class="shno">COLOPHON</span>
      </div>
      <div class="prose">
        <!-- THE EQUATION CARD, above the fold: one WebP per theme, picked as the cover's card backdrops are -->
        <figure class="card-figure">
          <img
            class="l"
            src="${thumbSrc(CARD.light)}"
            alt="${CARD_ALT}"
            width="1200"
            height="630"
            decoding="async"
          />
          <img
            class="d"
            src="${thumbSrc(CARD.dark)}"
            alt="${CARD_ALT}"
            width="1200"
            height="630"
            decoding="async"
          />
          <figcaption>lit-ui-router.dev equals lit plus ui-router — the equation card: the lockup on a framed pane over sheet 7's census city.</figcaption>
        </figure>
        <h2>THE SET, ROUTED</h2>
        ${manifest ? html`<p>${unsafeHTML(manifest.cover.thesis)}</p>` : nothing}
        ${ARTIFACT
          ? html`<p>
              This file is the atlas condensed to its index and this colophon. The full atlas,
              with its interactive plates and the plates in the round, lives at
              ${ext(`${SITE}/`, 'atlas.lit-ui-router.dev')}; every sheet card links there.
            </p>`
          : nothing}
        <p>
          The atlas is ${manifest?.total ?? 14} sheets of static HTML. This is the same
          set as one ${ext(npmUrl('lit-ui-router'), html`<code>lit-ui-router</code>`)} application: an abstract
          <code>atlas</code> state renders the rail and a nested
          <code>&lt;ui-view&gt;</code>, and <code>atlas.sheet</code> resolves one
          generated fragment per plate. Every plate is cut out of its page chrome by
          ${ext(`${BRANCH}${generatedBy}`, html`<code>${generatedBy}</code>`)} and
          mounted through one state — nothing here is transcribed by hand.
        </p>
        <h3>WHAT IS DOGFOODED</h3>
        <p>
          <code>srefHref</code>, <code>srefActiveClass</code> and
          <code>srefAriaCurrent</code> — the attribute-part forms, so the
          <code>href</code> in the source is the <code>href</code> in the DOM — on every
          rail link, cover card and key chip;
          <code>resolve</code> for the manifest, the plate, and — on
          the three plates in the round — Google's ${ext(HOME.modelViewer, html`<code>&lt;model-viewer&gt;</code>`)} itself, so a
          library and the ${ext(HOME.three, 'three.js')} it carries are fetched by the states that need them and by no other;
          <code>redirectTo</code> for <code>/office</code> → appendix A2; a url-less
          <code>atlas.notFound</code> as the <code>otherwise</code> target, so an unknown
          sheet keeps its own url in the address bar; nested
          <code>&lt;ui-view&gt;</code>; and the ${ext(HOME.navigation, 'Navigation API')} location plugin with a
          <code>pushState</code> fallback.
        </p>
        <h3>THE ISSUE LOG</h3>
        <p>
          Every REV across every plate — the set's own revision record, latest first —
          is at
          <a href=${goHref('atlas.log')} target=${outTarget}><code>${href.log}</code></a>.
          It is parsed at build time out of ${ext(`${BRANCH}www/atlas.lit-ui-router.dev/HISTORY.md`, html`<code>www/atlas.lit-ui-router.dev/HISTORY.md</code>`)}, the frozen
          record, and rides the manifest as JSON, so the app fetches no markdown. The
          sheets themselves carry no revision table: each describes its present state,
          and the log is where the set's history is read.
        </p>
        <h3>THE BARE PLATE</h3>
        <p>
          Every sheet is also served at <code>${href.plate('<num>')}</code>: one plate in a
          bare document, with no rail and no client script, which the prerender writes from
          the same route table — a top-level <code>plate</code> state the client knows only
          as a link target. Each sheet's crumb links its own.
        </p>
        <h3>WHAT THE SERVER DOES</h3>
        <p>
          ${ext(npmUrl('ui-router-server'), html`<code>ui-router-server</code>`)} compiles
          ${ext(`${BRANCH}www/atlas.lit-ui-router.dev/app/src/routes.ts`, html`<code>src/routes.ts</code>`)} — the same
          route table, projected as data — into a mount at the site root. It runs in
          the ${ext(HOME.vite, 'Vite')} dev and preview servers, so a bad deep link answers 404 rather than 200,
          and it drives the build-time prerender: every route a
          <code>shell</code> verdict claims gets its own HTML file, redirect verdicts
          become ${ext(HOME.redirects, html`<code>_redirects</code>`)} lines. See
          ${ext(`${BRANCH}www/atlas.lit-ui-router.dev/app/SSR-VERDICT.md`, html`<code>SSR-VERDICT.md</code>`)} for what rendered and what did not.
        </p>
        <h3>PACKAGES</h3>
        <p>
          ${pkg('lit-ui-router')}, ${pkg('@uirouter/core')},
          ${pkg('ui-router-server')},
          ${pkg('ui-router-navigation-location-plugin')}, ${pkg('lit')},
          ${pkg('ui-router-effect')} (the route ref: the boot's settled route,
          the index filter and the arrow-key walk read it),
          ${pkg('lit-ui-router-effect')} (the Lit controller that binds the city pin
          to it), ${pkg('effect')},
          ${pkg('cytoscape')} (the four interactive plates) and
          ${pkg('@google/model-viewer')} (the plates in the round, imported only by
          <code>atlas.city</code>, <code>atlas.plant</code>, <code>atlas.bricks</code> and <code>atlas.builds</code>); at build
          time, ${pkg('lit-ui-router-ssr')} and ${pkg('@lit-labs/ssr')}. All from
          ${ext(HOME.npm, 'npm')}; no workspace links.
        </p>
        <h3>HOW THE SET IS DRAWN</h3>
        ${manifest ? html`<p>${unsafeHTML(manifest.cover.notes)}</p>` : nothing}
        <p>
          Icons: ${ext(HOME.lucide, 'Lucide')} (ISC), restroked — the card keys, and the glyphs that mark the
          interactive plates' controls and panel heads; projection glyphs and the
          register and spine drawn here.
        </p>
        <!-- SOURCES is a footnote to the reading column, so it sits in it -->
        ${manifest ? unsafeHTML(manifest.cover.provenance) : nothing}
      </div>
    </section>
  `;
};

// --- unmatched -------------------------------------------------------------

export const NotFoundView: RoutedLitTemplate = () => html`
  ${utilBar(html`${indexCrumb()}<span class="sh">NO SUCH SHEET</span>`)}
  <section class="sheet">
    <div class="sheet-head">
      <span class="proj">${PROJECT_MARK} — DRAWING SET</span>
      <span class="shno">NO SUCH SHEET</span>
    </div>
    <h2 class="sheet-title">NOT IN THE SET</h2>
    <p class="sheet-sub">
      THE URL IS UNCHANGED ON PURPOSE — A URL-LESS <code>otherwise</code> STATE, WHICH IS
      WHAT <code>ui-router-server</code> PROJECTS AS AN HTTP 404
    </p>
    <div class="notes">
      <p>
        No plate is filed under that number.
        <a href=${srefHref('atlas.gallery')}>Back to the index</a>.
      </p>
    </div>
  </section>
`;

declare global {
  interface HTMLElementTagNameMap {
    'atlas-city': AtlasCity;
    'atlas-bricks': AtlasBricks;
    'atlas-builds': AtlasBuilds;
    'atlas-plate': AtlasPlate;
    'atlas-themer': AtlasThemer;
    'atlas-copy-link': AtlasCopyLink;
  }
}
