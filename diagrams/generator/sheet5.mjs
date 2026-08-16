import { defs } from './chrome.mjs';
import { txt, lines, box, keyRow } from './helpers.mjs';

const P = 's5';

// Plot area
const PX = 130, PW = 870, PY = 70, PH = 440;
const bandY = { library: PY + 70, framework: PY + 220, platform: PY + 370 };
const cx = (f) => PX + f * PW;

// [xFrac, band, dy, name, note, shape, side?] — square = state-first, circle = URL-first.
// side pins the label to one flank when the default would straddle a column line.
const points = [
  [0.10, 'framework', -26, 'SvelteKit', 'filesystem routes, compiled', 'c'],
  [0.14, 'framework', 26, 'Next App Router', 'fs routes · server-first', 'c'],
  [0.39, 'framework', 0, 'React Router v7', 'framework mode — Remix folded in', 'c'],
  [0.72, 'framework', -26, 'Angular Router', 'config tree in the injector', 'c', 'r'],
  [0.88, 'framework', 30, 'Vue Router', 'official, but installable', 'c'],
  [0.70, 'library', -34, 'TanStack Router', 'typed at build, matched in the client', 'c', 'r'],
  [0.92, 'library', 4, 'wouter', 'minimal hook', 'c'],
  [0.38, 'library', 40, 'Hono / Express', 'server-only: match, no navigation', 'c'],
  [0.71, 'library', 56, 'ui-router / lit-ui-router', 'named state tree — URL is a projection', 's', 'r'],
  [0.69, 'platform', 0, 'Navigation API', 'the primitive the client column builds on', 'c', 'r'],
];

const marks = points.map(([xf, band, dy, name, note, shape, side]) => {
  const x = cx(xf), y = bandY[band] + dy;
  const isUs = shape === 's';
  const mark = isUs
    ? `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" class="ska fp" stroke-width="2.2"/><rect x="${x - 13}" y="${y - 13}" width="26" height="26" rx="4" class="fhalo"/>`
    : `<circle cx="${x}" cy="${y}" r="6" class="sk fp" stroke-width="1.6"/>`;
  const right = side ? side === 'r' : xf < 0.70;
  const gap = isUs ? 20 : 14;
  const lx = right ? x + gap : x - gap;
  const anchor = right ? 'start' : 'end';
  return `<g><title>${name} — ${note}</title>${mark}
${txt(lx, y - 1, name, isUs ? 'lbla' : 'lblb', anchor)}
${txt(lx, y + 12, note, 'lblf', anchor)}</g>`;
}).join('\n');

const svg = `<svg viewBox="0 0 1080 640" role="img" aria-label="A positioned chart of the JavaScript router design space: horizontal axis runs from build-time to server-runtime to client-runtime route matching; vertical bands separate platform, framework, and library ownership of navigation. Ten routers are plotted as labeled points. ui-router and lit-ui-router sit alone as the only state-first router, marked with a square, in an otherwise URL-first field.">
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

<!-- the thesis callout -->
<rect x="${PX + 16}" y="${PY + 14}" width="330" height="86" class="skr fnone" stroke-dasharray="6 4"/>
${lines(PX + 30, PY + 38, [
  'THE EMPTY QUARTER',
  'nearly every router here is URL-first:',
  'the address is the source of truth.',
  'state-first routing is a one-square niche.',
], 'lbls', 'start', 15)}

<!-- shape legend under plot -->
${txt(PX, PY + PH + 36, 'SHAPE = SOURCE OF TRUTH', 'lbls')}
<circle cx="${PX + 12}" cy="${PY + PH + 58}" r="6" class="sk fp" stroke-width="1.6"/>
${txt(PX + 28, PY + PH + 62, 'URL-first — the view is derived from the address', 'lbl')}
<rect x="${PX + 6}" y="${PY + PH + 76}" width="12" height="12" class="ska fp" stroke-width="2"/>
${txt(PX + 28, PY + PH + 90, 'state-first — a named state tree; the URL is one projection of it', 'lbl')}
</svg>`;

export const sheet5 = {
  num: 5, id: 'runtime',
  title: 'THE DESIGN SPACE',
  sub: 'ALTITUDE 5 — routers in the JS runtime · positions are editorial, argued in the notes',
  scale: 'JS ECOSYSTEM',
  form: 'POSITIONED CHART',
  svg,
  caption: 'No mechanism connects these projects, so any drawn edge would be fiction. What is real is position: where matching happens, who owns navigation, and — the one square — whether the URL or a state tree is the source of truth.',
  notes: `
<p><strong>This altitude forbids the city outright.</strong> A diagram's edges assert mechanism, and there is none between TanStack and SvelteKit. The honest form is a positioned chart whose axes are real, contested design decisions — with the positions owned as editorial judgment, not measurement.</p>
<p><strong>Reading the columns:</strong> the field has been sliding left for a decade — filesystem routes and typegen move matching toward build time; server components move it toward the server. The client-runtime column is where the platform itself now competes, via the Navigation API.</p>
<p><strong>The square is the argument.</strong> Every circle on this chart treats the URL as the source of truth and derives the view from it. The ui-router lineage inverts that: a named, hierarchical state tree is primary, and the URL is a projection — one of several possible addresses for a state. That inversion is why sheet 1's loop runs through a state registry rather than a path matcher, and why the same tree can answer HTTP requests in sheet 2's server lane. It is also why the square sits alone: the niche is real, small, and — for state-heavy embedded UIs where the address bar is not the whole story — defensible.</p>`,
  key: [
    keyRow('<circle cx="22" cy="9" r="6" class="sk fp" stroke-width="1.6"/>', 'URL-first router'),
    keyRow('<rect x="16" y="3" width="12" height="12" class="ska fp" stroke-width="2"/>', 'state-first router (this lineage)'),
    keyRow('<rect x="2" y="2" width="40" height="14" class="skr fnone" stroke-dasharray="4 3"/>', 'editorial callout'),
    keyRow('<line x1="2" y1="9" x2="40" y2="9" class="skf" stroke-dasharray="4 4"/>', 'column boundary (soft)'),
  ].join('\n'),
};
