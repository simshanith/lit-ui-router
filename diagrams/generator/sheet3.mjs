import { defs } from './chrome.mjs';
import { txt, arrow, isoBlock, isoPt, keyRow } from './helpers.mjs';

const P = 's3';
const OX = 350, OY = 175;

// Heights encode gate severity: 16 reporter · 66 merge gate · 100 publish halt.
const H = { rep: 22, gate: 66, halt: 100, slab: 12, crate: 30 };

// [n, plan x, y, w, d, h, cap?, schedule text]
const blocks = [
  [1, 30, 30, 100, 70, H.slab, null, 'src — packages/* sources'],
  [2, 162, 48, 36, 36, 8, null, 'transit — stages src between passes'],
  [3, 225, 18, 70, 38, H.slab, null, 'build:js — oxc-emit, JS pass'],
  [4, 225, 80, 70, 38, H.slab, null, 'build:types — oxc-emit, d.ts pass'],
  [5, 322, 32, 80, 55, 18, null, 'pack — packPublishTarball, cached'],
  [6, 432, 40, 45, 45, H.crate, 'fa', 'THE TARBALL — the one artifact'],
  [7, 505, 30, 80, 50, H.slab, null, 'publish — release-it'],
  [8, 625, 25, 70, 50, 44, null, 'npm registry — immutable once crossed'],
  [9, 30, 215, 50, 50, H.halt, 'fr', 'published-diff — vs live npm · HALTS'],
  [10, 145, 215, 50, 50, H.gate, null, 'check:exports — publint + attw · gates'],
  [11, 260, 215, 50, 50, H.gate, null, 'dts-backtest — TS 5.0 dts floor · gates'],
  [12, 30, 340, 50, 50, H.gate, null, 'compat-guards — the lit 2 lane · gates'],
  [13, 150, 345, 32, 32, H.rep, null, 'peer-floor tier-1 — reports, never gates'],
  [14, 200, 342, 36, 36, H.gate, null, 'peer-floor tier-2 — gates version bumps'],
  [15, 270, 335, 74, 52, H.gate, null, 'tests — vitest, 4 real browsers · gates'],
  [16, 365, 300, 90, 72, 16, null, 'lint & probe fleet ×10 — mixed'],
  [17, 490, 240, 80, 60, H.gate, null, 'e2e — cypress, sample apps · gates'],
  [18, 515, 330, 80, 52, H.crate, null, 'docs site — ships to lit-ui-router.dev'],
];

function districtPath(x1, y1, x2, y2) {
  const pts = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
    .map(([px, py]) => isoPt(OX, OY, px, py).map((v) => v.toFixed(1)).join(','))
    .join(' ');
  return `<polygon points="${pts}" class="skf fnone" stroke-dasharray="5 4"/>`;
}

function groundArrow(a, b, mk = 'ai', cls = 'sk2', dash = '') {
  const [x1, y1] = isoPt(OX, OY, a[0], a[1]);
  const [x2, y2] = isoPt(OX, OY, b[0], b[1]);
  return arrow(P, `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`, mk, cls, dash);
}

// Ground layer first (roads under buildings), then blocks back-to-front, then balloons.
const roads = [
  groundArrow([132, 70], [160, 66]),
  groundArrow([200, 56], [223, 42]),
  groundArrow([200, 70], [223, 94]),
  groundArrow([297, 38], [320, 52]),
  groundArrow([297, 100], [320, 74]),
  groundArrow([404, 60], [430, 62]),
  groundArrow([479, 62], [503, 56]),
  groundArrow([587, 55], [623, 50], 'ai', 'sks', '6 4'),
  groundArrow([440, 88], [210, 240], 'as', 'sks', '4 3'),
].join('\n');

const bodies = blocks
  .slice()
  .sort((a, b) => (a[1] + a[2] + (a[3] + a[4]) / 2) - (b[1] + b[2] + (b[3] + b[4]) / 2))
  .map(([n, x, y, w, d, h, cap]) => {
    const body = isoBlock(P, OX, OY, x, y, w, d, h, { capCls: cap ?? 'fp' });
    const [bx, by] = isoPt(OX, OY, x + w / 2, y, h);
    const ballCls = cap === 'fr' ? 'skr fp' : cap === 'fa' ? 'ska fp' : 'sk fp';
    // 13 sits where a later-painted neighbour's roof would clip it
    const lift = n === 13 ? 26 : 16;
    return `${body}
<circle cx="${bx.toFixed(1)}" cy="${(by - lift).toFixed(1)}" r="9.5" class="${ballCls}"/>
${txt(bx.toFixed(1), (by - lift + 3.6).toFixed(1), String(n), 'lbl', 'middle')}`;
  })
  .join('\n');

// Feedback arc: published-diff pulls the live tarball back from npm.
const [nx, ny] = isoPt(OX, OY, 660, 50, 44);
const [dx2, dy2] = isoPt(OX, OY, 55, 240, H.halt);
const feedback = `${arrow(P, `M${nx.toFixed(1)},${(ny - 8).toFixed(1)} C 820,210 430,120 ${(dx2 + 36).toFixed(1)},${(dy2 - 2).toFixed(1)}`, 'aa', 'ska', '7 4')}
${txt(470, 148, 'published-diff pulls the LIVE tarball back — the loop closes', 'lbla', 'middle')}`;

const schedule = `<g>
<rect x="878" y="58" width="330" height="392" class="sk fp"/>
${txt(892, 78, 'STRUCTURE SCHEDULE', 'lbls')}
<line x1="878" y1="88" x2="1208" y2="88" class="skf"/>
${blocks.map(([n, , , , , , cap, sched], i) => {
  const y = 106 + i * 19;
  const numCls = cap === 'fr' ? 'lblr' : cap === 'fa' ? 'lbla' : 'lblb';
  return `${txt(892, y, String(n), numCls)}
${txt(914, y, sched, 'lbls')}`;
}).join('\n')}
</g>`;

const svg = `<svg viewBox="0 0 1220 720" role="img" aria-label="Isometric map of the lit-ui-router monorepo as an industrial site: a build conveyor running from source through a single pack step to the npm registry, an instrument yard of numbered measurement towers whose heights encode gate severity, and a proving ground of apps and docs. A structure schedule names all eighteen numbered structures. The tallest, red-capped tower is published-diff, which halts publishing and pulls the live tarball back from npm, closing the loop.">
${defs(P)}

<rect x="40" y="26" width="560" height="42" class="skf fnone"/>
${txt(52, 43, 'TWO TASK MANAGERS, ONE SITE', 'lbls')}
${txt(52, 58, 'mise — node-free standalone umbrella · turbo — cached fan-out (remote R2)', 'lblf')}

<!-- districts -->
${districtPath(15, 8, 600, 130)}
${districtPath(15, 200, 460, 400)}
${districtPath(475, 230, 615, 395)}
${txt(150, 160, 'packages/ — the conveyor', 'lblf')}
${txt(30, 645, 'tools/ — the instrument yard', 'lblf')}
${txt(560, 700, 'apps/ + docs/ — proving ground & shopfront', 'lblf', 'middle')}

<!-- registry boundary -->
${(() => {
  const [x1, y1] = isoPt(OX, OY, 610, 0);
  const [x2, y2] = isoPt(OX, OY, 610, 120);
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="sks" stroke-dasharray="9 5"/>
${txt(x2 + 40, y2 + 110, 'the registry boundary — beyond here, releases are immutable', 'lblf', 'middle')}`;
})()}

${roads}
${bodies}
${feedback}
${schedule}
</svg>`;

export const sheet3 = {
  num: 3, id: 'monorepo',
  title: 'THE INSTRUMENT YARD',
  sub: 'ALTITUDE 3 — 4 publishable packages · 16 tools · ~38 turbo tasks · one packer, many readers',
  scale: 'THE MONOREPO',
  form: 'ISOMETRIC CITY',
  svg,
  caption: 'The monorepo drawn as what it functionally is: a short conveyor that turns source into one tarball, inside a yard of instruments built to measure that tarball. Height is gate severity — a tall tower stops the line.',
  notes: `
<p><strong>The reference's thesis is truest at this altitude.</strong> "Nearly every hard problem turned out to be a measurement problem" describes this repo exactly: four publishable packages, sixteen <code>tools/*</code> instruments. The city is mostly instruments; the product is one crate (structure 6).</p>
<p><strong>One packer, many readers (#449).</strong> Every check reads the same cached <code>packPublishTarball</code> output — <code>check:exports</code> (publint + attw), <code>dts-backtest</code>, bundle probes, <code>published-diff</code>. No check re-packs, so a drift verdict is always about the artifact that would actually ship.</p>
<p><strong>Height = what halts.</strong> Low slabs report (peer-floor tier-1 never gates a PR). Mid towers gate merges. The one red-capped tower, <code>published-diff</code> (9), halts publishing itself — and it closes the loop by pulling the <em>live</em> npm tarball back for comparison, which makes the registry part of the circuit rather than a destination.</p>
<p><strong>Two gantries, one site.</strong> mise runs the site node-free from a standalone umbrella; turbo fans the same tasks out with remote caching. Known failure mode, drawn nowhere but written here as a real condition: a poisoned remote cache entry can replay a stale verdict — <code>--force</code> is the remediation.</p>`,
  key: [
    keyRow('<rect x="14" y="10" width="20" height="6" class="sk fp"/>', 'reports only (never gates)'),
    keyRow('<rect x="14" y="4" width="20" height="12" class="sk fp"/>', 'gates a merge'),
    keyRow('<rect x="14" y="1" width="20" height="15" class="sk fp"/><rect x="14" y="1" width="20" height="4" class="fr"/>', 'halts a publish'),
    keyRow('<rect x="14" y="4" width="16" height="11" class="sk fa"/>', 'the artifact (one tarball)'),
    keyRow('<line x1="2" y1="9" x2="44" y2="9" class="ska" stroke-dasharray="6 4"/>', 'feedback from the registry'),
    keyRow('<line x1="2" y1="9" x2="44" y2="9" class="sks" stroke-dasharray="4 3"/>', 'checks reading the tarball'),
  ].join('\n'),
};
