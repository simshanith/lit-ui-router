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
import type { ExtraRow, Manifest, SheetRow } from './src/manifest.ts';
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

const router = createServerRouter({
  mounts: mountsFor(manifest.sheets.map((sheet) => sheet.num)),
});

// --- the server templates --------------------------------------------------
// Deliberately NOT src/views.ts: those carry uiSref/uiSrefActive, which are
// element-part directives, and @lit-labs/ssr emits no element parts at all
// (repo issue #564). The markup below is the same shape with plain hrefs —
// which is also what a crawler and a no-JS reader need. The hrefs themselves
// come from src/routes.ts, so only the markup is written twice.

const railTemplate = (active: string): TemplateResult => html`
  <nav class="rail" aria-label="drawing set">
    <div class="rail-head">
      <span class="kicker">A DRAWING SET · lit-ui-router</span>
      <h1><a href="${href.gallery}">THE ALTITUDE ATLAS</a></h1>
    </div>
    <div class="rail-top">
      <a class="${active === 'gallery' ? 'is-active' : ''}" href="${href.gallery}">INDEX</a>
      <a class="${active === 'about' ? 'is-active' : ''}" href="${href.about}">ABOUT</a>
      <a class="rail-out" href="${href.set}">THE FLAT SET ↗</a>
    </div>
    <p class="rail-sec">SHEETS — ASCENT ORDER</p>
    <div class="rail-links">
      ${manifest.sheets.map(
        (row) => html`
          <a class="${active === row.num ? 'is-active' : ''}" href="${href.sheet(row.num)}">
            <span class="n">${row.num}</span><span class="t">${row.title}</span>
          </a>
        `,
      )}
      <a class="${active === 'city' ? 'is-active' : ''}" href="${href.city}">
        <span class="n">S7·3D</span><span class="t">THE CITY — IN THE ROUND</span>
      </a>
      <a class="${active === 'specimen' ? 'is-active' : ''}" href="${href.specimen}">
        <span class="n">S0·T</span><span class="t">THE TYPE SPECIMEN — FIVE PAIRINGS</span>
      </a>
    </div>
  </nav>
`;

const page = (active: string, content: TemplateResult): TemplateResult => html`
  ${unsafeHTML(`<style>${manifest.cover.css}</style>`)}
  <div class="app">${railTemplate(active)}<main class="content">${content}</main></div>
`;

const galleryContent = (): TemplateResult => html`
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
      (row) => html`
        <a class="card" href="${href.sheet(row.num)}">
          <span class="n">SHEET ${row.num} · REV ${row.rev}</span>
          <h3>${row.title}</h3>
          <span class="alt">${row.scale}</span>
          <p>${row.caption}</p>
          <p class="verdict">${row.verdict}</p>
        </a>
      `,
    )}
    ${manifest.extras.map(
      (extra) => html`
        <a class="card" href="${href.city}">
          <span class="n">${extra.shno} · REV ${extra.rev}</span>
          <h3>${extra.title}</h3>
          <span class="alt">${extra.scale}</span>
          <p>${extra.sub}</p>
          <p class="verdict">${extra.verdict}</p>
        </a>
      `,
    )}
  </div>
`;

// The plate itself, server-rendered: the generated fragment is read off disk
// and emitted verbatim. Its <script> tags stay inert until the client runs
// them (see src/fragment.ts), which is exactly the static-page behaviour.
const sheetContent = (row: SheetRow): TemplateResult => {
  const fragment = readFileSync(join(PUBLIC, row.file), 'utf8');
  const index = manifest.sheets.findIndex((other) => other.id === row.id);
  const prev = manifest.sheets[index - 1];
  const next = manifest.sheets[index + 1];
  return html`
    <div class="crumb">
      <a href="${href.gallery}">← INDEX</a>
      ${prev ? html`<a href="${href.sheet(prev.num)}">PREV · ${prev.num}</a>` : nothing}
      ${next ? html`<a href="${href.sheet(next.num)}">NEXT · ${next.num}</a>` : nothing}
      <a href="${href.plate(row.standalone)}">STANDALONE PLATE ↗</a>
      <span>ALTITUDE · ${row.scale}</span>
    </div>
    <atlas-plate>${unsafeHTML(fragment)}</atlas-plate>
  `;
};

// The 3D plate, server-rendered like a sheet: the same fragment, inert until
// the client hands it a bundled three. The shell is honest with no JS at all —
// legend, reading panel and basis note are markup; only the canvas is missing.
const cityContent = (extra: ExtraRow): TemplateResult => {
  const fragment = readFileSync(join(PUBLIC, extra.file), 'utf8');
  return html`
    <div class="crumb">
      <a href="${href.gallery}">← INDEX</a>
      <a href="${href.plate(extra.standalone)}">STANDALONE PLATE ↗</a>
      <span>ALTITUDE · ${extra.scale}</span>
    </div>
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
  <div class="crumb">
    <a href="${href.gallery}">← INDEX</a>
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
      FIVE PAIRINGS ON ONE MOCK SHEET · SITE FACES COME FROM ADOBE FONTS WHEN THE KIT
      IS PRESENT, GOOGLE STAND-INS OTHERWISE · THE READOUTS SAY WHICH ONE ACTUALLY
      RENDERED AND HOW ITS GLYPHS MEASURE AGAINST TODAY'S MONO
    </p>
    <atlas-specimen></atlas-specimen>
  </section>
`;

const proseContent = (title: string, line: string): TemplateResult => html`
  <section class="sheet">
    <div class="sheet-head">
      <span class="proj">THE ALTITUDE ATLAS — DRAWING SET</span>
      <span class="shno">${title}</span>
    </div>
    <h2 class="sheet-title">${title}</h2>
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
      ${unsafeHTML(manifest.cover.provenance)}
    `,
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
  ...manifest.sheets
    .filter((row) => row.id !== row.num)
    .map((row) => verdictOnly(href.sheet(row.id))),
  ...manifest.sheets.map((row) => ({
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
