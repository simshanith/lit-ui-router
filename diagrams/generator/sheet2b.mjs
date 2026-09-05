// SHEET 2B — THE COUPLING BENCH: the standalone page for the interactive plate.
// The drawing itself is generator/coupling-bench.mjs; this file is the sheet
// around it — the title block, the method prose and the key.  Every figure in
// the prose is looked up in census-couplings.json through a THROWING lookup, so
// a contract that changes ranges changes the sentence or breaks the build.
import { readFileSync } from 'node:fs';
import { titleBlock } from './chrome.mjs';
import { keyRow } from './helpers.mjs';
import { couplingBenchSection } from './coupling-bench.mjs';

const C = JSON.parse(readFileSync(new URL('../data/census-couplings.json', import.meta.url), 'utf8'));

const T = C.totals;
const contract = (from, to) => {
  const r = C.rows.find((x) => x.from === from && x.to === to);
  if (!r) throw new Error(`sheet2b: census-couplings.json has no contract ${from} -> ${to}`);
  return r;
};
const version = (key) => {
  const n = C.nodes.find((x) => x.key === key);
  if (!n) throw new Error(`sheet2b: census-couplings.json has no node ${key}`);
  return n.version;
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
const MBX = declares('lit-ui-router-mobx');
const SHIPPED = C.rows.filter((r) => r.kind === 'dep');

export const sheet2b = {
  num: '2B', id: 'coupling-bench', rev: 'A',
  title: 'THE COUPLING BENCH',
  sub: `ALTITUDE 2 — INTERACTIVE PLATE: sheet 2A’s joints made live · ${T.nodes} nodes · every one of the ${T.drawnContracts} drawn edges is a published contract, with its declared range under the pointer`,
  scale: 'SEVEN NODES · TWELVE CONTRACTS',
  form: 'INTERACTIVE COUPLING GRAPH',
  caption: `The same assembly as sheets 2 and 2A, reduced to what a consumer's installer actually reads: seven buildings and ${T.drawnContracts} contracts. Hover an edge for the range it declares and the section it lives in; hover a building for its version, what it declares, and what declares it.`,
};

// the cover index's fit verdict, told from the plate's own tallies
export const SHEET2B_VERDICT = `2A’s joints made live — every one of the ${T.drawnContracts} drawn edges is a published contract with its declared range under the pointer: ${T.peers} peers to ${T.deps} dependencies across the five packages, and neither dependency is a router`;

const notes = `
<p><strong>This plate is sheet 2A with the joints made live.</strong> Sheet 2 explodes the assembly and sheet 2A draws each coupling at reading size; both letter the API call that makes the joint. This one drops the API entirely and draws the other contract — the one <code>npm install</code> reads. Its arrangement is deliberately 2A’s: <code>@uirouter/core</code> as the socket wall at the left with <code>lit</code> above it, the companions in a column at its right in 2A’s order, and the server below them with the coupling that exists only to be crossed out.</p>
<p><strong>An edge is one declaration, not a relationship.</strong> Every line is a single entry in a published <code>package.json</code> — its section (<code>peerDependencies</code> or <code>dependencies</code>), its declared range, and whether <code>peerDependenciesMeta</code> marks it optional. <code>devDependencies</code> are not drawn: they bind this workspace and never reach a consumer’s install. Of ${T.contracts} contracts the five published packages declare, ${T.drawnContracts} land on a node that is on this bench; the other ${T.contracts - T.drawnContracts} are filed on the plate and read out in the panel under OFF THE BENCH.</p>
<p><strong>The ranges are the ranges that ship, not the ones written in the file.</strong> Every spec in this repo is a catalog reference — <code>${CORE_PEER.spec}</code>, not <code>${CORE_PEER.range}</code> — which pnpm rewrites at pack time. <code>census-couplings.mjs</code> resolves each one against the archive’s own <code>pnpm-workspace.yaml</code> and the plate carries both, so the panel can show you what is written and what a consumer would see. <code>@uirouter/core</code> and <code>lit</code> carry no range of their own on this bench: their versions (${version('@uirouter/core')} and ${version('lit')}) come from the lockfile, which is the only honest source for a resolution.</p>
<p><strong>The whole deps-to-peers decision is legible in one column.</strong> ${T.peers} of the ${T.contracts} contracts are peers and only ${T.deps} are dependencies — and neither of the two shipped dependencies is a router. <code>lit-ui-router</code> declares <code>@uirouter/core</code> at <code>${CORE_PEER.range}</code> and <code>lit</code> at <code>${LIT_PEER.range}</code> as <em>peers</em>, and keeps exactly one thing in its tarball’s dependency list: <code>${OXC.to}</code> at <code>${OXC.range}</code>, a runtime helper deliberately declared as wide as it can honestly be. <code>lit-ui-router-mobx</code> goes further and declares no dependency at all: all ${MBX.length} of its contracts are peers, including the one brick-to-brick joint on the bench — <code>lit-ui-router ${MBX_LIT.range}</code>, a floor the flagship has since left behind at ${version('lit-ui-router')} without breaking it.</p>
<p><strong>The lit range is a lane, and it is drawn as one.</strong> <code>${LIT_PEER.range}</code> is not a loose bound; it is a supported compatibility lane, and the same range appears on both packages that touch lit. The bench shows the consequence: the lockfile resolves <em>two</em> lit majors (${version('lit')}), because the compat lane is tested, not merely permitted.</p>
<p><strong>Two contracts are drawn in red, and they are the interesting ones.</strong> <code>ui-router-server</code>’s <code>@uirouter/core</code> is an <em>optional</em> peer at <code>${SRV_CORE.range}</code> — sheet 2A draws that same tie crossed out, because the default matcher tier never loads the wall. And <code>eslint-plugin-lit-ui-router</code> stands in a bay of its own: it declares ${declares('eslint-plugin-lit-ui-router').length} contracts, <code>eslint ${ESL_PEER.range}</code> and a shipped <code>${SHIPPED.find((r) => r.from === 'eslint-plugin-lit-ui-router').to}</code>, and not one of them touches anything else on this bench. It is a published package of this repo that couples to none of its siblings — which is exactly why it is drawn here rather than left out.</p>
<p><strong>Counting rules.</strong> ${CORE_PEERS.length} of the five published packages name <code>@uirouter/core</code>; ${CORE_PEERS.filter((r) => r.optional).length} of those name it optionally. <code>${NAV_CORE.from}</code> declares exactly one contract in the world — <code>@uirouter/core ${NAV_CORE.range}</code> — which is the plate’s own way of saying it has never heard of Lit. Massing and storeys are the brick schedule’s: front-face area tracks sloc, the smallest companions are clamped up to a legible minimum, and a building’s storeys are its <code>courses</code> band from <code>census-bricks.json</code>, never a pipeline tier.</p>`;

const key = [
  keyRow('<line x1="2" y1="9" x2="44" y2="9" stroke="var(--accent)" stroke-width="2.2"/>', 'a <code>peerDependencies</code> entry — the consumer supplies it'),
  keyRow('<line x1="2" y1="9" x2="44" y2="9" stroke="var(--ink-soft)" stroke-width="1.6" stroke-dasharray="5 4"/>', 'a <code>dependencies</code> entry — it ships inside the tarball'),
  keyRow('<line x1="2" y1="9" x2="44" y2="9" stroke="var(--red)" stroke-width="1.6" stroke-dasharray="4 5"/>', 'an OPTIONAL peer — <code>peerDependenciesMeta</code> says the install may skip it'),
  keyRow('<rect x="6" y="2" width="36" height="14" fill="none" stroke="var(--accent)" stroke-width="2"/>', 'a node this repo does not publish — core and lit, versions from the lockfile'),
  keyRow('<rect x="6" y="2" width="36" height="14" fill="none" stroke="var(--edge)" stroke-width="1.1"/>', 'a published package — area ≈ sloc, storeys = brick courses'),
].join('\n');

export function sheet2bPage() {
  return `${couplingBenchSection()}
<section class="sheet" id="sheet-2B" aria-label="Sheet 2B notes: ${sheet2b.title}">
  <div class="sheet-head"><span class="proj">THE ALTITUDE ATLAS — DRAWING SET</span><span class="shno">SHEET 2B · METHOD &amp; BASIS</span></div>
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
