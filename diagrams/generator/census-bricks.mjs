// Brick census for sheet 2 — authored source of this repo's four published
// packages, plus @uirouter/core (the baseplate) from the family clone.
// Same basis as sheets 3 & 4: .ts/.tsx/.js/.mjs under src/, excluding *.d.ts,
// *.{spec,test}.*, *.types.ts fixtures, specs/ __tests__/ and typedoc stubs.
// sloc = scc 4.0.0 `Code` lines (string-aware: template-literal interiors count as code).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// FAM is a scratch clone of the upstream family repos, outside this repo by nature.
const FAM = '/Users/simloovoo/.claude/jobs/a9024f9c/tmp/family-src/';
const WT = fileURLToPath(new URL('../../packages/', import.meta.url));

const MEMBERS = [
  ['@uirouter/core', FAM + 'core/src'],
  ['lit-ui-router', WT + 'lit-ui-router/src'],
  ['ui-router-server', WT + 'ui-router-server/src'],
  ['lit-ui-router-mobx', WT + 'lit-ui-router-mobx/src'],
  ['ui-router-navigation-location-plugin', WT + 'navigation-location-plugin/src'],
];

const EXT = /\.(tsx?|jsx?|mjs)$/;
const SKIP_FILE = (f) =>
  /\.d\.ts$/.test(f) || /\.(spec|test)\./.test(f) || /\.typedoc\./.test(f);
const SKIP_DIR = (d) =>
  ['specs', 'test', 'tests', '__tests__', '__test__', 'node_modules'].includes(d);

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIR(e.name)) walk(join(dir, e.name), out);
    } else if (EXT.test(e.name) && !SKIP_FILE(e.name)) out.push(join(dir, e.name));
  }
  return out;
}

// Batch scc over absolute paths; Location echoes each path verbatim.
// Provision: `mise x aqua:boyter/scc@4.0.0` (bare `scc` is not an aqua name).
function sccSloc(files) {
  const out = execFileSync('mise',
    ['x', 'aqua:boyter/scc@4.0.0', '--', 'scc', '--by-file', '--format', 'json', ...files],
    { maxBuffer: 1 << 26 });
  const map = new Map();
  for (const lang of JSON.parse(out)) for (const f of lang.Files) map.set(f.Location, f.Code);
  return map;
}

// The quantization rule drawn on sheet 2 rev B.
const STUDS = (s) => Math.max(1, Math.ceil(s / 150));
const SHAPE = (n) =>
  n <= 1 ? '1x1' : n <= 2 ? '1x2' : n <= 4 ? '2x2' : n <= 6 ? '2x3' : '2x4';
const COURSES = (f) => Math.max(1, Math.ceil(f / 3));

const rows = [];
for (const [name, dir] of MEMBERS) {
  const files = walk(dir);
  const code = sccSloc(files);
  const lines = files.reduce((a, f) => a + code.get(f), 0);
  rows.push([name, files.length, lines, STUDS(lines), SHAPE(STUDS(lines)), COURSES(files.length)]);
}
for (const r of rows)
  console.log(
    r[0].padEnd(38),
    String(r[1]).padStart(3) + 'f',
    String(r[2]).padStart(6) + ' sloc',
    String(r[3]).padStart(3) + ' studs',
    r[4].padStart(4),
    String(r[5]) + ' courses',
  );
console.log(JSON.stringify(rows));
