// THE BUILDS, IN THE ROUND: each of sheet 2C's models as a glTF binary in Google's
// <model-viewer>, one build at a time, picked by name, with each build's explosion,
// scaled, as its one clip.
//
// Nothing is re-derived: sheet2c.mjs exports every model's layout as BUILD_MODELS,
// seated, with each brick's drawn lift, builds-glb.mjs writes each into its own GLB
// along assembleMotion's keys, and this module ships every build's parts, readings
// and keyed rises as one JSON island beside the viewer. The plate is app-only.
import { readFileSync } from 'node:fs';
import { PROJECT_MARK, articleTitle } from './chrome.mjs';
import { BUILD_JS, FOCUS_JS } from './focus.mjs';
import { basisStrip, laneCss } from './lane-chrome.mjs';
import { ASSEMBLE_SECONDS, PITCH, assembleMotion } from './brick-glb.mjs';
import { BUILD_GLB_BUDGET, atModel, buildGlb, explodeOf } from './builds-glb.mjs';
import { frameCss, mvJs, orbitAt, partsCss, partsMarkup, pinCss } from './mv-kit.mjs';
import { BUILD_BOX, BUILD_MODELS } from './sheet2c.mjs';
import { BASE } from '../app/src/routes.ts';

const APP_PKG = JSON.parse(readFileSync(new URL('../app/package.json', import.meta.url), 'utf8'));
const MV_VERSION = APP_PKG.dependencies['@google/model-viewer'].replace(/^[^\d]*/, '');

/** Where the app serves each build's model: app/public/models/builds/<slug>.glb, under the app's base. */
export const BUILDS_GLB_DIR = 'models/builds';
const glbOf = (m) => `${BUILDS_GLB_DIR}/${m.slug}.glb`;

/** Every build's model as [path under app/public, GLB] — emit-app.mjs writes them. */
export const buildsGlbs = () => BUILD_MODELS.map((m) => [glbOf(m), buildGlb(m)]);

const fmt = (v) => v.toLocaleString('en-US');
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const listOf = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;
const shapeName = ([w, d]) => `${w}×${d}`;
const RADIUS = 88;
// sheet 2C's own corner, the opposite one, and the turn between them
const CORNERS = [
  ['drawn', 'DRAWING’S CORNER', 45],
  ['opposite', 'OPPOSITE CORNER', 225],
  ['side', 'SIDE CORNER', 135],
].map(([id, label, az]) => ({ id, label, orbit: orbitAt(az, `${RADIUS}%`) }));
const SWEEP = 30;
const DOLLY = 0.5;
const SEATED_MAX = 'Infinity 88deg auto';
const EXPLODED_MAX = `Infinity 88deg ${+(RADIUS * (1 + DOLLY)).toFixed(2)}%`;

const r4 = (v) => +v.toFixed(4);
// over a cap, the open stud farthest from the parts standing on it, its centre when none does, null when they cover it
const openStud = (box, riders) => {
  if (!riders.length) return [box.x + box.w / 2, box.y + box.d / 2];
  const clear = (x, y) => Math.min(...riders.map((o) => Math.hypot(x - o.x - (o.ws * PITCH) / 2, y - o.y - (o.ds * PITCH) / 2)));
  let best = null;
  for (let i = 0; i < box.ws; i++) for (let j = 0; j < box.ds; j++) {
    const x = box.x + (i + 0.5) * PITCH, y = box.y + (j + 0.5) * PITCH;
    if (riders.some((o) => x > o.x && x < o.x + o.ws * PITCH && y > o.y && y < o.y + o.ds * PITCH)) continue;
    if (!best || clear(x, y) > best[2]) best = [x, y, clear(x, y)];
  }
  return best ? [best[0], best[1]] : null;
};
const plateWord = (p) => (p.full ? `${plural(p.plates, 'plate')} · ${p.full} of ${shapeName(p.shape)}${p.topShape.join() !== p.shape.join() ? ` + a ${shapeName(p.topShape)}` : ''}` : `1 plate · ${shapeName(p.shape)}`);
const plateRef = (m, letter) => `plate ${letter}, ${m.plates.find((p) => p.letter === letter).name}`;
const brickNote = (m, b) => {
  const seat = b.on !== null ? `brick ${b.on}` : plateRef(m, b.seat);
  const reach = [...b.straddles.map((l) => `straddles the seam onto ${plateRef(m, l)}`), ...b.cords.map((l) => `is corded to ${plateRef(m, l)}`)];
  return `Seats on ${seat}${reach.length ? `; ${listOf(reach)}` : ''}.`;
};
const plateNote = (p) => {
  const here = [
    ...(p.seats.length ? [`seats brick${p.seats.length > 1 ? 's' : ''} ${listOf(p.seats)}`] : []),
    ...(p.straddled.length ? [`carries brick${p.straddled.length > 1 ? 's' : ''} ${listOf(p.straddled)} across its seam with core`] : []),
    ...(p.corded.length ? [`takes the cord${p.corded.length > 1 ? 's' : ''} from brick${p.corded.length > 1 ? 's' : ''} ${listOf(p.corded)}`] : []),
  ];
  return `In this build it ${listOf(here)}. Peered by brick${p.peeredBy.length > 1 ? 's' : ''} ${listOf(p.peeredBy)} across the family${p.optional ? ', each as an optional peer' : ''}.`;
};
const consumersLine = (m) => `${plural(m.consumers, 'consumer')} · ${m.kinds}${m.atlas ? ` · ${m.words}` : ''}`;
const FIRST = BUILD_MODELS[0];
const hrefOf = (m, key) => `?build=${m.slug}${key === undefined ? '' : `&focus=${key}`}`;

const DATA = {
  end: ASSEMBLE_SECONDS,
  first: FIRST.slug,
  builds: BUILD_MODELS.map((m) => {
    const { parts, explode } = explodeOf(m);
    const motion = assembleMotion(parts, explode);
    const at = (x, y, z) => atModel(m, x, y, z).map(r4);
    return {
      slug: m.slug,
      numeral: m.numeral,
      name: m.name.toUpperCase(),
      glb: `${BASE}${glbOf(m)}`,
      who: consumersLine(m),
      us: motion.us.map(r4),
      bricks: m.bricks.map((b) => {
        const box = { x: b.x, y: b.y, w: b.ws * PITCH, d: b.ds * PITCH, ws: b.ws, ds: b.ds };
        return {
          key: String(b.n), n: b.n, name: b.name, ver: b.ver, hue: b.hue,
          ledger: `${b.files}f · ${fmt(b.sloc)} sloc · ${shapeName(b.shape)} · ${plural(b.courses, 'course')}`,
          note: brickNote(m, b),
          // a stud's height clear of the cap, over an open stud, so the badge stands clear of the bricks seated on it
          cap: at(...(openStud(box, m.bricks.filter((o) => o.on === b.n)) ?? [box.x + box.w / 2, box.y + box.d / 2]), b.z0 + b.h + 14),
          centre: at(b.x + box.w / 2, b.y + box.d / 2, b.z0 + b.h / 2),
          rise: motion.us.map((u) => r4(motion.rise(b.n, u) / PITCH)),
        };
      }),
      plates: m.plates.map((p) => {
        const top = { x: p.x + p.topOff[0] * PITCH, y: p.y + p.topOff[1] * PITCH, w: p.topShape[0] * PITCH, d: p.topShape[1] * PITCH, ws: p.topShape[0], ds: p.topShape[1] };
        const riders = m.bricks.filter((b) => b.seat === p.letter || b.straddles.includes(p.letter));
        return {
          key: p.letter, letter: p.letter, name: p.name, ver: p.ver,
          ledger: `${p.range}${p.optional ? ' · optional' : ''} · one build (${p.build}): ${p.files}f · ${fmt(p.sloc)} sloc · ${plural(p.studs, 'stud')} · ${plateWord(p)}`,
          note: plateNote(p),
          // a top wholly under its bricks takes its pin on the flank facing the drawing's corner
          cap: openStud(top, riders) ? at(...openStud(top, riders), p.z0 + p.h + 14) : at(top.x + top.w / 2, top.y + top.d + 6, p.z0 + p.h / 2),
          centre: at(top.x + top.w / 2, top.y + top.d / 2, p.z0 + p.h / 2),
        };
      }),
    };
  }),
};
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

const BRICKS_IN = new Set(BUILD_MODELS.flatMap((m) => m.bricks.map((b) => b.n)));
const PLATES_IN = new Set(BUILD_MODELS.flatMap((m) => m.plates.map((p) => p.letter)));
const NAMES = BUILD_MODELS.map((m) => m.name.toUpperCase());
const CORDS = BUILD_MODELS.reduce((a, m) => a + m.cords.length, 0);
const STRADDLES = BUILD_MODELS.reduce((a, m) => a + m.bricks.reduce((s, b) => s + b.straddles.length, 0), 0);
const CABINET = BUILD_MODELS.filter((m) => !m.atlas);
const ATLAS = BUILD_MODELS.filter((m) => m.atlas);
if (ATLAS.length !== 1) throw new Error(`builds-scene: ${ATLAS.length} builds carry the atlas flag, not one`);

export const BUILDS_META = {
  id: 'builds',
  head: 'SHEET 2C · 3D',
  rev: 'A',
  title: 'THE BUILDS, IN THE ROUND',
  sub: `SHEET 2C'S ${WORD[BUILD_MODELS.length].toUpperCase()} BUILDS IN THE ROUND — ${listOf(NAMES)} · ${WORD[BRICKS_IN.size].toUpperCase()} OF THE BOX'S ${WORD[BUILD_BOX.bricks].toUpperCase()} BRICKS AND ${WORD[PLATES_IN.size].toUpperCase()} OF ITS ${WORD[BUILD_BOX.plates].toUpperCase()} PLATES BUILT · ONE GLTF BINARY PER BUILD · EACH BUILD'S EXPLOSION HALF AGAIN AS HIGH AS ITS ONE CLIP, ASSEMBLE ⇄ EXPLODE · THE CAMERA TURNS TO THREE CORNERS`,
};

/** The index row's verdict, derived from the models. */
export const BUILDS_VERDICT = `sheet 2C's ${WORD[BUILD_MODELS.length]} builds as ${WORD[BUILD_MODELS.length]} glTF binaries in Google's model-viewer, picked by name — ${WORD[CABINET.length]} from the repository's own consumers and ${ATLAS[0].name} from the atlas app — each build's bricks in their hues on the runtime plates they peer, stacked plate by plate, with ${plural(STRADDLES, 'straddle')} and ${plural(CORDS, 'cord')} across the set, and each build's explosion, half again as high, as a clip that lifts the stacked bricks first while the plates stay put`;

const CSS = `
${frameCss('bd', 'bd-read', ['stage', 'bar', 'read'])}
.bd-stage { display: block; position: relative; border: 1.5px solid var(--ink); border-block-end: none; }
.bd-stage:focus-within { outline: max(2px, 0.08em) solid var(--accent); outline-offset: -2px; }
.bd-view { display: block; width: 100%; height: clamp(460px, 64vh, 920px);
  background: radial-gradient(ellipse 70% 60% at 50% 42%, var(--paper) 0%, var(--paper-2) 58%, var(--ground) 100%);
  --poster-color: transparent; --progress-bar-color: var(--accent); }
.bd .bd-bar { border-block-end: 1.5px solid var(--ink); }
.bd-bar .lg i.sw { display: block; width: 20px; height: 12px; border: 1.2px solid var(--ink); }
.bd-bar .lg i.sw-brick { background: linear-gradient(90deg, oklch(74.7% 0.133 80.8), oklch(74.7% 0.133 80.8) 33%, oklch(59.4% 0.111 138.6) 33%, oklch(59.4% 0.111 138.6) 66%, oklch(60.9% 0.115 252.3) 66%); }
.bd-bar .lg i.sw-plate { background: repeating-linear-gradient(180deg, var(--paper) 0 3px, var(--line) 3px 4px); }
.bd-bar .lg i.sw-stud { background: oklch(42.4% 0.077 253.0); border-radius: 50%; width: 14px; }
.bd-bar .lg i.sw-ghost { background: oklch(95.3% 0.012 101.5 / 0.45); border-style: dashed; }
.bd-bar .lg i.sw-cord { height: 8px; border: none; background: radial-gradient(circle at 4px 50%, var(--paper) 2px, var(--ink) 2.5px 3.5px, transparent 4px), radial-gradient(circle at calc(100% - 4px) 50%, var(--paper) 2px, var(--ink) 2.5px 3.5px, transparent 4px), linear-gradient(var(--ink), var(--ink)) center / calc(100% - 8px) 1px no-repeat; }
.bd-bar .lg i.sw-ground { background: oklch(92.9% 0.015 102.5); height: 7px; }
.bd-pick { flex-basis: 100%; min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px 12px; align-items: center;
  font-family: var(--data); font-size: 11px; letter-spacing: 0.12em; color: var(--ink-soft); }
.bd-pick .k { font-weight: 600; letter-spacing: 0.16em; color: var(--ink); }
.bd-builds { display: flex; gap: 6px; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: thin; scrollbar-color: var(--line) transparent;
  padding-block-end: 2px; }
.bd-builds a { flex: none; font: inherit; letter-spacing: inherit; color: var(--ink); background: var(--paper); text-decoration: none;
  border: 1px solid var(--ink); padding: 6px 12px; white-space: nowrap; }
.bd-builds a .nm { color: var(--ink-soft); margin-inline-end: 6px; }
.bd-builds a[aria-current="true"] { background: var(--ink); color: var(--paper); }
.bd-builds a[aria-current="true"] .nm { color: inherit; }
.bd-builds a[data-atlas] { border-style: dashed; border-color: var(--accent); }
@media (hover: hover) and (pointer: fine) { .bd-builds a:not([aria-current="true"]):hover { background: var(--paper-2); } }
.bd-builds a:focus-visible { outline: max(2px, 0.08em) solid var(--accent); outline-offset: -2px; }
.bd-builds a:active { transform: scale(0.97); }
@media (prefers-reduced-motion: no-preference) { .bd-builds a { transition: transform 160ms var(--ease-out, ease-out); } }
.bd-who { grid-column: 2; font-size: 11px; letter-spacing: 0.08em; }
.bd-ctl .grp { display: inline-flex; flex-wrap: wrap; gap: 6px; }
@media (max-width: 560px) { .bd-ctl .touch { white-space: normal; } .bd-pick { grid-template-columns: minmax(0, 1fr); } .bd-who { grid-column: 1; } }
.bd-ctl button[aria-pressed="true"] { background: var(--ink); color: var(--paper); }
.bd-ctl input[type=range] { flex: none; width: 150px; accent-color: var(--accent); }
#bd-play::after { content: "ASSEMBLE"; display: block; height: 0; overflow: clip; visibility: hidden; }
${pinCss('bd-pin', 26, 12)}
.bd-pin[hidden], .bd-parts .pt[hidden] { display: none; }
.bd-pin[data-kind="plate"] { border-radius: 4px; border-color: var(--accent); }
/* a pin or chip without a hue lights in the accent, lettered in paper so the dark theme keeps its contrast */
.bd-pin.on:not([style]), .bd-parts .pt.on:not([style]) { color: var(--paper); }
.bd-parts .pt[data-kind="plate"] .n { border-radius: 3px; border-color: var(--accent); }
${partsCss('bd-parts', { side: 'start', top: 8, cols: 1, font: 11 })}
.bd-read { border: 1.5px solid var(--ink); border-block-start: none; background: var(--paper-2); padding-block: 14px 16px; padding-inline: 22px;
  min-height: 72px; color: var(--ink); --rd-head: 16px; --rd-data: 12px; --rd-prose: 16px;
  --read-reserve: calc(1.3 * var(--rd-head) + 3px + 2 * 1.5 * var(--rd-data) + 4px + 3 * 1.5 * var(--rd-prose)); }
.bd-read h3 { font-family: var(--code); font-size: var(--rd-head); font-weight: 600; letter-spacing: 0.04em; line-height: 1.3;
  margin: 0; word-break: break-word; }
.bd-read h3 i.sw { display: inline-block; width: 18px; height: 11px; margin-inline-end: 8px; border: 1.2px solid var(--ink); vertical-align: baseline; }
.bd-read h3 .n { font-family: var(--data); font-size: 11px; letter-spacing: 0.16em; color: var(--accent);
  margin-inline-end: 10px; vertical-align: 0.12em; white-space: nowrap; }
.bd-read .ledger { font-family: var(--data); font-size: var(--rd-data); letter-spacing: 0.08em; line-height: 1.5;
  color: var(--ink-soft); margin-block: 3px 0; margin-inline: 0; }
.bd-read .note, .bd-read .hint { font-family: var(--prose); font-size: var(--rd-prose); line-height: 1.5; max-width: 66ch;
  margin-block: 4px 0; margin-inline: 0; color: var(--ink-soft); }
@media (max-width: 860px) { .bd-view { height: clamp(420px, 62vh, 620px); } }`;

const LEGEND = [
  ['brick', 'a family brick, in its own colour'],
  ['plate', 'a runtime — a stack of plates, studs on its top plate'],
  ['stud', 'a ringed stud — a brick coupled to that plate'],
  ['ghost', 'an optional peer'],
  ['cord', 'a string with end studs — two 1×1 round plates joined by a cord, a coupling a footprint cannot make, drawn to fit and not massed'],
  ['ground', 'ground — the registry'],
];

const BASIS = `Each model is <code>generator/sheet2c.mjs</code>'s own layout of that build, exported seated as <code>BUILD_MODELS</code> in sheet 2's plan units and written into one glTF binary per build by <code>generator/builds-glb.mjs</code> on <code>generator/brick-glb.mjs</code>'s materials and studs: every brick a cuboid in its own colour edged in ink, every runtime a stack of thin plates scored plate by plate, three to a brick course, with studs on its top plate only and one ringed stud per brick coupled to it, an optional peer translucent, and the ground the page's paper, retinted from the theme's tokens on each turn. Each brick's lift in the <code>assemble</code> clip is the height sheet 2C's exploded panel hovers it above its seat, scaled ×1.5, a brick stacked on another at least a stud's pitch clear of it; the stacked bricks leave first and land last, every hovering brick hangs plumb over each stud it seats on by a dashed leader, a cord, a string with end studs, joins a brick to each runtime it reaches but does not stand on: two 1×1 round plates with their own studs, one seated on a ringed stud of the brick's top and riding its lift, the other on a ringed stud of the runtime, and a cord between their studs, a tube a third of a stud's radius thick that stretches with the lift, and the plates stay put. One stud pitch is one unit; each binary stays under ${fmt(BUILD_GLB_BUDGET / 1024)} KiB. Counted ${BUILD_BOX.counted}, the atlas app's build read from ${BUILD_BOX.atlasApp}; <code>@google/model-viewer</code> ${MV_VERSION} is fetched only when this page is entered, and the clip jumps to its end under <code>prefers-reduced-motion</code>.`;

const ALT = `One of sheet 2C's alternate builds in three dimensions: the family bricks one group of consumers installs, in their own colours, standing on the runtime plates they peer — @uirouter/core the baseplate of every build, lit a one-stud plate beside it that lit-ui-router straddles, and each other runtime a stack of thin plates at its side, joined to the bricks that peer it by cords, each a string with a 1×1 round plate seated on a stud at either end. The explode control lifts the stacked bricks first, then the rest, each half again as high as the sheet draws it, with a dashed leader dropping from each to the stud it seats on.`;

/** The plate: style, section and the JSON island — no init script. */
export function buildsMarkup() {
  const meta = BUILDS_META;
  const pins = DATA.builds.flatMap((b) => [
    ...b.bricks.map((p) => `        <button type="button" class="bd-pin" slot="hotspot-${b.slug}-${p.key}" data-build="${b.slug}" data-key="${p.key}"${p.hue ? ` style="--hue:${p.hue}"` : ''} data-position="${p.cap.map((v) => `${v}m`).join(' ')}" data-normal="0m 1m 0m" aria-pressed="false" aria-label="Brick ${p.n}, ${p.name}"${b.slug === FIRST.slug ? '' : ' hidden'}>${p.n}</button>`),
    ...b.plates.map((p) => `        <button type="button" class="bd-pin" data-kind="plate" slot="hotspot-${b.slug}-${p.key}" data-build="${b.slug}" data-key="${p.key}" data-position="${p.cap.map((v) => `${v}m`).join(' ')}" data-normal="0m 1m 0m" aria-pressed="false" aria-label="Plate ${p.letter}, ${p.name}"${b.slug === FIRST.slug ? '' : ' hidden'}>${p.letter}</button>`),
  ]).join('\n');
  const chips = BUILD_MODELS.flatMap((m) => {
    const attrs = (kind) => ` data-build="${m.slug}" data-kind="${kind}"${m === FIRST ? '' : ' hidden'}`;
    return [
      ...m.bricks.map((b) => ({ n: String(b.n), name: b.name, hue: b.hue, href: hrefOf(m, b.n), attrs: attrs('brick') })),
      ...m.plates.map((p) => ({ n: p.letter, name: p.name, href: hrefOf(m, p.letter), attrs: attrs('plate') })),
    ];
  });
  return `<style>${laneCss('bd')}${CSS}</style>
<section class="sheet bd" id="${meta.id}-scene" aria-label="The Builds in the round — each of sheet 2C's alternate builds as a three-dimensional model that explodes and reassembles">
  <div class="sheet-head"><span class="proj">${PROJECT_MARK} — INTERACTIVE PLATE</span><span class="shno">${meta.head} · REV ${meta.rev}</span></div>
  <h2 class="sheet-title">${articleTitle(meta.title)}</h2>
  <p class="sheet-sub">${meta.sub}</p>
  <div class="bd-frame fillable" id="bd-frame"><button type="button" class="fill" data-fill aria-label="Enlarge this figure, or leave it"></button>
    <div class="bd-stage">
      <model-viewer id="bd-viewer" class="bd-view" src="${DATA.builds[0].glb}" loading="eager" reveal="manual" camera-controls touch-action="pan-y" interaction-prompt="none" camera-orbit="${CORNERS[0].orbit}" max-camera-orbit="${SEATED_MAX}" field-of-view="14deg" min-field-of-view="5deg" max-field-of-view="18deg" exposure="1" shadow-intensity="0" animation-name="assemble" alt="${ALT}">
${pins}
      </model-viewer>
${partsMarkup('bd-parts', 'Parts', chips)}
    </div>
    <div class="bd-bar">
      <div class="bd-pick">
        <span class="k">BUILD</span>
        <nav class="bd-builds" aria-label="Build">
${BUILD_MODELS.map((m, i) => `          <a href="${hrefOf(m)}" data-build="${m.slug}" data-src="${DATA.builds[i].glb}"${m.atlas ? ' data-atlas' : ''} aria-current="${m === FIRST}"><span class="nm">${m.numeral}</span>${m.name.toUpperCase()}</a>`).join('\n')}
        </nav>
        <span class="bd-who" id="bd-who">${consumersLine(FIRST)}</span>
      </div>
      <div class="bd-legend">
${LEGEND.map(([k, t]) => `        <span class="lg"><i class="sw sw-${k}"></i>${t}</span>`).join('\n')}
      </div>
      <div class="bd-ctl">
        <span class="hints"><span class="mouse">DRAG TO ORBIT · SCROLL TO ZOOM · TAP A NUMBER OR A LETTER TO PIN <span class="nw">← → STEP THE PIN</span> <span class="nw">ESC CLEARS</span></span><span class="nw touch">A FINGER ACROSS ORBITS · PINCH TO ZOOM · TAP A NUMBER OR A LETTER TO PIN</span></span>
        <span class="grp" role="group" aria-label="Camera corner">
${CORNERS.map((c, i) => `          <button type="button" data-orbit="${c.orbit}" aria-pressed="${i === 0}">${c.label}</button>`).join('\n')}
        </span>
        <button type="button" id="bd-turn" aria-pressed="false" aria-label="Turn the camera with the clip">TURN</button>
        <button type="button" id="bd-play" disabled>EXPLODE</button>
        <label>EXPLODED <input type="range" id="bd-t" min="0" max="${ASSEMBLE_SECONDS}" step="0.01" value="${ASSEMBLE_SECONDS}" disabled aria-label="Assembly, from exploded to seated"> SEATED</label>
      </div>
    </div>
    <aside class="bd-read" id="bd-info" aria-live="polite"></aside>
  </div>
  ${basisStrip('bd', BASIS)}
</section>
<script type="application/json" id="bd-model">${json(DATA)}</script>`;
}

// The scene, as a module for the app: handed the resolved <model-viewer> module,
// the opening build and the opening pin, it returns { dispose, select }.
const BODY = `${FOCUS_JS}${BUILD_JS}${mvJs(undefined, true)}  var mv = root.querySelector('#bd-viewer');
  var island = root.querySelector('#bd-model');
  if (!mv || !island || !viewer) return undefined;
  var D = JSON.parse(island.textContent);
  var stage = root.querySelector('.bd-stage');
  var info = root.querySelector('#bd-info');
  var who = root.querySelector('#bd-who');
  var play = root.querySelector('#bd-play');
  var slider = root.querySelector('#bd-t');
  var turnBtn = root.querySelector('#bd-turn');
  var corners = Array.prototype.slice.call(root.querySelectorAll('[data-orbit]'));
  var picks = Array.prototype.slice.call(root.querySelectorAll('.bd-builds a[data-build]'));
  var chips = Array.prototype.slice.call(root.querySelectorAll('.bd-parts a.pt'));
  var allPins = Array.prototype.slice.call(mv.querySelectorAll('.bd-pin'));
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var ac = new AbortController();
  var on = function (el, type, fn, capture) { el.addEventListener(type, fn, { signal: ac.signal, capture: Boolean(capture) }); };
  var END = D.end, t = END, raf = 0, pinK = null, loaded = false;
  var bySlug = {};
  D.builds.forEach(function (b) {
    bySlug[b.slug] = b;
    // the picker carries each build's src, so a host that rewrites src attributes reaches every model
    b.src = root.querySelector('.bd-builds a[data-build="' + b.slug + '"]').getAttribute('data-src');
    b.byKey = {};
    b.pins = {};
    b.bricks.concat(b.plates).forEach(function (p) {
      b.byKey[p.key] = p;
      b.pins[p.key] = mv.querySelector('[slot="hotspot-' + b.slug + '-' + p.key + '"]');
    });
    b.order = b.bricks.map(function (p) { return p.key; }).concat(b.plates.map(function (p) { return p.key; }));
    b.top = b.bricks.reduce(function (m, p) { return Math.max(m, p.rise[0]); }, 0);
  });
  var B = bySlug[D.first];
  function idle() {
    return '<p class="hint">Build ' + B.numeral + ', ' + B.name + ': ' + B.bricks.length + ' brick' + (B.bricks.length > 1 ? 's' : '') + ' on ' + B.plates.length + ' plate' + (B.plates.length > 1 ? 's' : '') + '. Tap a number or a letter to read its part; EXPLODE lifts the stacked bricks first, every brick half again as high as sheet 2C draws it, each on a leader over its stud, and the plates stay put.</p>';
  }

  function rise(p) {
    if (!p.rise) return 0;
    var u = t / END, k = 0;
    while (k < B.us.length - 2 && u > B.us[k + 1]) k++;
    var s = Math.min(1, Math.max(0, (u - B.us[k]) / (B.us[k + 1] - B.us[k])));
    return p.rise[k] + (p.rise[k + 1] - p.rise[k]) * s;
  }
  function exploded() { return B.top ? B.bricks.reduce(function (m, p) { return Math.max(m, rise(p)); }, 0) / B.top : 0; }
  var turning = false, moved = false, corner = corners[0].getAttribute('data-orbit'), base = null;
  function swept(at) { var u = at / END; return turning ? ${SWEEP} * (1 - u * u * u) : 0; }
  function rebase(orbit) {
    var p = orbit.split(' ');
    base = { orbit: orbit, az: parseFloat(p[0]), polar: p[1], r: parseFloat(p[2]), unit: p[2].replace(/^[\\d.]+/, '') };
    moved = false;
  }
  function adopt() {
    var o = mv.getCameraOrbit();
    base = { orbit: null, az: o.theta * 180 / Math.PI - swept(t), polar: (o.phi * 180 / Math.PI).toFixed(3) + 'deg', r: o.radius / (1 + ${DOLLY} * exploded()), unit: 'm' };
    moved = false;
  }
  function camera(jump) {
    var e = exploded(), sweep = swept(t);
    mv.maxCameraOrbit = e ? '${EXPLODED_MAX}' : '${SEATED_MAX}';
    mv.cameraOrbit = base.orbit && !e && !sweep ? base.orbit
      : (base.az + sweep).toFixed(3) + 'deg ' + base.polar + ' ' + (base.r * (1 + ${DOLLY} * e)).toFixed(4) + base.unit;
    aim();
    if (jump) mv.jumpCameraToGoal();
  }
  function turn(v) {
    turning = Boolean(v);
    turnBtn.setAttribute('aria-pressed', String(turning));
    rebase(corner);
    camera(reduce.matches);
  }
  rebase(corner);
  function vec(p, k) { return p[0] + 'm ' + (p[1] + k).toFixed(4) + 'm ' + p[2] + 'm'; }
  function aim() {
    if (pinK !== null) { var p = B.byKey[pinK]; mv.cameraTarget = vec(p.centre, rise(p)); return; }
    var e = exploded();
    mv.cameraTarget = e ? 'auto ' + (mv.getBoundingBoxCenter().y + e * B.top / 2).toFixed(4) + 'm auto' : 'auto auto auto';
  }
  function pose(next) {
    if (moved) adopt();
    var was = exploded();
    t = Math.min(END, Math.max(0, next));
    if (loaded) mv.currentTime = Math.min(t, END - 1e-4);
    slider.value = String(t);
    play.textContent = t >= END ? 'EXPLODE' : 'ASSEMBLE';
    B.bricks.forEach(function (p) { mv.updateHotspot({ name: 'hotspot-' + B.slug + '-' + p.key, position: vec(p.cap, rise(p)) }); });
    if (loaded && (was || exploded() || turning)) camera(true);
    else if (pinK !== null) aim();
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function run(to) {
    stop();
    if (reduce.matches) { pose(to); return; }
    var dir = to > t ? 1 : -1, last = performance.now();
    function tick(now) {
      raf = 0;
      var next = t + dir * (now - last) / 1000;
      last = now;
      if (dir > 0 ? next >= to : next <= to) { pose(to); return; }
      pose(next);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  }

  function show(k) {
    if (k === null) { info.innerHTML = idle(); return; }
    var p = B.byKey[k];
    var sw = p.letter ? '' : '<i class="sw" style="background:' + (p.hue || 'var(--paper)') + '"></i>';
    info.innerHTML = '<h3>' + sw + '<span class="n">' + (p.letter ? 'PLATE ' + p.letter : 'BRICK ' + p.n) + '</span>' + p.name + ' ' + p.ver + '</h3>'
      + '<p class="ledger">' + p.ledger + '</p><p class="note">' + p.note + '</p>';
  }
  function member(v) { return v !== null && v !== undefined && B.byKey[String(v)] ? String(v) : null; }
  function pin(k) {
    if (k === pinK) return;
    pinK = k;
    B.order.forEach(function (key) {
      B.pins[key].classList.toggle('on', key === k);
      B.pins[key].setAttribute('aria-pressed', String(key === k));
    });
    parts.light(k);
    aim();
    show(k);
  }
  function tap(k) {
    var next = k === pinK ? null : k;
    pin(next);
    atlasFocusPush(mv, next);
  }

  var loadWait = null, loadDone = null;
  function expectLoad() { loadWait = new Promise(function (resolve) { loadDone = resolve; }); }
  expectLoad();
  // a pick: the src, the picker, the pins and chips of that build; the url hears it through the seam, focus cleared
  function setBuild(slug, push) {
    var next = bySlug[slug] || bySlug[D.first];
    if (next === B) return;
    stop();
    pin(null);
    B = next;
    t = END;
    loaded = false;
    play.disabled = true;
    slider.disabled = true;
    picks.forEach(function (a) { a.setAttribute('aria-current', String(a.getAttribute('data-build') === B.slug)); });
    allPins.forEach(function (el) { el.hidden = el.getAttribute('data-build') !== B.slug; });
    chips.forEach(function (a) { a.hidden = a.getAttribute('data-build') !== B.slug; });
    who.textContent = B.who;
    show(null);
    expectLoad();
    mv.src = B.src;
    if (push) atlasBuildPush(mv, B.slug === D.first ? null : B.slug);
  }

  var parts = partsPanel(root, 'bd-parts', on, tap);
  allPins.forEach(function (el) { on(el, 'click', function () { tap(el.getAttribute('data-key')); }); });
  picks.forEach(function (a) {
    on(a, 'click', function (e) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      setBuild(a.getAttribute('data-build'), true);
    });
  });
  on(play, 'click', function () { run(t >= END ? 0 : END); });
  on(slider, 'input', function () { stop(); pose(Number(slider.value)); });
  corners.forEach(function (c) {
    on(c, 'click', function () {
      corners.forEach(function (o) { o.setAttribute('aria-pressed', String(o === c)); });
      corner = c.getAttribute('data-orbit');
      rebase(corner);
      camera(reduce.matches);
    });
  });
  on(turnBtn, 'click', function () { turn(!turning); });
  on(mv, 'camera-change', function (e) { if (e.detail && e.detail.source === 'user-interaction') moved = true; });
  pinKeys(stage, on, {
    step: function (d) { tap(walk(B.order, pinK, d)); },
    escape: function () { if (pinK === null) return false; tap(pinK); return true; },
  });
  wheelGate(stage, on);

  var TINT = [['cap', '--paper'], ['flank', '--paper-2'], ['edge', '--ink'], ['ghost-cap', '--paper', 0.45], ['ghost-flank', '--paper-2', 0.45], ['ghost-edge', '--ink', 0.45], ['ring', '--accent']];
  function tint() {
    return paint(mv, TINT.map(function (row) { return [row[0], tokenRgb(tokColor(row[1])), row[2]]; }));
  }
  var themeOff = onTheme(tint, on);

  // every load, the first and each pick's: the clip held at its seat, the camera on its corner, the theme on the model
  function boot() {
    if (mv.src !== B.src) return;
    loaded = true;
    mv.play({ repetitions: 1 });
    mv.pause();
    play.disabled = false;
    slider.disabled = false;
    rebase(corner);
    pose(t);
    camera(true);
    var done = loadDone;
    revealPainted(mv, tint).then(function () { done(); });
  }
  on(mv, 'load', boot);
  if (mv.loaded) boot();
  show(null);
  function select(build, focus) {
    setBuild(atlasBuildRead(build) || D.first, false);
    pin(member(atlasFocusRead(focus)));
  }
  select(build, focus);
  var ready = loadWait;

  // verification hook: the build, the clip's clock, the pin, and a clean frame for the card photograph
  window.__buildsScene = {
    ready: ready,
    settled: function () { return loadWait; },
    build: function () { return B.slug; },
    src: function () { return mv.src; },
    pick: function (slug) { setBuild(slug, true); return loadWait; },
    animations: function () { return mv.availableAnimations; },
    time: function () { return t; },
    pose: function (v) { stop(); pose(v); },
    pinned: function () { return pinK; },
    orbit: function () { return mv.getCameraOrbit().toString(); },
    turn: function (v) { turn(v); },
    turning: function () { return turning; },
    photo: function () { allPins.forEach(function (el) { el.style.visibility = 'hidden'; }); parts.hide(); },
  };

  return {
    select: select,
    dispose: function () {
      stop();
      themeOff();
      ac.abort();
      delete window.__buildsScene;
    },
  };
`;

/** emit-app.mjs writes this to app/src/generated/builds-init.js. */
export function buildsInitModule() {
  return `// GENERATED by www/atlas.lit-ui-router.dev/generator/builds-scene.mjs — do not edit.
// Sheet 2C's builds in the round: wires the fragment's <model-viewer> to the picked build,
// its clip, corners and pins once the routed state has loaded the element; returns { dispose, select }.
export async function initBuilds(root, viewer, build, focus) {
${BODY}}
`;
}

export const BUILDS_INIT_DTS = `// GENERATED by www/atlas.lit-ui-router.dev/generator/emit-app.mjs — do not edit.
/** The wired model: its teardown, and the build and pin the url carries as \`build\` and \`focus\`. */
export interface BuildsScene {
  dispose(): void;
  /** Shows build \`build\` (null or a slug no build carries: the first) and pins its part \`focus\` (null clears). */
  select(build: string | null, focus: string | null): void;
}
/** Wires the model inside \`root\`, opening on \`build\` and the \`focus\` pin.
 *  Undefined when there was nothing to wire — no plate, or no viewer. */
export declare function initBuilds(
  root: Element,
  viewer: unknown,
  build: string | null,
  focus: string | null,
): Promise<BuildsScene | undefined>;
`;
