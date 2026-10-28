// SHEET 2B — THE COUPLING BENCH: the standalone page for the interactive plate.
// The drawing itself is generator/coupling-bench.mjs; this file is the sheet
// around it — the title block, the method prose and the key.  Every figure in
// the prose is looked up in census-couplings.json through a THROWING lookup, so
// a contract that changes ranges changes the sentence or breaks the build.
import { readFileSync } from 'node:fs';
import { PROJECT_MARK, titleBlock } from './chrome.mjs';
import { keyRow, npmUrl } from './helpers.mjs';
import { BENCH_COLUMNS, CORE_ONLY, TWO_TIES, couplingBenchSection } from './coupling-bench.mjs';

const C = JSON.parse(readFileSync(new URL('../data/census-couplings.json', import.meta.url), 'utf8'));

const T = C.totals;
const contract = (from, to) => {
  const r = C.rows.find((x) => x.from === from && x.to === to);
  if (!r) throw new Error(`sheet2b: census-couplings.json has no contract ${from} -> ${to}`);
  return r;
};
const node = (key) => {
  const n = C.nodes.find((x) => x.key === key);
  if (!n) throw new Error(`sheet2b: census-couplings.json has no node ${key}`);
  return n;
};
const version = (key) => node(key).version;
// a package's registry page: a bench node, or a contract the plate files off the bench
const npmLink = (name, text = `<code>${name}</code>`) => {
  if (!C.nodes.some((x) => x.key === name) && !C.rows.some((r) => r.to === name)) throw new Error(`sheet2b: census-couplings.json names no package ${name}`);
  return `<a href="${npmUrl(name)}">${text}</a>`;
};
// the homes the notes name off the plate: npm's install and manifest docs, pnpm catalogs, the workspace file
const HOME = {
  install: 'https://docs.npmjs.com/cli/v11/commands/npm-install',
  manifest: 'https://docs.npmjs.com/cli/v11/configuring-npm/package-json',
  peerMeta: 'https://docs.npmjs.com/cli/v11/configuring-npm/package-json#peerdependenciesmeta',
  catalogs: 'https://pnpm.io/catalogs',
  workspace: 'https://github.com/simshanith/lit-ui-router/blob/main/pnpm-workspace.yaml',
};
const declaredBy = (to) => C.rows.filter((r) => r.to === to);
const declares = (from) => C.rows.filter((r) => r.from === from);

const CORE_PEER = contract('lit-ui-router', '@uirouter/core');
const LIT_PEER = contract('lit-ui-router', 'lit');
const OXC = contract('lit-ui-router', '@oxc-project/runtime');
const SRV_CORE = contract('ui-router-server', '@uirouter/core');
const MBX_LIT = contract('lit-ui-router-mobx', 'lit-ui-router');
const NAV_CORE = contract('ui-router-navigation-location-plugin', '@uirouter/core');
const ESL_PEER = contract('eslint-plugin-lit-ui-router', 'eslint');
const CORE_PEERS = declaredBy('@uirouter/core');
const LIT_PEERS = declaredBy('lit');
const SSR_LIT = contract('lit-ui-router-ssr', 'lit-ui-router');
const SSR_SRV = contract('lit-ui-router-ssr', 'ui-router-server');
const MBX = declares('lit-ui-router-mobx');
const SHIPPED = C.rows.filter((r) => r.kind === 'dep');
// "no router among the shipped dependencies" and the helper's other carriers are read, never typed
if (SHIPPED.some((r) => /ui-?router/.test(r.to))) throw new Error('sheet2b: a shipped dependency is a router, and the notes say none is');
if (declares('lit-ui-router').filter((r) => r.kind === 'dep').length !== 1) throw new Error('sheet2b: lit-ui-router no longer ships exactly one dependency');
if (MBX.some((r) => r.kind === 'dep')) throw new Error('sheet2b: lit-ui-router-mobx declares a dependency, and the notes say it declares none');
const OXC_ALSO = SHIPPED.filter((r) => r.to === OXC.to && r.from !== OXC.from);
if (OXC_ALSO.some((r) => r.range !== OXC.range)) throw new Error('sheet2b: another package ships the oxc runtime helper at a different range');
const NO_ROUTER = T.deps === 2 ? 'neither of the two shipped dependencies is a router' : `none of the ${T.deps} shipped dependencies is a router`;
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const Cap = (w) => w[0].toUpperCase() + w.slice(1);
const listOf = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
// the two-tie paragraph names ssr, lit-ui-router-effect, lit-ui-router-signals, lit-ui-router-mobx and the registry, in that order of telling
if (TWO_TIES.map(([k]) => k).sort().join() !== 'lit-ui-router-effect,lit-ui-router-mobx,lit-ui-router-signals,lit-ui-router-ssr,ui-router-registry')
  throw new Error(`sheet2b: the notes name ssr, lit-ui-router-effect, lit-ui-router-signals, lit-ui-router-mobx and ui-router-registry as the nodes that tie two siblings or more, but the bench has [${TWO_TIES.map(([k]) => k)}]`);
// the registry's sibling ties, every one optional and every one a renderer-free package
const REG_SIBS = TWO_TIES.find(([k]) => k === 'ui-router-registry')[1].map((to) => contract('ui-router-registry', to));
if (!REG_SIBS.every((r) => r.optional && r.kind === 'peer') || REG_SIBS.map((r) => r.to).sort().join() !== 'ui-router-effect,ui-router-mobx,ui-router-signals')
  throw new Error(`sheet2b: the notes call the registry's sibling ties optional peers on the three renderer-free packages, and the plate files [${REG_SIBS.map((r) => `${r.to} ${r.optional ? 'optional ' : ''}${r.kind}`)}]`);
// the drawn ties in red: every optional contract that lands on the bench
const RED_TIES = C.rows.filter((r) => r.drawn && r.optional);
if (RED_TIES.some((r) => r.from !== 'ui-router-server' && r.from !== 'ui-router-registry')) throw new Error(`sheet2b: the red paragraph tells the server's and the registry's optional ties, and the plate draws [${RED_TIES.map((r) => `${r.from} -> ${r.to}`)}]`);
// the middle-column paragraph puts the navigation plugin on the wall's baseline among the core-only nodes
if (!CORE_ONLY.includes('ui-router-navigation-location-plugin')) throw new Error(`sheet2b: the notes stand the navigation plugin in the core-only column, but it holds [${CORE_ONLY}]`);
const MBX_UMX = contract('lit-ui-router-mobx', 'ui-router-mobx');
const MBX_SIBS = TWO_TIES.find(([k]) => k === 'lit-ui-router-mobx')[1];
const SIG_LIT = contract('lit-ui-router-signals', 'lit-ui-router');
const SIG_USG = contract('lit-ui-router-signals', 'ui-router-signals');
const EFF_LIT = contract('lit-ui-router-effect', 'lit-ui-router');
const EFF_UEF = contract('lit-ui-router-effect', 'ui-router-effect');
// the lit lane is the flagship's range; a package that declares another is named off it
const ON_LANE = LIT_PEERS.filter((r) => r.range === LIT_PEER.range);
const OFF_LANE = LIT_PEERS.filter((r) => r.range !== LIT_PEER.range);
if (ON_LANE.length < 2) throw new Error('sheet2b: the notes call the flagship’s lit range a lane, but no other package declares it');
const LANE_COUNT = OFF_LANE.length ? `${ON_LANE.length} of the ${LIT_PEERS.length}` : `all ${LIT_PEERS.length}`;
const OFF_CLAUSE = OFF_LANE.map((r) => `; <code>${r.from}</code> narrows it to <code>${r.range}</code>`).join('');
const OXC_CLAUSE = OXC_ALSO.length ? `; ${OXC_ALSO.map((r) => `<code>${r.from}</code>`).join(' and ')} ${OXC_ALSO.length === 1 ? 'ships' : 'ship'} the same helper at the same range` : '';

export const sheet2b = {
  num: '2B', id: 'coupling-bench', rev: 'I',
  title: 'THE COUPLING BENCH',
  sub: `ALTITUDE 2 — INTERACTIVE PLATE: sheet 2A’s joints made live · ${T.nodes} nodes in ${WORD[BENCH_COLUMNS]} columns, every tie a straight run · each of the ${T.drawnContracts} drawn edges is a published contract, with its declared range under the pointer`,
  scale: `${T.nodes} NODES · ${T.drawnContracts} DRAWN CONTRACTS`,
  form: 'INTERACTIVE COUPLING GRAPH',
  caption: `The same assembly as sheets 2 and 2A, reduced to what a consumer's installer actually reads: ${T.nodes} buildings and ${T.drawnContracts} contracts. Hover an edge for the range it declares and the section it lives in; hover a building for its version, what it declares, and what declares it.`,
};

// the cover index's fit verdict, told from the plate's own tallies
export const SHEET2B_VERDICT = `2A’s joints made live — every one of the ${T.drawnContracts} drawn edges is a published contract with its declared range under the pointer: ${T.peers} peers to ${T.deps} dependencies across the ${T.published} packages, and ${T.deps === 2 ? 'neither dependency is a router' : 'no dependency is a router'}`;

const notes = `
<p><strong>This plate is sheet 2A with the joints made live.</strong> Sheet 2 explodes the assembly and sheet 2A draws each coupling at reading size; both letter the API call that makes the joint. This one drops the API entirely and draws the other contract — the one <a href="${HOME.install}"><code>npm install</code></a> reads. Its arrangement is deliberately 2A’s: ${npmLink('@uirouter/core')} as the socket wall at the left with ${npmLink('lit')} above it, the lit companions in a column at the right in 2A’s order, the server below them with the coupling that exists only to be crossed out, and beyond that column effect and ssr, which tie the flagship from outside it, with ${npmLink('ui-router-signals')} standing over them.</p>
<p><strong>The middle column is an argument, not a spacer.</strong> ${LIT_PEERS.length} of the ${T.published} published packages declare <code>lit</code> outright; ${listOf(CORE_ONLY.map((k) => npmLink(k)))} need neither it nor anything that does, and the bench says so by standing them in a column of their own between the wall and the lit column, the navigation plugin on the wall’s own baseline. Every other building on this bench reaches left across at least two column gaps; these ${WORD[CORE_ONLY.length]} reach across one, the navigation plugin along a straight horizontal run, and that run is the whole of its coupling. With that column standing clear, nothing sits between ${npmLink('lit-ui-router-mobx')} and ${npmLink('lit-ui-router')} either, so their tie is a plain vertical. Every line on the plate is straight by construction: the generator <em>throws</em> if a same-column tie is laid through a third building, so a curve drawn around a neighbour is a build error rather than a layout choice.</p>
<p><strong>An edge is one declaration, not a relationship.</strong> Every line is a single entry in a published <a href="${HOME.manifest}"><code>package.json</code></a> — its section (<code>peerDependencies</code> or <code>dependencies</code>), its declared range, and whether <a href="${HOME.peerMeta}"><code>peerDependenciesMeta</code></a> marks it optional. <code>devDependencies</code> are not drawn: they bind this workspace and never reach a consumer’s install. Of ${T.contracts} contracts the ${T.published} published packages declare, ${T.drawnContracts} land on a node that is on this bench; the other ${T.contracts - T.drawnContracts} are filed on the plate and read out in the panel under OFF THE BENCH — ${npmLink('effect')}, ${npmLink('@lit-labs/ssr')}, ${npmLink('eslint')} and the rest, contracts on things this repo neither publishes nor draws.</p>
<p><strong>${Cap(WORD[TWO_TIES.length])} nodes tie two siblings or more, and the first is the reason the bench grew a column.</strong> ${npmLink('lit-ui-router-ssr')} declares ${npmLink('lit-ui-router', `<code>lit-ui-router ${SSR_LIT.range}</code>`)} <em>and</em> ${npmLink('ui-router-server', `<code>ui-router-server ${SSR_SRV.range}</code>`)}. It cannot stand in the companions column: a tie laid down that column to the flagship would run straight through <code>lit-ui-router-mobx</code>, and the generator throws on exactly that rather than bowing the line around it. So it stands one column further out with ${npmLink('lit-ui-router-effect')}, which declares <code>lit-ui-router ${EFF_LIT.range}</code> <em>and</em> ${npmLink('ui-router-effect', `<code>ui-router-effect ${EFF_UEF.range}</code>`)}: its flagship tie has the same shape as mobx’s and the same problem, and its second tie runs from that outer column back across the bench to <code>ui-router-effect</code> in the core-only column. ${npmLink('lit-ui-router-signals')} declares <code>lit-ui-router ${SIG_LIT.range}</code> <em>and</em> <code>ui-router-signals ${SIG_USG.range}</code>, and it can stand in the companions column, over the flagship, because nothing sits between them; its other sibling stands over effect, where the tie between them runs short and its own tie to the wall clears the flagship’s. ${npmLink('lit-ui-router-mobx')} declares <code>lit-ui-router ${MBX_LIT.range}</code> <em>and</em> ${npmLink('ui-router-mobx', `<code>ui-router-mobx ${MBX_UMX.range}</code>`)}: its flagship tie is the plain vertical down the companions column, and its second runs long from that column back across the bench to <code>ui-router-mobx</code>, which stands at the foot of the core-only column. ${npmLink('ui-router-registry')} ties ${WORD[REG_SIBS.length]}, every one an optional peer at ${listOf([...new Set(REG_SIBS.map((r) => `<code>${r.range}</code>`))])} — ${listOf(REG_SIBS.map((r) => `<code>${r.to}</code>`))}, the hooks its adapter entries type — so it stands between <code>ui-router-effect</code> and <code>ui-router-mobx</code>, where both of those ties are adjacent runs and its third runs out to <code>ui-router-signals</code>.</p>
<p><strong>The ranges are the ranges that ship, not the ones written in the file.</strong> Every spec in this repo is a <a href="${HOME.catalogs}">catalog</a> reference — <code>${CORE_PEER.spec}</code>, not <code>${CORE_PEER.range}</code> — which pnpm rewrites at pack time. <code>census-couplings.mjs</code> resolves each one against the archive’s own <a href="${HOME.workspace}"><code>pnpm-workspace.yaml</code></a> and the plate carries both, so the panel can show you what is written and what a consumer would see. <code>@uirouter/core</code> and <code>lit</code> carry no range of their own on this bench: their versions (${version('@uirouter/core')} and ${version('lit')}) come from the lockfile, which is the only honest source for a resolution.</p>
<p><strong>The whole deps-to-peers decision is legible in one column.</strong> ${T.peers} of the ${T.contracts} contracts are peers and only ${T.deps} are dependencies — and ${NO_ROUTER}. <code>lit-ui-router</code> declares <code>@uirouter/core</code> at <code>${CORE_PEER.range}</code> and <code>lit</code> at <code>${LIT_PEER.range}</code> as <em>peers</em>, and keeps exactly one thing in its tarball’s dependency list: ${npmLink(OXC.to)} at <code>${OXC.range}</code>, a runtime helper deliberately declared as wide as it can honestly be${OXC_CLAUSE}. <code>lit-ui-router-mobx</code> goes further and declares no dependency at all: all ${MBX.length} of its contracts are peers, including its ${WORD[MBX_SIBS.length]} brick-to-brick joints — <code>lit-ui-router ${MBX_LIT.range}</code>, a floor the flagship sits above at ${version('lit-ui-router')}, and <code>ui-router-mobx ${MBX_UMX.range}</code>, a floor its store sits above at ${version('ui-router-mobx')}.</p>
<p><strong>The lit range is a lane, and it is drawn as one.</strong> <code>${LIT_PEER.range}</code> is not a loose bound; it is a supported compatibility lane, and the same range appears on ${LANE_COUNT} packages that declare lit${OFF_CLAUSE}. The bench shows the consequence: the lockfile resolves <em>two</em> lit majors (${version('lit')}), because the compat lane is tested, not merely permitted.</p>
<p><strong>${Cap(WORD[RED_TIES.length])} contracts are drawn in red, and they are the interesting ones.</strong> <code>ui-router-server</code>’s <code>@uirouter/core</code> is an <em>optional</em> peer at <code>${SRV_CORE.range}</code> — sheet 2A draws that same tie crossed out, because the default matcher tier never loads the wall. The registry’s ${WORD[REG_SIBS.length]} sibling ties are optional too: an app that types none of those hooks installs none of those packages. And ${npmLink('eslint-plugin-lit-ui-router')} stands in a bay of its own: it declares ${declares('eslint-plugin-lit-ui-router').length} contracts, <code>eslint ${ESL_PEER.range}</code> and a shipped <code>${SHIPPED.find((r) => r.from === 'eslint-plugin-lit-ui-router').to}</code>, and not one of them touches anything else on this bench. It is a published package of this repo that couples to none of its siblings — which is exactly why it is drawn here rather than left out.</p>
<p><strong>Counting rules.</strong> ${CORE_PEERS.length} of the ${T.published} published packages name <code>@uirouter/core</code>; ${CORE_PEERS.filter((r) => r.optional).length} of those name it optionally. <code>${NAV_CORE.from}</code> declares exactly one contract in the world — <code>@uirouter/core ${NAV_CORE.range}</code> — which is the plate’s own way of saying it has never heard of Lit. Massing and storeys are the brick schedule’s: front-face area tracks sloc, the smallest companions are clamped up to a legible minimum, and a building’s storeys are its <code>courses</code> band from <code>census-bricks.json</code>, never a pipeline tier.</p>`;

const key = [
  keyRow('<line x1="2" y1="9" x2="44" y2="9" stroke="var(--accent)" stroke-width="2.2"/>', 'a <code>peerDependencies</code> entry — the consumer supplies it'),
  keyRow('<line x1="2" y1="9" x2="44" y2="9" stroke="var(--ink-soft)" stroke-width="1.6" stroke-dasharray="5 4"/>', 'a <code>dependencies</code> entry — it ships inside the tarball'),
  keyRow('<line x1="2" y1="9" x2="44" y2="9" stroke="var(--red)" stroke-width="1.6" stroke-dasharray="4 5"/>', 'an OPTIONAL peer — <code>peerDependenciesMeta</code> says the install may skip it'),
  keyRow('<rect x="6" y="2" width="36" height="14" fill="none" stroke="var(--accent)" stroke-width="2"/>', 'a node this repo does not publish — core and lit, versions from the lockfile'),
  keyRow('<rect x="6" y="2" width="36" height="14" fill="none" stroke="var(--edge)" stroke-width="1.1"/>', 'a published package — area ≈ sloc, storeys = brick courses'),
].join('\n');

export function sheet2bPage() {
  return `${couplingBenchSection({ caption: sheet2b.caption })}
<section class="sheet" id="sheet-2B" aria-label="Sheet 2B notes: ${sheet2b.title}">
  <div class="sheet-head"><span class="proj">${PROJECT_MARK} — DRAWING SET</span><span class="shno">SHEET 2B · METHOD &amp; BASIS</span></div>
  <div class="notes-grid">
    <div class="notes">
      <h3>GENERAL NOTES</h3>
      ${notes}
    </div>
    <div class="keyblock">
      <h3>KEY</h3>
      <table>${key}</table>
      ${titleBlock(sheet2b)}
    </div>
  </div>
</section>`;
}
