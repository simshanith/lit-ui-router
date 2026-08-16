import { defs } from './chrome.mjs';
import { txt, lines, keyRow } from './helpers.mjs';

const P = 's6';

// Strata, surface (top) to bedrock (bottom).
const strata = [
  {
    name: 'APPLICATION', ex: 'state routers · ui-router',
    addr: 'named state tree', match: 'hierarchy + params', trans: 'guarded, async, cancellable — with resolve and memory',
    fill: `url(#${P}-ha)`, us: true,
  },
  {
    name: 'CLIENT', ex: 'SPA routers · Nav API',
    addr: 'document URL', match: 'route table', trans: 'navigation lifecycle — interceptable, stateful session',
    fill: `url(#${P}-hx)`,
  },
  {
    name: 'EDGE', ex: 'CDNs · workers',
    addr: 'host + path + geo', match: 'ruleset, first match', trans: 'rewrite / proxy / spawn an isolate',
    fill: `url(#${P}-hd)`,
  },
  {
    name: 'SERVER', ex: 'HTTP frameworks',
    addr: 'method + path pattern', match: 'trie / first match', trans: 'request → response, stateless',
    fill: `url(#${P}-hx)`,
  },
  {
    name: 'INTER-NETWORK', ex: 'IP · BGP',
    addr: 'address prefixes', match: 'longest prefix wins', trans: 'next hop — best-effort, no memory at all',
    fill: `url(#${P}-hd)`,
  },
];

const CY = 100, CH = 88, CX = 70, CW = 170;

const rows = strata.map((s, i) => {
  const y = CY + i * CH;
  const mid = y + CH / 2;
  return `<rect x="${CX}" y="${y}" width="${CW}" height="${CH}" class="${s.us ? 'ska' : 'sk'} fnone" ${s.us ? 'stroke-width="2"' : ''}/>
<rect x="${CX}" y="${y}" width="${CW}" height="${CH}" fill="${s.fill}" opacity="${s.us ? 0.9 : 0.5}"/>
${txt(CX + CW / 2, mid - 4, s.name, s.us ? 'lbla' : 'lblb', 'middle')}
${txt(CX + CW / 2, mid + 12, s.ex, 'lblf', 'middle')}
${txt(300, mid - 2, s.addr, 'lbl')}
${txt(510, mid - 2, s.match, 'lbl')}
${lines(700, mid - 8, s.trans.length > 34 ? [s.trans.slice(0, s.trans.lastIndexOf(' ', 34)), s.trans.slice(s.trans.lastIndexOf(' ', 34) + 1)] : [s.trans], 'lbl', 'start', 14)}
${i < strata.length - 1 ? `<line x1="260" y1="${y + CH}" x2="960" y2="${y + CH}" class="skf"/>` : ''}`;
}).join('\n');

const svg = `<svg viewBox="0 0 1000 660" role="img" aria-label="Routing in general drawn as a geological column of five strata, from IP routing at the bedrock up through HTTP servers, edge networks, and client-side routers to application state routing at the surface. Three columns annotate each stratum with its address space, matching function, and transition semantics — the invariant triple every routing plane shares.">
${defs(P)}

<!-- column headers -->
${txt(300, 60, 'ADDRESS SPACE', 'lbls')}
${txt(510, 60, 'MATCHING FUNCTION', 'lbls')}
${txt(700, 60, 'TRANSITION SEMANTICS', 'lbls')}
${txt(CX, 60, 'STRATUM', 'lbls')}
<line x1="${CX}" y1="68" x2="960" y2="68" class="sk"/>

${rows}

<!-- surface + bedrock captions -->
${txt(CX, CY - 10, 'surface — sheets 1–3 of this set live here', 'lbla')}
${txt(CX, CY + 5 * CH + 18, 'bedrock', 'lblf')}

<!-- ascent annotation -->
<path d="M962,${CY + 5 * CH - 12} V${CY + 12}" class="ska" marker-end="url(#${P}-aa)"/>
${txt(962, CY + 5 * CH + 26, 'ascending, transitions gain memory, cancellation, and meaning', 'lbla', 'end')}
</svg>`;

export const sheet6 = {
  num: 6, id: 'planet',
  title: 'THE ROUTING STRATA',
  sub: 'ALTITUDE 6 — routing in general · the altitude where prose outranks pictures',
  scale: 'EVERYTHING',
  form: 'CORE SAMPLE',
  svg,
  caption: 'At the widest altitude the only shared structure is a definition, so the drawing shrinks to a core sample and the writing does the work: five strata, one invariant triple.',
  notes: `
<p><strong>The definition that survives every stratum:</strong> a router is an address space, a matching function, and transition semantics. BGP matches prefixes and forwards with no memory; an HTTP framework matches path patterns into a stateless response; an edge ruleset rewrites and proxies; a SPA router matches a URL into a view tree through a cancellable lifecycle; a state router matches into a named hierarchy through guarded, resolving transitions.</p>
<p><strong>What changes with ascent is the transition.</strong> At the bedrock a transition is a forwarding decision that forgets itself immediately. Each stratum upward, transitions acquire more: statefulness, interceptability, cancellation, resolved data, meaning. By the surface a transition is a first-class object with a lifecycle — which is precisely the layer sheet 1 drew.</p>
<p><strong>Why this sheet is mostly writing:</strong> no mechanism spans these strata — an IP hop and a <code>ui-view</code> activation share a definition, not a wire. Drawing more than a core sample here would be decoration, and the reference's own rule applies: the drawing earns exactly as much ink as the mechanism deserves.</p>`,
  key: [
    keyRow(`<rect x="2" y="2" width="40" height="14" fill="url(#s6-ha)"/>`, 'the stratum this repo inhabits'),
    keyRow(`<rect x="2" y="2" width="40" height="14" fill="url(#s6-hx)"/>`, 'strata below (shared definition only)'),
    keyRow('<line x1="22" y1="16" x2="22" y2="2" class="ska"/>', 'ascent: transitions gain semantics'),
  ].join('\n'),
};
