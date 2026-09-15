/**
 * The views. Everything renders into the LIGHT DOM so the generated
 * `sheets/atlas.css` — the drawing set's own chrome, lifted verbatim out of
 * www/atlas.lit-ui-router.dev/generator/chrome.mjs — styles the plates as it styles the
 * standalone pages.
 */
import type { UIRouter } from '@uirouter/core';
import { LitElement, html, isServer, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { srefActiveClass, srefAriaCurrent, srefHref } from 'lit-ui-router';
import type { RoutedLitTemplate } from 'lit-ui-router';
import type {
  AscentRow,
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
  EMPTY_FILTER,
  LABEL_KEYS,
  ascent,
  entryTitle,
  facet,
  findExtra,
  isAppendix,
  isFiltered,
  kvVocabulary,
  labelledRows,
  matchesFilter,
  readFilter,
  thumbSrc,
  without,
} from './manifest.ts';
import { loadCytoscape, runScripts } from './fragment.ts';
import { ICON_SPRITE, iconId } from './icons.ts';
import { initCity } from './generated/city-init.js';
import { ARTIFACT } from './mode.ts';
import { href } from './routes.ts';
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
 * sheets/atlas.css so the flat set, the app and the artifact draw it alike).
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

/** The live site — the only place the flat set exists for an artifact reader. */
const SITE = 'https://atlas.lit-ui-router.dev';
const DOCS = 'https://lit-ui-router.dev';
const GITHUB = 'https://github.com/simshanith/lit-ui-router';

/**
 * An in-app path for the ONE site that is not a router link: the key box's
 * `<form action>`, a plain GET target that takes no directive. Every real link
 * asks the router through `srefHref`, so the artifact build's `#/…` comes from
 * `hashLocationPlugin` (src/router.ts) and not from a string prefix here.
 */
const to = (path: string): string => (ARTIFACT ? `#${path}` : path);

/** A link out to the flat set: relative on the site, absolute in the artifact. */
const out = (path: string): string => (ARTIFACT ? `${SITE}${path}` : path);

/** Artifact-only: the flat set is a different document, so open a new tab. */
const outTarget = ARTIFACT ? '_blank' : nothing;

// --- <atlas-plate> — a generated fragment, inserted and brought to life ----

/**
 * THE ELEMENT'S OWN RENDER, as a shared function (SPIKE #898).
 *
 * A light-DOM element's content is what the server cannot draw: there is no
 * `connectedCallback` on the server and the default `LitElementRenderer` only
 * knows how to fill a declarative shadow root. So the view template hands the
 * server the element's own render output to write INSIDE the tag, through a
 * child part whose value is `nothing` on the client — same template strings on
 * both sides, so the digests match, and the markers the server emits in that
 * part are exactly the markers the element's own `hydrate()` expects.
 */
export const plateContent = (fragment: string): TemplateResult =>
  html`${unsafeHTML(fragment)}`;

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
  // right edge — the same rule chrome.mjs writes for the flat set.
  #markEnd = (event: Event): void => {
    const wrap = event.target;
    if (!(wrap instanceof HTMLElement) || !wrap.classList.contains('figure-wrap')) return;
    wrap.parentElement?.toggleAttribute(
      'data-end',
      wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 1,
    );
  };

  override render(): TemplateResult {
    return plateContent(this.fragment);
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
    return plate(this.fragment, false);
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

/**
 * The themer's own render, shared with the server the way `plateContent` is.
 * The server has no stored choice, so it draws the default one; the element
 * hydrates against that and reaches for the reader's own in `firstUpdated`,
 * which is a re-render of three `aria-pressed` attributes and no new node.
 */
export const themerContent = (
  choice: ThemeChoice,
  pick: (choice: ThemeChoice) => void,
): TemplateResult => {
  const button = (value: ThemeChoice, label: string): TemplateResult => html`
    <button
      type="button"
      aria-pressed=${choice === value ? 'true' : 'false'}
      @click=${() => pick(value)}
    >
      ${label}
    </button>
  `;
  return html`
    <div class="themer" role="group" aria-label="colour scheme">
      ${button('auto', 'AUTO')}${button('light', 'VELLUM')}${button('dark', 'CYANO')}
    </div>
  `;
};

export class AtlasThemer extends LitElement {
  static override properties = { choice: { state: true } };

  declare choice: ThemeChoice;

  constructor() {
    super();
    // The DEFAULT, not the stored choice: this is what the server drew, and
    // the first render has to match it. `firstUpdated` reads the real one.
    this.choice = 'auto';
  }

  override createRenderRoot(): HTMLElement {
    return this;
  }

  #pick = (choice: ThemeChoice): void => {
    this.choice = choice;
    applyTheme(choice);
  };

  override firstUpdated(changed: Map<PropertyKey, unknown>): void {
    super.firstUpdated(changed);
    this.choice = readTheme();
  }

  override render(): TemplateResult {
    return themerContent(this.choice, this.#pick);
  }
}
customElements.define('atlas-themer', AtlasThemer);

// --- the utility bar: crumb left, utilities right, on every page ------------

function utilBar(crumb: TemplateResult): TemplateResult {
  return html`
    <div class="util">
      <div class="crumb">${crumb}</div>
      <nav class="util-links" aria-label="utilities">
        <!-- The set's issue record: its own state since 2026-09-06, not a cover column. -->
        <a class="util-log" href=${srefHref('atlas.log')}>LOG</a>
        <a class="util-docs" href="${DOCS}" target="_blank" rel="noopener">DOCS ↗</a>
        <a class="util-github" href="${GITHUB}" target="_blank" rel="noopener">GITHUB ↗</a>
        <!-- The flat set is plain pages beside the app, not a state: a real link. -->
        <a class="util-set" href="${out(href.set)}" target=${outTarget}>THE FLAT SET ↗</a>
        <atlas-themer>${isServer ? themerContent('auto', () => {}) : nothing}</atlas-themer>
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
    href=${srefHref('atlas.sheet', { num: sheet.num })}
    class=${srefActiveClass({
      state: 'atlas.sheet',
      params: { num: sheet.num },
      activeClasses: ACTIVE_CLASSES,
    })}
    aria-current=${srefAriaCurrent({ state: 'atlas.sheet', params: { num: sheet.num } })}
  >
    <span class="n">${sheet.num}</span><span class="t">${entryTitle(sheet.title)}</span>
  </a>
`;

const railEntry = (entry: AscentRow): TemplateResult =>
  entry.kind === 'sheet'
    ? sheetEntry(entry.row)
    : html`
        <a
          href=${srefHref('atlas.city')}
          class=${srefActiveClass({ state: 'atlas.city', activeClasses: ACTIVE_CLASSES })}
          aria-current=${srefAriaCurrent({ state: 'atlas.city' })}
        >
          <span class="n">7·3D</span><span class="t">${entryTitle(entry.row.title)}</span>
        </a>
      `;

function rail(manifest: Manifest | undefined): TemplateResult {
  const rows = manifest ? ascent(manifest) : [];
  const appendixRows = manifest?.appendix ?? [];
  return html`
    <nav class="rail" aria-label="drawing set">
      <input type="checkbox" id="rail-open" class="rail-open" aria-label="show the sheets" />
      <div class="rail-head">
        <div>
          <a class="kicker" href="https://lit-ui-router.dev">A DRAWING SET · lit-ui-router</a>
          <h1><a href=${srefHref('atlas.gallery')}>THE ALTITUDE ATLAS</a></h1>
        </div>
        <label class="rail-toggle" for="rail-open">SHEETS ▾</label>
      </div>
      <div class="rail-body" @click=${closeRail}>
        <div class="rail-top">
          <a
            href=${srefHref('atlas.gallery')}
            class=${srefActiveClass({ state: 'atlas.gallery', activeClasses: ACTIVE_CLASSES })}
            aria-current=${srefAriaCurrent({ state: 'atlas.gallery' })}
            >INDEX</a
          >
          <a
            href=${srefHref('atlas.about')}
            class=${srefActiveClass({ state: 'atlas.about', activeClasses: ACTIVE_CLASSES })}
            aria-current=${srefAriaCurrent({ state: 'atlas.about' })}
            >ABOUT</a
          >
        </div>
        <p class="rail-sec">SHEETS — ASCENT ORDER</p>
        <div class="rail-links">${rows.map(railEntry)}</div>
        <!-- The type specimen is a bench, not a plate: reachable at /specimen, off the rail. -->
        ${appendixRows.length > 0
          ? html`
              <!-- Letter-prefixed ids, no altitude: the appendix rides AFTER the
                   ascent, under its own section label. -->
              <p class="rail-sec">APPENDIX — ABOUT THE ATLAS</p>
              <div class="rail-links">${appendixRows.map(sheetEntry)}</div>
            `
          : nothing}
      </div>
    </nav>
  `;
}

// --- the shell: rail + the nested content view -----------------------------

/**
 * THE ROUTED VIEW'S HOLE — one template, both sides (SPIKE #898).
 *
 * `<ui-view>` is server-silent: @lit-labs/ssr never calls the
 * `connectedCallback` that picks the routed component, so the server writes
 * what the element WOULD have rendered into this slot and the client leaves it
 * `nothing` — the element hydrates against the markers the slot emitted. The
 * strings are shared, so the two sides carry the same digest, which is the
 * whole condition lit's `hydrate()` puts on a template.
 */
export const uiViewSlot = (content: unknown = nothing): TemplateResult =>
  html`<ui-view>${content}</ui-view>`;

/**
 * THE ROOT, shared by `main.ts` and `prerender.ts`. The server renders the
 * shell into the outer hole; the client hydrates the same tree with both holes
 * empty and lets the two `<ui-view>`s fill themselves.
 */
export const rootTemplate = (router: UIRouter, content: unknown = nothing): TemplateResult =>
  html`<ui-router .uiRouter=${router}>${uiViewSlot(content)}</ui-router>`;

/**
 * The shell around whatever fills the content column.
 *
 * Same rail, same sprite, same cover CSS on both sides: ONE template set, two
 * fillings of one hole.
 */
export const shell = (manifest: Manifest | undefined, content: unknown): TemplateResult => html`
  <!-- lit cannot bind inside <style>, so the whole tag rides unsafeHTML. -->
  ${manifest ? unsafeHTML(`<style>${manifest.cover.css}</style>`) : nothing}
  <!-- The key icons, once a page: every card cell and index chip is a <use>. -->
  ${unsafeHTML(ICON_SPRITE)}
  <div class="app">
    ${rail(manifest)}
    <main class="content">${content}</main>
  </div>
`;

export const ShellView: RoutedLitTemplate<ManifestResolves> = (props) =>
  shell(props?.resolves?.manifest, uiViewSlot());

// --- gallery: the title sheet — key image, issue log, index ----------------

const logLink = (entry: IssueEntry): TemplateResult =>
  entry.num === 'city'
    ? html`<a class="s" href=${srefHref('atlas.city')}
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
 * it lies BEHIND the head window and the text panel with the lattice still
 * running through it. One WebP per theme, and only the one the theme asks for
 * is ever fetched: `display: none` suppresses a lazy image's request, so the
 * pair costs a single file. At rest the image is invisible; hover or focus
 * fades the plate in, and nothing in the card moves. Decorative either way —
 * the card's title says what it is.
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

/** The pane across the head of the card: paper, thinner than the body's, over
 *  the backdrop. It holds the card's one fixed proportion and no content. */
const cardWindow = (): TemplateResult => html`<div class="card-window"></div>`;

/**
 * A cover card. The card is a CONTAINER, not a link: the title carries the one
 * primary `srefHref` and stretches over the whole card through a `::after`
 * (the Inclusive Components card pattern), so the key block's own filter links
 * are valid interactive content rather than links nested inside a link. Tab
 * order is title, then keys. Three layers, back to front: the plate's picture
 * over the whole box, the head window's thinner paper, and `.card-body`, which
 * carries the card's paper translucent — so the lattice and the drawing both
 * read behind the writing, and the window is only the plainest pane of the
 * same panel.
 */
const sheetCard = (sheet: SheetRow): TemplateResult => html`
  <article class="card">
    ${cardPic(sheet.thumb)} ${cardWindow()}
    <div class="card-body">
      <span class="n">${isAppendix(sheet.num) ? 'APPENDIX' : 'SHEET'} ${sheet.num} · REV ${sheet.rev}</span>
      <h3>
        <a
          href=${srefHref('atlas.sheet', { num: sheet.num })}
          class="card-go ${srefActiveClass({
            state: 'atlas.sheet',
            params: { num: sheet.num },
            activeClasses: ACTIVE_CLASSES,
          })}"
          aria-current=${srefAriaCurrent({ state: 'atlas.sheet', params: { num: sheet.num } })}
          >${articleTitle(sheet.title)}</a
        >
      </h3>
      <span class="alt">${sheet.scale}</span>
      <p>${unsafeHTML(sheet.caption)}</p>
      <span class="meta">
        ${isAppendix(sheet.num)
          ? `${sheet.form} · NO CENSUS PLATE — META`
          : `${sheet.form} · ${String(sheet.plates.length)} PLATE${sheet.plates.length === 1 ? '' : 'S'}`}
      </span>
      ${keyBlock(sheet.labels)}
    </div>
  </article>
`;

// The city has no raster: `cover.hero` is already a build-time SVG in the
// manifest, and drawing it again costs the cover nothing but DOM.
const cityCard = (extra: ExtraRow, hero: string): TemplateResult => html`
  <article class="card">
    <div class="card-pic card-pic-svg">${unsafeHTML(hero)}</div>
    ${cardWindow()}
    <div class="card-body">
      <span class="n">${extra.shno} · REV ${extra.rev}</span>
      <h3>
        <a
          href=${srefHref('atlas.city')}
          class="card-go ${srefActiveClass({ state: 'atlas.city', activeClasses: ACTIVE_CLASSES })}"
          aria-current=${srefAriaCurrent({ state: 'atlas.city' })}
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
  // The key index's state is the url's: globals.params is current once the
  // transition has settled, and the in-flight transition answers before that.
  const filter = readFilter(
    (props?.router?.globals.params ?? props?.transition?.params()) as Record<string, unknown>,
  );
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
        <!-- The key image: sheet 7's city, drawn at build time. three.js loads on /city and nowhere else. -->
        ${city
          ? html`
              <a class="hero-plate" href=${srefHref('atlas.city')}>
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
            <a href=${srefHref('atlas.log')}
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
      ? html`<div class="cards-field">
          <!-- THE FIELD: one turning cube lattice behind the grid, seen only
               through the cards' windows. src/lattice.ts defines the tag on
               the client; prerendered, it is an empty element. -->
          <atlas-lattice aria-hidden="true"></atlas-lattice>
          <div class="cards">
            <!-- Unkeyed since 1.14. A filter changes the list and an unkeyed
                 map re-uses a card's DOM for a different plate; that used to
                 leave each key cell's uiSrefActive holding the target it first
                 saw, so the filter echo went stale. srefActiveClass re-reads
                 its params on every render, so re-use is safe and the keying
                 (and its DOM moves) is no longer paying for anything. -->
            ${shownAscent.map((entry) =>
              entry.kind === 'sheet'
                ? sheetCard(entry.row)
                : cityCard(entry.row, manifest.cover.hero),
            )}
          </div>
        </div>`
      : html`<p class="kempty">NO PLATE IN THE ASCENT CARRIES THAT KEY SET.</p>`}
    ${shownAppendix.length > 0
      ? html`
          <h2 class="set-sec">APPENDIX — PLATES ABOUT THE ATLAS, NOT THE CODEBASE</h2>
          <div class="cards-field">
            <atlas-lattice aria-hidden="true"></atlas-lattice>
            <div class="cards">
              ${shownAppendix.map(sheetCard)}
            </div>
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
type CityResolves = { extra?: ExtraRow; fragment?: string; three?: unknown };
type SpecimenResolves = { specimen?: unknown };

const neighbours = (manifest: Manifest, sheet: SheetRow): [SheetRow?, SheetRow?] => {
  // The ← / → walk stays inside the ascent; an appendix plate walks its own
  // (currently one-plate) list, so A1 never appears as "next" after sheet 14.
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
 * THE PLATE, both sides of the seam — ONE template now (SPIKE #898).
 *
 * In a browser the fragment is a PROPERTY: `<atlas-plate>` renders it into its
 * own light DOM and then runs the scripts inside it. @lit-labs/ssr emits no
 * property bindings and calls no `connectedCallback`, so the server writes the
 * element's own render output as its child instead — but through the SAME
 * template as the client's, with `nothing` in the slot where the browser's
 * copy of the element will draw it for itself. Two templates here (the old
 * `isServer ? … : …` pair) meant two digests and no hydration at all.
 */
const plate = (fragment: string, needsCytoscape: boolean): TemplateResult =>
  html`<atlas-plate .fragment=${fragment} .needsCytoscape=${needsCytoscape}
    >${isServer ? plateContent(fragment) : nothing}</atlas-plate
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
      <a href="${out(href.plate(sheet.standalone))}" target=${outTarget}>STANDALONE PLATE ↗</a>
    `)}
    <div class="plate-data">
      <span>ALTITUDE · ${sheet.scale}</span>
      <span
        >PLATES READ:
        ${sheet.plates.length > 0 ? sheet.plates.join(' · ') : 'NONE — DRAWN FROM PROSE'}</span
      >
      ${seeAlso(sheet.refs)} ${keyBlock(sheet.labels)}
    </div>
    ${verdictLine(sheet.verdict)}
    ${plate(resolves.fragment ?? '', sheet.needsCytoscape)}
  `;
};

// --- the city: sheet 7 in the round, with three loaded on demand -----------

export const CityView: RoutedLitTemplate<CityResolves> = (props) => {
  const resolves = props?.resolves;
  const extra = resolves?.extra;
  if (!extra || !resolves.fragment) return html`<p class="loading">RAISING THE CITY…</p>`;
  return html`
    ${utilBar(html`
      ${indexCrumb()}
      <span class="sh">${extra.shno}</span>
      <a href="${out(href.plate(extra.standalone))}" target=${outTarget}>STANDALONE PLATE ↗</a>
    `)}
    <div class="plate-data">
      <span>ALTITUDE · ${extra.scale}</span>
      ${seeAlso(extra.refs)} ${keyBlock(extra.labels)}
    </div>
    ${verdictLine(extra.verdict)}
    <atlas-city .fragment=${resolves.fragment} .three=${resolves.three}
      >${isServer ? plate(resolves.fragment, false) : nothing}</atlas-city
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

export const AboutView: RoutedLitTemplate<ManifestResolves> = (props) => {
  const manifest = props?.resolves?.manifest;
  return html`
    ${utilBar(html`${indexCrumb()}<span class="sh">COLOPHON</span>`)}
    <section class="sheet">
      <div class="sheet-head">
        <span class="proj">${PROJECT_MARK} — DRAWING SET</span>
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
          <code>${manifest?.generatedBy ?? 'www/atlas.lit-ui-router.dev/generator/emit-app.mjs'}</code> and
          mounted through one state — nothing here is transcribed by hand.
        </p>
        <h3>WHAT IS DOGFOODED</h3>
        <p>
          <code>srefHref</code>, <code>srefActiveClass</code> and
          <code>srefAriaCurrent</code> — the attribute-part forms, so the
          <code>href</code> in the source is the <code>href</code> in the DOM — on every
          rail link, cover card and key chip;
          <code>resolve</code> for the manifest, the plate, and — on
          <code>atlas.city</code> — three.js itself, so a 600 KB library is
          fetched by the state that needs it and by no other;
          <code>redirectTo</code> for <code>/office</code> → sheet 14; a url-less
          <code>atlas.notFound</code> as the <code>otherwise</code> target, so an unknown
          sheet keeps its own url in the address bar; nested
          <code>&lt;ui-view&gt;</code>; and the Navigation API location plugin with a
          <code>pushState</code> fallback.
        </p>
        <h3>THE ISSUE LOG</h3>
        <p>
          Every REV across every plate — the set's own revision record, latest first —
          is at
          <a href=${srefHref('atlas.log')}><code>${href.log}</code></a>.
          It is parsed at build time out of <code>www/atlas.lit-ui-router.dev/HISTORY.md</code>, the frozen
          record, and rides the manifest as JSON, so the app fetches no markdown. The
          sheets themselves carry no revision table: each describes its present state,
          and the log is where the set's history is read.
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
          (the isometric city, imported only by <code>atlas.city</code>); at build
          time, <code>lit-ui-router-ssr</code> and <code>@lit-labs/ssr</code>. All from
          npm; no workspace links.
        </p>
        <h3>HOW THE SET IS DRAWN</h3>
        ${manifest ? html`<p>${unsafeHTML(manifest.cover.notes)}</p>` : nothing}
        <p>
          Icons: Lucide (ISC), restroked; projection glyphs and the register and spine
          drawn here.
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
    'atlas-plate': AtlasPlate;
    'atlas-themer': AtlasThemer;
  }
}
