// SHIP — the run that puts an atlas change on atlas.lit-ui-router.dev, one named
// step per call, each with an exit code the next step can trust:
//
//   mise exec -- node www/atlas.lit-ui-router.dev/generator/ship.mjs <step> [options]
//
//   build                 the generator: fragments, models, manifest and the README
//   app                   typecheck, then the vite build and prerender; the two count
//                         lines are compared with the last run's (--accept to lower them)
//   audit <tag> [--only ids]   frame audit of the bare plates under app/dist/plate/, then light
//                         and dark photographs under tmp/shots/<tag>; needs `app` to have run.
//                         Escapes and deep hits stop; text-on-text on a full run is compared
//                         with the last full run's (--accept to raise it)
//   stage                 stage-site.mjs; stops unless the Adobe Fonts kit is on every page
//   check                 the gate the deploy runs first: branch www/atlas, tree clean, HEAD on
//                         origin, dist/city/index.html carries typekit and no Google font link
//   deploy                check, then the Pages upload; prints the deployment URL
//   verify [--page p --marker m]   two live fetches must agree on the marker and on typekit;
//                         seven status codes must match
//   artifact              the single-file build for the claude.ai Artifact
//
// Run from anywhere: every path is resolved from this file. The hook in
// generator/ship-guard.mjs refuses a wrangler deploy that does not come through here.
// docs/SHIPPING.md is the account of the whole run.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './basis.mjs';

const ATLAS = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');
const APP = join(ATLAS, 'app');
const DIST = join(ATLAS, 'dist');
const STATE = join(ATLAS, 'tmp', 'ship');
const BRANCH = 'www/atlas';
const SITE = 'https://atlas.lit-ui-router.dev';
const PROJECT = 'altitude-atlas';

const [STEP, ...ARGV] = process.argv.slice(2);
const flag = (name) => { const i = ARGV.indexOf(name); return i !== -1 ? ARGV[i + 1] : undefined; };
const has = (name) => ARGV.includes(name);
const say = (line) => console.log(`ship ${STEP}: ${line}`);
const stop = (why) => { console.error(`ship ${STEP}: STOP — ${why}`); process.exit(1); };

// a child that inherits the terminal; its exit code is this step's
const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: process.env });
  if (r.status !== 0) stop(`${cmd} ${args.join(' ')} exited ${r.status ?? r.signal}`);
};
// a child whose output is read; stdout is also echoed so the log carries it
const read = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', env: process.env, maxBuffer: 64 * 1024 * 1024 });
  process.stdout.write(r.stdout ?? '');
  process.stderr.write(r.stderr ?? '');
  if (r.status !== 0) stop(`${cmd} ${args.join(' ')} exited ${r.status ?? r.signal}`);
  return r.stdout ?? '';
};
const git = (...args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' }).trim();
const lastRun = () => (existsSync(join(STATE, 'last.json')) ? JSON.parse(readFileSync(join(STATE, 'last.json'), 'utf8')) : {});
const remember = (patch) => { mkdirSync(STATE, { recursive: true }); writeFileSync(join(STATE, 'last.json'), JSON.stringify({ ...lastRun(), ...patch }, null, 1)); };

const STEPS = {
  build() {
    run('node', [join(ATLAS, 'generator', 'build.mjs'), ATLAS], ROOT);
    say('generator build ok');
  },

  app() {
    run('npm', ['--prefix', APP, 'run', 'typecheck'], ROOT);
    const out = read('npm', ['--prefix', APP, 'run', 'build'], ROOT);
    const pages = Number(/prerendered (\d+) pages/.exec(out)?.[1]);
    const scoped = /scoped router at construction: (\d+)\/(\d+)/.exec(out);
    if (!pages || !scoped) stop('the build log lacks its prerendered or scoped-router line');
    if (scoped[1] !== scoped[2]) stop(`scoped router: ${scoped[1]}/${scoped[2]} renders match`);
    const last = lastRun();
    if (!has('--accept') && last.pages && pages < last.pages) stop(`prerendered ${pages} pages, the last run had ${last.pages} (--accept to lower it)`);
    remember({ pages, scoped: Number(scoped[2]) });
    say(`prerendered ${pages} pages · scoped router ${scoped[1]}/${scoped[2]}`);
  },

  audit() {
    if (!existsSync(join(APP, 'dist', 'plate'))) stop('app/dist/plate missing; run ship.mjs app first');
    const tag = ARGV.find((a, i) => !a.startsWith('--') && ARGV[i - 1] !== '--only') ?? 'ship';
    const only = flag('--only') ? ['--only', flag('--only')] : [];
    // audit-frames exits 1 on any finding; text-on-text is judged against the last full run, not against zero
    const r = spawnSync('node', [join(ATLAS, 'generator', 'audit-frames.mjs'), tag, ...only], { cwd: ROOT, encoding: 'utf8', env: process.env, maxBuffer: 64 * 1024 * 1024 });
    process.stdout.write(r.stdout ?? '');
    process.stderr.write(r.stderr ?? '');
    const total = /TOTAL escapes (\d+) · hits>1px (\d+) · text-on-text (\d+)/.exec(r.stdout ?? '');
    if (!total) stop('no TOTAL line from the frame audit');
    const [escapes, hits, text] = total.slice(1).map(Number);
    if (escapes || hits) stop(`${escapes} escapes, ${hits} hits deeper than 1px`);
    if (only.length === 0) {
      const last = lastRun();
      if (!has('--accept') && last.text !== undefined && text > last.text) stop(`text-on-text ${text}, the last full run had ${last.text} (--accept to raise it)`);
      remember({ text });
    }
    run('node', [join(ATLAS, 'generator', 'shoot.mjs'), tag, ...only], ROOT);
    say(`escapes 0 · hits 0 · text-on-text ${text}${only.length ? ' (partial)' : ''} · photographs under ${join(ATLAS, 'tmp', 'shots', tag)} — read every one`);
  },

  stage() {
    const out = read('node', [join(ATLAS, 'generator', 'stage-site.mjs')], ATLAS);
    const kit = /Adobe Fonts kit: (\S+)/.exec(out)?.[1];
    if (!kit || kit === 'none') stop('Adobe Fonts kit: none — this checkout has no .config/mise/cloudflare.local.env; a fork never deploys');
    say(`staged with kit ${kit}`);
  },

  check() {
    const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    if (branch !== BRANCH) stop(`on ${branch}, not ${BRANCH}`);
    const dirty = git('status', '--porcelain', '--', ATLAS);
    if (dirty) stop(`the atlas tree is not clean:\n${dirty}`);
    const head = git('rev-parse', 'HEAD');
    const remote = git('ls-remote', 'origin', BRANCH).split(/\s/)[0];
    if (remote !== head) stop(`HEAD ${head.slice(0, 8)} is not on origin/${BRANCH} (${remote.slice(0, 8)}); push first`);
    const city = join(DIST, 'city', 'index.html');
    if (!existsSync(city)) stop('dist/city/index.html is missing; stage first');
    const html = readFileSync(city, 'utf8');
    const typekit = (html.match(/typekit/g) ?? []).length;
    const google = (html.match(/fonts\.googleapis/g) ?? []).length;
    if (typekit < 1 || google > 0) stop(`dist/city/index.html: typekit ${typekit}, fonts.googleapis ${google}`);
    say(`${BRANCH} @ ${head.slice(0, 8)} on origin · tree clean · typekit ${typekit} · google 0`);
    return head;
  },

  deploy() {
    const head = STEPS.check();
    const out = read('pnpm', ['exec', 'wrangler', 'pages', 'deploy', 'dist', '--project-name', PROJECT, '--branch', BRANCH, '--commit-dirty=true'], ATLAS);
    const url = /https:\/\/[a-z0-9]+\.altitude-atlas\.pages\.dev/.exec(out)?.[0];
    if (!url) stop('no deployment URL in the wrangler output');
    remember({ deployed: head, deployment: url, at: new Date().toISOString() });
    say(`deployed ${head.slice(0, 8)} → ${url}`);
  },

  async verify() {
    const page = flag('--page') ?? '/';
    const marker = flag('--marker');
    const fetchText = async (path) => (await fetch(`${SITE}${path}`, { redirect: 'follow', cache: 'no-store' })).text();
    const count = (text, needle) => text.split(needle).length - 1;
    const a = await fetchText(page), b = await fetchText(page);
    const kit = [count(a, 'typekit'), count(b, 'typekit')];
    if (kit[0] < 1 || kit[1] < 1) stop(`${page}: typekit ${kit.join('/')} across two fetches`);
    if (marker) {
      const m = [count(a, marker), count(b, marker)];
      if (m[0] < 1 || m[0] !== m[1]) stop(`${page}: marker ${JSON.stringify(marker)} seen ${m.join('/')} across two fetches`);
      say(`${page}: marker ×${m[0]} on both fetches`);
    }
    const EXPECT = { '/': 200, '/sheet/7/': 200, '/sheet/2a': 200, '/plate/7/': 200, '/set/sheet-7-the-measured-city': 200, '/set/gallery.html': 200, '/sheet/99': 404 };
    for (const [path, status] of Object.entries(EXPECT)) {
      const r = await fetch(`${SITE}${path}`, { redirect: 'follow', cache: 'no-store' });
      if (r.status !== status) stop(`${path}: ${r.status}, expected ${status}`);
    }
    say(`${page}: typekit ${kit.join('/')} · ${Object.keys(EXPECT).length} status codes as expected`);
  },

  artifact() {
    run('npm', ['--prefix', APP, 'run', 'build:artifact'], ROOT);
    const file = join(APP, 'dist-artifact', 'index.html');
    if (!existsSync(file)) stop('app/dist-artifact/index.html was not written');
    say(`${file} · ${(statSync(file).size / 1e6).toFixed(1)} MB — publish it by url with the Artifact tool`);
  },
};

if (!STEP || !STEPS[STEP]) {
  console.error(`usage: ship.mjs <${Object.keys(STEPS).join('|')}> [options]`);
  process.exit(2);
}
await STEPS[STEP]();
