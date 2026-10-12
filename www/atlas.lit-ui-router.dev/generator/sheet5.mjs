import { defs } from './chrome.mjs';
import { txt, lines, box, keyRow, link } from './helpers.mjs';

const P = 's5';

// the homes the notes and the plate name: each router's docs, the platform's primitives at their standards, the ui-router site, the two server-side guides
const HOME = {
  tanstack: 'https://tanstack.com/router',
  sveltekit: 'https://svelte.dev/docs/kit/routing',
  next: 'https://nextjs.org/docs/app',
  reactrouter: 'https://reactrouter.com/',
  angular: 'https://angular.dev/guide/routing',
  vue: 'https://router.vuejs.org/',
  wouter: 'https://github.com/molefrog/wouter',
  hono: 'https://hono.dev/',
  nodehttp: 'https://nodejs.org/api/http.html',
  fetch: 'https://min-common-api.proposal.wintertc.org/',
  urlpattern: 'https://urlpattern.spec.whatwg.org/',
  navigation: 'https://html.spec.whatwg.org/multipage/nav-history-apis.html#navigation-api',
  uirouter: 'https://ui-router.github.io/',
  lit: 'https://lit-ui-router.dev/',
  server: 'https://lit-ui-router.dev/packages/server',
  ssr: 'https://lit-ui-router.dev/packages/ssr',
  compare: 'https://lit-ui-router.dev/packages/ssr#how-this-compares',
};

// every member's name lettering links to its home; a member with no home is a build error
const MEMBER_HOME = {
  'SvelteKit': HOME.sveltekit,
  'Next App Router': HOME.next,
  'React Router v7': HOME.reactrouter,
  'Angular Router': HOME.angular,
  'Vue Router': HOME.vue,
  'TanStack Router': HOME.tanstack,
  'wouter': HOME.wouter,
  'Hono / Express': HOME.hono,
  'Navigation API': HOME.navigation,
  'node:http / fetch handler': [['node:http', HOME.nodehttp], [' / ', null], ['fetch handler', HOME.fetch]],
  'lit-ui-router-ssr': HOME.ssr,
  'ui-router-server': HOME.server,
  'ui-router / lit-ui-router': HOME.lit,
};
const home = (name) => {
  if (!MEMBER_HOME[name]) throw new Error(`sheet5: ${name} has no home`);
  return MEMBER_HOME[name];
};
const lettering = (name, x, y, anchor) => {
  const h = home(name);
  if (!Array.isArray(h)) return link(h, txt(x, y, name, 'lblb', anchor));
  const spans = h.map(([s, href]) => (href ? link(href, `<tspan>${s}</tspan>`) : `<tspan>${s}</tspan>`)).join('');
  return `<text x="${x}" y="${y}" class="lblb" text-anchor="${anchor}">${spans}</text>`;
};

// Plot area
const PX = 130, PW = 870, PY = 70, PH = 440;
const bandY = { library: PY + 70, framework: PY + 220, platform: PY + 370 };
const cx = (f) => PX + f * PW;

// [xFrac, band, dy, name, note, 'c', side?] — every point here is a circle, URL-first; a pair home is one lettering, two links.
// side pins the label to one flank when the default would straddle a column line.
const points = [
  [0.10, 'framework', -26, 'SvelteKit', 'filesystem routes, compiled', 'c'],
  [0.14, 'framework', 26, 'Next App Router', 'fs routes · server-first', 'c'],
  [0.39, 'framework', 0, 'React Router v7', 'framework mode — Remix folded in', 'c'],
  [0.72, 'framework', -26, 'Angular Router', 'config tree in the injector', 'c', 'r'],
  [0.88, 'framework', 30, 'Vue Router', 'official, but installable', 'c'],
  [0.70, 'library', -34, 'TanStack Router', 'typed at build, matched in the client', 'c', 'r'],
  [0.92, 'library', 4, 'wouter', 'minimal hook', 'c'],
  [0.38, 'library', 0, 'Hono / Express', 'server-only: match, no navigation', 'c'],
  [0.36, 'platform', 0, 'node:http / fetch handler', 'a request, a URL string, no match', 'c'],
  [0.69, 'platform', 0, 'Navigation API', 'the primitive the client column builds on', 'c', 'r'],
];

// The lineage is one row of squares, one per column, on one state tree: the
// same declarations prerendered at build, answered per path on the server and
// navigated in the client. The bracket under the row is the sheet's one edge.
const LY = bandY.library + 36;
const LINEAGE = [
  [0.17, 'lit-ui-router-ssr', 'prerender · drawn to pages at build'],
  [0.50, 'ui-router-server', 'HTTP verdict per path'],
  [0.80, 'ui-router / lit-ui-router', 'navigated in the client'],
];
const lineage = `<g><title>the ui-router lineage — one named state tree, matched in every column; the URL is a projection</title>
${LINEAGE.map(([xf, name, note]) => {
  const x = cx(xf);
  return `<rect x="${x - 7}" y="${LY - 7}" width="14" height="14" class="ska fp" stroke-width="2.2"/><rect x="${x - 13}" y="${LY - 13}" width="26" height="26" rx="4" class="fhalo"/>
<line x1="${x}" y1="${LY + 7}" x2="${x}" y2="${LY + 24}" class="ska"/>
${link(home(name), txt(x + 20, LY - 1, name, 'lbla'))}
${txt(x + 20, LY + 12, note, 'lblf')}`;
}).join('\n')}
<line x1="${cx(LINEAGE[0][0])}" y1="${LY + 24}" x2="${cx(LINEAGE[2][0])}" y2="${LY + 24}" class="ska"/>
${txt(cx(0.485), LY + 36, 'ONE STATE TREE · MATCHED IN EVERY COLUMN · THE URL IS A PROJECTION', 'lbla', 'middle')}
</g>`;

const marks = points.map(([xf, band, dy, name, note, , side]) => {
  const x = cx(xf), y = bandY[band] + dy;
  const right = side ? side === 'r' : xf < 0.70;
  const lx = right ? x + 14 : x - 14;
  const anchor = right ? 'start' : 'end';
  return `<g><title>${name} — ${note}</title><circle cx="${x}" cy="${y}" r="6" class="sk fp" stroke-width="1.6"/>
${lettering(name, lx, y - 1, anchor)}
${txt(lx, y + 12, note, 'lblf', anchor)}</g>`;
}).join('\n');

const svg = `<svg viewBox="0 0 1080 640" role="img" aria-label="A positioned chart of the JavaScript router design space: horizontal axis runs from build-time to server-runtime to client-runtime route matching; vertical bands separate platform, framework, and library ownership of navigation. Ten entries are plotted as labeled circles, the platform's own primitives among them: the Navigation API at client runtime, node:http and the fetch handler at server runtime. The ui-router lineage is the one state-first entry, drawn as three squares on one row of the library band, one in each column — lit-ui-router-ssr at build time, ui-router-server at server runtime, lit-ui-router at client runtime — joined by a bracket, the sheet's only edge.">
${defs(P)}

<!-- frame + column bands -->
${box(PX, PY, PW, PH, 'sk fnone')}
<line x1="${cx(1 / 3)}" y1="${PY}" x2="${cx(1 / 3)}" y2="${PY + PH}" class="skf" stroke-dasharray="4 4"/>
<line x1="${cx(2 / 3)}" y1="${PY}" x2="${cx(2 / 3)}" y2="${PY + PH}" class="skf" stroke-dasharray="4 4"/>
${txt(cx(1 / 6), PY - 12, 'AT BUILD TIME', 'lbls', 'middle')}
${txt(cx(1 / 2), PY - 12, 'AT SERVER RUNTIME', 'lbls', 'middle')}
${txt(cx(5 / 6), PY - 12, 'AT CLIENT RUNTIME', 'lbls', 'middle')}
${txt(cx(0.5), PY - 34, 'WHERE ROUTES ARE MATCHED →', 'lblb', 'middle')}

<!-- ownership bands -->
${['library', 'framework', 'platform'].map((b, i) => {
  const yTop = PY + i * (PH / 3);
  return `${i > 0 ? `<line x1="${PX}" y1="${yTop}" x2="${PX + PW}" y2="${yTop}" class="skf"/>` : ''}
${txt(PX - 12, yTop + PH / 6 + 4, { library: 'LIBRARY', framework: 'FRAMEWORK', platform: 'PLATFORM' }[b], 'lbls', 'end')}`;
}).join('\n')}
${txt(22, PY + PH / 2, 'WHO OWNS NAVIGATION ↑', 'lblb', 'middle', `transform="rotate(-90 22 ${PY + PH / 2})"`)}

${marks}
${lineage}

<!-- the thesis callout, in the quarter no router occupies -->
<rect x="${PX + 16}" y="${PY + 2 * PH / 3 + 14}" width="236" height="100" class="skr fnone" stroke-dasharray="6 4"/>
${lines(PX + 30, PY + 2 * PH / 3 + 38, [
  'THE EMPTY QUARTER',
  'nearly every router here is URL-first:',
  'the address is the source of truth.',
  'state-first routing is one lineage —',
  'three squares, one tree, every column.',
], 'lbls', 'start', 15)}

<!-- shape legend under plot -->
${txt(PX, PY + PH + 36, 'SHAPE = SOURCE OF TRUTH', 'lbls')}
<circle cx="${PX + 12}" cy="${PY + PH + 58}" r="6" class="sk fp" stroke-width="1.6"/>
${txt(PX + 28, PY + PH + 62, 'URL-first — the view is derived from the address', 'lbl')}
<rect x="${PX + 6}" y="${PY + PH + 76}" width="12" height="12" class="ska fp" stroke-width="2"/>
${txt(PX + 28, PY + PH + 90, 'state-first — a named state tree; the URL is one projection of it', 'lbl')}
</svg>`;

export const sheet5 = {
  num: 5, id: 'runtime', rev: 'D',
  title: 'THE DESIGN SPACE',
  sub: 'ALTITUDE 5 — eleven entries placed by where matching happens and who owns navigation, shape marking the source of truth · positions are editorial, argued in the notes',
  scale: 'JS ECOSYSTEM',
  form: 'POSITIONED CHART',
  svg,
  caption: 'No mechanism connects these projects, so an edge between them would be fiction; the one line on the sheet runs inside the lineage, where sheet 2 draws the mechanism. What is real is position: where matching happens, who owns navigation, and — the squares — whether the URL or a state tree is the source of truth.',
  notes: `
<p><strong>This altitude forbids the city outright.</strong> A diagram's edges assert mechanism, and there is none between <a href="${HOME.tanstack}">TanStack</a> and <a href="${HOME.sveltekit}">SvelteKit</a>. The honest form is a positioned chart whose axes are real, contested design decisions — with the positions owned as editorial judgment, not measurement.</p>
<p><strong>Reading the columns:</strong> the field has been sliding left for a decade — filesystem routes and typegen move matching toward build time; server components move it toward the server. The client-runtime column is where the platform itself now competes, via the <a href="${HOME.navigation}">Navigation API</a>. The server-runtime column has a platform floor of its own, drawn as one circle with two names: <a href="${HOME.nodehttp}"><code>node:http</code></a> hands a listener a request whose URL is a bare string, and the <a href="${HOME.fetch}">fetch handler</a> hands one a Request and wants a Response back; neither matches anything, and Hono, Express and the lineage's connect and fetch adapters all stand on one or the other. <a href="${HOME.urlpattern}">URLPattern</a> is the platform's matcher, in browsers and global in Node 24, and it stays off the plot: it matches a string against a pattern and owns neither a request nor navigation, so it is a part routers are built from, not a router.</p>
<p><strong>The squares are the argument.</strong> Every circle on this chart treats the URL as the source of truth and derives the view from it. The <a href="${HOME.uirouter}">ui-router</a> lineage inverts that: a named, hierarchical state tree is primary, and the URL is a projection — one of several possible addresses for a state. That inversion is why sheet 1's loop runs through a state registry rather than a path matcher, and why the same tree answers HTTP requests in sheet 2's server lane. It is also why the squares sit alone: the niche is real, small, and — for state-heavy embedded UIs where the address bar is not the whole story — defensible.</p>
<p><strong>One tree, every column — and this atlas is the measurement.</strong> The lineage is the one entry drawn in all three columns, and the bracket under its row is the sheet's one edge with a mechanism behind it. <a href="${HOME.server}"><code>ui-router-server</code></a> compiles the same state declarations into a mount table and gives each path an HTTP verdict — shell, redirect or 404 — at server runtime, in its connect, vite, fetch and hono adapters. <a href="${HOME.ssr}"><code>lit-ui-router-ssr</code></a> takes that mount table at build time, drives one router to every path and draws each <code>&lt;ui-view&gt;</code> to a page; its client half adopts the page one view per route match, the per-boundary, provided cell of the <a href="${HOME.compare}">hydration models its guide compares</a>. Every page of this atlas, this one included, is a verdict the server router gave and a document the prerenderer wrote at build, adopted by <code>lit-ui-router</code> at client runtime: the three squares are the three times one state tree matched the address you are reading.</p>`,
  key: [
    keyRow('<circle cx="22" cy="9" r="6" class="sk fp" stroke-width="1.6"/>', 'URL-first router'),
    keyRow('<rect x="16" y="3" width="12" height="12" class="ska fp" stroke-width="2"/>', 'state-first router (this lineage) — one square per column it matches in'),
    keyRow('<line x1="8" y1="4" x2="8" y2="13" class="ska"/><line x1="36" y1="4" x2="36" y2="13" class="ska"/><line x1="8" y1="13" x2="36" y2="13" class="ska"/>', 'the lineage\'s span — the sheet\'s one edge; sheet 2 draws the mechanism'),
    keyRow('<rect x="2" y="2" width="40" height="14" class="skr fnone" stroke-dasharray="4 3"/>', 'editorial callout'),
    keyRow('<line x1="2" y1="9" x2="40" y2="9" class="skf" stroke-dasharray="4 4"/>', 'column boundary (soft)'),
  ].join('\n'),
};
