/**
 * The views. Everything renders into the LIGHT DOM so the generated
 * `sheets/atlas.css` — the drawing set's own chrome, lifted verbatim out of
 * diagrams/generator/chrome.mjs — styles the plates as it styles the
 * standalone pages.
 */
import { LitElement, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { uiSref, uiSrefActive } from 'lit-ui-router';
import type { RoutedLitTemplate } from 'lit-ui-router';
import type { ExtraRow, Manifest, SheetRow } from './manifest.ts';
import { isAppendix } from './manifest.ts';
import { loadCytoscape, runScripts } from './fragment.ts';
import { initCity } from './generated/city-init.js';
import { ARTIFACT } from './mode.ts';
import { href } from './routes.ts';
import type { ThemeChoice } from './theme.ts';
import { applyTheme, readTheme } from './theme.ts';

const ACTIVE = { activeClasses: ['is-active'] };

/** The live site — the only place the flat set exists for an artifact reader. */
const SITE = 'https://atlas.lit-ui-router.dev';

/**
 * An in-app href. Written straight through on the site; hash-prefixed in the
 * artifact build, which is exactly what `uiSref` writes over it there, so the
 * static attribute and the directive agree instead of fighting.
 */
const to = (path: string): string => (ARTIFACT ? `#${path}` : path);

/** A link out to the flat set: relative on the site, absolute in the artifact. */
const out = (path: string): string => (ARTIFACT ? `${SITE}${path}` : path);

/** Artifact-only: the flat set is a different document, so open a new tab. */
const outTarget = ARTIFACT ? '_blank' : nothing;

// --- <atlas-plate> — a generated fragment, inserted and brought to life ----

export class AtlasPlate extends LitElement {
  static override properties = {
    fragment: { attribute: false },
    needsCytoscape: { attribute: false },
  };

  declare fragment: string;
  declare needsCytoscape: boolean;
  #seq = 0;

  constructor() {
    super();
    this.fragment = '';
    this.needsCytoscape = false;
  }

  // Light DOM: the plates' scripts find their JSON islands with
  // document.getElementById, and atlas.css is a plain stylesheet.
  override createRenderRoot(): HTMLElement {
    return this;
  }

  override render(): TemplateResult {
    return html`${unsafeHTML(this.fragment)}`;
  }

  override updated(changed: Map<PropertyKey, unknown>): void {
    if (!changed.has('fragment') || !this.fragment) return;
    const seq = (this.#seq += 1);
    const boot = (): void => {
      if (seq === this.#seq) runScripts(this);
    };
    if (this.needsCytoscape) void loadCytoscape().then(boot);
    else boot();
  }
}
customElements.define('atlas-plate', AtlasPlate);

// --- <atlas-city> — the 3D plate, and the layer that tears it down --------

/**
 * The isometric city: a generated fragment plus a WebGL scene over it.
 *
 * WHY THE ELEMENT OWNS THE TEARDOWN. The scene holds a WebGL context, a
 * ResizeObserver, a MutationObserver on <html>, a colour-scheme media listener
 * and pending animation frames — none of which the DOM reclaims when the
 * routed view is swapped, and a context per visit hits the browser's cap in a
 * dozen moves. A router hook could dispose it, but the experimental layer is
 * deletable by design and this is not optional; the element that CREATED the
 * scene is the one thing whose lifetime already matches it, so
 * `disconnectedCallback` is the hook. `updated` waits on the plate's own
 * `updateComplete` for "the fragment is in the DOM" — the same promise
 * `experimental/view-rendered.ts` chains, owned locally so `src/*.ts` stays
 * free of that directory.
 */
export class AtlasCity extends LitElement {
  static override properties = {
    fragment: { attribute: false },
    three: { attribute: false },
  };

  declare fragment: string;
  declare three: unknown;
  #dispose: (() => void) | null = null;
  #seq = 0;

  constructor() {
    super();
    this.fragment = '';
    this.three = undefined;
  }

  override createRenderRoot(): HTMLElement {
    return this;
  }

  override render(): TemplateResult {
    return html`<atlas-plate .fragment=${this.fragment}></atlas-plate>`;
  }

  override updated(changed: Map<PropertyKey, unknown>): void {
    if (!changed.has('fragment') && !changed.has('three')) return;
    void this.#boot();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#teardown();
  }

  async #boot(): Promise<void> {
    const seq = (this.#seq += 1);
    const plate = this.querySelector('atlas-plate');
    if (!plate || !this.fragment || !this.three) return;
    await plate.updateComplete; // the fragment (and its JSON island) is in the DOM
    if (seq !== this.#seq || !this.isConnected) return;
    this.#teardown();
    const dispose = await initCity(this, this.three);
    // undefined = nothing was raised (no WebGL); a superseded boot disposes at once
    if (seq === this.#seq && this.isConnected) this.#dispose = dispose ?? null;
    else dispose?.();
  }

  #teardown(): void {
    this.#dispose?.();
    this.#dispose = null;
  }
}
customElements.define('atlas-city', AtlasCity);

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

// --- the rail --------------------------------------------------------------

function rail(manifest: Manifest | undefined): TemplateResult {
  const sheets = manifest?.sheets ?? [];
  const appendixRows = manifest?.appendix ?? [];
  return html`
    <nav class="rail" aria-label="drawing set">
      <div class="rail-head">
        <span class="kicker">A DRAWING SET · lit-ui-router</span>
        <h1><a ${uiSref('atlas.gallery')} href="${to(href.gallery)}">THE ALTITUDE ATLAS</a></h1>
      </div>
      <div class="rail-top">
        <a ${uiSrefActive(ACTIVE)} ${uiSref('atlas.gallery')} href="${to(href.gallery)}">INDEX</a>
        <a ${uiSrefActive(ACTIVE)} ${uiSref('atlas.about')} href="${to(href.about)}">ABOUT</a>
        <!-- The flat set is plain pages beside the app, not a state: a real link. -->
        <a class="rail-out" href="${out(href.set)}" target=${outTarget}>THE FLAT SET ↗</a>
      </div>
      <atlas-themer></atlas-themer>
      <p class="rail-sec">SHEETS — ASCENT ORDER</p>
      <div class="rail-links">
        ${sheets.map(
          (sheet) => html`
            <a
              ${uiSrefActive(ACTIVE)}
              ${uiSref('atlas.sheet', { num: sheet.num })}
              href="${to(href.sheet(sheet.num))}"
            >
              <span class="n">${sheet.num}</span><span class="t">${sheet.title}</span>
            </a>
          `,
        )}
        <!-- No sheet number, so it rides at the end of the ascent rather than in it. -->
        <a ${uiSrefActive(ACTIVE)} ${uiSref('atlas.city')} href="${to(href.city)}">
          <span class="n">S7·3D</span><span class="t">THE CITY — IN THE ROUND</span>
        </a>
        <!-- The type specimen is a bench, not a plate: reachable at /specimen, off the rail. -->
      </div>
      ${appendixRows.length > 0
        ? html`
            <!-- Letter-prefixed ids, no altitude: the appendix rides AFTER the
                 ascent and after the city, under its own section label. -->
            <p class="rail-sec">APPENDIX — ABOUT THE ATLAS</p>
            <div class="rail-links">
              ${appendixRows.map(
                (sheet) => html`
                  <a
                    ${uiSrefActive(ACTIVE)}
                    ${uiSref('atlas.sheet', { num: sheet.num })}
                    href="${to(href.sheet(sheet.num))}"
                  >
                    <span class="n">${sheet.num}</span><span class="t">${sheet.title}</span>
                  </a>
                `,
              )}
            </div>
          `
        : nothing}
    </nav>
  `;
}

// --- the shell: rail + the nested content view -----------------------------

export const ShellView: RoutedLitTemplate<ManifestResolves> = (props) => html`
  <!-- lit cannot bind inside <style>, so the whole tag rides unsafeHTML. -->
  ${props?.resolves?.manifest
    ? unsafeHTML(`<style>${props.resolves.manifest.cover.css}</style>`)
    : nothing}
  <div class="app">
    ${rail(props?.resolves?.manifest)}
    <main class="content"><ui-view></ui-view></main>
  </div>
`;

// --- gallery ---------------------------------------------------------------

export const GalleryView: RoutedLitTemplate<ManifestResolves> = (props) => {
  const manifest = props?.resolves?.manifest;
  if (!manifest) return html`<p class="loading">LOADING INDEX…</p>`;
  return html`
    <section class="sheet">
      <div class="sheet-head">
        <span class="proj">THE ALTITUDE ATLAS — DRAWING SET</span>
        <span class="shno">${manifest.sheets.length} PLATES / ${manifest.total} SHEETS</span>
      </div>
      <h2 class="sheet-title">THE INDEX</h2>
      <p class="sheet-sub">
        SAME SUBJECT AT EVERY SCALE — THE FORM CHANGES BECAUSE THE TRUTH DOES · CLIENT
        ${manifest.client} · PLATES COUNTED ${manifest.date}
      </p>
      ${unsafeHTML(manifest.cover.statBar)} ${unsafeHTML(manifest.cover.survey)}
      ${unsafeHTML(manifest.cover.prose)}
    </section>
    <div class="cards">
      ${manifest.sheets.map(
        (sheet) => html`
          <a
            class="card"
            ${uiSrefActive(ACTIVE)}
            ${uiSref('atlas.sheet', { num: sheet.num })}
            href="${to(href.sheet(sheet.num))}"
          >
            <span class="n">SHEET ${sheet.num} · REV ${sheet.rev}</span>
            <h3>${sheet.title}</h3>
            <span class="alt">${sheet.scale}</span>
            <p>${sheet.caption}</p>
            <p class="verdict">${sheet.verdict}</p>
            <span class="meta">
              ${sheet.form} · ${sheet.plates.length}
              PLATE${sheet.plates.length === 1 ? '' : 'S'}
              ${sheet.interactive ? ' · INTERACTIVE' : ''}
            </span>
          </a>
        `,
      )}
      ${manifest.extras?.map(
        (extra) => html`
          <a class="card" ${uiSrefActive(ACTIVE)} ${uiSref('atlas.city')} href="${to(href.city)}">
            <span class="n">${extra.shno} · REV ${extra.rev}</span>
            <h3>${extra.title}</h3>
            <span class="alt">${extra.scale}</span>
            <p>${extra.sub}</p>
            <p class="verdict">${extra.verdict}</p>
            <span class="meta">3D · WEBGL · INTERACTIVE · LOADED ON DEMAND</span>
          </a>
        `,
      )}
    </div>
    ${(manifest.appendix ?? []).length > 0
      ? html`
          <h2 class="set-sec">APPENDIX — PLATES ABOUT THE ATLAS, NOT THE CODEBASE</h2>
          <div class="cards">
            ${manifest.appendix.map(
              (sheet) => html`
                <a
                  class="card"
                  ${uiSrefActive(ACTIVE)}
                  ${uiSref('atlas.sheet', { num: sheet.num })}
                  href="${to(href.sheet(sheet.num))}"
                >
                  <span class="n">APPENDIX ${sheet.num} · REV ${sheet.rev}</span>
                  <h3>${sheet.title}</h3>
                  <span class="alt">${sheet.scale}</span>
                  <p>${sheet.caption}</p>
                  <p class="verdict">${sheet.verdict}</p>
                  <span class="meta">${sheet.form} · NO CENSUS PLATE — META</span>
                </a>
              `,
            )}
          </div>
        `
      : nothing}
  `;
};

// --- one sheet -------------------------------------------------------------

// Resolve generics are declared as TYPE ALIASES with OPTIONAL members on
// purpose. LitStateDeclaration defaults its generic to Record<string, any>,
// and a required member makes a typed view non-assignable to the default —
// see README/SSR-VERDICT for the write-up.
type ManifestResolves = { manifest?: Manifest };
type SheetResolves = { manifest?: Manifest; sheet?: SheetRow; fragment?: string };
type CityResolves = { extra?: ExtraRow; fragment?: string; three?: unknown };
type SpecimenResolves = { specimen?: unknown };

const neighbours = (manifest: Manifest, sheet: SheetRow): [SheetRow?, SheetRow?] => {
  // The ← / → walk stays inside the ascent; an appendix plate walks its own
  // (currently one-plate) list, so A1 never appears as "next" after sheet 14.
  const list = isAppendix(sheet.num) ? (manifest.appendix ?? []) : manifest.sheets;
  const index = list.findIndex((row) => row.id === sheet.id);
  return [list[index - 1], list[index + 1]];
};

export const SheetView: RoutedLitTemplate<SheetResolves> = (props) => {
  const resolves = props?.resolves;
  const sheet = resolves?.sheet;
  const manifest = resolves?.manifest;
  if (!sheet || !manifest) return html`<p class="loading">LOADING PLATE…</p>`;
  const [prev, next] = neighbours(manifest, sheet);
  return html`
    <div class="crumb">
      <a ${uiSref('atlas.gallery')} href="${to(href.gallery)}">← INDEX</a>
      <!-- The one FACT in the strip, bold, in tabular figures. -->
      <span class="sh"
        >${isAppendix(sheet.num)
          ? `APPENDIX ${sheet.num}`
          : `SHEET ${sheet.num} OF ${String(manifest.total)}`}</span
      >
      ${prev
        ? html`<a ${uiSref('atlas.sheet', { num: prev.num })} href="${to(href.sheet(prev.num))}"
            >PREV · ${prev.num}</a
          >`
        : nothing}
      ${next
        ? html`<a ${uiSref('atlas.sheet', { num: next.num })} href="${to(href.sheet(next.num))}"
            >NEXT · ${next.num}</a
          >`
        : nothing}
      <a href="${out(href.plate(sheet.standalone))}" target=${outTarget}
        >STANDALONE PLATE ↗</a
      >
      <span>ALTITUDE · ${sheet.scale}</span>
      <span
        >PLATES READ:
        ${sheet.plates.length > 0 ? sheet.plates.join(' · ') : 'NONE — DRAWN FROM PROSE'}</span
      >
      ${sheet.refs.length > 0
        ? html`<span
            >SEE ALSO
            ${sheet.refs.map(
              (num) =>
                html`<a
                    ${uiSref('atlas.sheet', { num })}
                    href="${to(href.sheet(num))}"
                    >${num}</a
                  >&nbsp;`,
            )}</span
          >`
        : nothing}
    </div>
    <atlas-plate
      .fragment=${resolves.fragment ?? ''}
      .needsCytoscape=${sheet.needsCytoscape}
    ></atlas-plate>
  `;
};

// --- the city: sheet 7 in the round, with three loaded on demand -----------

export const CityView: RoutedLitTemplate<CityResolves> = (props) => {
  const resolves = props?.resolves;
  const extra = resolves?.extra;
  if (!extra || !resolves.fragment) return html`<p class="loading">RAISING THE CITY…</p>`;
  return html`
    <div class="crumb">
      <a ${uiSref('atlas.gallery')} href="${to(href.gallery)}">← INDEX</a>
      <a href="${out(href.plate(extra.standalone))}" target=${outTarget}>STANDALONE PLATE ↗</a>
      <span>ALTITUDE · ${extra.scale}</span>
      <span
        >SEE ALSO
        ${extra.refs.map(
          (num) =>
            html`<a ${uiSref('atlas.sheet', { num })} href="${to(href.sheet(num))}">${num}</a
              >&nbsp;`,
        )}</span
      >
    </div>
    <atlas-city .fragment=${resolves.fragment} .three=${resolves.three}></atlas-city>
  `;
};

// --- the type specimen: a design bench, with its element loaded on demand ---

export const SpecimenView: RoutedLitTemplate<SpecimenResolves> = (props) => {
  // The element module IS the resolve (src/router.ts), so the custom element is
  // defined before the tag is written and the webfont <link> its
  // connectedCallback injects is fetched by this state and no other.
  if (!props?.resolves?.specimen) return html`<p class="loading">SETTING THE TYPE…</p>`;
  return html`
    <div class="crumb">
      <a ${uiSref('atlas.gallery')} href="${to(href.gallery)}">← INDEX</a>
      <span>ALTITUDE · THE SET'S OWN CHROME</span>
      <span>NOT A PLATE — A BENCH</span>
    </div>
    <section class="sheet">
      <div class="sheet-head">
        <span class="proj">THE ALTITUDE ATLAS — DRAWING SET</span>
        <span class="shno">TYPE SPECIMEN</span>
      </div>
      <h2 class="sheet-title">THE TYPE SPECIMEN</h2>
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

export const AboutView: RoutedLitTemplate<ManifestResolves> = (props) => {
  const manifest = props?.resolves?.manifest;
  return html`
    <section class="sheet">
      <div class="sheet-head">
        <span class="proj">THE ALTITUDE ATLAS — DRAWING SET</span>
        <span class="shno">COLOPHON</span>
      </div>
      <div class="prose">
        <h2>THE SET, ROUTED</h2>
        ${manifest ? html`<p>${unsafeHTML(manifest.cover.thesis)}</p>` : nothing}
        <p>
          The atlas is ${manifest?.total ?? 14} sheets of static HTML. This is the same
          set as one <code>lit-ui-router</code> application: an abstract
          <code>atlas</code> state renders the rail and a nested
          <code>&lt;ui-view&gt;</code>, and <code>atlas.sheet</code> resolves one
          generated fragment per plate. Every plate is the same drawing the standalone
          set publishes, cut out of its page chrome by
          <code>${manifest?.generatedBy ?? 'diagrams/generator/emit-app.mjs'}</code> and
          mounted through one state — nothing here is transcribed by hand.
        </p>
        <h3>WHAT IS DOGFOODED</h3>
        <p>
          <code>uiSref</code> and <code>uiSrefActive</code> on every rail link;
          <code>resolve</code> for the manifest, the plate, and — on
          <code>atlas.city</code> — three.js itself, so a 600 KB library is
          fetched by the state that needs it and by no other;
          <code>redirectTo</code> for <code>/office</code> → sheet 14; a url-less
          <code>atlas.notFound</code> as the <code>otherwise</code> target, so an unknown
          sheet keeps its own url in the address bar; nested
          <code>&lt;ui-view&gt;</code>; and the Navigation API location plugin with a
          <code>pushState</code> fallback.
        </p>
        <h3>THE FLAT SET</h3>
        <p>
          The same drawings as the standalone pages they were first published as — the
          gallery, the megacanvas and one page per sheet — are kept beside this app at
          <a href="${out(href.set)}" target=${outTarget}
            ><code>${out(href.set)}</code></a
          >
          as the version to compare
          against. Every sheet here links to its standalone plate from its crumb.
        </p>
        <h3>WHAT THE SERVER DOES</h3>
        <p>
          <code>ui-router-server</code> compiles <code>src/routes.ts</code> — the same
          route table, projected as data — into a mount at the site root. It runs in
          the Vite dev and preview servers, so a bad deep link answers 404 rather than 200,
          and it drives the build-time prerender: every route a
          <code>shell</code> verdict claims gets its own HTML file, redirect verdicts
          become <code>_redirects</code> lines. See
          <code>SSR-VERDICT.md</code> for what rendered and what did not.
        </p>
        <h3>PACKAGES</h3>
        <p>
          <code>lit-ui-router</code>, <code>@uirouter/core</code>,
          <code>ui-router-server</code>,
          <code>ui-router-navigation-location-plugin</code>, <code>lit</code>,
          <code>cytoscape</code> (the four interactive plates) and <code>three</code>
          (the isometric city, imported only by <code>atlas.city</code>). All from npm;
          no workspace links.
        </p>
        <h3>HOW THE SET IS DRAWN</h3>
        ${manifest ? html`<p>${unsafeHTML(manifest.cover.notes)}</p>` : nothing}
      </div>
      ${manifest ? unsafeHTML(manifest.cover.provenance) : nothing}
    </section>
  `;
};

// --- unmatched -------------------------------------------------------------

export const NotFoundView: RoutedLitTemplate = () => html`
  <section class="sheet">
    <div class="sheet-head">
      <span class="proj">THE ALTITUDE ATLAS — DRAWING SET</span>
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
        <a ${uiSref('atlas.gallery')} href="${to(href.gallery)}">Back to the index</a>.
      </p>
    </div>
  </section>
`;

declare global {
  interface HTMLElementTagNameMap {
    'atlas-city': AtlasCity;
    'atlas-plate': AtlasPlate;
    'atlas-themer': AtlasThemer;
  }
}
