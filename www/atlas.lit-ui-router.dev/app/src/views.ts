/**
 * The views. Everything renders into the LIGHT DOM so the generated
 * `sheets/atlas.css` — the drawing set's own chrome, lifted verbatim out of
 * www/atlas.lit-ui-router.dev/generator/chrome.mjs — styles the plates as it styles the
 * standalone pages.
 */
import type { UIRouter } from '@uirouter/core';
import { LitElement, html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { uiSref, uiSrefActive } from 'lit-ui-router';
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
  filterQuery,
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

const ACTIVE = { activeClasses: ['is-active'] };

/**
 * THE ARTICLE (T9, shipped 2026-09-06): a title keeps its THE, drawn as a
 * lowercase superior in the data face (`sup.art`, styled in the generated
 * sheets/atlas.css so the flat set, the app and the artifact draw it alike).
 * Twins: `articleTitle` in generator/chrome.mjs and in prerender.ts.
 */
const THE: TemplateResult = html`<sup class="art">the&nbsp;</sup>`;

/**
 * THE CONDENSED WORDMARK — the atlas's LEDGER name, for the sheet-head PROJECT
 * line and the plates' title blocks: the NAME in the display face
 * (`.project-mark` in sheets/atlas.css, so the face travels with the mark, not
 * with the site), with the article drawn as the kit's catchword (`.cw`) and as
 * the superior off it.
 * The rail head and the cover title carry the OTHER name — the full uppercase
 * wordmark in the display face, plain, with nothing set apart.
 * Twin: `PROJECT_MARK` in generator/chrome.mjs and in prerender.ts.
 */
const PROJECT_MARK: TemplateResult = html`<span class="cw">${THE}</span><span class="project-mark">ALTITUDE ATLAS</span>`;

const articleTitle = (title: string): TemplateResult =>
  ARTICLE.test(title) ? html`${THE}${entryTitle(title)}` : html`${title}`;

/** The live site — the only place the flat set exists for an artifact reader. */
const SITE = 'https://atlas.lit-ui-router.dev';
const DOCS = 'https://lit-ui-router.dev';
const GITHUB = 'https://github.com/simshanith/lit-ui-router';

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

// --- the utility bar: crumb left, utilities right, on every page ------------

function utilBar(crumb: TemplateResult): TemplateResult {
  return html`
    <div class="util">
      <div class="crumb">${crumb}</div>
      <nav class="util-links" aria-label="utilities">
        <!-- The set's issue record: its own state since 2026-09-06, not a cover column. -->
        <a class="util-log" ${uiSref('atlas.log')} href="${to(href.log)}">LOG</a>
        <a class="util-docs" href="${DOCS}" target="_blank" rel="noopener">DOCS ↗</a>
        <a class="util-github" href="${GITHUB}" target="_blank" rel="noopener">GITHUB ↗</a>
        <!-- The flat set is plain pages beside the app, not a state: a real link. -->
        <a class="util-set" href="${out(href.set)}" target=${outTarget}>THE FLAT SET ↗</a>
        <atlas-themer></atlas-themer>
      </nav>
    </div>
  `;
}

const indexCrumb = (): TemplateResult =>
  html`<a ${uiSref('atlas.gallery')} href="${to(href.gallery)}">← INDEX</a>`;

// --- the rail --------------------------------------------------------------

/** ≤900 the sheet list is a disclosure; a pick closes it over the new page. */
const closeRail = (): void => {
  const box = document.getElementById('rail-open') as HTMLInputElement | null;
  if (box) box.checked = false;
};

const sheetEntry = (sheet: SheetRow): TemplateResult => html`
  <a
    ${uiSrefActive(ACTIVE)}
    ${uiSref('atlas.sheet', { num: sheet.num })}
    href="${to(href.sheet(sheet.num))}"
  >
    <span class="n">${sheet.num}</span><span class="t">${entryTitle(sheet.title)}</span>
  </a>
`;

const railEntry = (entry: AscentRow): TemplateResult =>
  entry.kind === 'sheet'
    ? sheetEntry(entry.row)
    : html`
        <a ${uiSrefActive(ACTIVE)} ${uiSref('atlas.city')} href="${to(href.city)}">
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
          <h1><a ${uiSref('atlas.gallery')} href="${to(href.gallery)}">THE ALTITUDE ATLAS</a></h1>
        </div>
        <label class="rail-toggle" for="rail-open">SHEETS ▾</label>
      </div>
      <div class="rail-body" @click=${closeRail}>
        <div class="rail-top">
          <a ${uiSrefActive(ACTIVE)} ${uiSref('atlas.gallery')} href="${to(href.gallery)}">INDEX</a>
          <a ${uiSrefActive(ACTIVE)} ${uiSref('atlas.about')} href="${to(href.about)}">ABOUT</a>
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

export const ShellView: RoutedLitTemplate<ManifestResolves> = (props) => html`
  <!-- lit cannot bind inside <style>, so the whole tag rides unsafeHTML. -->
  ${props?.resolves?.manifest
    ? unsafeHTML(`<style>${props.resolves.manifest.cover.css}</style>`)
    : nothing}
  <!-- The key icons, once a page: every card cell and index chip is a <use>. -->
  ${unsafeHTML(ICON_SPRITE)}
  <div class="app">
    ${rail(props?.resolves?.manifest)}
    <main class="content"><ui-view></ui-view></main>
  </div>
`;

// --- gallery: the title sheet — key image, issue log, index ----------------

const logLink = (entry: IssueEntry): TemplateResult =>
  entry.num === 'city'
    ? html`<a class="s" ${uiSref('atlas.city')} href="${to(href.city)}"
        >${entry.head} · REV ${entry.rev}</a
      >`
    : html`<a class="s" ${uiSref('atlas.sheet', { num: entry.num })} href="${to(href.sheet(entry.num))}"
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
// cannot say. Every chip is a uiSref onto atlas.gallery with the whole filter
// as params, so the index is a link and the browser's back button undoes a
// filter. uiSrefActive then lights the chip whose target IS the current url.

const KEY_ACTIVE = { activeClasses: ['is-on'] };

const filterHref = (filter: Filter): string => `${to(href.gallery)}${filterQuery(filter)}`;

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
 * Every cell is a link into the filtered index; `uiSrefActive` echoes the
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
    class="kr-cell kr-${key}"
    aria-label="${key} ${value}"
    title="${key} ${value}"
    ${uiSrefActive(KEY_ACTIVE)}
    ${uiSref('atlas.gallery', { ...next })}
    href="${filterHref(next)}"
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
 * A CHIP MARKS ITSELF ACTIVE. `uiSrefActive` caches its status and recomputes
 * it on transitions only, while a chip's TARGET params are rewritten by the
 * render that the transition causes — so a chip whose target moved read one
 * navigation behind, and the ALL chips, whose target is "the filter minus this
 * key", moved on every click. The filter is already in hand here and says the
 * answer outright: a value chip is on when the key holds it, and ALL is on when
 * the key holds nothing. `uiSrefActive` still drives the cards' key cells,
 * whose targets are the plate's own fixed labels.
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
  on: boolean,
  withIcon = true,
): TemplateResult => html`
  <a
    class="kv ${on ? 'is-on' : ''}"
    aria-current="${on ? 'page' : nothing}"
    ${uiSref('atlas.gallery', { ...next })}
    href="${filterHref(next)}"
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
        ${chip(
          key,
          'all',
          rows.filter((row) => matchesFilter(row.labels, all)).length,
          all,
          filter[key] === null,
          false,
        )}
        ${facet(rows, key, filter).map((entry) =>
          chip(
            key,
            entry.value,
            entry.count,
            { ...filter, [key]: entry.value },
            filter[key] === entry.value,
          ),
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
          ? html`<a
              class="kclear"
              ${uiSref('atlas.gallery', { ...EMPTY_FILTER })}
              href="${filterHref(EMPTY_FILTER)}"
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
 * THE CARD'S WINDOW (T16) — a fixed 259 x 150 box across the head of the card,
 * holding a crop of the plate drawn at build time by generator/thumbs.mjs. One
 * WebP per theme, and only the one the theme asks for is ever fetched:
 * `display: none` suppresses a lazy image's request, so the pair costs a
 * single file. At rest the image is transparent and the box is a window onto
 * the lattice behind the grid; hover or focus fades the plate in over it, and
 * nothing in the card moves. Decorative either way — the card's title says
 * what it is.
 */
const cardPic = (thumb: Thumb): TemplateResult => html`
  <div class="card-pic">
    <img
      class="l"
      src="${thumbSrc(thumb.light)}"
      alt=""
      width="518"
      height="300"
      loading="lazy"
      decoding="async"
    />
    <img
      class="d"
      src="${thumbSrc(thumb.dark)}"
      alt=""
      width="518"
      height="300"
      loading="lazy"
      decoding="async"
    />
  </div>
`;

/**
 * A cover card. The card is a CONTAINER, not a link: the title carries the one
 * primary `uiSref` and stretches over the whole card through a `::after`
 * (the Inclusive Components card pattern), so the key block's own filter links
 * are valid interactive content rather than links nested inside a link. Tab
 * order is title, then keys. The text lives in `.card-body`, which carries the
 * card's paper: the card itself is transparent, so its window is a hole.
 */
const sheetCard = (sheet: SheetRow): TemplateResult => html`
  <article class="card">
    ${cardPic(sheet.thumb)}
    <div class="card-body">
      <span class="n">${isAppendix(sheet.num) ? 'APPENDIX' : 'SHEET'} ${sheet.num} · REV ${sheet.rev}</span>
      <h3>
        <a
          class="card-go"
          ${uiSrefActive(ACTIVE)}
          ${uiSref('atlas.sheet', { num: sheet.num })}
          href="${to(href.sheet(sheet.num))}"
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
    <div class="card-body">
      <span class="n">${extra.shno} · REV ${extra.rev}</span>
      <h3>
        <a class="card-go" ${uiSrefActive(ACTIVE)} ${uiSref('atlas.city')} href="${to(href.city)}"
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
      <!-- THE FULL WORDMARK — the same plain uppercase name the rail head carries,
           in the display face, so the two read as one mark. The condensed variant
           with the kit catchword belongs to the sheet head above and the title
           blocks, and nowhere else. -->
      <h2 class="cover-title">THE ALTITUDE ATLAS</h2>
      <p class="sheet-sub cover-sub">
        SAME SUBJECT AT EVERY SCALE — THE FORM CHANGES BECAUSE THE TRUTH DOES
        <span class="stamp">CLIENT ${manifest.client} · PLATES COUNTED ${manifest.date}</span>
      </p>
      <div class="hero">
        <!-- The key image: sheet 7's city, drawn at build time. three.js loads on /city and nowhere else. -->
        ${city
          ? html`
              <a class="hero-plate" ${uiSref('atlas.city')} href="${to(href.city)}">
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
            <a ${uiSref('atlas.log')} href="${to(href.log)}"
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
            <!-- KEYED. A filter changes the list, and an unkeyed map re-uses a
                 card's DOM for a different plate — which leaves each key slot's
                 uiSrefActive holding the target it first saw, so the filter echo
                 goes stale. A key per plate gives the new row its own parts. -->
            ${repeat(
              shownAscent,
              (entry) => entry.row.id,
              (entry) =>
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
              ${repeat(shownAppendix, (row) => row.id, sheetCard)}
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
          (num) =>
            html`<a ${uiSref('atlas.sheet', { num })} href="${to(href.sheet(num))}">${num}</a
              >&nbsp;`,
        )}</span
      >`
    : nothing;

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
        ? html`<a ${uiSref('atlas.sheet', { num: prev.num })} href="${to(href.sheet(prev.num))}"
            >PREV · ${prev.num}</a
          >`
        : nothing}
      ${next
        ? html`<a ${uiSref('atlas.sheet', { num: next.num })} href="${to(href.sheet(next.num))}"
            >NEXT · ${next.num}</a
          >`
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
        <h3>THE ISSUE LOG</h3>
        <p>
          Every REV across every plate — the set's own revision record, latest first —
          is at
          <a ${uiSref('atlas.log')} href="${to(href.log)}"><code>${href.log}</code></a>.
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
          (the isometric city, imported only by <code>atlas.city</code>). All from npm;
          no workspace links.
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
