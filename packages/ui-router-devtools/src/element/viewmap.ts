// The Views' code, loaded on first use of the Views view so a panel that never shows it does not pay for it.
import { html, nothing, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { DevtoolsPanel } from './panel.ts';
import type { ViewFill, ViewInfo } from '../schema.ts';
import { ancestorsOf } from '../fold.ts';
import { truncateMiddle } from '../notation.ts';
import { targetText, viewTree, type ViewNode } from '../views.ts';
import { textWidth } from './measure.ts';
import {
  drawnIn,
  fits,
  METRICS,
  narrowestWidth,
  pack,
  RUNGS,
  type Box,
  type Drawn,
  type Metrics,
  type Placed,
  type Rung,
  type Size,
} from './pack.ts';
import type { NestedLayout } from './nested.ts';
import { fitView, type View } from './viewport.ts';

export { viewMapStyles } from './viewmap-styles.ts';

/** The Map's dock step, with room for a view's name and the state that fills it in one header. */
const VIEW_METRICS: Metrics = { ...METRICS, max: 320 };

const LONG = 28;

export interface ViewRow {
  node: ViewNode;
  setsize: number;
  posinset: number;
}

/** Views in tree order, for the arrow keys and the item numbering. */
export const viewRows = (nodes: readonly ViewNode[]): ViewRow[] =>
  nodes.flatMap((node, index) => [
    { node, setsize: nodes.length, posinset: index + 1 },
    ...viewRows(node.children),
  ]);

// A name that repeats in the tree, `$default` above all, is told apart by its path.
const repeatedNames = (views: readonly ViewInfo[]): Set<string> => {
  const seen = new Set<string>();
  const repeated = new Set<string>();

  for (const { name } of views) (seen.has(name) ? repeated : seen).add(name);

  return repeated;
};

interface Scene {
  host: DevtoolsPanel;
  repeated: ReadonlySet<string>;
  /** The states on the active path, and the root. */
  active: ReadonlySet<string>;
  focus: number | undefined;
  rows: ReadonlyMap<number, ViewRow>;
  /** The view drawn as selected. */
  selected: number | null;
  /** Views tied to the state selected beside them, on the Map. */
  linked: ReadonlySet<number>;
}

const viewName = (view: ViewInfo, scene: Pick<Scene, 'repeated'>): string =>
  scene.repeated.has(view.name) ? view.fqn : view.name;

const stateText = (state: string): string =>
  state ? truncateMiddle(state, LONG) : '(root)';

// A sticky state stays filling its views after it is left; such a fill is not on the active path.
const inactive = (fill: ViewFill | null, scene: Pick<Scene, 'active'>) =>
  Boolean(fill && !scene.active.has(fill.state));

/** What a view's item says: its name, what fills it, and whether that is on the active path. */
export const describeView = (
  view: ViewInfo,
  scene: Pick<Scene, 'repeated' | 'active'>,
): string => {
  const name = `${viewName(view, scene)} view`;

  if (!view.fill) return `${name}, empty`;

  return `${name}, filled by ${view.fill.state || 'the root'}${inactive(view.fill, scene) ? ', inactive' : ''}`;
};

interface Fonts {
  /** The face names are set in. */
  mono: string;
  /** The face the panel's own tags are set in. */
  sans: string;
}

// A tag is set in uppercase caption type tracked 0.08em.
const tagWidth = (text: string, { sans }: Fonts): number =>
  textWidth(text.toUpperCase(), `400 11px ${sans}`) + text.length * 0.88;

const labelWidth = (
  view: ViewInfo,
  scene: Pick<Scene, 'repeated' | 'active'>,
  fonts: Fonts,
): number => {
  const font = `400 ${VIEW_METRICS.type}px ${fonts.mono}`;

  const parts = [
    textWidth(viewName(view, scene), font),
    view.fill
      ? textWidth(stateText(view.fill.state), font)
      : tagWidth('Empty', fonts),
    ...(inactive(view.fill, scene) ? [tagWidth('Inactive', fonts)] : []),
  ];

  // Padding either side, and a gap between each part and the next.
  return Math.ceil(
    16 + 8 * (parts.length - 1) + parts.reduce((a, b) => a + b, 0),
  );
};

const boxOf = (
  node: ViewNode,
  scene: Pick<Scene, 'repeated' | 'active'>,
  fonts: Fonts,
): Box => ({
  name: String(node.view.id),
  label: labelWidth(node.view, scene, fonts),
  children: node.children.map((child) => boxOf(child, scene, fonts)),
});

const MIRRORED: ReadonlyMap<string, string> = new Map([
  ['ArrowLeft', 'ArrowRight'],
  ['ArrowRight', 'ArrowLeft'],
]);

// Up and down move in tree order, right into a view's first nested view and left to the view around it, as in the Outline.
const target = (
  key: string,
  rows: readonly ViewRow[],
  index: number,
): ViewRow | undefined => {
  const row = rows[index];

  switch (key) {
    case 'ArrowDown':
      return rows[index + 1];
    case 'ArrowUp':
      return rows[index - 1];
    case 'Home':
      return rows[0];
    case 'End':
      return rows.at(-1);
    case 'ArrowRight':
      return row?.node.children.length ? rows[index + 1] : undefined;
    default:
      return rows.find((each) => each.node.view.id === row?.node.parent);
  }
};

const MOVES = new Set([
  'ArrowDown',
  'ArrowUp',
  'Home',
  'End',
  'ArrowRight',
  'ArrowLeft',
]);

const onKey = (
  host: DevtoolsPanel,
  event: KeyboardEvent,
  rows: readonly ViewRow[],
  focus: number | undefined,
) => {
  const index = rows.findIndex((row) => row.node.view.id === focus);
  const rtl = getComputedStyle(host).direction === 'rtl';
  const key = (rtl && MIRRORED.get(event.key)) || event.key;

  if (key === 'Enter' || key === ' ') {
    if (focus !== undefined) host._selectView(focus);
  } else if (key === 'Escape' && host._viewSelected !== null)
    host._selectView(null);
  else if (MOVES.has(key)) {
    const next = target(key, rows, index);

    if (next) {
      host._viewFocus = next.node.view.id;
      host._moveFocus = true;
    }
  } else return;

  event.preventDefault();
};

const renderFill = (view: ViewInfo, scene: Scene) => {
  const { fill } = view;

  if (!fill) return html`<span class="tag">Empty</span>`;

  return html`<span
      class="name vm-fill ${scene.host._depthClass(fill.state)}"
      title=${fill.state || '(root)'}
      >${stateText(fill.state)}</span
    >${inactive(fill, scene) ? html`<span class="tag">Inactive</span>` : nothing}`;
};

/* oxlint-disable lit-a11y/click-events-have-key-events -- the tree's keydown handler moves focus and selects for every treeitem */
const renderHead = (scene: Scene, node: ViewNode) => {
  const { host } = scene;
  const { view } = node;
  const row = scene.rows.get(view.id);
  const compound = node.children.length > 0;

  return html`<div
    class="head"
    role="treeitem"
    title=${view.fqn}
    tabindex=${view.id === scene.focus ? 0 : -1}
    aria-label=${describeView(view, scene)}
    aria-level=${node.depth}
    aria-setsize=${row?.setsize ?? 1}
    aria-posinset=${row?.posinset ?? 1}
    aria-owns=${compound ? `vm-kids-${view.id}` : nothing}
    aria-expanded=${compound ? 'true' : nothing}
    aria-selected=${scene.selected === view.id}
    @click=${() => host._selectView(view.id)}
    @focus=${() => (host._viewFocus = view.id)}
    @pointerenter=${() => host._pointView(view.id)}
    @pointerleave=${() => host._pointView(null)}
  >
    <span class="name">${viewName(view, scene)}</span>${renderFill(view, scene)}
  </div>`;
};
/* oxlint-enable lit-a11y/click-events-have-key-events */

const boxClasses = (scene: Scene, view: ViewInfo, compound: boolean) =>
  [
    'box',
    compound ? 'open' : 'leaf',
    view.fill ? scene.host._depthClass(view.fill.state) : 'vacant',
    inactive(view.fill, scene) && 'inactive',
    scene.selected === view.id && 'selected',
    scene.linked.has(view.id) && 'linked',
  ]
    .filter(Boolean)
    .join(' ');

const renderBoxes = (
  scene: Scene,
  placed: Placed,
  nodes: ReadonlyMap<string, ViewNode>,
) =>
  repeat(
    drawnIn(placed, VIEW_METRICS),
    (item) => item.box.name,
    (item) => renderBox(scene, item, nodes),
  );

const renderBox = (
  scene: Scene,
  item: Drawn,
  nodes: ReadonlyMap<string, ViewNode>,
): TemplateResult => {
  const node = nodes.get(item.box.name)!;
  const compound = node.children.length > 0;

  return html`<div
    role="none"
    class=${boxClasses(scene, node.view, compound)}
    data-view=${node.view.id}
    style="inset-inline-start:${item.x}px;inset-block-start:${item.y}px;inline-size:${item.width}px;block-size:${item.height}px"
  >
    ${renderHead(scene, node)}${
      compound
        ? html`<div class="kids" role="group" id="vm-kids-${node.view.id}">
            ${renderBoxes(scene, item.placed, nodes)}
          </div>`
        : nothing
    }
  </div>`;
};

// A state named in the details; it selects that state on the Map beside the views, and in the Outline from the Views.
const stateLink = (host: DevtoolsPanel, name: string) =>
  name
    ? html`<button
        class="link ${host._depthClass(name)}"
        title=${name}
        @click=${() => host._showState(name)}
      >
        ${name}
      </button>`
    : '(root)';

type Fact = readonly [term: string, value: unknown];

export const facts = (host: DevtoolsPanel, view: ViewInfo): Fact[] => {
  const { fill } = view;
  // An imported session's page is not the recorded one, so it has no place to report.
  const place = host._imported ? undefined : host.viewLocator?.describe?.(view);

  return [
    ['Path', view.fqn],
    ['Type', view.type],
    ['Created in', stateLink(host, view.context)],
    ['Filled by', fill ? stateLink(host, fill.state) : 'nothing; empty'],
    ...(fill
      ? ([
          ['Declared', `views.${fill.view}`],
          ['Targets', targetText(fill)],
          ...(fill.component ? [['Component', fill.component] as const] : []),
        ] as const)
      : []),
    ...(place === undefined
      ? []
      : ([['On page', place ?? 'not found']] as const)),
  ];
};

const renderDetail = (host: DevtoolsPanel, view: ViewInfo | undefined) => {
  if (!view) return nothing;

  return html`<section
    class="vm-detail"
    tabindex="0"
    aria-labelledby="h-vm-detail"
  >
    <h3 class="insp-title" id="h-vm-detail">
      <span class="name">${view.name}</span>
    </h3>
    <dl class="facts">
      ${facts(host, view).map(
        ([term, value]) =>
          html`<dt>${term}</dt>
            <dd>${value}</dd>`,
      )}
    </dl>
  </section>`;
};

// Configs no view took: their content is declared active and is nowhere on the page.
const renderUnmatched = (host: DevtoolsPanel, unmatched: readonly ViewFill[]) =>
  unmatched.length
    ? html`<section class="vm-unmatched" aria-labelledby="h-vm-unmatched">
        <h3 class="section sub" id="h-vm-unmatched">
          <span class="title">No view took</span>
        </h3>
        <ul class="plain">
          ${unmatched.map(
            (fill) =>
              html`<li>
                ${stateLink(host, fill.state)}<span class="muted">
                  views.${fill.view} → ${targetText(fill)}</span
                >
              </li>`,
          )}
        </ul>
      </section>`
    : nothing;

const activeStates = (host: DevtoolsPanel): Set<string> => {
  const { states, current } = host._model;

  return new Set(['', current.name, ...ancestorsOf(states, current.name)]);
};

/** The details column, which stands beside the boxes once the Views are this wide; `viewmap-styles.ts` sets both. */
const DETAIL = 296;

const BESIDE = 720;

// Below the drawing in the same room: the configs no view took.
const footOf = (host: DevtoolsPanel): number => feet.get(host) ?? 0;

const feet = new WeakMap<DevtoolsPanel, number>();

/** Measures what sits under the drawing, and draws again once when it changed, so the drawing centres in the room above it. */
export const measureViewMap = (host: DevtoolsPanel): void => {
  const list = host.renderRoot.querySelector<HTMLElement>('.vm-unmatched');

  const foot = list ? Math.ceil(list.getBoundingClientRect().height) : 0;

  if (foot === footOf(host)) return;
  feet.set(host, foot);
  host.requestUpdate();
};

interface Layout {
  placed: Placed;
  view: View;
}

interface Drawing {
  roots: ViewNode[];
  rows: ViewRow[];
  scene: Scene;
  nodes: ReadonlyMap<string, ViewNode>;
}

const drawingOf = (
  host: DevtoolsPanel,
  views: readonly ViewInfo[],
  selected: number | null,
  linked: ReadonlySet<number> = new Set(),
): Drawing => {
  const roots = viewTree(views);
  const rows = viewRows(roots);

  const scene: Scene = {
    host,
    repeated: repeatedNames(views),
    active: activeStates(host),
    focus:
      rows.find((row) => row.node.view.id === host._viewFocus)?.node.view.id ??
      rows[0]?.node.view.id,
    rows: new Map(rows.map((row) => [row.node.view.id, row])),
    selected,
    linked,
  };

  const nodes = new Map(
    rows.map((row) => [String(row.node.view.id), row.node]),
  );

  return { roots, rows, scene, nodes };
};

const fontsOf = (host: DevtoolsPanel): Fonts => {
  const style = getComputedStyle(host);

  return {
    mono: style.getPropertyValue('--uird-font-mono'),
    sans: style.getPropertyValue('--uird-font'),
  };
};

const packViews = (
  { roots, scene }: Drawing,
  fonts: Fonts,
  room: Size,
): Placed =>
  pack(
    roots.map((root) => boxOf(root, scene, fonts)),
    room,
    VIEW_METRICS,
  );

// Margins are logical, so the view is taken as left to right and mirrors with the page.
const centred = (placed: Placed, room: Size & { reserve: number }): View =>
  fitView(placed, { ...room, slack: 0, foot: 0, rtl: false });

// The Views' container, whose width puts the details beside the boxes; before it is drawn, the room it will hold.
const containerOf = (host: DevtoolsPanel, width: number, margin: number) =>
  host.renderRoot.querySelector('.views-scroll')?.clientWidth ??
  width + margin * 2;

/**
 * Packs the views for the room they are drawn in and places them as the Map's fitted view does: in the middle on an
 * axis they fit, at the start of one they overflow. Where the dock puts the details beside the boxes, the drawing is
 * packed for the room they leave and placed in the whole room as it is before a view is selected, in the middle
 * while their column stays free, else as near it as keeps the column free, so selecting one moves nothing.
 */
const layoutOf = (host: DevtoolsPanel, drawing: Drawing): Layout => {
  const margin = parseFloat(
    getComputedStyle(host).getPropertyValue('--uird-margin'),
  );

  const { width } = host._mapSize;
  const container = containerOf(host, width, margin);
  const beside = container >= BESIDE;
  // Beside the details the room is the container's, which a selection leaves as it was.
  const whole = beside ? container - margin * 2 : width;
  const height = Math.max(0, host._mapSize.height - footOf(host));

  const placed = packViews(drawing, fontsOf(host), {
    width: beside ? whole - DETAIL : width,
    height,
  });

  // As the Map keeps the popover's column: centred while it is free either side, past that the end margin goes first.
  const reserve = beside
    ? Math.max(0, Math.min(DETAIL, DETAIL * 2 - (whole - placed.width)))
    : 0;

  return { placed, view: centred(placed, { width: whole, height, reserve }) };
};

const renderTree = (
  host: DevtoolsPanel,
  { rows, scene, nodes }: Drawing,
  { placed, view }: Layout,
  label: string,
) =>
  html`<div
    class="nested vm-boxes"
    role="tree"
    aria-labelledby=${label}
    style="inline-size:${placed.width}px;block-size:${placed.height}px;margin-inline-start:${view.x}px;margin-block-start:${view.y}px"
    @keydown=${(event: KeyboardEvent) => onKey(host, event, rows, scene.focus)}
  >
    ${
      placed.box
        ? renderBox(
            scene,
            {
              box: placed.box,
              placed,
              x: 0,
              y: 0,
              width: placed.width,
              height: placed.height,
            },
            nodes,
          )
        : renderBoxes(scene, placed, nodes)
    }
  </div>`;

/** The router's `ui-view`s as nested boxes, each named with what fills it, and the selected view's details. */
export const renderViewMap = (host: DevtoolsPanel): TemplateResult => {
  const snapshot = host._model.views;

  if (!snapshot) return html`<p class="empty">This session holds no views.</p>`;

  const drawing = drawingOf(host, snapshot.views, host._viewSelected);

  const selected = snapshot.views.find(
    (view) => view.id === host._viewSelected,
  );

  return html`<div class="viewmap" ?data-detail=${Boolean(selected)}>
    <div class="vm-main">
      ${
        drawing.rows.length
          ? renderTree(host, drawing, layoutOf(host, drawing), 'h-states')
          : html`<p class="empty">No ui-view is registered with the router.</p>`
      }
      ${renderUnmatched(host, snapshot.unmatched)}
    </div>
    ${renderDetail(host, selected)}
  </div>`;
};

/** The split's two rooms: the state Map's at the inline start, and the views' after it. */
export interface Split {
  /** The rung the states are drawn at beside the views. */
  rung: Rung;
  states: Size;
  views: Size;
}

/** Room the two sides share beyond their drawings, half to each; a drawing centred in its side may stand nearer the rule. */
const GAP = 48;

/** The share of the room a resize must leave to spare before the split takes a milder step back, as the fit ladder does. */
const RESTORE = 0.1;

/** The last rung the states step down to beside the views: the Map's own floor before it pans. */
const FLOOR = RUNGS.indexOf('small');

/** The step a hidden split stands at, past every rung. */
const HIDDEN = RUNGS.length;

// Everything the answer is weighed from: the room, the panel it is in, and what each rung tried leaves.
interface Weighed extends Size {
  /** The dock, or the maximised panel, whose room is measured a frame after a switch. */
  docked: boolean;
  /** The whole room's rung, where the steps start. */
  from: Rung;
  /** What both drawings leave at each rung tried, mildest first, up to the one chosen. */
  extras: readonly number[];
  /** The rung chosen, as its place in `RUNGS`, or `HIDDEN`. */
  chosen: number;
  // Weighed for a changed column in a room still measured for the old one, so the next size is weighed afresh too.
  fresh: boolean;
}

const weighed = new WeakMap<DevtoolsPanel, Weighed>();

const narrowViews = new WeakMap<object, { key: string; width: number }>();

// A snapshot is replaced, never changed, so its list keys the cache.
const viewsWidth = (
  host: DevtoolsPanel,
  views: readonly ViewInfo[],
  height: number,
  max: number,
): number => {
  const fonts = fontsOf(host);
  const drawing = drawingOf(host, views, null);
  const key = JSON.stringify([height, max, fonts, [...drawing.scene.active]]);
  const known = narrowViews.get(views);

  if (known?.key === key) return known.width;

  const width = narrowestWidth((at) => {
    const room = { width: at, height };

    return fits(packViews(drawing, fonts, room), room);
  }, max);

  narrowViews.set(views, { key, width });

  return width;
};

// The ResizeObserver measures the new column's room in the frame after its first weigh; past that frame, a weigh at
// another size is a resize.
const settle = (host: DevtoolsPanel, first: Weighed) =>
  requestAnimationFrame(() =>
    setTimeout(() => {
      const now = weighed.get(host);

      if (
        now?.fresh &&
        now.docked === first.docked &&
        now.width === first.width &&
        now.height === first.height
      )
        weighed.set(host, { ...now, fresh: false });
    }),
  );

type Room = Size & { docked: boolean; from: Rung };

/** A step of the ladder chosen, and what each rung tried on the way to it leaves. */
interface Step {
  chosen: number;
  extras: number[];
}

// The first rung that leaves room, trying each down to the floor; one milder than `held` needs `restore` to spare.
const firstFit = (
  extraAt: (rung: number) => number,
  from: number,
  held: number,
  restore: number,
): Step => {
  const extras: number[] = [];

  for (let rung = from; rung <= FLOOR; rung++) {
    const extra = extraAt(rung);

    extras.push(extra);

    if (extra >= (rung < held ? restore : 0)) return { chosen: rung, extras };
  }

  return { chosen: HIDDEN, extras };
};

// Read again with nothing changed it keeps its answer; a resize of the same panel takes a milder step back only with
// room to spare, and the dock and the maximised panel each weigh it afresh, up to the first size measured for them.
const choose = (
  host: DevtoolsPanel,
  now: Room,
  extraAt: (rung: number) => number,
): number => {
  const last = weighed.get(host);
  const from = RUNGS.indexOf(now.from);
  const panel = last?.docked === now.docked;
  const sized = panel && last.width === now.width && last.height === now.height;
  const moved = last !== undefined && !panel;
  const fresh = moved || (sized && last.fresh);
  const held = panel && !sized && !last.fresh ? last.chosen : 0;

  const same =
    sized &&
    last.from === now.from &&
    last.extras.every((extra, index) => extra === extraAt(from + index));

  const next = same
    ? { chosen: last.chosen, extras: last.extras }
    : firstFit(extraAt, from, held, now.width * RESTORE);

  const entry = { ...now, ...next, fresh };

  weighed.set(host, entry);

  if (moved) settle(host, entry);

  return next.chosen;
};

/**
 * The rooms of the split where the views fit beside the state Map, else `null`. The states take the mildest rung from
 * the whole room's down to the Map's floor that leaves the views their natural size. No popover column is kept: the
 * dock's popover takes its column only where the drawings leave it free.
 */
export const splitOf = (
  host: DevtoolsPanel,
  whole: NestedLayout,
  docked: boolean,
): Split | null => {
  const views = host._model.views?.views ?? [];

  if (!views.length || whole.rung === 'pan' || host._mapZoom !== null)
    return null;

  const { width, height } = host._mapSize;

  const head = parseFloat(
    getComputedStyle(host).getPropertyValue('--uird-row'),
  );

  const room = height - head;
  const free = width - GAP;
  const drawn = viewsWidth(host, views, room, free);
  // SAFETY: the panel weighs a split only for a layout the Map's module packed
  const map = host._map!;

  const statesAt = (rung: number) =>
    map.narrowest(host, whole, room, RUNGS[rung]);

  const chosen = choose(
    host,
    { width, height, docked, from: whole.rung },
    (rung) => free - statesAt(rung) - drawn,
  );

  if (chosen === HIDDEN) return null;

  const states = statesAt(chosen);
  const extra = free - states - drawn;
  const side = states + Math.floor((extra + GAP) / 2);

  return {
    rung: RUNGS[chosen],
    states: { width: side, height: room },
    views: { width: width - side, height: room },
  };
};

/** The view map beside the state Map: each side in its own labelled region, centred in its own room. */
export const renderSplit = (
  host: DevtoolsPanel,
  split: Split,
  states: TemplateResult,
): TemplateResult => {
  // SAFETY: a split is weighed only for a snapshot that holds views
  const { views } = host._model.views!;
  const selected = host._inspect === 'view' ? host._viewSelected : null;
  const state = host._inspect === 'state' ? host._selectedState : null;

  const linked = new Set(
    views.flatMap((view) => (view.fill?.state === state ? [view.id] : [])),
  );

  const drawing = drawingOf(host, views, selected, linked);

  const placed = packViews(drawing, fontsOf(host), split.views);

  const layout = {
    placed,
    view: centred(placed, { ...split.views, reserve: 0 }),
  };

  return html`<section class="split-side" aria-labelledby="h-split-states">
      <h3 class="section sub" id="h-split-states">
        <span class="title">States</span>
      </h3>
      ${states}
    </section>
    <section class="split-side vm-side" aria-labelledby="h-split-views">
      <h3 class="section sub" id="h-split-views">
        <span class="title">Views</span>
      </h3>
      ${renderTree(host, drawing, layout, 'h-split-views')}
    </section>`;
};

/** The view selected beside the Map, in the panel's own inspector. */
export const renderViewInspector = (host: DevtoolsPanel): TemplateResult => {
  // SAFETY: the panel drops a view selection when its view leaves the snapshot
  const { views } = host._model.views!;
  const view = views.find((each) => each.id === host._viewSelected)!;

  return html`<div class="inspector vm-inspector">
    <p class="insp-title">
      <span class="name"
        >${viewName(view, { repeated: repeatedNames(views) })}</span
      >
    </p>
    <dl class="facts">
      ${facts(host, view).map(
        ([term, value]) =>
          html`<dt>${term}</dt>
            <dd>${value}</dd>`,
      )}
    </dl>
  </div>`;
};
