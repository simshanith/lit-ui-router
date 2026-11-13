import { html, nothing, svg, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { Row, DevtoolsPanel } from './panel.ts';
import type { StateInfo } from '../schema.ts';
import { ancestorsOf, bareName, type Tx } from '../fold.ts';
import { edgesOf, edgeWeight } from '../edges.ts';
import { segment, truncateMiddle } from '../notation.ts';
import {
  depthClass,
  foldGlyph,
  markGlyph,
  markLabel,
  stateMarks,
  type StateMark,
} from './glyphs.ts';
import {
  chooseRung,
  drawnIn,
  fits,
  LARGE_METRICS,
  METRICS,
  pack,
  ROOMY_METRICS,
  SMALL_METRICS,
  type Box,
  type Drawn,
  type Metrics,
  type Placed,
  type Rung,
  type Size,
} from './pack.ts';
import { renderMinimap, viewKey } from './mapview.ts';
import {
  route,
  visibleEnd,
  type Rect,
  type RouteBox,
  type Routed,
  type RouteEdge,
} from './route.ts';
import { placeChips, type Chip } from './chips.ts';
import type { Avoid } from './popover.ts';
import { facts, label, onTreeKey, words } from './tree.ts';

const LEAD = 20;

/** How long boxes take to settle after a re-pack; edges draw once they have. */
const SETTLE = 200;

/** How long a withdrawn edge stays drawn. */
const WITHDRAW = 160;

const CHAR = 7.2;

interface Options {
  collapse: boolean;
  merge: boolean;
  truncate: boolean;
  metrics: Metrics;
}

const OPEN = { collapse: false, merge: false, truncate: false };

const SHUT = { collapse: true, merge: true, truncate: true };

const OPTIONS: Record<Rung, Options> = {
  large: { ...OPEN, metrics: LARGE_METRICS },
  roomy: { ...OPEN, metrics: ROOMY_METRICS },
  expanded: { ...OPEN, metrics: METRICS },
  collapsed: { ...OPEN, collapse: true, metrics: METRICS },
  merged: { ...SHUT, truncate: false, metrics: METRICS },
  truncated: { ...SHUT, metrics: METRICS },
  small: { ...SHUT, metrics: SMALL_METRICS },
  // Nothing fits, so the type stays the dock's, names stay whole and the viewport pans.
  pan: { ...SHUT, truncate: false, metrics: METRICS },
};

/** The type steps a diagram can be drawn at; zooming moves between them, so type and hairlines are never scaled. */
export const ZOOMS: readonly Metrics[] = [
  SMALL_METRICS,
  METRICS,
  ROOMY_METRICS,
  LARGE_METRICS,
];

/** How far a room's width over height may move from the one a layout was packed for before the layout is packed again. */
const REPACK_RATIO = 1.25;

const STEP = new Map([
  [LARGE_METRICS, 'large'],
  [ROOMY_METRICS, 'roomy'],
  [SMALL_METRICS, 'small'],
]);

/** How far the header's fixed parts are enlarged with the type; the caption rung keeps them. */
export const scaleOf = (metrics: Metrics): number =>
  Math.max(1, metrics.type / METRICS.type);

export interface NestedLayout {
  rung: Rung;
  options: Options;
  metrics: Metrics;
  placed: Placed;
  /** Every drawn box, relative to the diagram's origin; the edge router and the popover read these. */
  rects: ReadonlyMap<string, Rect>;
  /** Drawn boxes in tree order, for the arrow keys. */
  rows: Row[];
  /** Names of the compounds drawn with their children. */
  open: ReadonlySet<string>;
  /** The monospace face the labels were measured in. */
  family: string;
  rtl: boolean;
  /** The layout's place in `ZOOMS`. */
  step: number;
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
  host: DevtoolsPanel;
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
  merging: boolean,
): number => {
  const { host, options, family } = build;
  const size = options.metrics.type;
  const scale = scaleOf(options.metrics);
  const weight = state.name === host._model.current.name ? 700 : 400;
  const marks = stateMarks(state, host._model.states).length;
  const font = (w: number) => `${w} ${size}px ${family}`;

  // The count is measured like the name, so a header is never a fraction of a pixel short and elided.
  const count = collapsed
    ? 8 * scale + textWidth(String(countUnder(build, state.name)), font(400))
    : 0;

  const name = textWidth(nameOf(state, options), font(weight));

  // A merging header is the glyph, the name and the chevron that leads to the next one.
  if (merging) return Math.ceil(44 * scale + name);

  const fixed =
    36 +
    (marks ? 4 + marks * 16 : 0) +
    (state.future ? 40 : 0) +
    ((build.children.get(state.name) ?? []).length ? 20 : 0);

  // Padding, the glyph and its gap, then the name and whatever trails it.
  return Math.ceil(fixed * scale + name + count);
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
    if (!merge && state.redirectTo === bareName(child.name)) child.lead = LEAD;

  return {
    name: state.name,
    label: labelWidth(build, state, kids.length > 0 && !open, merge),
    merge,
    children,
  };
};

const keepOpen = (host: DevtoolsPanel): Set<string> => {
  const { states, current } = host._model;
  const tx = host._inspect === 'tx' ? host._tx(host._selectedTx) : undefined;
  const origin = tx && host._origin(tx);

  const names = [current.name, tx?.from, tx?.to, origin?.from, origin?.to];

  const keep = new Set<string>();

  for (const name of names) {
    if (!name) continue;
    keep.add(name);
    ancestorsOf(states, name).forEach((ancestor) => keep.add(ancestor));
  }

  // A selected box stays as it is drawn, so selecting moves nothing; only what hides it opens.
  if (host._selectedState)
    ancestorsOf(states, host._selectedState).forEach((a) => keep.add(a));

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
  DevtoolsPanel,
  { content: string; key: string; layout: NestedLayout; room: Size }
>();

const sameAspect = (a: Size, b: Size): boolean => {
  const ratio = (a.width * b.height) / Math.max(1, a.height * b.width);

  return ratio < REPACK_RATIO && ratio > 1 / REPACK_RATIO;
};

const rectsOf = (
  placed: Placed,
  metrics: Metrics,
  origin: { x: number; y: number },
  into: Map<string, Rect> = new Map(),
): Map<string, Rect> => {
  for (const item of drawnIn(placed, metrics)) {
    const at = { x: origin.x + item.x, y: origin.y + item.y };
    into.set(item.box.name, { ...at, width: item.width, height: item.height });
    rectsOf(item.placed, metrics, at, into);
  }

  return into;
};

// The diagram's own box: a single top-level state is drawn at the origin, several share it.
const allRects = (
  placed: Placed,
  metrics: Metrics,
  rtl: boolean,
): Map<string, Rect> => {
  const rects = new Map<string, Rect>();
  const origin = { x: 0, y: 0 };

  if (placed.box)
    rects.set(placed.box.name, {
      ...origin,
      width: placed.width,
      height: placed.height,
    });

  rectsOf(placed, metrics, origin, rects);

  // Boxes are placed from the inline start; the router works in physical coordinates.
  if (rtl)
    for (const [name, rect] of rects)
      rects.set(name, { ...rect, x: placed.width - rect.x - rect.width });

  return rects;
};

/**
 * Packs the state tree for the Map viewport, stepping down the fit ladder until it fits.
 * A resize that leaves the rung and the room's shape as they were keeps the layout, and only the view of it moves.
 */
export const layoutNested = (host: DevtoolsPanel): NestedLayout => {
  const { states, current } = host._model;
  const keep = keepOpen(host);
  const style = getComputedStyle(host);
  // State names are set in the monospace face, so that is the face measured.
  const family = style.getPropertyValue('--uird-font-mono');
  const rtl = style.direction === 'rtl';

  // The Map viewport is the scroller's content box; the panel's 12px padding is the diagram's outer margin.
  const viewport = host._mapSize;

  const children = host._children();

  // Only a compound without a hand-set fold can change the packing, so a selection that opens nothing keeps the layout.
  const opened = [...keep].filter(
    (name) => children.get(name)?.length && !host._mapOpen.has(name),
  );

  const content = JSON.stringify([
    states,
    current.name,
    opened,
    [...host._mapOpen],
    family,
    rtl,
    host._max,
    host._mapZoom,
  ]);

  const key = content + JSON.stringify(viewport);

  const cached = cache.get(host);

  if (cached?.key === key) return cached.layout;

  const boxesWith = (options: Options) => {
    const build = { host, children, keep, options, family };

    return (children.get(null) ?? []).map((state) => buildBox(build, state));
  };

  const sizeAt = (rung: Rung, room: Size): Size =>
    pack(boxesWith(OPTIONS[rung]), room, OPTIONS[rung].metrics);

  // The ladder holds its rung across a resize only; a changed tree or selection starts from the top.
  const same = cached?.content === content ? cached : undefined;
  const rung = chooseRung(sizeAt, viewport, same && host._rung, host._max);
  const zoom = host._mapZoom === null ? undefined : ZOOMS[host._mapZoom];

  host._rung = rung;

  if (
    same?.layout.rung === rung &&
    sameAspect(same.room, viewport) &&
    (zoom || rung === 'pan' || fits(same.layout.placed, viewport))
  ) {
    cache.set(host, { ...same, key });

    return same.layout;
  }

  // A zoomed diagram is packed for a room scaled with its type, so it keeps the arrangement the fitted one has.
  const options = zoom ? { ...OPTIONS[rung], metrics: zoom } : OPTIONS[rung];
  const scale = options.metrics.type / OPTIONS[rung].metrics.type;
  const boxes = boxesWith(options);

  const placed = pack(
    boxes,
    { width: viewport.width * scale, height: viewport.height * scale },
    options.metrics,
  );

  const byName = new Map(states.map((state) => [state.name, state]));

  const layout = {
    rung,
    options,
    metrics: options.metrics,
    placed,
    rects: allRects(placed, options.metrics, rtl),
    rows: rowsOf(boxes, byName, children),
    open: new Set(openOf(boxes)),
    family,
    rtl,
    step: ZOOMS.indexOf(options.metrics),
  };

  cache.set(host, { content, key, layout, room: viewport });

  return layout;
};

// Edges

type EdgeStyle = 'ok' | 'redirect' | 'fault';

interface MapEdge extends RouteEdge {
  style: EdgeStyle;
  /** Transitions seen along the line, and against it when it runs both ways; 0 for a selected transition's own edge. */
  count: number;
  back: number;
  /** The transition has not finished. */
  running?: boolean;
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
  running?: boolean;
}

// A selected transition shows its own edge and, for a redirect, a dashed one from its origin.
const txEdges = (host: DevtoolsPanel, tx: Tx): Wanted[] => {
  const origin = host._origin(tx);

  return [
    ...(origin
      ? [{ from: origin.from, to: origin.to, style: 'redirect' as const }]
      : []),
    { from: tx.from, to: tx.to, style: styleOf(tx), running: !tx.result },
  ];
};

// A selected state shows the traffic it has seen, one edge per pair of states.
const stateEdges = (host: DevtoolsPanel, name: string): Wanted[] =>
  edgesOf(host._model).flatMap((edge) => {
    const count = edge.outcomes.success ?? 0;

    return count && (edge.from === name || edge.to === name)
      ? [{ from: edge.from, to: edge.to, style: 'ok' as const, count }]
      : [];
  });

const wantedEdges = (host: DevtoolsPanel): Wanted[] => {
  const tx = host._inspect === 'tx' ? host._tx(host._selectedTx) : undefined;

  if (tx) return txEdges(host, tx);

  return host._inspect === 'state' && host._selectedState
    ? stateEdges(host, host._selectedState)
    : [];
};

// Ends hidden in a collapsed box move to that box, and edges that now share a pair merge.
const mapEdges = (
  host: DevtoolsPanel,
  drawn: ReadonlySet<string>,
): MapEdge[] => {
  const parents = new Map(host._model.states.map((s) => [s.name, s.parent]));

  const end = (name: string) =>
    visibleEnd(
      name,
      (at) => parents.get(at),
      (at) => drawn.has(at),
    );

  const edges = new Map<string, MapEdge>();

  for (const wanted of wantedEdges(host)) {
    const from = end(wanted.from);
    const to = end(wanted.to);

    if (!from || !to) continue;

    const id = JSON.stringify([from.id, to.id, wanted.style]);
    const edge = edges.get(id);

    edges.set(id, {
      id,
      from: from.id,
      to: to.id,
      style: wanted.style,
      count: (edge?.count ?? 0) + (wanted.count ?? 0),
      back: 0,
      running: wanted.running,
      fromStub: edge?.fromStub || from.stub,
      toStub: edge?.toStub || to.stub,
    });
  }

  const nested = (a: string, b: string) =>
    ancestorsOf(host._model.states, a).includes(b) ||
    ancestorsOf(host._model.states, b).includes(a);

  return twoWay([...edges.values()], nested).map((edge) => ({
    ...edge,
    width: edge.count ? edgeWeight(Math.max(edge.count, edge.back)) : 2,
  }));
};

// Opposite traffic between one pair shares a line with a head at each end, so a box has one port per neighbour.
// A compound and a box inside it keep an arrow each way: those are stubs, too short for two heads.
const twoWay = (
  edges: readonly MapEdge[],
  nested: (a: string, b: string) => boolean,
): MapEdge[] => {
  const byId = new Map(edges.map((edge) => [edge.id, edge]));

  return edges.flatMap((edge) => {
    const reverse = byId.get(JSON.stringify([edge.to, edge.from, edge.style]));

    if (!reverse || reverse === edge || nested(edge.from, edge.to))
      return [edge];

    // The pair is drawn once, from the end that sorts first.
    return edge.from > edge.to
      ? []
      : [
          {
            ...edge,
            both: true,
            back: reverse.count,
            fromStub: edge.fromStub || reverse.toStub,
            toStub: edge.toStub || reverse.fromStub,
          },
        ];
  });
};

type Drawing = Routed & { edge: MapEdge };

interface ChipPart {
  text: string;
  /** The way this count's traffic travels; a lone count has no arrow. */
  dir?: number;
  /** Where the part starts inside the chip. */
  x: number;
}

interface CountChip extends Chip {
  parts: ChipPart[];
}

interface Routes {
  routed: Drawing[];
  chips: CountChip[];
}

const routes = new WeakMap<
  DevtoolsPanel,
  Routes & { key: string; layout: NestedLayout }
>();

const CHIP = { height: 12, pad: 3, arrow: 6, gap: 4 };

const CHIP_FONT = '500 11px';

// A chip says how often a line was travelled, when more than once: one count, or one each way with its arrow.
const chipCounts = (
  { count, back, both }: MapEdge,
  dir: number,
): Omit<ChipPart, 'x'>[] => {
  if (Math.max(count, back) < 2) return [];

  if (!both) return [{ text: `×${count}` }];

  const forward = { text: String(count), dir };
  const against = { text: String(back), dir: (dir + 2) % 4 };

  // The count going west or north comes first.
  return dir >= 2 ? [forward, against] : [against, forward];
};

interface ChipText {
  parts: ChipPart[];
  width: number;
}

const chipParts = (edge: MapEdge, dir: number, family: string): ChipText => {
  let x = CHIP.pad - CHIP.gap;

  const parts = chipCounts(edge, dir).map((part) => {
    const start = x + CHIP.gap;

    x =
      start +
      (part.dir === undefined ? 0 : CHIP.arrow) +
      textWidth(part.text, `${CHIP_FONT} ${family}`);

    return { ...part, x: start };
  });

  return { parts, width: Math.ceil(x + CHIP.pad) };
};

const countChips = (
  routed: readonly Drawing[],
  boxes: readonly RouteBox[],
  family: string,
): CountChip[] => {
  const byId = new Map(routed.map((r) => [r.id, r.edge]));

  const wants = routed.flatMap(({ id, edge }) => {
    const { parts, width } = chipParts(edge, 0, family);

    return parts.length ? [{ id, width, height: CHIP.height }] : [];
  });

  return placeChips(routed, boxes, wants).map((chip) => ({
    ...chip,
    parts: chipParts(byId.get(chip.id)!, chip.dir, family).parts,
  }));
};

const routeEdges = (host: DevtoolsPanel, layout: NestedLayout): Routes => {
  const { rects } = layout;
  const edges = mapEdges(host, new Set(rects.keys()));
  const key = JSON.stringify(edges);
  const cached = routes.get(host);

  if (cached?.key === key && cached.layout === layout) return cached;

  const parents = new Map(host._model.states.map((s) => [s.name, s.parent]));

  const boxes: RouteBox[] = [...rects].map(([id, rect]) => ({
    id,
    parent: parents.get(id) ?? null,
    rect,
    head: Math.min(layout.metrics.head, rect.height),
  }));

  const byId = new Map(edges.map((edge) => [edge.id, edge]));

  const routed = route(boxes, edges, {
    dpr: globalThis.devicePixelRatio || 1,
  }).map((r) => ({ ...r, edge: byId.get(r.id)! }));

  const drawn = {
    routed,
    chips: countChips(routed, boxes, layout.family),
  };

  routes.set(host, { key, layout, ...drawn });

  return drawn;
};

interface Shown extends Routes {
  layout: NestedLayout;
  /** Edges no longer wanted, kept until they have withdrawn. */
  leaving: (Drawing & { until: number })[];
  /** Counts re-packs, so an edge that survives one is redrawn once its boxes have settled. */
  pass: number;
  timer?: ReturnType<typeof setTimeout>;
}

const shown = new WeakMap<DevtoolsPanel, Shown>();

interface EdgesToDraw extends Routes {
  leaving: Drawing[];
  /** The boxes were re-packed since the last render. */
  moved: boolean;
  pass: number;
}

// An edge that is no longer wanted withdraws before it goes; a re-pack drops it at once, since its boxes have moved.
const edgesToDraw = (
  host: DevtoolsPanel,
  layout: NestedLayout,
): EdgesToDraw => {
  const { routed, chips } = routeEdges(host, layout);
  const before = shown.get(host);
  const moved = before !== undefined && before.layout !== layout;
  const now = performance.now();
  const ids = new Set(routed.map((r) => r.id));

  const leaving =
    !before || moved
      ? []
      : [
          ...before.leaving.filter((r) => r.until > now),
          ...before.routed
            .filter((r) => !before.leaving.some((gone) => gone.id === r.id))
            .map((r) => ({ ...r, until: now + WITHDRAW })),
        ].filter((r) => !ids.has(r.id));

  const pass = (before?.pass ?? 0) + (moved ? 1 : 0);

  clearTimeout(before?.timer);

  shown.set(host, {
    layout,
    routed,
    chips,
    leaving,
    pass,
    timer: leaving.length
      ? setTimeout(() => host.requestUpdate(), WITHDRAW)
      : undefined,
  });

  return { routed, chips, leaving, moved, pass };
};

/** The drawn box that stands for the state the inspector popover sits beside. */
export const anchorRect = (
  host: DevtoolsPanel,
  layout: NestedLayout,
): Rect | undefined => {
  const parents = new Map(host._model.states.map((s) => [s.name, s.parent]));
  const name = host._anchorState;

  const end =
    name === null
      ? undefined
      : visibleEnd(
          name,
          (at) => parents.get(at),
          (at) => layout.rects.has(at),
        );

  return end && layout.rects.get(end.id);
};

/** What the inspector popover should keep clear of: first the drawn edges and the boxes they end at, then every pill. */
export const keepClear = (
  host: DevtoolsPanel,
  layout: NestedLayout,
): Avoid[] => {
  const pad = 6;

  const drawn = routeEdges(host, layout).routed.flatMap(({ edge, points }) => [
    ...[edge.from, edge.to].flatMap((id) => layout.rects.get(id) ?? []),
    ...points.slice(1).map((point, index) => {
      const prev = points[index];

      return {
        x: Math.min(prev.x, point.x) - pad,
        y: Math.min(prev.y, point.y) - pad,
        width: Math.abs(point.x - prev.x) + pad * 2,
        height: Math.abs(point.y - prev.y) + pad * 2,
      };
    }),
  ]);

  const pills = [...layout.rects].flatMap(([name, rect]) =>
    layout.open.has(name) ? [] : [rect],
  );

  return [
    ...drawn.map((rect) => ({ ...rect, weight: 20 })),
    ...pills.map((rect) => ({ ...rect, weight: 1 })),
  ];
};

// The mask draws an edge in from its start and withdraws it toward its end; the path runs to the arrowhead's tip.
const renderEdge = (
  { edge, kind, d, points, head, tail, caps }: Drawing,
  index: number,
  leaving: boolean,
  frame: Size,
) => {
  const id = `uird-edge-${leaving ? 'out' : 'in'}-${index}`;
  const reveal = `M${points.map((point) => `${point.x} ${point.y}`).join('L')}`;

  const tip =
    edge.style === 'redirect' ? 'M-6.5 -3.5L0 0L-6.5 3.5' : 'M0 0L-7 -3.5V3.5z';

  return svg`<g class="nedge edge-${edge.style} w${edge.width ?? 1} ${kind === 'fallback' ? 'fallback' : ''} ${edge.running ? 'running' : ''} ${leaving ? 'leaving' : ''}">
    <mask id=${id} maskUnits="userSpaceOnUse" x="-24" y="-24" width=${frame.width + 48} height=${frame.height + 48}>
      <path class="reveal" pathLength="1" d=${reveal} />
    </mask>
    <g mask="url(#${id})">
      <path class="halo" d=${d} /><path class="line" d=${d} />
      ${[head, ...(tail ? [tail] : [])].map(
        (at) =>
          svg`<path class="head" transform="translate(${at.x} ${at.y}) rotate(${at.angle})" d=${tip} />`,
      )}
      ${caps.map(
        (cap) =>
          svg`<path class="cap" d=${cap.upright ? `M${cap.x} ${cap.y - 4}v8` : `M${cap.x - 4} ${cap.y}h8`} />`,
      )}
    </g>
  </g>`;
};

const renderChip = ({ x, y, width, height, parts }: CountChip) =>
  svg`<g class="chip" transform="translate(${x} ${y})">
    <rect width=${width} height=${height} rx="2" />
    ${parts.map(
      (part) =>
        svg`${
          part.dir === undefined
            ? nothing
            : svg`<path transform="translate(${part.x + 2.5} ${height / 2}) rotate(${part.dir * 90})" d="M-2 -3L2 0L-2 3z" />`
        }<text x=${part.x + (part.dir === undefined ? 0 : CHIP.arrow)} y=${height / 2}>${part.text}</text>`,
    )}
  </g>`;

// Boxes

interface View {
  host: DevtoolsPanel;
  layout: NestedLayout;
  states: ReadonlyMap<string, StateInfo>;
  build: Build;
  /** A number per state, for the ids that tie a header to its group. */
  ids: ReadonlyMap<string, number>;
  /** Each state's depth in the declared tree, which its identity colour follows. */
  depths: ReadonlyMap<string, number>;
  focus: string | undefined;
  pivot: string | undefined;
}

const initialMark = svg`<svg class="initial" viewBox="0 0 20 12" width="20" height="12" aria-hidden="true">
  <circle cx="4" cy="6" r="3" /><path d="M4 6H13" /><path class="tip" d="M20 6l-8 -4v8z" />
</svg>`;

type Kind = 'open' | 'collapsed' | 'leaf';

const renderMarks = (marks: readonly StateMark[]) =>
  marks.length
    ? html`<span class="marks" aria-hidden="true"
        >${marks.map(
          (mark) =>
            html`<span class="mark" title=${markLabel(mark)}
              >${markGlyph(mark.mark)}</span
            >`,
        )}</span
      >`
    : nothing;

// The pointer's way to close or open a compound; the arrow keys do the same on the treeitem.
const renderFold = (
  view: View,
  box: Box,
  kind: Kind,
  chain: string | undefined,
) => {
  // A merged header has one button, at its end, and it closes the box the header belongs to.
  if (kind === 'leaf' || box.merge) return nothing;

  const open = kind === 'open';
  const target = chain ?? box.name;

  return html`<button
    class="fold"
    tabindex="-1"
    aria-label="${open ? 'Collapse' : 'Expand'} ${segment(target)}"
    title=${open ? 'Collapse' : 'Expand'}
    @click=${(event: Event) => {
      event.stopPropagation();
      nestedKeys(view.host, view.layout).toggle(target, open);
    }}
  >
    ${foldGlyph(open)}
  </button>`;
};

// The header is the treeitem and owns the group beside it. A compound is labelled, since a name from content would take in the owned group.
const renderHead = (
  view: View,
  box: Box,
  state: StateInfo,
  kind: Kind,
  chain: string | undefined,
) => {
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
    ${label(state, role, isPivot, [], name, false)}${
      kind === 'collapsed'
        ? // The space keeps the visible text the same as the label, "name count".
          html` <span class="count num">${hidden}</span>`
        : nothing
    }${renderMarks(marks)}${renderFold(view, box, kind, chain)}
  </div>`;
  /* oxlint-enable lit-a11y/role-supports-aria-attr */
};

const boxClasses = (view: View, item: Drawn, kind: Kind): string => {
  const { box, placed } = item;
  const state = view.states.get(box.name)!;

  return [
    `role-${view.host._role(state)}`,
    depthClass(view.depths.get(box.name) ?? 1),
    facts(state, view.host._model.current.name),
    kind,
    view.host._selectedState === box.name && 'selected',
    box.merge && 'merging',
    placed.indent > 0 && 'merged',
    box.lead && 'led',
  ]
    .filter(Boolean)
    .join(' ');
};

const kindOf = (view: View, box: Box): Kind => {
  if (view.layout.open.has(box.name)) return 'open';

  return (view.build.children.get(box.name) ?? []).length
    ? 'collapsed'
    : 'leaf';
};

// Boxes are keyed by state, so a re-pack moves an element instead of replacing it.
const renderBoxes = (view: View, placed: Placed, chain?: string) =>
  repeat(
    drawnIn(placed, view.layout.metrics),
    (item) => item.box.name,
    (item) => renderBox(view, item, chain),
  );

// `chain` names the outermost box of a merged header; the one fold button at its end closes that box.
const renderBox = (view: View, item: Drawn, chain?: string): TemplateResult => {
  const { box, placed } = item;
  const state = view.states.get(box.name)!;
  const kind = kindOf(view, box);

  return html`<div
    role="none"
    class="box ${boxClasses(view, item, kind)}"
    data-name=${box.name}
    style="inset-inline-start:${item.x}px;inset-block-start:${item.y}px;inline-size:${item.width}px;block-size:${item.height}px;--indent:${placed.indent}px"
  >
    ${box.lead ? initialMark : nothing}${renderHead(view, box, state, kind, chain)}${
      kind === 'open'
        ? html`<div
            class="kids"
            role="group"
            id="kids-${view.ids.get(box.name) ?? 0}"
          >
            ${renderBoxes(view, placed, box.merge ? (chain ?? box.name) : undefined)}
          </div>`
        : nothing
    }
  </div>`;
};

const boxName = (event: Event): string | undefined =>
  // SAFETY: the listeners sit on the tree, whose event targets are its own elements
  (event.target as Element).closest<HTMLElement>('.box')?.dataset.name;

const nestedKeys = (host: DevtoolsPanel, layout: NestedLayout) => ({
  expanded: (row: Row) => layout.open.has(row.state.name),
  toggle: (name: string, collapse: boolean) => {
    host._mapOpen = new Map([...host._mapOpen, [name, !collapse]]);
  },
});

/** The Map as statechart containment: a box per state, child states inside their parent. */
export const renderNested = (
  host: DevtoolsPanel,
  layout: NestedLayout,
): TemplateResult => {
  const { states, current } = host._model;
  const { rows, placed, options } = layout;
  const drawn = new Set(rows.map((row) => row.state.name));
  const { routed, chips, leaving, moved, pass } = edgesToDraw(host, layout);
  const frame = { width: placed.width, height: placed.height };

  const top: Drawn[] = placed.box
    ? [{ box: placed.box, placed, x: 0, y: 0, ...frame }]
    : [];

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
    depths: new Map(rows.map((row) => [row.state.name, row.depth])),
    focus,
    pivot: host._focusTx?.retained.at(-1),
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && host._inspect !== 'none') {
      host._clearSelection();
      event.preventDefault();

      return;
    }

    if (viewKey(host, layout, event)) {
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

    if (!name) return;
    host._focusState = name;

    // Focus that arrives by keyboard pans its box into view; a click never moves what is under the pointer.
    // SAFETY: the listener sits on the tree, whose event targets are its own elements
    if ((event.target as Element).matches(':focus-visible'))
      host._reveal(layout, name);
  };

  const room = host._room(layout);
  const at = host._viewOf(layout);
  // The tree is laid out at the room's inline start, so the view is taken from there.
  const from = layout.rtl ? room.width - placed.width : 0;

  /* oxlint-disable lit-a11y/click-events-have-key-events -- the tree's keydown handler moves focus and selects for every treeitem */
  return html`<div
      class="nested ${STEP.get(options.metrics) ?? ''}"
      role="tree"
      aria-label="State map"
      style="inline-size:${placed.width}px;block-size:${placed.height}px;translate:${at.x - from}px ${at.y}px"
      @keydown=${onKey}
      @click=${select}
      @focusin=${focusIn}
    >
      ${top.length ? renderBox(view, top[0]) : renderBoxes(view, placed)}
      <svg
        class="nedges"
        aria-hidden="true"
        style="--uird-edge-delay:${moved ? SETTLE : 0}ms"
      >
        ${repeat(
          routed,
          (r) => `${pass} ${r.id}`,
          (r, index) => renderEdge(r, index, false, frame),
        )}
        ${leaving.map((r, index) => renderEdge(r, index, true, frame))}
        ${repeat(
          chips,
          (chip) => `${pass} ${chip.id}`,
          (chip) => renderChip(chip),
        )}
      </svg>
    </div>
    ${renderMinimap(host, layout, at, room)}`;
  /* oxlint-enable lit-a11y/click-events-have-key-events */
};
