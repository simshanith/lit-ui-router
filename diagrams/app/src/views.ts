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
import type { Manifest, SheetRow } from './manifest.ts';
import { loadCytoscape, runScripts } from './fragment.ts';
import type { ThemeChoice } from './theme.ts';
import { applyTheme, readTheme } from './theme.ts';

const ACTIVE = { activeClasses: ['is-active'] };

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
  return html`
    <nav class="rail" aria-label="drawing set">
      <div class="rail-head">
        <span class="kicker">A DRAWING SET · lit-ui-router</span>
        <h1><a ${uiSref('atlas.gallery')} href="/app/">THE ALTITUDE ATLAS</a></h1>
      </div>
      <div class="rail-top">
        <a ${uiSrefActive(ACTIVE)} ${uiSref('atlas.gallery')} href="/app/">INDEX</a>
        <a ${uiSrefActive(ACTIVE)} ${uiSref('atlas.megacanvas')} href="/app/megacanvas"
          >MEGACANVAS</a
        >
        <a ${uiSrefActive(ACTIVE)} ${uiSref('atlas.about')} href="/app/about">ABOUT</a>
      </div>
      <atlas-themer></atlas-themer>
      <p class="rail-sec">SHEETS — ASCENT ORDER</p>
      <div class="rail-links">
        ${sheets.map(
          (sheet) => html`
            <a
              ${uiSrefActive(ACTIVE)}
              ${uiSref('atlas.sheet', { num: sheet.num })}
              href="/app/sheet/${sheet.num}"
            >
              <span class="n">${sheet.num}</span><span class="t">${sheet.title}</span>
            </a>
          `,
        )}
      </div>
    </nav>
  `;
}

// --- the shell: rail + the nested content view -----------------------------

export const ShellView: RoutedLitTemplate<ManifestResolves> = (props) => html`
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
      <div class="notes">
        <p>
          Every sheet below is the same drawing the standalone set publishes, cut out of
          its page chrome by <code>${manifest.generatedBy}</code> and mounted here through
          one <code>lit-ui-router</code> state. Nothing on this page is transcribed by
          hand.
        </p>
      </div>
    </section>
    <div class="cards">
      ${manifest.sheets.map(
        (sheet) => html`
          <a
            class="card"
            ${uiSrefActive(ACTIVE)}
            ${uiSref('atlas.sheet', { num: sheet.num })}
            href="/app/sheet/${sheet.num}"
          >
            <span class="n">SHEET ${sheet.num} · REV ${sheet.rev}</span>
            <h3>${sheet.title}</h3>
            <p>${sheet.caption}</p>
            <span class="meta">
              ${sheet.form} · ${sheet.plates.length}
              PLATE${sheet.plates.length === 1 ? '' : 'S'}
              ${sheet.interactive ? ' · INTERACTIVE' : ''}
            </span>
          </a>
        `,
      )}
    </div>
  `;
};

// --- one sheet -------------------------------------------------------------

// Resolve generics are declared as TYPE ALIASES with OPTIONAL members on
// purpose. LitStateDeclaration defaults its generic to Record<string, any>,
// and a required member makes a typed view non-assignable to the default —
// see README/SSR-VERDICT for the write-up.
type ManifestResolves = { manifest?: Manifest };
type SheetResolves = { manifest?: Manifest; sheet?: SheetRow; fragment?: string };
type MegacanvasResolves = { megacanvas?: string };

const neighbours = (manifest: Manifest, sheet: SheetRow): [SheetRow?, SheetRow?] => {
  const index = manifest.sheets.findIndex((row) => row.id === sheet.id);
  return [manifest.sheets[index - 1], manifest.sheets[index + 1]];
};

export const SheetView: RoutedLitTemplate<SheetResolves> = (props) => {
  const resolves = props?.resolves;
  const sheet = resolves?.sheet;
  const manifest = resolves?.manifest;
  if (!sheet || !manifest) return html`<p class="loading">LOADING PLATE…</p>`;
  const [prev, next] = neighbours(manifest, sheet);
  return html`
    <div class="crumb">
      <a ${uiSref('atlas.gallery')} href="/app/">← INDEX</a>
      ${prev
        ? html`<a ${uiSref('atlas.sheet', { num: prev.num })} href="/app/sheet/${prev.num}"
            >PREV · ${prev.num}</a
          >`
        : nothing}
      ${next
        ? html`<a ${uiSref('atlas.sheet', { num: next.num })} href="/app/sheet/${next.num}"
            >NEXT · ${next.num}</a
          >`
        : nothing}
      <a
        ${uiSref('atlas.megacanvas', { at: sheet.num })}
        href="/app/megacanvas?at=${sheet.num}"
        >ON THE REEL</a
      >
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
                    href="/app/sheet/${num}"
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

// --- the megacanvas: the whole set on one surface --------------------------

export const MegacanvasView: RoutedLitTemplate<MegacanvasResolves> = (props) => {
  const fragment = props?.resolves?.megacanvas;
  if (!fragment) return html`<p class="loading">ASSEMBLING THE MEGACANVAS…</p>`;
  return html`
    <div class="crumb"><a ${uiSref('atlas.gallery')} href="/app/">← INDEX</a></div>
    <atlas-plate .fragment=${fragment} .needsCytoscape=${true}></atlas-plate>
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
        <p>
          The atlas is ${manifest?.total ?? 14} sheets of static HTML. This is the same
          set as one <code>lit-ui-router</code> application: an abstract
          <code>atlas</code> state renders the rail and a nested
          <code>&lt;ui-view&gt;</code>, and <code>atlas.sheet</code> resolves one
          generated fragment per plate.
        </p>
        <h3>WHAT IS DOGFOODED</h3>
        <p>
          <code>uiSref</code> and <code>uiSrefActive</code> on every rail link;
          <code>resolve</code> for the manifest, the plate and the megacanvas;
          <code>redirectTo</code> for <code>/office</code> → sheet 14; a url-less
          <code>atlas.notFound</code> as the <code>otherwise</code> target, so an unknown
          sheet keeps its own url in the address bar; nested
          <code>&lt;ui-view&gt;</code>; and the Navigation API location plugin with a
          <code>pushState</code> fallback.
        </p>
        <h3>WHAT THE SERVER DOES</h3>
        <p>
          <code>ui-router-server</code> compiles <code>src/routes.ts</code> — the same
          route table, projected as data — into a mount at <code>/app</code>. It runs in
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
          <code>cytoscape</code> (for the two interactive plates). All from npm; no
          workspace links.
        </p>
      </div>
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
        <a ${uiSref('atlas.gallery')} href="/app/">Back to the index</a>.
      </p>
    </div>
  </section>
`;

declare global {
  interface HTMLElementTagNameMap {
    'atlas-plate': AtlasPlate;
    'atlas-themer': AtlasThemer;
  }
}
