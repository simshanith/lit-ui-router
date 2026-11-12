import { html, nothing, svg, type TemplateResult } from 'lit';
import type { Row, UIRouterDevtools } from '../ui-router-devtools.ts';
import type { StateInfo } from '../schema.ts';
import { ancestorsOf, type Tx } from '../fold.ts';
import { edgeWeight, observedEdges } from '../edges.ts';
import { segment, truncateMiddle } from '../notation.ts';
import { markGlyph, markLabel, stateMarks } from './glyphs.ts';
import {
  chooseRung,
  pack,
  type Box,
  type Metrics,
  type Placed,
  type Rung,
  type Size,
} from './pack.ts';
import {
  route,
  visibleEnd,
  type RouteBox,
  type Routed,
  type RouteEdge,
} from './route.ts';
import { facts, label, onTreeKey, words } from './tree.ts';

/** Below this inline size the nested layout is the Outline with borders, so it is not offered. */
export const NESTED_MIN_WIDTH = 560;

const METRICS: Metrics = { head: 24, pad: 12, gap: 16 };

const SMALL_METRICS: Metrics = { head: 20, pad: 8, gap: 12 };

const LEAD = 20;

const CHAR = 6.7;

interface Options {
  collapse: boolean;
  merge: boolean;
  truncate: boolean;
  small: boolean;
}

const OPTIONS: Record<Exclude<Rung, 'tree'>, Options> = {
  expanded: { collapse: false, merge: false, truncate: false, small: false },
  collapsed: { collapse: true, merge: false, truncate: false, small: false },
  merged: { collapse: true, merge: true, truncate: false, small: false },
  truncated: { collapse: true, merge: true, truncate: true, small: false },
  small: { collapse: true, merge: true, truncate: true, small: true },
};

export interface NestedLayout {
  rung: Rung;
  options: Options;
  placed: Placed;
  /** Drawn boxes in tree order, for the arrow keys. */
  rows: Row[];
  /** Names of the compounds drawn with their children. */
  open: ReadonlySet<string>;
}

let context: CanvasRenderingContext2D | null | undefined;

// Label widths come from a canvas, so packing needs no render; without one, from a per-character estimate.
const textWidth = (text: string, font: string): number => {
  context ??= globalThis.document?.createElement('canvas').getContext('2d');

  if (!context) return text.length * CHAR;
  context.font = font;

  return context.measureText(text).width;
};

interface Build {
  host: UIRouterDevtools;
  children: Map<string | null, StateInfo[]>;
  /** Compounds on the active path or holding the selection; these never collapse on their own. */
  keep: ReadonlySet<string>;
  options: Options;
  family: string;
}

const isOpen = ({ host, keep, options }: Build, name: string): boolean =>
  host._mapOpen.get(name) ?? (!options.collapse || keep.has(name));

const countUnder = (build: Build, name: string): number =>
  (build.children.get(name) ?? []).reduce(
    (total, child) => total + 1 + countUnder(build, child.name),
    0,
  );

const nameOf = (state: StateInfo, options: Options): string =>
  options.truncate ? truncateMiddle(segment(state.name)) : segment(state.name);

const labelWidth = (
  build: Build,
  state: StateInfo,
  collapsed: boolean,
): number => {
  const { host, options, family } = build;
  const size = options.small ? 11 : 12;
  const weight = state.name === host._model.current.name ? 700 : 400;
  const marks = stateMarks(state, host._model.states).length;

  const count = collapsed
    ? 8 + String(countUnder(build, state.name)).length * 7
    : 0;

  return Math.ceil(
    36 +
      textWidth(nameOf(state, options), `${weight} ${size}px ${family}`) +
      count +
      (marks ? 8 + marks * 16 : 0) +
      (state.future ? 44 : 0) +
      8,
  );
};

const buildBox = (build: Build, state: StateInfo): Box => {
  const kids = build.children.get(state.name) ?? [];
  const open = kids.length > 0 && isOpen(build, state.name);
  const children = open ? kids.map((kid) => buildBox(build, kid)) : [];

  const merge =
    build.options.merge &&
    children.length === 1 &&
    children[0].children.length > 0;

  for (const child of children)
    if (!merge && state.redirectTo === child.name) child.lead = LEAD;

  return {
    name: state.name,
    label: labelWidth(build, state, kids.length > 0 && !open),
    merge,
    children,
  };
};

const keepOpen = (host: UIRouterDevtools): Set<string> => {
  const { states, current } = host._model;
  const tx = host._inspect === 'tx' ? host._tx(host._selectedTx) : undefined;
  const origin = tx && host._origin(tx);

  const names = [
    current.name,
    host._selectedState,
    tx?.from,
    tx?.to,
    origin?.from,
    origin?.to,
  ];

  const keep = new Set<string>();

  for (const name of names) {
    if (!name) continue;
    keep.add(name);
    ancestorsOf(states, name).forEach((ancestor) => keep.add(ancestor));
  }

  return keep;
};

const rowsOf = (
  boxes: readonly Box[],
  states: ReadonlyMap<string, StateInfo>,
  children: Build['children'],
  depth = 1,
): Row[] =>
  boxes.flatMap((box, index) => [
    {
      state: states.get(box.name)!,
      depth,
      hasChildren: (children.get(box.name) ?? []).length > 0,
      setsize: boxes.length,
      posinset: index + 1,
    },
    ...rowsOf(box.children, states, children, depth + 1),
  ]);

const openOf = (boxes: readonly Box[]): string[] =>
  boxes.flatMap((box) =>
    box.children.length ? [box.name, ...openOf(box.children)] : [],
  );

const cache = new WeakMap<
  UIRouterDevtools,
  { content: string; key: string; layout: NestedLayout }
>();

/** Packs the state tree for the Map viewport, stepping down the fit ladder until it fits. */
export const layoutNested = (host: UIRouterDevtools): NestedLayout => {
  const { states, current } = host._model;
  const viewport = host._mapSize;
  const keep = keepOpen(host);
  const family = getComputedStyle(host).fontFamily;

  const content = JSON.stringify([
    states,
    current.name,
    [...keep],
    [...host._mapOpen],
    family,
  ]);

  const key = content + JSON.stringify(viewport);

  const cached = cache.get(host);

  if (cached?.key === key) return cached.layout;

  const children = host._children();
  const byName = new Map(states.map((state) => [state.name, state]));

  const boxesAt = (rung: Exclude<Rung, 'tree'>) => {
    const build = { host, children, keep, options: OPTIONS[rung], family };

    return (children.get(null) ?? []).map((state) => buildBox(build, state));
  };

  const packAt = (rung: Exclude<Rung, 'tree'>, room: Size) =>
    pack(boxesAt(rung), room, OPTIONS[rung].small ? SMALL_METRICS : METRICS);

  const sizeAt = (rung: Rung, room: Size): Size =>
    rung === 'tree' ? { width: 0, height: 0 } : packAt(rung, room);

  // The ladder holds its rung across a resize only; a changed tree or selection starts from the top.
  const held = cached?.content === content ? host._rung : undefined;
  const rung = chooseRung(sizeAt, viewport, held);
  // The tree fallback still needs a packed tree to measure against on the next resize.
  const shown = rung === 'tree' ? 'small' : rung;
  const boxes = boxesAt(shown);
  const placed = packAt(shown, viewport);

  const layout = {
    rung,
    options: OPTIONS[shown],
    placed,
    rows: rowsOf(boxes, byName, children),
    open: new Set(openOf(boxes)),
  };

  host._rung = rung;
  cache.set(host, { content, key, layout });

  return layout;
};

// Edges

type EdgeStyle = 'ok' | 'redirect' | 'fault';

interface MapEdge extends RouteEdge {
  style: EdgeStyle;
}

const styleOf = (tx: Tx): EdgeStyle => {
  const outcome = tx.result?.outcome;

  if (outcome === 'error' || outcome === 'invalid') return 'fault';

  return outcome === 'redirected' ? 'redirect' : 'ok';
};

interface Wanted {
  from: string;
  to: string;
  style: EdgeStyle;
  count?: number;
}

// A selected transition shows its own edge and, for a redirect, a dashed one from its origin.
const txEdges = (host: UIRouterDevtools, tx: Tx): Wanted[] => {
  const origin = host._origin(tx);

  return [
    ...(origin
      ? [{ from: origin.from, to: origin.to, style: 'redirect' as const }]
      : []),
    { from: tx.from, to: tx.to, style: styleOf(tx) },
  ];
};

// A selected state shows the traffic it has seen, one edge per pair of states.
const stateEdges = (host: UIRouterDevtools, name: string): Wanted[] =>
  observedEdges(host._model).flatMap((edge) => {
    const count = edge.outcomes.success ?? 0;

    return count && (edge.from === name || edge.to === name)
      ? [{ from: edge.from, to: edge.to, style: 'ok' as const, count }]
      : [];
  });

const wantedEdges = (host: UIRouterDevtools): Wanted[] => {
  const tx = host._inspect === 'tx' ? host._tx(host._selectedTx) : undefined;

  if (tx) return txEdges(host, tx);

  return host._inspect === 'state' && host._selectedState
    ? stateEdges(host, host._selectedState)
    : [];
};

// Ends hidden in a collapsed box move to that box, and edges that now share a pair merge.
const mapEdges = (
  host: UIRouterDevtools,
  drawn: ReadonlySet<string>,
): MapEdge[] => {
  const parents = new Map(host._model.states.map((s) => [s.name, s.parent]));

  const end = (name: string) =>
    visibleEnd(
      name,
      (at) => parents.get(at),
      (at) => drawn.has(at),
    );

  const edges = new Map<string, MapEdge & { count: number }>();

  for (const wanted of wantedEdges(host)) {
    const from = end(wanted.from);
    const to = end(wanted.to);

    if (!from || !to) continue;

    const id = JSON.stringify([from.id, to.id, wanted.style]);
    const edge = edges.get(id);
    const count = (edge?.count ?? 0) + (wanted.count ?? 2);

    edges.set(id, {
      id,
      from: from.id,
      to: to.id,
      style: wanted.style,
      count,
      width: wanted.count ? edgeWeight(count) : 2,
      fromStub: edge?.fromStub || from.stub,
      toStub: edge?.toStub || to.stub,
    });
  }

  return [...edges.values()];
};

const routes = new WeakMap<
  UIRouterDevtools,
  { key: string; routed: (Routed & { edge: MapEdge })[] }
>();

const routeEdges = (
  host: UIRouterDevtools,
  layout: NestedLayout,
): (Routed & { edge: MapEdge })[] => {
  const rects = host._rects;

  if (!rects?.size) return [];

  const edges = mapEdges(host, new Set(rects.keys()));
  const key = JSON.stringify([[...rects], edges]);
  const cached = routes.get(host);

  if (cached?.key === key) return cached.routed;

  const parents = new Map(host._model.states.map((s) => [s.name, s.parent]));
  const head = (layout.options.small ? SMALL_METRICS : METRICS).head;

  const boxes: RouteBox[] = [...rects].map(([id, rect]) => ({
    id,
    parent: parents.get(id) ?? null,
    rect,
    head: Math.min(head, rect.height),
  }));

  const byId = new Map(edges.map((edge) => [edge.id, edge]));

  const routed = route(boxes, edges, {
    dpr: globalThis.devicePixelRatio || 1,
  }).map((r) => ({ ...r, edge: byId.get(r.id)! }));

  routes.set(host, { key, routed });

  return routed;
};

const renderEdge = ({
  edge,
  kind,
  d,
  head,
  caps,
}: Routed & { edge: MapEdge }) =>
  svg`<g class="nedge edge-${edge.style} w${edge.width ?? 1} ${kind === 'fallback' ? 'fallback' : ''}">
    <path class="halo" d=${d} /><path class="line" d=${d} />
    <path
      class="head"
      transform="translate(${head.x} ${head.y}) rotate(${head.angle})"
      d=${edge.style === 'redirect' ? 'M-7 -4L0 0L-7 4' : 'M0 0L-8 -4V4z'}
    />
    ${caps.map(
      (cap) =>
        svg`<path class="cap" d=${cap.upright ? `M${cap.x} ${cap.y - 5}v10` : `M${cap.x - 5} ${cap.y}h10`} />`,
    )}
  </g>`;

// Boxes

interface View {
  host: UIRouterDevtools;
  layout: NestedLayout;
  states: ReadonlyMap<string, StateInfo>;
  build: Build;
  /** A number per state, for the ids that tie a header to its group. */
  ids: ReadonlyMap<string, number>;
  focus: string | undefined;
  pivot: string | undefined;
  anchor: string | undefined;
}

const initialMark = svg`<svg class="initial" viewBox="0 0 20 12" width="20" height="12" aria-hidden="true">
  <circle cx="4" cy="6" r="3" /><path d="M4 6H13" /><path class="tip" d="M20 6l-8 -4v8z" />
</svg>`;

const growth = (placed: Placed): string =>
  `flex-grow:${Math.round(placed.width)}`;

const renderRows = (view: View, rows: Placed[][]): TemplateResult[] =>
  rows.map((row) => {
    const tall = Math.max(...row.map((cell) => cell.height));
    const leaves = row.every((cell) => cell.box && !cell.rows.length);

    return html`<div
      class="nrow"
      role="none"
      style="flex-grow:${leaves ? 0 : Math.round(tall)}"
    >
      ${row.map((cell) => renderCell(view, cell))}
    </div>`;
  });

const renderCell = (view: View, placed: Placed): TemplateResult =>
  placed.box
    ? renderBox(view, placed, placed.box)
    : html`<div class="nstack" role="none" style=${growth(placed)}>
        ${renderRows(view, placed.rows)}
      </div>`;

type Kind = 'open' | 'collapsed' | 'leaf';

// The header is the treeitem and owns the group beside it. A compound is labelled, since a name from content would take in the owned group.
const renderHead = (view: View, box: Box, state: StateInfo, kind: Kind) => {
  const { host, layout, build } = view;
  const role = host._role(state);
  const isPivot = role === 'retained' && state.name === view.pivot;
  const marks = stateMarks(state, host._model.states);
  const name = nameOf(state, layout.options);
  const full = segment(state.name);
  const current = state.name === host._model.current.name;
  const id = view.ids.get(box.name) ?? 0;

  const described = words(state, role, isPivot, marks);
  const hidden = countUnder(build, state.name);

  // A leaf is named by its own text; a label repeats the header's visible text, so the two never disagree.
  const labelled = kind === 'collapsed' ? `${full} ${hidden}` : full;
  const unlabelled = kind === 'leaf' && name === full;

  const description =
    kind === 'collapsed' ? `${described}, ${hidden} states inside` : described;

  /* oxlint-disable lit-a11y/role-supports-aria-attr -- aria-description is a global attribute in ARIA 1.3 */
  return html`<div
    class="head"
    role="treeitem"
    title=${state.name}
    tabindex=${box.name === view.focus ? 0 : -1}
    aria-label=${unlabelled ? nothing : labelled}
    aria-owns=${kind === 'open' ? `kids-${id}` : nothing}
    aria-expanded=${kind === 'leaf' ? nothing : kind === 'open' ? 'true' : 'false'}
    aria-current=${current ? 'true' : nothing}
    aria-selected=${host._selectedState === box.name}
    aria-description=${description}
  >
    ${label(state, role, isPivot, [], name)}${
      kind === 'collapsed'
        ? html` <span class="count num">${hidden}</span>`
        : nothing
    }${
      marks.length
        ? html`<span class="marks" aria-hidden="true"
            >${marks.map(
              (mark) =>
                html`<span class="mark" title=${markLabel(mark)}
                  >${markGlyph(mark.mark)}</span
                >`,
            )}</span
          >`
        : nothing
    }
  </div>`;
  /* oxlint-enable lit-a11y/role-supports-aria-attr */
};

const boxClasses = (
  view: View,
  placed: Placed,
  box: Box,
  state: StateInfo,
  kind: Kind,
): string =>
  [
    `role-${view.host._role(state)}`,
    facts(state, view.host._model.current.name),
    kind,
    view.host._selectedState === box.name && 'selected',
    box.merge && 'merging',
    placed.indent > 0 && 'merged',
    box.lead && 'led',
    box.name === view.anchor && 'anchor',
  ]
    .filter(Boolean)
    .join(' ');

const kindOf = (view: View, box: Box): Kind => {
  if (view.layout.open.has(box.name)) return 'open';

  return (view.build.children.get(box.name) ?? []).length
    ? 'collapsed'
    : 'leaf';
};

const renderBox = (view: View, placed: Placed, box: Box): TemplateResult => {
  const state = view.states.get(box.name)!;
  const kind = kindOf(view, box);

  const kids = box.merge
    ? renderCell(view, placed.rows[0][0])
    : renderRows(view, placed.rows);

  return html`<div
    role="none"
    class="box ${boxClasses(view, placed, box, state, kind)}"
    data-name=${box.name}
    style="${growth(placed)};--indent:${placed.indent}px"
  >
    ${box.lead ? initialMark : nothing}${renderHead(view, box, state, kind)}${
      kind === 'open'
        ? html`<div
            class="kids"
            role="group"
            id="kids-${view.ids.get(box.name) ?? 0}"
          >
            ${kids}
          </div>`
        : nothing
    }
  </div>`;
};

const boxName = (event: Event): string | undefined =>
  // SAFETY: the listeners sit on the tree, whose event targets are its own elements
  (event.target as Element).closest<HTMLElement>('.box')?.dataset.name;

const nestedKeys = (host: UIRouterDevtools, layout: NestedLayout) => ({
  expanded: (row: Row) => layout.open.has(row.state.name),
  toggle: (name: string, collapse: boolean) => {
    host._mapOpen = new Map([...host._mapOpen, [name, !collapse]]);
  },
});

/** The Map as statechart containment: a box per state, child states inside their parent. */
export const renderNested = (
  host: UIRouterDevtools,
  layout: NestedLayout,
): TemplateResult => {
  const { states, current } = host._model;
  const { rows, placed, options } = layout;
  const drawn = new Set(rows.map((row) => row.state.name));
  const parents = new Map(states.map((s) => [s.name, s.parent]));

  const focus =
    host._focusState && drawn.has(host._focusState)
      ? host._focusState
      : (rows.find((r) => r.state.name === current.name) ?? rows[0])?.state
          .name;

  const view: View = {
    host,
    layout,
    states: new Map(states.map((state) => [state.name, state])),
    ids: new Map(states.map((state, index) => [state.name, index])),
    build: {
      host,
      children: host._children(),
      keep: new Set(),
      options,
      family: '',
    },
    focus,
    pivot: host._focusTx?.retained.at(-1),
    anchor:
      host._anchorState === null
        ? undefined
        : visibleEnd(
            host._anchorState,
            (at) => parents.get(at),
            (at) => drawn.has(at),
          )?.id,
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && host._inspect !== 'none') {
      host._clearSelection();
      event.preventDefault();

      return;
    }

    onTreeKey(host, event, rows, focus, nestedKeys(host, layout));
  };

  const select = (event: Event) => {
    const name = boxName(event);

    if (name) host._selectState(name);
  };

  const focusIn = (event: Event) => {
    const name = boxName(event);

    if (name) host._focusState = name;
  };

  /* oxlint-disable lit-a11y/click-events-have-key-events -- the tree's keydown handler moves focus and selects for every treeitem */
  return html`<div
    class="nested ${options.small ? 'small' : ''}"
    role="tree"
    aria-label="State map"
    style="min-inline-size:${host._mapSize.width}px;min-block-size:${host._mapSize.height}px"
    @keydown=${onKey}
    @click=${select}
    @focusin=${focusIn}
  >
    ${renderCell(view, placed)}
    <svg class="nedges" aria-hidden="true">
      ${routeEdges(host, layout).map(renderEdge)}
    </svg>
  </div>`;
  /* oxlint-enable lit-a11y/click-events-have-key-events */
};
