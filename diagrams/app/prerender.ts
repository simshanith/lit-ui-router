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
import type { Manifest, SheetRow } from './src/manifest.ts';
import { MOUNT, mountsFor } from './src/routes.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, 'dist');
const PUBLIC = join(HERE, 'public');
const BASE = `${MOUNT}/`;

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
// which is also what a crawler and a no-JS reader need.

const sheetHref = (row: SheetRow): string => `${BASE}sheet/${row.num}`;

const railTemplate = (active: string): TemplateResult => html`
  <nav class="rail" aria-label="drawing set">
    <div class="rail-head">
      <span class="kicker">A DRAWING SET · lit-ui-router</span>
      <h1><a href="${BASE}">THE ALTITUDE ATLAS</a></h1>
    </div>
    <div class="rail-top">
      <a class="${active === 'gallery' ? 'is-active' : ''}" href="${BASE}">INDEX</a>
      <a class="${active === 'megacanvas' ? 'is-active' : ''}" href="${BASE}megacanvas"
        >MEGACANVAS</a
      >
      <a class="${active === 'about' ? 'is-active' : ''}" href="${BASE}about">ABOUT</a>
    </div>
    <p class="rail-sec">SHEETS — ASCENT ORDER</p>
    <div class="rail-links">
      ${manifest.sheets.map(
        (row) => html`
          <a class="${active === row.num ? 'is-active' : ''}" href="${sheetHref(row)}">
            <span class="n">${row.num}</span><span class="t">${row.title}</span>
          </a>
        `,
      )}
    </div>
  </nav>
`;

const page = (active: string, content: TemplateResult): TemplateResult => html`
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
  </section>
  <div class="cards">
    ${manifest.sheets.map(
      (row) => html`
        <a class="card" href="${sheetHref(row)}">
          <span class="n">SHEET ${row.num} · REV ${row.rev}</span>
          <h3>${row.title}</h3>
          <p>${row.caption}</p>
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
      <a href="${BASE}">← INDEX</a>
      ${prev ? html`<a href="${sheetHref(prev)}">PREV · ${prev.num}</a>` : nothing}
      ${next ? html`<a href="${sheetHref(next)}">NEXT · ${next.num}</a>` : nothing}
    </div>
    <atlas-plate>${unsafeHTML(fragment)}</atlas-plate>
  `;
};

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

const jobs: Job[] = [
  {
    path: `${BASE}`,
    title: 'The Altitude Atlas — Drawing Set',
    active: 'gallery',
    content: galleryContent,
  },
  {
    path: `${BASE}about`,
    title: 'About — The Altitude Atlas',
    active: 'about',
    content: () =>
      proseContent(
        'COLOPHON',
        'THE SET, ROUTED — lit-ui-router, ui-router-server, and one generated manifest',
      ),
  },
  {
    path: `${BASE}megacanvas`,
    title: 'The Megacanvas — The Altitude Atlas',
    active: 'megacanvas',
    content: () =>
      proseContent(
        'THE MEGACANVAS',
        'THE WHOLE SET ON ONE SURFACE — ASSEMBLED IN THE BROWSER FROM ' +
          `${String(manifest.sheets.length)} FRAGMENTS`,
      ),
  },
  // Verdict-only: /app/office is a redirect, and /app (no slash) a redirect
  // to the gallery. Neither gets a page; both get a _redirects line.
  { path: `${BASE}office`, title: '', active: '', content: galleryContent },
  { path: MOUNT, title: '', active: '', content: galleryContent },
  ...manifest.sheets.map((row) => ({
    path: sheetHref(row),
    title: `${row.title} — Sheet ${row.num} · The Altitude Atlas`,
    active: row.num,
    content: () => sheetContent(row),
  })),
];

const redirects: string[] = [];
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
  'Not in the set — The Altitude Atlas',
);

// SPA fallback for anything the prerender did not write a file for.
// No SPA catch-all: every route the mount claims has its own file, and
// anything else must reach 404.html with a real 404 status.
writeFileSync(join(DIST, '_redirects'), `${redirects.join('\n')}\n`);

console.log(
  `prerendered ${String(tally.shell)} pages + 404.html · ` +
    `${String(tally.redirect)} redirects → _redirects · ` +
    `unknown-path verdict: ${missing.kind}` +
    ('status' in missing && missing.status ? ` ${String(missing.status)}` : ''),
);
for (const line of await probeClientTemplates()) console.log(`ssr probe · ${line}`);
