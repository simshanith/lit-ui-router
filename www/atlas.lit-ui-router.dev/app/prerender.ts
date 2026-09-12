/**
 * Build-time prerender: `ui-router-server` decides, `@lit-labs/ssr` draws.
 *
 * Run after `vite build` (npm run build does both). For every route the
 * client can reach, the mount table in src/routes.ts is asked for a verdict:
 *
 *   shell     → write dist/<subpath>/index.html with server-rendered content
 *   redirect  → a line in dist/_redirects (Cloudflare Pages), no page
 *   notFound  → dist/404.html, written once from the otherwise projection
 *
 * The verdicts come out of the same compiled mounts the Vite dev/preview
 * server uses, so a route that 302s in development 302s on the deployed site.
 *
 * Two things this file is honest about, both written up in SSR-VERDICT.md:
 * `ui-router-server` renders nothing (it is a verdict engine — rendering is
 * an explicitly separate roadmap axis), and the client's own templates cannot
 * be the ones rendered here, because `uiSref`/`uiSrefActive` are element-part
 * directives that @lit-labs/ssr does not emit.
 */
import '@lit-labs/ssr/lib/install-global-dom-shim.js';

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render as ssrRender } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { createServerRouter } from 'ui-router-server';
import type { Verdict } from 'ui-router-server';
import type {
  AscentRow,
  ExtraRow,
  IssueEntry,
  LabelKey,
  Manifest,
  SheetLabels,
  SheetRow,
  Thumb,
} from './src/manifest.ts';
import {
  ARTICLE,
  EMPTY_FILTER,
  LABEL_KEYS,
  allSheets,
  ascent,
  entryTitle,
  facet,
  filterQuery,
  findExtra,
  isAppendix,
  kvVocabulary,
  labelledRows,
  thumbSrc,
} from './src/manifest.ts';
import { ICON_SPRITE, iconId } from './src/icons.ts';
import { BASE, MOUNT, href, mountsFor } from './src/routes.ts';
import { TITLES, sheetTitle } from './src/titles.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, 'dist');
const PUBLIC = join(HERE, 'public');

const manifest: Manifest = JSON.parse(
  readFileSync(join(PUBLIC, 'manifest.json'), 'utf8'),
) as Manifest;

const shellHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
const ROOT_RE = /(<div id="root">)(\s*)(<\/div>)/;
if (!ROOT_RE.test(shellHtml))
  throw new Error('prerender: dist/index.html has no empty <div id="root">');

// BOTH lists narrow the `/sheet/{num:...}` alternation: the appendix is out of
// the ascent, but /sheet/A1 is as real a url as /sheet/13.
const PLATES = allSheets(manifest);

/**
 * THE ARTICLE (T9, shipped 2026-09-06) — the twin of `articleTitle` in
 * src/views.ts and generator/chrome.mjs. Prerender and client must draw the
 * same markup, so the three stay in lockstep.
 */
const THE: TemplateResult = html`<sup class="art">the&nbsp;</sup>`;

/** The CONDENSED wordmark, for sheet heads and title blocks: twin of views.ts. */
const PROJECT_MARK: TemplateResult = html`<span class="cw">${THE}</span><span class="project-mark">ALTITUDE ATLAS</span>`;

const articleTitle = (title: string): TemplateResult =>
  ARTICLE.test(title) ? html`${THE}${entryTitle(title)}` : html`${title}`;

const router = createServerRouter({
  mounts: mountsFor(PLATES.map((sheet) => sheet.num)),
});

// --- the server templates --------------------------------------------------
// Deliberately NOT src/views.ts: those carry uiSref/uiSrefActive, which are
// element-part directives, and @lit-labs/ssr emits no element parts at all
// (repo issue #564). The markup below is the same shape with plain hrefs —
// which is also what a crawler and a no-JS reader need. The hrefs themselves
// come from src/routes.ts, so only the markup is written twice.

const DOCS = 'https://lit-ui-router.dev';
const GITHUB = 'https://github.com/simshanith/lit-ui-router';

const sheetEntry = (row: SheetRow, active: string): TemplateResult => html`
  <a class="${active === row.num ? 'is-active' : ''}" href="${href.sheet(row.num)}">
    <span class="n">${row.num}</span><span class="t">${entryTitle(row.title)}</span>
  </a>
`;

// The city sits right after 7B — it is sheet 7's third plate — exactly as views.ts files it.
const railEntry = (entry: AscentRow, active: string): TemplateResult =>
  entry.kind === 'sheet'
    ? sheetEntry(entry.row, active)
    : html`
        <a class="${active === 'city' ? 'is-active' : ''}" href="${href.city}">
          <span class="n">7·3D</span><span class="t">${entryTitle(entry.row.title)}</span>
        </a>
      `;

const railTemplate = (active: string): TemplateResult => html`
  <nav class="rail" aria-label="drawing set">
    <input type="checkbox" id="rail-open" class="rail-open" aria-label="show the sheets" />
    <div class="rail-head">
      <div>
        <a class="kicker" href="https://lit-ui-router.dev">A DRAWING SET · lit-ui-router</a>
        <h1><a href="${href.gallery}">THE ALTITUDE ATLAS</a></h1>
      </div>
      <label class="rail-toggle" for="rail-open">SHEETS ▾</label>
    </div>
    <div class="rail-body">
      <div class="rail-top">
        <a class="${active === 'gallery' ? 'is-active' : ''}" href="${href.gallery}">INDEX</a>
        <a class="${active === 'about' ? 'is-active' : ''}" href="${href.about}">ABOUT</a>
      </div>
      <p class="rail-sec">SHEETS — ASCENT ORDER</p>
      <div class="rail-links">${ascent(manifest).map((entry) => railEntry(entry, active))}</div>
      ${manifest.appendix.length > 0
        ? html`
            <p class="rail-sec">APPENDIX — ABOUT THE ATLAS</p>
            <div class="rail-links">${manifest.appendix.map((row) => sheetEntry(row, active))}</div>
          `
        : nothing}
    </div>
  </nav>
`;

// The utility bar, the same shape views.ts draws: the themer is inert markup
// here; the client replaces the shell before anyone can press it.
const utilBar = (crumb: TemplateResult): TemplateResult => html`
  <div class="util">
    <div class="crumb">${crumb}</div>
    <nav class="util-links" aria-label="utilities">
      <a class="util-log" href="${href.log}">LOG</a>
      <a class="util-docs" href="${DOCS}" target="_blank" rel="noopener">DOCS ↗</a>
      <a class="util-github" href="${GITHUB}" target="_blank" rel="noopener">GITHUB ↗</a>
      <a class="util-set" href="${href.set}">THE FLAT SET ↗</a>
      <div class="themer" role="group" aria-label="colour scheme">
        <button type="button" aria-pressed="true">AUTO</button
        ><button type="button" aria-pressed="false">VELLUM</button
        ><button type="button" aria-pressed="false">CYANO</button>
      </div>
    </nav>
  </div>
`;

const indexCrumb = (): TemplateResult => html`<a href="${href.gallery}">← INDEX</a>`;

const page = (active: string, content: TemplateResult): TemplateResult => html`
  ${unsafeHTML(`<style>${manifest.cover.css}</style>`)}
  ${unsafeHTML(ICON_SPRITE)}
  <div class="app">${railTemplate(active)}<main class="content">${content}</main></div>
`;

const logLink = (entry: IssueEntry): TemplateResult =>
  entry.num === 'city'
    ? html`<a class="s" href="${href.city}">${entry.head} · REV ${entry.rev}</a>`
    : html`<a class="s" href="${href.sheet(entry.num)}">${entry.head} · REV ${entry.rev}</a>`;

const logEntry = (entry: IssueEntry): TemplateResult => html`
  <li>
    <span class="d">${entry.date || '—'}</span>${logLink(entry)}<span class="t">${entry.desc}</span>
  </li>
`;

// The key index, prerendered in its OPEN state: `/` is the unfiltered page, so
// every chip here is a plain link to a filtered url and the kv box is a GET
// form onto the same page. A reader with no JS at all still gets the index and
// a shareable filter url; the client takes it over on hydration.
/**
 * THE KEY ROW, static twin (`keyBlock` in src/views.ts). Same cells, same
 * classes, same symbols, plain hrefs — element-part directives do not SSR,
 * and the prerendered page is the unfiltered index, so no cell is lit.
 */
const icon = (key: LabelKey, value: string): TemplateResult | typeof nothing => {
  const id = iconId(key, value);
  return id ? html`<svg class="gl" aria-hidden="true"><use href="#${id}"></use></svg>` : nothing;
};

const keyCell = (key: LabelKey, value: string | undefined): TemplateResult | typeof nothing => {
  if (!value) return nothing;
  return html`<a
    class="kr-cell kr-${key}"
    aria-label="${key} ${value}"
    title="${key} ${value}"
    href="${href.gallery}${filterQuery({ ...EMPTY_FILTER, [key]: value })}"
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

const ROWS = labelledRows(manifest);

const staticKeyRow = (key: LabelKey, extraClass = ''): TemplateResult => html`
  <div class="krow ${extraClass}">
    <span class="kk">${key}</span>
    <div class="kchips">
      <a class="kv is-on" href="${href.gallery}"><i>all</i><span class="c">${ROWS.length}</span></a>
      ${facet(ROWS, key, EMPTY_FILTER).map(
        (entry) => html`
          <a class="kv" href="${href.gallery}${filterQuery({ ...EMPTY_FILTER, [key]: entry.value })}"
            >${icon(key, entry.value)}<i>${entry.value}</i
            ><span class="c">${entry.count}</span></a
          >
        `,
      )}
    </div>
  </div>
`;

const keyIndex = (): TemplateResult => html`
  <div class="keyindex" aria-label="key index">
    <div class="khead">
      <span class="kt">KEY INDEX — FORM, SPLIT</span>
      <span class="kn">${ROWS.length} / ${ROWS.length} SHOWN</span>
    </div>
    ${staticKeyRow('mode')} ${staticKeyRow('subject')} ${staticKeyRow('projection')}
    <form class="kvbox" action="${href.gallery}" method="get">
      <label for="kv-query">key = value</label>
      <input
        id="kv-query"
        name="kv"
        list="kv-vocab"
        autocomplete="off"
        spellcheck="false"
        placeholder="subject=city projection=isometric"
      />
      <datalist id="kv-vocab">
        ${kvVocabulary(ROWS).map((entry) => html`<option value="${entry}"></option>`)}
      </datalist>
      <button type="submit">FILTER</button>
    </form>
  </div>
`;

/** Twin of `cardPic` in src/views.ts — T16's picture of the plate. */
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

const sheetCard = (row: SheetRow): TemplateResult => html`
  <article class="card">
    ${cardPic(row.thumb)}
    <div class="card-body">
      <span class="n">${isAppendix(row.num) ? 'APPENDIX' : 'SHEET'} ${row.num} · REV ${row.rev}</span>
      <h3><a class="card-go" href="${href.sheet(row.num)}">${articleTitle(row.title)}</a></h3>
      <span class="alt">${row.scale}</span>
      <p>${unsafeHTML(row.caption)}</p>
      <span class="meta">
        ${isAppendix(row.num)
          ? `${row.form} · NO CENSUS PLATE — META`
          : `${row.form} · ${String(row.plates.length)} PLATE${row.plates.length === 1 ? '' : 'S'}`}
      </span>
      ${keyBlock(row.labels)}
    </div>
  </article>
`;

const cityCard = (extra: ExtraRow): TemplateResult => html`
  <article class="card">
    <div class="card-pic card-pic-svg">${unsafeHTML(manifest.cover.hero)}</div>
    <div class="card-body">
      <span class="n">${extra.shno} · REV ${extra.rev}</span>
      <h3><a class="card-go" href="${href.city}">${articleTitle(extra.title)}</a></h3>
      <span class="alt">${extra.scale}</span>
      <p>${extra.sub.split(' · REV ')[0]}</p>
      <span class="meta">3D · WEBGL · LOADED ON DEMAND</span>
      ${keyBlock(extra.labels)}
    </div>
  </article>
`;

const galleryContent = (): TemplateResult => {
  const city = findExtra(manifest, 'city');
  // ONE line of issue record on the title sheet; the log itself is /log.
  const latest = (manifest.issueLog ?? []).find((entry) => entry.date);
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
      <h2 class="cover-title">THE ALTITUDE ATLAS</h2>
      <p class="sheet-sub cover-sub">
        SAME SUBJECT AT EVERY SCALE — THE FORM CHANGES BECAUSE THE TRUTH DOES
        <span class="stamp">CLIENT ${manifest.client} · PLATES COUNTED ${manifest.date}</span>
      </p>
      <div class="hero">
        ${city
          ? html`
              <a class="hero-plate" href="${href.city}">
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
            <a href="${href.log}"
              ><span class="k">LATEST</span><span class="d">${latest.date}</span
              ><span class="s">${latest.head} · REV ${latest.rev}</span
              ><span class="t">${latest.desc}</span><span class="go">ISSUE LOG ↗</span></a
            >
          </p>`
        : nothing}
    </section>
    <h2 class="set-sec">SHEET INDEX — ASCENT ORDER</h2>
    ${keyIndex()}
    <div class="cards">
      ${ascent(manifest).map((entry) =>
        entry.kind === 'sheet' ? sheetCard(entry.row) : cityCard(entry.row),
      )}
    </div>
    ${manifest.appendix.length > 0
      ? html`
          <h2 class="set-sec">APPENDIX — PLATES ABOUT THE ATLAS, NOT THE CODEBASE</h2>
          <div class="cards">${manifest.appendix.map(sheetCard)}</div>
        `
      : nothing}
    <div class="cover-band">
      ${unsafeHTML(manifest.cover.statBar)}
      <div class="cover-wide">
        ${unsafeHTML(manifest.cover.survey)} ${unsafeHTML(manifest.cover.prose)}
      </div>
    </div>
  `;
};

// The issue log's own page — the twin of views.ts's LogView.
const logContent = (): TemplateResult => {
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
        EVERY REV ACROSS EVERY PLATE, LATEST FIRST — THE SET'S OWN REVISION RECORD ·
        EACH SHEET'S REVISIONS TABLE READS THE OTHER WAY, ASCENDING, AS A DRAWING'S REV
        BLOCK DOES
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

const seeAlso = (refs: string[]): TemplateResult | typeof nothing =>
  refs.length > 0
    ? html`<span
        >SEE ALSO
        ${refs.map((num) => html`<a href="${href.sheet(num)}">${num}</a>&nbsp;`)}</span
      >`
    : nothing;

const verdictLine = (verdict: string): TemplateResult | typeof nothing =>
  verdict
    ? html`<p class="plate-verdict"><span class="lead">FIT VERDICT</span>${verdict}</p>`
    : nothing;

// The plate itself, server-rendered: the generated fragment is read off disk
// and emitted verbatim. Its <script> tags stay inert until the client runs
// them (see src/fragment.ts), which is exactly the static-page behaviour.
const sheetContent = (row: SheetRow): TemplateResult => {
  const fragment = readFileSync(join(PUBLIC, row.file), 'utf8');
  // The walk stays inside the row's own list: A1 is not sheet 14's "next".
  const list = isAppendix(row.num) ? manifest.appendix : manifest.sheets;
  const index = list.findIndex((other) => other.id === row.id);
  const prev = list[index - 1];
  const next = list[index + 1];
  return html`
    ${utilBar(html`
      ${indexCrumb()}
      <span class="sh"
        >${isAppendix(row.num) ? `APPENDIX ${row.num}` : `SHEET ${row.num} OF ${String(manifest.total)}`}</span
      >
      ${prev ? html`<a href="${href.sheet(prev.num)}">PREV · ${prev.num}</a>` : nothing}
      ${next ? html`<a href="${href.sheet(next.num)}">NEXT · ${next.num}</a>` : nothing}
      <a href="${href.plate(row.standalone)}">STANDALONE PLATE ↗</a>
    `)}
    <div class="plate-data">
      <span>ALTITUDE · ${row.scale}</span>
      <span
        >PLATES READ:
        ${row.plates.length > 0 ? row.plates.join(' · ') : 'NONE — DRAWN FROM PROSE'}</span
      >
      ${seeAlso(row.refs)} ${keyBlock(row.labels)}
    </div>
    ${verdictLine(row.verdict)}
    <atlas-plate>${unsafeHTML(fragment)}</atlas-plate>
  `;
};

// The 3D plate, server-rendered like a sheet: the same fragment, inert until
// the client hands it a bundled three. The shell is honest with no JS at all —
// legend, reading panel and basis note are markup; only the canvas is missing.
const cityContent = (extra: ExtraRow): TemplateResult => {
  const fragment = readFileSync(join(PUBLIC, extra.file), 'utf8');
  return html`
    ${utilBar(html`
      ${indexCrumb()}
      <span class="sh">${extra.shno}</span>
      <a href="${href.plate(extra.standalone)}">STANDALONE PLATE ↗</a>
    `)}
    <div class="plate-data">
      <span>ALTITUDE · ${extra.scale}</span>
      ${seeAlso(extra.refs)} ${keyBlock(extra.labels)}
    </div>
    ${verdictLine(extra.verdict)}
    <atlas-city>${unsafeHTML(fragment)}</atlas-city>
  `;
};

/**
 * The type specimen, server-rendered as far as it honestly goes: the sheet
 * head, the title and the standfirst are markup; the bench itself is an empty
 * <atlas-specimen> the client fills. Nothing more is possible — the pairings,
 * the two readouts and the webfont <link> are all measurements of a LIVE
 * document — and `generator/stage-site.mjs` puts the Adobe Fonts kit's
 * stylesheet into this page and no other.
 */
const specimenContent = (): TemplateResult => html`
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
      FIVE PAIRINGS ON ONE MOCK SHEET · SITE FACES COME FROM ADOBE FONTS WHEN THE KIT
      IS PRESENT, GOOGLE STAND-INS OTHERWISE · THE READOUTS SAY WHICH ONE ACTUALLY
      RENDERED AND HOW ITS GLYPHS MEASURE AGAINST TODAY'S MONO
    </p>
    <atlas-specimen></atlas-specimen>
  </section>
`;

const proseContent = (title: string, line: string): TemplateResult => html`
  ${utilBar(html`${indexCrumb()}<span class="sh">${title}</span>`)}
  <section class="sheet">
    <div class="sheet-head">
      <span class="proj">${PROJECT_MARK} — DRAWING SET</span>
      <span class="shno">${title}</span>
    </div>
    <h2 class="sheet-title">${articleTitle(title)}</h2>
    <p class="sheet-sub">${line}</p>
  </section>
`;

const renderToString = (template: TemplateResult): string =>
  collectResultSync(ssrRender(template));

const writeFile = (file: string, body: string, title: string): void => {
  mkdirSync(dirname(file), { recursive: true });
  const titled = shellHtml.replace(
    /<title>[^<]*<\/title>/,
    `<title>${title}</title>`,
  );
  writeFileSync(file, titled.replace(ROOT_RE, `$1${body}$3`));
};

/** A route path becomes `<subpath>/index.html`, so every url keeps its slash. */
const write = (subpath: string, body: string, title: string): void => {
  writeFile(
    subpath === '/' ? join(DIST, 'index.html') : join(DIST, subpath, 'index.html'),
    body,
    title,
  );
};

// --- the probes: what does @lit-labs/ssr actually do with the client half? --
// Recorded on every build rather than assumed; SSR-VERDICT.md quotes these.
//
// NOTE the dynamic import. `lit-ui-router` must be loaded AFTER the DOM shim
// has finished installing: a static `import ... from 'lit-ui-router'` in this
// module leaves <ui-view>/<ui-router> unregistered, and they then render as
// inert unknown elements with no error at all.
const attempt = (name: string, fn: () => string): string => {
  try {
    return `${name}: ${fn().replace(/\s+/g, ' ')}`;
  } catch (error) {
    return `${name}: THREW ${(error as Error).name}: ${(error as Error).message}`;
  }
};

async function probeClientTemplates(): Promise<string[]> {
  const { uiSref, uiSrefActive } = await import('lit-ui-router');
  const views = await import('./src/views.ts');
  return [
    attempt('uiSref on a bare anchor', () =>
      renderToString(html`<a ${uiSref('atlas.gallery')}>INDEX</a>`),
    ),
    attempt('uiSrefActive + uiSref', () =>
      renderToString(
        html`<a ${uiSrefActive({ activeClasses: ['is-active'] })} ${uiSref('atlas.gallery')}
          >INDEX</a
        >`,
      ),
    ),
    attempt('the client ShellView (rail + nested ui-view)', () =>
      renderToString(
        (views.ShellView as (props: unknown) => TemplateResult)({
          resolves: { manifest },
        }),
      ),
    ),
  ];
}

// --- drive it off the verdicts --------------------------------------------

interface Job {
  path: string;
  title: string;
  content: () => TemplateResult;
  active: string;
}

const verdictOnly = (path: string): Job => ({
  path,
  title: '',
  active: '',
  content: galleryContent,
});

const jobs: Job[] = [
  {
    path: href.gallery,
    title: TITLES.gallery,
    active: 'gallery',
    content: galleryContent,
  },
  {
    path: href.about,
    title: TITLES.about,
    active: 'about',
    content: () => html`
      ${proseContent(
        'COLOPHON',
        'THE SET, ROUTED — lit-ui-router, ui-router-server, and one generated manifest',
      )}
      <!-- the reading column, as the client view sets it: SOURCES is its footnote -->
      <div class="prose">${unsafeHTML(manifest.cover.provenance)}</div>
    `,
  },
  {
    path: href.log,
    title: TITLES.log,
    active: 'log',
    content: logContent,
  },
  ...manifest.extras.map((extra) => ({
    path: href.city,
    title: TITLES.city,
    active: 'city',
    content: () => cityContent(extra),
  })),
  {
    path: href.specimen,
    title: TITLES.specimen,
    active: 'specimen',
    content: specimenContent,
  },
  // Verdict-only: /office is a redirect, a bare mount (when the mount is not
  // the root) redirects to the gallery, and a lowercase sheet id redirects
  // to its cased page. None gets a page; each gets a _redirects line.
  verdictOnly(`${BASE}office`),
  ...(MOUNT === BASE ? [] : [verdictOnly(MOUNT)]),
  ...PLATES
    .filter((row) => row.id !== row.num)
    .map((row) => verdictOnly(href.sheet(row.id))),
  ...PLATES.map((row) => ({
    path: href.sheet(row.num),
    title: sheetTitle(row),
    active: row.num,
    content: () => sheetContent(row),
  })),
];

// The megacanvas was retired from the app on 2026-09-05; the flat set still
// publishes the page, so both spellings of the old url are sent to it.
const redirects: string[] = [
  `${BASE}megacanvas ${href.plate('megacanvas.html')} 301`,
  `${BASE}megacanvas/ ${href.plate('megacanvas.html')} 301`,
];
const tally = { shell: 0, redirect: 0, notFound: 0 };

for (const job of jobs) {
  const verdict: Verdict = await router.resolve(job.path);
  if (verdict.kind === 'redirect') {
    tally.redirect += 1;
    redirects.push(`${job.path} ${verdict.location} ${String(verdict.status)}`);
    continue;
  }
  if (verdict.kind === 'notFound') {
    tally.notFound += 1;
    console.warn(`prerender: no route for ${job.path}`);
    continue;
  }
  tally.shell += 1;
  const subpath = job.path === BASE ? '/' : job.path.slice(BASE.length);
  write(subpath, renderToString(page(job.active, job.content())), job.title);
}

// The otherwise projection, as a page: Cloudflare Pages serves 404.html with
// a 404 status, which is the same verdict the mount gives an unknown path.
const missing: Verdict = await router.resolve(`${BASE}sheet/does-not-exist`);
writeFile(
  join(DIST, '404.html'),
  renderToString(
    page(
      '',
      proseContent(
        'NOT IN THE SET',
        'NO PLATE IS FILED UNDER THAT NUMBER — THE URL IS KEPT, WHICH IS WHAT A ' +
          'URL-LESS otherwise STATE MEANS',
      ),
    ),
  ),
  TITLES.notFound,
);

// No SPA catch-all: every route the mount claims has its own file, and
// anything else must reach 404.html with a real 404 status. stage-site.mjs
// appends the site-level rules (the flat set's old filenames, /app/*).
writeFileSync(join(DIST, '_redirects'), `${redirects.join('\n')}\n`);

console.log(
  `prerendered ${String(tally.shell)} pages + 404.html · ` +
    `${String(redirects.length)} redirects → _redirects · ` +
    `unknown-path verdict: ${missing.kind}` +
    ('status' in missing && missing.status ? ` ${String(missing.status)}` : ''),
);
for (const line of await probeClientTemplates()) console.log(`ssr probe · ${line}`);
